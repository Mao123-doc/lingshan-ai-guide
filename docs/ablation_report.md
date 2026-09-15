# RAG Retrieval Ablation Framework Report

## 1. 工作概述

本次工作在现有 Evaluation Baseline 上建立了 configuration-driven 的 RAG Retrieval Ablation Framework。实验复用了同一个 RAG Pipeline，通过 `evaluation_config` 切换检索、Rewrite 和 Rerank，不复制 Vector、Structured、Keyword 三套问答实现，也没有修改正式问答逻辑。

本次完成内容：

- 定义命名的 Retrieval Ablation profiles；
- 增加无人值守 50 题 Runner；
- 保存每题 answer、Fact Contract 结果、retrieval trace、retrieved chunks 和 latency；
- 自动计算 Accuracy、Fact Recall、Pass Rate、API Success Rate、Avg Latency 和 Retrieval Success Rate；
- 自动生成本报告；
- 完成 7 组、每组 50 题的真实 Full-RAG 实验，共 350 次 API 调用。

本次没有修改：

- RAG 检索算法；
- Query Rewrite Prompt；
- Rerank Prompt；
- LLM、Embedding、temperature、Top-K；
- 知识库和 50 道测试题；
- Fact Contract、evaluator 和 Trace execution-state 逻辑。

## 2. RAG 数据流和实验入口

每个 profile 都经过同一条链路：

```text
test_questions.json
        ↓
run_ablation.py
        ↓
POST /api/v1/visitor/qa
        ↓
Query Rewrite
        ↓
Vector / Structured / Keyword Retrieval fallback
        ↓
Rerank
        ↓
Context
        ↓
LLM Generation
        ↓
test_accuracy.py Fact Contract Evaluation
        ↓
results/<profile>.json
```

关键入口：

| 模块 | 文件 | 入口 | 作用 |
|---|---|---|---|
| Dataset | `backend/python/tools/test_questions.json` | 50 道问题 | 固定评测输入和 Fact Contract |
| Runner | `backend/python/tools/run_ablation.py` | `run_experiments()` | 生成配置、调用 API、保存结果 |
| API | `backend/src/api/v1/visitor.ts` | `POST /api/v1/visitor/qa` | 接收 query、session 和 evaluation config |
| RAG | `backend/src/services/rag-service.ts` | `queryRAG()` | Rewrite、Retrieval、Rerank、Context、Generation |
| Trace | `rag-service.ts` | `RAGTrace` | 记录 configured/executed/status/reason |
| Evaluator | `backend/python/tools/test_accuracy.py` | `evaluate_api_result()` | 计算 Fact Hits、Fact Recall 和 passed |

当前 Retrieval 是优先级 fallback，而不是三路结果合并：

```text
Vector 有结果 → Structured skipped → Keyword skipped
Vector 无结果且 Structured 有结果 → Keyword skipped
前两者都无结果 → Keyword 执行
```

因此报告中的 `configured` 不等于 `executed`。每题原始 trace 已保存，可区分 disabled、skipped、failed 和 executed。

## 3. 实验配置

所有 profile 固定以下控制变量：

```text
LLM: deepseek-chat
Embedding: BAAI/bge-large-zh-v1.5
Dataset: 同一 50 题
Evaluator: 同一 test_accuracy.py
Prompt: 不变
Temperature: 不变
retrievalTopK: 8
contextTopK: 5
history: off
full knowledge injection: off
```

实验变量：

| Profile | Vector | Structured | Keyword | Rewrite | Rerank |
|---|---:|---:|---:|---:|---:|
| Vector Only | on | off | off | on | off |
| Structured Only | off | on | off | on | off |
| Keyword Only | off | off | on | on | off |
| Full Retrieval | on | on | on | on | on |
| Vector + Rerank | on | off | off | on | on |
| Full - Rerank | on | on | on | on | off |
| Full - Rewrite | on | on | on | off | on |

`Vector + Rerank` 用于观察 Vector 路径的 Rerank 影响；`Full - Rerank` 对应正式组件消融矩阵。

## 4. 实验结果

### Retrieval Ablation

| Method | Accuracy | Fact Recall | Avg Latency |
|---|---:|---:|---:|
| Vector Only | 86.0% | 0.905 | 2543.96 ms |
| Structured Only | 62.0% | 0.697 | 2432.66 ms |
| Keyword Only | 84.0% | 0.908 | 2318.14 ms |
| Full Retrieval | 84.0% | 0.902 | 2923.54 ms |

所有 4 组的 API Success Rate 均为 100%。

### Component Ablation

| Configuration | Accuracy | Fact Recall | Avg Latency |
|---|---:|---:|---:|
| Full | 84.0% | 0.902 | 2923.54 ms |
| Full - Rerank | 84.0% | 0.895 | 2365.80 ms |
| Full - Rewrite | 74.0% | 0.802 | 2411.82 ms |

### 直接回答实验问题

1. Vector Retrieval 准确率：`86.0%`。
2. Structured Retrieval 准确率：`62.0%`。
3. Keyword Retrieval 准确率：`84.0%`。
4. Full 相对 Vector：`-2.0` 个百分点；相对 Structured：`+22.0` 个百分点。
5. Rerank：Full Accuracy 无变化，Fact Recall 从 `0.895` 提升到 `0.902`；平均延迟增加 `557.74 ms`。
6. Rewrite：Accuracy 从 `74.0%` 提升到 `84.0%`，提升 `10.0` 个百分点；Fact Recall 从 `0.802` 提升到 `0.902`。

## 5. 结果解释

### Retrieval

- Vector Only 在本测试集上最高，为 86.0%。
- Structured Only 为 62.0%，说明结构化字段检索对部分复杂、多事实或非结构化表达覆盖不足。
- Keyword Only 为 84.0%，接近 Vector，但平均延迟最低。
- Full Retrieval 没有超过 Vector Only，说明当前 fallback 组合并不天然等于更高准确率；同时 Full 的额外 Rewrite/Rerank 调用增加了延迟。

### Rerank

Full 与 Full - Rerank 的 Accuracy 都是 84.0%，但 Fact Recall 有小幅提升。该结果说明本次测试集上 Rerank 对最终通过率没有形成可见提升，但对事实覆盖存在有限改善。

### Query Rewrite

Full - Rewrite 的 Accuracy 为 74.0%，比 Full 低 10 个百分点；Fact Recall 也明显下降。当前数据支持 Rewrite 对口语化或属性词检索有实际贡献，但这仍是本测试集和当前模型配置下的观察，不应推广为普遍结论。

## 6. 错误分析

每题结果保留了完整 trace，可按以下顺序定位：

```text
API → Retrieval → Rerank → Generation → Evaluator
```

保存结果中的 trace 错误分类统计为：

| Category | Count |
|---|---:|
| API | 0 |
| Retrieval | 5 |
| Rerank | 47 |
| Generation | 0 |
| Evaluator | 61 |

这些分类是基于 trace 的诊断桶，可能存在同一 profile 中不同题目的重复计数，不能直接解释为互斥的根因数量。具体错误应回到对应 JSON 的单题 `trace`、`answer` 和 `evaluation` 查看。

## 7. 指标口径和限制

- `Accuracy`：`passed / 50`，由 Fact Contract 最终通过判定得到。
- `Fact Recall`：50 道题的事实命中率平均值。
- `Pass Rate`：API 成功请求中的 passed 比例。
- `Avg Latency`：API 成功请求的平均响应时间。
- `Retrieval Success Rate`：trace 中存在有效 retrieval mode 和 retrieved IDs 的请求比例。

当前系统没有为每道题提供独立的 gold fact-to-chunk 标注，因此 `Retrieval Success Rate` 不能等同于严格的 gold-chunk Retrieval Recall。本次没有伪造严格 Recall；如果后续需要严格检索 Recall，应先建立问题事实与知识片段的标注映射。

## 8. 结果文件和复现

原始结果文件：

```text
results/vector_only.json
results/structured_only.json
results/keyword_only.json
results/full_retrieval.json
results/vector_rerank.json
results/full_without_rerank.json
results/full_without_rewrite.json
results/component_ablation.json
```

运行入口：

```powershell
python scripts/run_ablation.py
```

完整实验需要先启动 Vector Service 和 Backend，并确认 LLM online、Vector health 正常。每个 profile 会自动使用独立 session，不能通过手动修改配置替代 Runner。

## 9. 阶段提交

| Commit | 内容 |
|---|---|
| `4425b82` | 定义 Retrieval Ablation profiles |
| `c529b50` | 增加无人值守 Ablation Runner |
| `a80465f` | 增加报告生成和 Full - Rerank profile |
| `a50b920` | 完成 7 组真实实验并提交结果 |

## 10. 验收证据

- 每个 profile 均保存 50 条记录；
- 每题 question ID 和 session ID 均唯一；
- 350 条请求全部 API success；
- 每条记录均包含 answer、evaluation、trace 和 latency；
- 保存的 aggregate metrics 与独立重算结果一致；
- Python evaluator/runner tests：28 项通过；
- RAG config/trace tests：通过；
- TypeScript build：exit 0；
- `git diff --check`：通过。
