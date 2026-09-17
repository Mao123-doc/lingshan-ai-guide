# 竞赛展示级 Live2D 数字人设计规范

**状态：** 已批准进入实施计划

**日期：** 2026-09-17

**目标分支基线：** `master@6284f755bb9bd29b97c6bf86351e5f15d1e75007`

## 1. 目标与成功定义

本项目需要把当前“回答时主要显示静态图片”的数字人升级为竞赛展示级实时角色。最终的「灵小禅」必须根据用户与系统所处场景执行可解释、可重复验证的表情和动作，并与 TTS 语音、口型、用户打断保持同步。

成功不是“画面会动”，而是完成以下闭环：

```text
用户输入 / API 结果 / 音频播放状态
  → 受控场景事件
  → 确定性动作状态机
  → Live2D Motion + Expression
  → TTS 时间线 + 音量驱动口型
  → 可追踪、可打断、可降级的浏览器渲染
```

本功能不得改变 RAG 检索、回答生成、路线规划或 Fact Contract 的算法语义。数字人只消费既有结果和新增的展示元数据。

## 2. 当前事实与根因

当前代码已经包含 Live2D、情绪映射、TTS viseme 和待机动作逻辑，但实际资源与运行时不匹配：

- `frontend/public/models/hibiki/hibiki.model.json` 引用 `.moc`、`.mtn`，属于 Cubism 2 资源；
- `frontend/index.html` 只加载 `live2dcubismcore.min.js`，这是 Cubism 3/4 Runtime；
- `Live2DCanvas.tsx` 在缺少 Cubism 2 全局运行时时调用 `onError`；
- `DigitalHuman.tsx` 接到错误后显示静态 PNG fallback；
- 现有四套“外观风格”只是静态图片，Live2D 始终指向 Hibiki，人物身份并不一致；
- `QAPage.tsx` 直接维护 `idle/listening/thinking/speaking` 与 emotion，缺少独立的动作状态机；
- TTS 的 viseme 时间当前按总时长平均分配中文字符，无法代表真实停顿和语速。

因此最终方案不继续扩展 Hibiki。Hibiki 仅可作为诊断 fixture；竞赛版本使用一个拥有明确授权、与产品视觉一致的 Cubism 4「灵小禅」模型。

## 3. 选定方案

采用以下组合：

1. 自有授权的 Cubism 4 Live2D「灵小禅」模型；
2. 前端确定性 Avatar Controller；
3. 后端返回受控 presentation hint，而不是让 LLM 输出任意动作 ID；
4. Web Audio 时间源驱动口型和中断；
5. 静态角色图作为明确可观测的降级路径；
6. 管理后台提供动作、表情、口型和 fallback 诊断。

不采用透明视频作为主渲染，因为视频无法自然组合动作、表情、口型和用户打断。不采用 3D VRM/Unity，因为当前 Web 技术栈、移动端性能和实施周期不支持其风险。

## 4. 边界与模块职责

### 4.1 Model Manifest

模型清单负责定义可用资源，不包含业务判断。

```ts
export type AvatarMotionId =
  | 'idle_a'
  | 'idle_b'
  | 'greeting_wave'
  | 'listening_focus'
  | 'thinking'
  | 'explain_a'
  | 'explain_b'
  | 'point_left'
  | 'point_right'
  | 'affirm_nod'
  | 'warning'
  | 'apology'
  | 'farewell';

export type AvatarExpressionId =
  | 'neutral'
  | 'smile'
  | 'focused'
  | 'thinking'
  | 'serious'
  | 'sorry';

export interface AvatarModelManifest {
  id: 'lingxiaochan-v1';
  modelUrl: '/models/lingxiaochan/lingxiaochan.model3.json';
  fallbackImageUrl: string;
  motions: Record<AvatarMotionId, { group: string; index: number }>;
  expressions: Record<AvatarExpressionId, number>;
}
```

只有 Manifest 中声明的 motion 和 expression 才能被执行。

### 4.2 Presentation Contract

后端输出受控场景，不输出 Live2D 资源路径或任意字符串动作。

```ts
export type AvatarScene =
  | 'greeting'
  | 'fact_explanation'
  | 'culture_story'
  | 'route_guidance'
  | 'recommendation'
  | 'warning'
  | 'apology'
  | 'farewell';

export interface PresentationHint {
  avatar_scene: AvatarScene;
  emphasis?: 'left' | 'right' | 'none';
}
```

Presentation Hint 由确定性规则根据请求和已有结构化结果生成。规则无法判断时使用 `fact_explanation`。该字段不进入 Prompt，也不参与检索、排序、上下文或答案生成。

### 4.3 Avatar Controller

Controller 是纯状态机，输入事件，输出当前渲染指令。

```ts
export type AvatarState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'failed';

export type AvatarEvent =
  | { type: 'SESSION_STARTED' }
  | { type: 'LISTENING_STARTED' }
  | { type: 'LISTENING_STOPPED' }
  | { type: 'REQUEST_STARTED' }
  | { type: 'ANSWER_READY'; scene: AvatarScene; emphasis: 'left' | 'right' | 'none' }
  | { type: 'PLAYBACK_STARTED'; scene: AvatarScene; emphasis: 'left' | 'right' | 'none'; playbackToken: string }
  | { type: 'PLAYBACK_ENDED'; playbackToken: string }
  | { type: 'PLAYBACK_INTERRUPTED'; playbackToken: string }
  | { type: 'REQUEST_FAILED' }
  | { type: 'SESSION_ENDED' };

export interface AvatarRenderState {
  state: AvatarState;
  scene: AvatarScene;
  motion: AvatarMotionId;
  expression: AvatarExpressionId;
  speaking: boolean;
  sequence: number;
  playbackToken: string | null;
}
```

Controller 不访问 DOM、PIXI、AudioContext、网络或 React state，因此可以通过单元测试完整验证。

### 4.4 Live2D Renderer

Renderer 只负责：

- 加载 Cubism 4 模型；
- 播放 Controller 指定的 motion；
- 应用 expression；
- 接收 mouth open/form 参数；
- 汇报 `loading/ready/fallback/failed`；
- 卸载时释放模型、纹理、Ticker、RAF 和定时器。

Renderer 不判断当前是路线、文化讲解还是错误场景。

### 4.5 Speech Timeline

Speech Timeline 使用同一个 `AudioContext.currentTime` 作为播放与口型时钟。每个 viseme 包含：

```ts
export interface VisemeCue {
  time_ms: number;
  duration_ms: number;
  viseme_id: number;
  viseme_name: 'rest' | 'aa' | 'e' | 'i' | 'o' | 'u';
  shape: { w: number; h: number };
}
```

TTS 服务应优先使用实际 boundary 时间；无法得到 boundary 时可以使用明确标注的 `estimated` 时间线。前端把 viseme shape 与音量包络组合：viseme 决定嘴型，音量决定开合幅度。超过 250ms 的无声区间必须闭嘴。

## 5. 动作状态与优先级

优先级从高到低：

1. `interrupted`：立即停止语音、嘴型和当前主动作；
2. `failed/apology`：覆盖普通回答动作；
3. `speaking`：根据 scene 播放受控主动作；
4. `thinking`：请求期间循环低频思考动作；
5. `listening`：语音识别期间保持专注；
6. `idle`：呼吸、眨眼和低频自然动作。

动作映射：

| 状态/场景 | Motion | Expression | 规则 |
| --- | --- | --- | --- |
| 会话开始 | `greeting_wave` | `smile` | 每个 session 一次 |
| 待机 | `idle_a`/`idle_b` | `neutral` | 8–15 秒低频切换 |
| 聆听 | `listening_focus` | `focused` | 识别结束前持续 |
| 思考 | `thinking` | `thinking` | 请求完成或失败时结束 |
| 事实讲解 | `explain_a` | `focused` | 每 8–12 秒最多一个主动作 |
| 文化故事 | `explain_b` | `smile` | 句段边界触发 |
| 路线指引 | `point_left/right` | `focused` | emphasis 决定方向 |
| 推荐完成 | `affirm_nod` | `smile` | 一次后回讲解 |
| 条件警告 | `warning` | `serious` | 不与开心表情组合 |
| 抱歉/错误 | `apology` | `sorry` | 一次后保持 `sorry` |
| 告别 | `farewell` | `smile` | 每个 session 一次 |

相同场景允许在明确的 motion variants 中轮换，但必须使用 session seed，保证测试可重复。禁止直接使用 `Math.random()` 选择业务动作。

## 6. 资源合同

正式模型目录：

```text
frontend/public/models/lingxiaochan/
  lingxiaochan.model3.json
  lingxiaochan.moc3
  lingxiaochan.physics3.json
  textures/
  expressions/
  motions/
  LICENSE.md
  manifest.json
```

必须包含：

- 13 个 Manifest motion；
- 6 个 expression；
- `ParamEyeLOpen`、`ParamEyeROpen`；
- `ParamEyeBallX`、`ParamEyeBallY`；
- `ParamAngleX`、`ParamAngleY`、`ParamAngleZ`；
- `ParamBodyAngleX`；
- `ParamMouthOpenY`、`ParamMouthForm`；
- `ParamBreath`；
- 头发、衣袖、饰品物理参数；
- 允许比赛展示、录屏、GitHub 发布和项目部署的授权说明。

资源门禁脚本必须检查文件存在、JSON 可解析、动作/表情清单完整、单文件不超过 GitHub 100MB 限制。超过 20MB 的二进制资源应通过 Git LFS 管理。

## 7. 前后端数据流

### 7.1 问答

```text
QAPage 用户输入
  → REQUEST_STARTED
  → /visitor/qa
  → RAG/LLM 生成原答案（保持不变）
  → presentation-policy 根据 query/answer/emotion 产生 PresentationHint
  → ANSWER_READY
  → TTS 请求
  → PLAYBACK_STARTED
  → Avatar Controller + Speech Timeline
  → PLAYBACK_ENDED / PLAYBACK_INTERRUPTED
```

### 7.2 路线

路线结果不需要 LLM 决定动作：

- `feasible` → `recommendation`；
- `feasible_with_rejected_preferences` → `warning`；
- `needs_clarification` → `listening` UI 状态，不自动讲话时保持 focused；
- `infeasible` → `warning`；
- 路线步骤讲解 → `route_guidance`。

### 7.3 图片识别与错误

- 图片上传开始 → `thinking`；
- 识别成功 → `fact_explanation`；
- 低置信度/无法识别 → `apology`；
- 网络、TTS、LLM 错误 → `REQUEST_FAILED`；
- 静态 fallback 仍显示正确状态文案，不伪装为 Live2D ready。

## 8. UI 与管理后台

游客端只显示用户能够理解的状态：待机、聆听中、思考中、讲解中、已暂停。Renderer 诊断不直接展示给游客。

管理后台增加诊断面板：

- Renderer 状态和模型版本；
- 动作、表情逐项播放；
- TTS/口型测试；
- 当前 state/scene/motion/expression；
- FPS、模型加载耗时；
- fallback 原因；
- reduced-motion 模式。

后台不得保存 Manifest 中不存在的动作或表情。

## 9. 降级与错误处理

降级顺序：

```text
Live2D ready
  → WebGL/模型失败：品牌静态图 + CSS 呼吸 + 正确状态文案
  → 静态图失败：文字/Emoji 占位
```

降级不得阻止问答、路线或 TTS。`fallback` 必须通过回调和诊断面板暴露原因，例如：

- `webgl_unavailable`；
- `runtime_missing`；
- `model_fetch_failed`；
- `model_contract_invalid`；
- `renderer_init_failed`。

`prefers-reduced-motion: reduce` 下停止大幅身体动作、粒子和高频背景动画，保留必要状态反馈与低幅口型。

## 10. 测试策略

### 10.1 单元测试

- Controller 的全部事件转换；
- 动作优先级和中断；
- Scene → Motion/Expression 映射；
- Manifest 校验；
- Presentation Policy；
- Speech Timeline cue 选择、停顿闭嘴和结束复位。

### 10.2 组件测试

- Live2D ready 后隐藏静态 fallback；
- renderer error 后显示静态图和回调原因；
- motion/expression props 改变时调用对应 adapter；
- unmount 后销毁 renderer；
- reduced-motion 时不播放主动作；
- QAPage 的 listening/thinking/speaking/interrupted 行为。

### 10.3 E2E

覆盖十个核心场景：欢迎、待机、语音聆听、思考、事实回答、文化讲解、路线指引、不可行提醒、错误抱歉、播放打断。

E2E 通过稳定的 `data-avatar-*` 属性读取状态，不通过截图像素猜测业务状态。视觉回归截图作为补充证据。

### 10.4 人工验收

- Chrome/Edge 桌面；
- Android 视口；
- iPhone 视口；
- WebGL 禁用；
- reduced-motion；
- 正常网络与慢速网络；
- 连续 10 轮问答；
- 连续进入/离开页面 20 次。

## 11. 量化验收标准

| 指标 | 门槛 |
| --- | ---: |
| 正常环境 Live2D ready | 100% |
| 十类场景动作命中 | 10/10 |
| 桌面 FPS P5 | ≥ 50 FPS |
| 中端手机 FPS P5 | ≥ 30 FPS |
| 状态到动作响应 | ≤ 200ms |
| 用户打断到闭嘴/停动作 | ≤ 300ms |
| 有声区间口型激活率 | ≥ 90% |
| 口型/音频 P95 偏差 | ≤ 150ms |
| 超过 250ms 停顿闭嘴 | 100% |
| 局域网模型首次 ready | ≤ 3s |
| 10 轮对话内存增长 | ≤ 20% |
| 20 次页面挂载后的额外 Canvas | 0 |
| 浏览器未处理异常 | 0 |
| 核心 E2E | 10/10 |

FPS、加载耗时和内存需要在固定设备/浏览器版本下记录，报告必须注明设备与版本。自动化环境无法稳定测量的视觉指标由人工量表和录屏证据补充，不能用“看起来正常”代替数字。

## 12. 竞赛展示脚本

一分钟数字人闭环：

1. 页面进入，灵小禅挥手欢迎；
2. 用户开始语音输入，角色前倾聆听；
3. 请求发送后进入思考状态；
4. 回答文化问题时同步口型并执行解释动作；
5. 提问路线时执行方向指引；
6. 给出不可能约束时切换提醒动作和严肃表情；
7. 用户在回答中点击停止，角色 300ms 内闭嘴并回到待机/聆听；
8. 后台打开 Action Trace，展示每个动作来自受控状态机而不是随机视频。

展示用语：

> 灵小禅的动作不是预录视频，也不是由大模型任意控制。系统把用户交互、回答类型、路线结果和语音播放映射到受控状态机，因此动作可解释、可中断、可测试，并能在失败时安全降级。

## 13. 非目标

本阶段不建设：

- 3D 数字人、Unity 或 VRM；
- 全身动作捕捉；
- 摄像头面部追踪；
- 由 LLM 生成自定义动画；
- 多角色切换；
- 让数字人改变 RAG、路线或评测结论；
- 为四套静态皮肤分别制作四套 Live2D 模型。

## 14. 发布门禁

只有同时满足以下条件，功能才可进入竞赛演示分支：

1. 模型授权和资源合同通过；
2. 所有单元、组件、后端契约和 E2E 测试通过；
3. TypeScript build、Frontend lint/build、Backend build、`git diff --check` 通过；
4. 十类动作场景全部人工确认；
5. 性能指标达到第 11 节门槛；
6. WebGL 禁用和 TTS 失败时问答仍可用；
7. 录屏中没有静态 fallback 冒充动态模型；
8. PR 包含模型版本、授权、性能设备、测试输出和已知限制。
