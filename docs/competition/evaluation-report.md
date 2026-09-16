# Evaluation Evidence Report

## 评测口径

评测采用真实 QA API 请求，禁止 local fallback 计入 Full-RAG 结果。当前检索配置为 Vector / Structured / Keyword 并行，RRF `k=60`；评测控制变量关闭 conversation history 和 full knowledge injection，保留 Query Rewrite、检索、Rerank 与 Trace。

## 检索消融结果

数据集为 88 个 Gold queries，每种配置 88 次请求，共 440 次；5 个配置均为 88/88 eligible、无 API failure、无 local fallback。

| 配置 | Recall@1 | Recall@3 | Recall@5 | MRR@5 | p50 | p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| vector_only | 0.3409 | 0.8977 | 0.9886 | 0.6259 | 2398.5 ms | 2923.5 ms |
| structured_only | 0.9318 | 1.0000 | 1.0000 | 0.9659 | 2169.3 ms | 2555.2 ms |
| keyword_only | 0.3182 | 0.7159 | 0.8295 | 0.5091 | 2215.1 ms | 2655.4 ms |
| fused | 0.3409 | 0.9659 | 0.9886 | 0.5947 | 2216.2 ms | 2701.3 ms |
| fused_rerank | 0.3409 | 0.9659 | 0.9886 | 0.5947 | 2636.7 ms | 3212.3 ms |

结论：Recall@5 达到 98.86%，通过当前检索门槛；Structured-only 在这批 Gold 上最好，融合提高了 Recall@3 但没有超过 Structured-only，Rerank 没有带来离线召回提升且增加延迟。正式答辩应如实展示这一结果，而不是只展示融合方案。

## Scene State

40 个场景 Gold cases 全部通过：field accuracy 1.0，critical missing-field accuracy 1.0。

## 正式 50 题 Full-RAG Baseline

在冻结配置下完成 50 个独立 session 的真实 Full-RAG 请求：Query Rewrite、Vector、Structured、Keyword、Rerank 和 LLM 均开启；history 与 full knowledge injection 关闭；Top-K 为 8/5。

| 指标 | 结果 |
| --- | ---: |
| API success | 50/50 |
| Fact Contract pass | 39/50 |
| pass rate | 78.0% |
| mean fact recall | 0.855 |
| average latency | 2599.1 ms |
| retrieval success | 50/50 |
| local fallback | 0 |

该结果代表当前 Fact Contract evaluator 下的基线，不代表真实用户准确率、满意度或现场导航安全性。原始结果与 manifest 位于 `evaluation/results/formal_baseline_20260916/`。

## Route Validator / Planner

- 60 个路线案例：40 个可行、20 个不可行，判定全部正确。
- hard violations：0。
- infeasible precision / recall / F1：1.0。
- 同一核心演示重复 10 次：10/10 HTTP 成功、10/10 可行、输出确定性一致。

最近一次 API smoke 的 10 次结果为：10/10 HTTP 200、10/10 `route.feasible=true`、10/10 `route.violations=[]`、唯一输出路线为 `LS-013`。

## 证据位置

- Retrieval：`evaluation/results/20260915T195912Z_b01d12d8/`
- Scene：`evaluation/results/scene/scene_benchmark_v1.json`
- Route：`evaluation/results/route/route_validator_v1.json`
- Gold：`evaluation/retrieval/retrieval_gold_v1.json`、`evaluation/scene/scene_gold_v1.json`

## 解释边界

这些是离线 Gold、规则合同和 API smoke 证据，不是用户满意度、商业转化率或现场导航准确率。路线数据中明确标记为 estimated 的步行时间和设施信息必须现场核验。
