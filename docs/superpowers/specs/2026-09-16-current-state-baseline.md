# 灵山 AI 导览历史状态基线（已被后续证据包取代）

> 本文是 2026-09-16 的历史审计快照，不是当前实现的状态声明。后续已完成 Scene State、确定性路线规划、Hybrid/RRF 检索、Fact Contract 修复、Trace 状态修复和竞赛证据刷新；当前权威结果请以 `docs/competition/evaluation-report.md`、`docs/ablation_report.md`、`evaluation/results/baseline_20260917_020000/` 和 `evaluation/results/ablation_20260917_013925/` 为准。

日期：2026-09-16  
用途：场景创新赛道后续改造的事实基线。本文只记录当前 Git 工作区、实际代码、运行时探针和已有评测，不把设计目标当作已实现能力。

## 1. Git 基线与工作区

- 原工作区：`E:/Projects/lingshan-ai-guide-Mao123-doc`
- 原分支：`codex/evaluation-baseline`
- 原稳定检查点：`27f38464527114922ea971fca722dde800bb958a`
- 当前隔离 worktree：`E:/Projects/lingshan-ai-guide-Mao123-doc/.worktrees/codex-scene-agent-upgrade`
- 当前分支：`codex/scene-agent-upgrade`
- 当前 HEAD：`79a05b4a3ca141c3137d1d17cebf7d442a3c094a`
- 远端：`https://github.com/Mao123-doc/lingshan-ai-guide.git`
- 当前 `git status --short --branch`：`## codex/scene-agent-upgrade`
- `git diff --check`：通过
- 本次隔离准备提交：`79a05b4 chore: ignore local worktrees`
- 原工作区和当前 worktree 均未发现未提交业务代码修改。

## 2. 当前系统结构

### 2.1 启动与 API

根目录 `package.json` 的 `build` 依次执行 frontend 和 backend build；Backend 入口为 `backend/src/index.ts`，默认监听 8010，健康检查为 `/health`。游客 API 在 `backend/src/api/v1/visitor.ts`，问答入口为 `POST /api/v1/visitor/qa`。

非流式问答的实际调用链是：

`visitor.ts:122-229` 接收 `query/session_id/evaluation_config`，生成或复用 session → `queryRAG` → 返回 `answer/retrieved_chunks/evaluation_trace`，并保存会话。

### 2.2 当前 RAG 链

当前 RAG 由 `backend/src/services/rag-service.ts` 实现：

1. `rewriteQueryWithTrace`（约 551-598 行）在 LLM 可用且问题满足条件时改写口语查询；失败时返回原查询并记录 trace。
2. `searchChunksWithTrace`（约 366-460 行）按顺序尝试 Vector → Structured → Keyword。
3. Vector 有结果时直接返回，Structured 和 Keyword 被标记为 `skipped`；只有 Vector 无结果时才进入 Structured，再无结果才进入 Keyword。
4. 因此当前 `Full Retrieval` 是有优先级的 fallback 链，不是三路并行召回、融合或 RRF。`configured=true` 不代表该层实际执行。
5. `rerankChunksWithTrace`（约 613 行以后）使用 LLM 对候选块重排；候选数不足、LLM 不可用或开关关闭时记录跳过状态。
6. Context builder 将最终 chunks 组成发送给 LLM 的上下文；Conversation History 由内存中的 `sessionHistory` 保存，`addToHistory` 每个 session 最多保留 `MAX_HISTORY` 条消息，并受 TTL/会话数量清理。

### 2.3 当前结构化数据与向量服务

- `backend/src/services/structured-knowledge.ts` 在启动时建立字段级索引；本次健康检查报告 22 个景点、176 个字段文档。
- `backend/src/services/vector-search-service.ts` 调用 `http://127.0.0.1:8002`。
- `backend/python/vector_service.py` 使用 ChromaDB 和 `BAAI/bge-large-zh-v1.5`，本次实际启动建立 48 个 chunks（13 guide + 35 dataset）。
- Backend 初始化时另保存 57 个 RAG chunks 到本地缓存；这与向量服务的 48 个索引 chunks 不是同一个统计口径，后续报告必须分别标注。

## 3. 路线推荐现状

`backend/src/api/v1/visitor.ts:276-312` 定义 `INTEREST_ROUTES` 静态景点数组；`/recommend`（约 314-360 行）根据兴趣选择一组预设景点，再按总时长截断为 2/4/6 小时层级。

当前实现没有：

- 景点节点和道路边数据；
- 起点、终点或实时位置约束；
- 步行距离/可达性计算；
- 营业时间、演出时间窗约束；
- 不可行性检测、路线求解器或路线验证器。

因此当前 `/recommend` 是兴趣模板 + 时长截断，不是真实路径规划。评测题 #37/#38 能检查景点事实覆盖，但不能证明路线顺序、可达性、时间窗可行或推荐合理。

前端 `frontend/src/pages/visitor/HomePage.tsx` 还包含静态景点/坐标展示和浏览器定位读取；这不等于后端路线引擎已接入真实地图路径。

## 4. 评测、测试与历史结果

### 4.1 现有测试

- Python：`backend/python/tools/test_accuracy.py`、`test_accuracy_unit.py`、`test_ablation_runner.py`。
- TypeScript：`backend/src/services/rag-config.test.ts`、`rag-trace.test.ts`。
- 本次重新运行：Python 28 个测试通过；RAG config/trace 2 个测试通过。
- Backend build 和 frontend build 通过。
- frontend lint 失败于当前已有代码，共 75 errors、3 warnings，主要包括既有 `any`、React refresh、hook/purity 规则问题；本阶段未修改这些文件。

### 4.2 评测输入与评分含义

评测输入为 `backend/python/tools/test_questions.json` 的 50 题，每题包含 Fact Contract。`backend/python/tools/run_ablation.py` 生成 profile/session，调用 `POST /api/v1/visitor/qa`，保存回答、trace、retrieved chunks、evaluation 和 latency。

`backend/python/tools/test_accuracy.py` 以 required fact groups、`min_fact_hits`、forbidden facts 和 refusal 状态评分。当前 Accuracy 的含义是：50 道固定问题中，最终 Fact Contract `passed` 的比例；它不是通用问答准确率，也不是事实错误率、幻觉率或路线质量分。

### 4.3 已有消融结果

来源：`docs/ablation_report.md`，每个 profile 50 题，共 350 次真实 API 调用。

| Profile | Accuracy | Fact Recall | Avg Latency |
| --- | ---: | ---: | ---: |
| Vector Only | 86.0% | 0.905 | 2543.96 ms |
| Structured Only | 62.0% | 0.697 | 2432.66 ms |
| Keyword Only | 84.0% | 0.908 | 2318.14 ms |
| Full Retrieval | 84.0% | 0.902 | 2923.54 ms |
| Vector + Rerank | 86.0% | 0.922 | 3019.94 ms |
| Full - Rerank | 84.0% | 0.895 | 2365.80 ms |
| Full - Rewrite | 74.0% | 0.802 | 2411.82 ms |

这些结果只能作为当前数据集和当前实现的历史观察。尤其 `Full Retrieval` 不能被描述为 hybrid fusion；后续实验需要先把每层执行、召回和融合定义清楚。

## 5. 数据资产与数据风险

当前 `data/raw` 包含：

- `knowledge_dataset.txt`（53,360 bytes）
- `knowledge_guide.txt`（16,892 bytes）
- 两个灵山景点/历史文化 DOCX
- `景点景区旅游数据行为分析数据.xlsx`（16.7 MB）

代码实际用于 RAG 的主要文本是 TXT；DOCX 主要是归档/上传来源，XLSX 有上传和结构化处理支持，但当前没有证据证明该 XLSX 是灵山真实运营数据。

只读审计得到：XLSX 约 140,447 行、17 列，日期覆盖 2025-01-01 至 2025-12-31，152 个景点、8 个类型，字段无空值、重复行 0；`灵山/梵宫/九龙灌浴` 关键词匹配约 522 行。文件缺少来源、授权、采集口径和脱敏证明。因此后续对外材料不得把它表述为真实灵山游客行为数据，除非补齐来源和授权证据。

## 6. 运行时基线

本次在隔离 worktree 中使用根目录 `.env` 的进程环境变量启动，未输出密钥，也未把 `.env` 复制进 worktree。

### Vector Service

命令：`python backend/python/vector_service.py`  
结果：成功；实际加载 `BAAI/bge-large-zh-v1.5`，建立 48 chunks，监听 `127.0.0.1:8002`。  
健康响应：`{"status":"ok","chunks":48,"model":"BAAI/bge-large-zh-v1.5"}`。

### Backend

命令：`npm run dev`（进程环境中注入根目录 `.env` 的非输出配置）  
结果：成功；实际识别 `deepseek-chat (DeepSeek)`。  
健康响应：

```json
{"status":"ok","llm":"deepseek-chat (DeepSeek)","knowledge_chunks":57,"knowledge_indexed":true,"vector_search":true,"structured_spots":22,"structured_fields":176}
```

第一次启动尝试因环境变量 `PORT` 被解析为空而出现 `options.port ... NaN`；随后显式设置 `PORT=8010` 重启成功。这是启动注入方式问题，不是源码构建问题。

## 7. Phase 0 Gate 结论

1. **Full Retrieval 是否真正 fusion？** 否。当前是 Vector → Structured → Keyword 的有结果即返回 fallback 链。
2. **路线是否是真正 path planning？** 否。当前是静态兴趣路线数组和时长截断，没有路径、时间窗和不可行性求解。
3. **当前 accuracy 测量什么？** 固定 50 题上 Fact Contract 通过比例；不能外推为通用准确率、幻觉率或路线质量。
4. **已有测试是什么？** Python evaluator/ablation runner 单元测试、RAG config/trace 测试、TypeScript/Python build；frontend lint 当前有既有失败。
5. **哪些设计内容尚未在仓库实现？** 并行混合召回与 RRF、Scene State、路线图数据契约与 validator、确定性路线求解、解释链、运营知识缺口闭环，以及真实地图/演出/设施数据治理。

## 8. 后续边界

Phase 1 必须先建立可复现 retrieval benchmark：冻结现有 50 题及其数据 hash，增加 gold retrieval 标注和 Recall@1/3/5、MRR@5、no-result、p50/p95，并保存原始结果和配置。Phase 1 完成并通过 Gate 后，才能进入并行 hybrid retrieval 或路线引擎实现。

本基线不承诺任何未测量的竞赛效果，不把静态路线称为导航，不把未知来源数据称为真实运营数据，也不把配置状态称为实际执行状态。
