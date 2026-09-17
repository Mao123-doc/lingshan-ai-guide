# RAG Retrieval Ablation Report

## 1. 实验目的

比较 Vector、Structured、Keyword Retrieval 及 Full Retrieval 的事实覆盖和延迟，并观察 Rerank 与 Query Rewrite 对同一 RAG Pipeline 的影响。实验只切换 evaluation_config，未复制或修改正式 RAG 实现。

## 2. 实验设置

- Dataset：`backend/python/tools/test_questions.json`，同一 50 题测试集
- Evaluator：`backend/python/tools/test_accuracy.py`，Fact Contract 版本保持不变
- LLM requested model：read from the runtime manifest; provider model identity is recorded per trace
- Embedding：`BAAI/bge-large-zh-v1.5`
- Prompt、temperature、retrievalTopK=8、contextTopK=5 保持不变
- Evaluation 控制变量：`enableHistory=false`，`includeFullKnowledge=false`
- 每题使用独立 session；每个 profile 保留原始 answer、evaluation 和 execution trace

## 3. 实验结果

### Retrieval Ablation

| Method | Accuracy | Fact Recall | Avg Latency (ms) |
|---|---:|---:|---:|
| Vector Only | N/A | N/A | N/A |
| Structured Only | N/A | N/A | N/A |
| Keyword Only | N/A | N/A | N/A |
| Full Retrieval | 96.0 | 0.97 | 3027.64 |

### Component Ablation

| Configuration | Accuracy |
|---|---:|
| Full Retrieval | 96.0 |
| Full - Rerank | N/A |
| Full - Rewrite | N/A |

## 4. 错误分析

错误分类基于保存的 trace；没有 trace 证据时不推断具体原因。
- API: 0
- Retrieval: 0
- Rerank: 0
- Generation: 0
- Evaluator: 2

## 5. 结论

- Full Retrieval accuracy：96.0。
- 具体模块贡献仅依据同一测试集、同一控制变量和保存的 trace 解读。
