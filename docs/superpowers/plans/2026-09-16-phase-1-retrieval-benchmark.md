# Phase 1：可复现 Retrieval Benchmark 实现计划

## 目标

在任何新的 hybrid retrieval、RRF 或路线引擎改造之前，建立一个可复现的检索基线，回答：当前问题集需要哪些证据块、各检索层是否召回了这些证据、延迟和空召回如何变化。

本阶段不改变问答 Prompt、LLM、Fact Contract、路线推荐、Top-K 默认值或生产 API 语义；只增加离线评测所需的标注、runner、指标和结果归档。

## 约束与输入冻结

1. 冻结 `backend/python/tools/test_questions.json` 当前内容，记录文件 SHA-256。
2. 冻结当前知识源文件的相对路径和 SHA-256：`data/raw/knowledge_guide.txt`、`data/raw/knowledge_dataset.txt`；DOCX/XLSX 是否纳入评测必须在配置中显式声明，不能隐式使用。
3. 每个 gold evidence 标注必须指向实际知识源中的 chunk/source ID，并保留人工依据；不能只复制 expected keywords 作为 gold evidence。
4. 运行结果目录使用 `evaluation/results/<timestamp>/`，至少保存配置、问题 hash、数据 hash、gold 标注版本、逐题原始输出和汇总指标。
5. 不把 API 调用失败、空召回或无法标注的题目静默删除；均需保留状态和原因。

## 工作包

### 1. 建立 gold retrieval schema

新增版本化标注文件，例如 `backend/python/tools/retrieval_gold.json`，每题至少包含：

- `question_id`
- `gold_source_ids`
- `gold_source_paths`
- `annotation_status`
- `annotation_note`

对无法从当前知识源可靠定位的题目标记 `unresolved`，不强行造标注。先完成 50 题覆盖率盘点，再决定是否允许 benchmark 只对 `resolved` 子集计算。

### 2. 建立离线 retrieval runner

优先复用现有 `run_ablation.py` 的 session/config/trace 保存习惯，但单独保存 retrieval benchmark 结果。runner 必须记录：

- Git SHA；
- 问题集和知识源 hash；
- 完整 RAG config；
- 每题 original/rewrite query；
- vector/structured/keyword 的 configured、executed、status、result count；
- returned chunk IDs、scores、source；
- rerank 前后顺序；
- latency 和错误；
- evaluator 不参与 retrieval 指标计算。

默认先运行现有 Full Retrieval fallback 配置，避免把评测工具本身和后续 hybrid 实现混在一起。

### 3. 实现检索指标

对 `resolved` 题目计算，并同时报告分母和 unresolved 数量：

- Recall@1、Recall@3、Recall@5；
- MRR@5；
- no-result rate；
- vector/structured/keyword 各自真实执行率与空召回率；
- rerank reorder rate；
- p50/p95 latency；
- API failure rate。

指标必须按题目类别和 source 类型分组，不能只给一个总平均。若一题有多个 gold evidence，明确采用“至少命中一个”还是“命中全部”的定义，并在 schema 中固定。

### 4. 添加确定性单元测试

至少覆盖：

- hash 和结果目录命名；
- gold 标注缺失/重复/非法 source ID；
- Recall/MRR 边界值；
- 空召回与 API 失败不计为成功；
- configured 与 executed 分离；
- rerank 改变顺序时指标使用最终或初始结果的定义；
- unresolved 题目不进入 resolved 分母，但会进入覆盖率报告。

### 5. 生成基线报告

报告必须引用保存的 raw JSON，而不是手填数字。至少包含：

- Git SHA；
- dataset/source hash；
- 配置；
- 标注覆盖率；
- 总体和分类指标；
- 空召回/失败题清单；
- 三层真实执行状态；
- 与现有 Fact Contract Accuracy 的关系和区别。

## 实施顺序

1. 先写 schema/parser/metric 的失败单元测试。
2. 加入最小 gold 标注样例和校验器，运行 RED → GREEN。
3. 对 50 题做只读人工标注审计，报告 resolved/unresolved，不修改知识库内容。
4. 实现 runner 与 raw result 保存。
5. 运行一次 Full Retrieval benchmark；不得运行后续消融矩阵。
6. 生成报告，复核所有数字均可从 raw result 重算。
7. 运行本阶段相关测试、backend/frontend build、`git diff --check`。
8. 通过 Gate 后单独提交 Phase 1；未通过则只修 benchmark，不进入 Phase 2。

## 工具链规范

- 文件搜索：`rg` / `rg --files`。
- 文件修改：`apply_patch`。
- Python 测试：`python -m unittest ...`。
- TypeScript 测试：项目已有 `npm exec -- tsx --test ...` 形式。
- 构建：`npm run build`；lint 作为现有基线单独记录，不将与本阶段无关的 lint 历史错误混入指标。
- 运行服务前必须确认 8002 Vector health、8010 Backend health；缺服务时不能用 local fallback 冒充 Full Retrieval。
- 所有结果文件必须保存配置、版本和 hash；报告不得引用未保存的临时终端输出。

## Phase 1 Gate

只有同时满足以下条件才能进入 Phase 2：

1. 50 题的 gold 标注覆盖率、unresolved 清单和人工依据已审阅。
2. runner 能对同一 Git SHA、同一数据 hash 重放并产生结构一致的 raw schema。
3. Recall@1/3/5、MRR@5、no-result、p50/p95 和 failure rate 均可从 raw JSON 独立重算。
4. configured/executed/status 语义经过测试，未把配置状态当作执行状态。
5. 所有 API 失败和空召回均保留，没有静默丢题。
6. 相关测试通过，backend/frontend build 通过，`git diff --check` 通过；既有 frontend lint 问题单独记录。
7. 输出一份 baseline report，并明确当前 fallback retrieval 与未来并行 fusion 的差异。

## 明确不在本阶段

- 不实现并行多路召回或 RRF；
- 不修改 Query Rewrite、Rerank、LLM Prompt 或 Fact Contract；
- 不构建 Scene State、路线图、路径求解器或地图接入；
- 不执行完整消融矩阵；
- 不用新增指标包装当前准确率，也不为提高分数修改题目或知识库。
