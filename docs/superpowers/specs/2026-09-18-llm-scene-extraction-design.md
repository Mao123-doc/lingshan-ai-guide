# LLM 场景结构化抽取设计

## 目标

为场景约束路线规划增加自然语言理解层，使用户可以使用口语、同义表达和间接时间表达描述旅行需求；LLM 只负责抽取结构化场景，现有确定性路线规划器继续负责路线计算和可行性校验。

## 当前问题

当前 `/api/v1/visitor/route/plan` 接收用户文本后直接调用 `extractSceneState()`。该函数主要依赖正则表达式，能够识别有限关键词，但无法稳定处理“我和对象一起”“陪家里老人”“从早上十点玩到下午五点”“还有两小时想看四点演出”等自然改写。

当前路线算法本身已经承担确定性职责：时间预算、路网、开放时间、行动能力、演出时间和路线校验。不能用 LLM 直接生成景点顺序或时间，否则会破坏可验证性。

## 设计原则

1. LLM 只做 `query -> partial SceneState` 的语义抽取，不做路线规划。
2. 所有 LLM 输出必须经过 JSON 解析、Zod Schema 校验和语义校验后才能进入路线算法。
3. LLM 不可用、超时、输出非法或置信度不足时，自动回退到现有规则抽取。
4. 回退必须被记录为 `fallback`，不能伪装成 LLM 成功。
5. LLM 与规则结果冲突且无法依据用户明确表达解决时，不猜测，转为缺失信息或冲突追问。
6. 现有 `planRoute()` 和 `validateRoute()` 继续作为唯一的路线执行与验收入口。
7. 不修改 Retrieval、Query Rewrite、Rerank、知识库、Top-K 和 Evaluation Fact Contract。

## 总体数据流

```text
用户自然语言
  -> route/plan API
  -> rule extraction（现有解析器）
  -> LLM scene extraction（若可用）
  -> merge + conflict resolution
  -> SceneStateSchema / semantic validation
  -> deterministic planRoute
  -> validateRoute
  -> route response + extraction trace
```

规则抽取先执行，作为 LLM 的参考和可靠回退。LLM 成功时以明确表达和通过校验的 LLM 字段为主；规则结果用于补全、校验和发现冲突。

## 场景抽取契约

新增抽取结果类型，不让 API 直接接收任意模型对象：

```ts
interface SceneExtractionResult {
  state: Partial<SceneState>;
  source: 'llm' | 'rules' | 'fallback' | 'merged';
  confidence: Record<string, number>;
  missingFields: string[];
  conflicts: string[];
  trace: {
    configured: boolean;
    executed: boolean;
    status: 'success' | 'fallback' | 'failed' | 'skipped';
    model?: string;
    latencyMs?: number;
    fallbackUsed: boolean;
    reason?: string;
  };
}
```

场景字段至少包括：

- `currentLocation`
- `currentTime`
- `remainingMinutes`
- `partyType`
- `mobility`
- `mealRequested`
- `interests`
- `mustVisitSpotIds`
- `preferredPerformanceIds`
- `preferredPerformanceTimes`
- `visitedSpotIds`

LLM 不直接输出内部景点 ID 也不强制模型记忆路线图。模型可以输出用户提到的地点和演出名称，服务层负责通过已有别名和结构化数据映射为内部 ID；无法映射时保留为冲突或缺失。

## LLM 抽取规则

系统 prompt 要求：

- 只输出 JSON，不输出解释文字；
- 只填写用户明确表达或可以直接计算得到的字段；
- 不猜测当前时间、地点、演出时间和餐厅位置；
- 时间范围可以计算出开始时间和时长；
- “还有三小时、想看下午两点演出”可以在明确语义成立时计算当前时间为 11:00；
- 对无法确定的字段返回 `null`，不得填入默认值；
- 每个字段提供 0 到 1 的置信度。

temperature 固定为 0 或项目约定的最低值，限制最大 token，使用现有 `callLLMWithMetadata()`，不新增第二套 HTTP 客户端。

## 合并与冲突规则

### 优先级

1. 用户明确表达的值；
2. 规则解析直接得到的值；
3. LLM 推断并通过语义校验的值；
4. 可计算值；
5. 缺失并追问。

### 示例

```text
用户：“我和女朋友一起”
结果：partyType=couple
```

```text
用户：“从早上10点玩到下午5点”
结果：currentTime=10:00, remainingMinutes=420
```

```text
用户：“还有3小时，想看2点的吉祥颂”
结果：currentTime=11:00, remainingMinutes=180, performanceTime=14:00
```

```text
用户：“现在10点，但下午2点才开始游览”
结果：记录 currentTime 冲突，不自动覆盖，要求用户确认。
```

## 回退策略

以下任一条件成立时使用现有规则解析：

- LLM 未配置；
- LLM 请求超时或网络失败；
- LLM 返回空内容；
- JSON 解析失败；
- Schema 校验失败；
- 关键字段置信度低于约定阈值；
- LLM 返回路线、景点顺序等越权字段。

回退结果仍必须经过 `SceneStateSchema` 和路线 validator。回退不是错误，但必须在 Trace 和 API 内部调试字段中标记。

## API 行为

`POST /api/v1/visitor/route/plan` 保持请求格式兼容：

```json
{
  "query": "我和对象从上午10点玩到下午5点，想轻松游览",
  "scene_state": {}
}
```

响应继续返回 `scene_state`、`route`、`outcome`、`explanation` 和 `evidence`，新增或扩展 `scene_extraction`：

```json
{
  "scene_extraction": {
    "source": "llm",
    "configured": true,
    "executed": true,
    "status": "success",
    "fallback_used": false,
    "confidence": {
      "partyType": 0.98
    }
  }
}
```

现有显式 `scene_state` 仍可覆盖抽取结果，但必须经过 Schema 校验。任何覆盖字段应在内部 trace 中可追踪。

## 前端行为

普通游客界面不显示 `configured`、`executed` 等内部术语，只根据 API 的 `outcome` 和 `clarification` 展示自然语言。

调试或竞赛演示模式可以显示：

- 场景理解来源：模型理解 / 自动回退；
- 缺少的信息；
- 是否存在冲突；
- 路线是否由确定性引擎验证通过。

## 测试策略

### 单元测试

覆盖：

- 标准表达；
- 同义表达；
- 口语表达；
- 时间范围；
- 间接时间推断；
- 情侣、朋友、老人、儿童；
- 午餐意图；
- 演出名称和时间；
- 已访问景点；
- LLM 空响应、非法 JSON、Schema 错误和超时；
- LLM 与规则冲突。

### 基准集

建立至少 30 条自然语言变体，按字段记录 gold contract。每个核心字段至少有 5 种表达方式。

验收门槛：

- 关键字段抽取准确率不低于 95%；
- 当前地点、当前时间、剩余时长不能静默错判；
- LLM 失败时规则 fallback 可运行；
- 所有路线都经过 `planRoute()` 和 `validateRoute()`；
- LLM 不可用时不能标记为 `source=llm`；
- 现有 Scene/Route benchmark 不回归。

### 端到端测试

至少验证：

1. 规范表达得到可执行路线；
2. 同义改写得到相同核心 SceneState；
3. LLM 关闭时仍能规划旧样本；
4. LLM 输出非法 JSON 时自动 fallback；
5. 冲突输入进入追问，不生成未经确认的路线；
6. 路线结果中的步行时间、开放时间和演出时间通过 validator。

## 分阶段交付

### 阶段 0：基线冻结

记录当前测试、API 响应和典型失败样本。验收标准是修改前后基线可比较。

### 阶段 1：契约和合并器

实现抽取结果类型、Schema、规则/LLM 合并和冲突检测，但默认仍使用规则结果。验收标准是非法结果不能进入路线规划。

### 阶段 2：LLM 抽取器

接入现有 LLM 服务，实现 JSON-only prompt、解析、校验、超时和 fallback。验收标准是抽取 benchmark 达到 95%，失败路径可复现。

### 阶段 3：路线 API 接入

将 API 接入抽取层，保持 `planRoute()` 和 `validateRoute()` 不变。验收标准是路线只接受校验后的 SceneState。

### 阶段 4：Trace 和前端状态

增加场景抽取 Trace，前端展示用户可理解的追问和回退提示。验收标准是 configured/executed/status/fallback 状态真实一致。

### 阶段 5：验收和提交

执行 Python evaluator、Scene/Route tests、TypeScript build、前端测试、端到端 API 测试和 `git diff --check`。全部通过后单独提交。

## 非目标

本设计不包含：

- LLM 直接生成路线；
- 修改 RAG 检索、重排和 Prompt；
- 修改知识库内容；
- 增加餐饮知识数据；
- 修改 Evaluation Fact Contract；
- 通过提高模型温度或扩大输出长度解决识别问题。
