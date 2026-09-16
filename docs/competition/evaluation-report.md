# Evaluation Evidence Report

## 当前可审查基线

当前权威 Full-RAG Baseline 为 `evaluation/results/baseline_20260917_020000/`，对应提交
`0522c3869bf5dd23a35769e0e7f225737a239141`。数据集为 50 道题，知识库和数据集 SHA-256
均记录在该目录的 `manifest.json` 中。

评测使用真实 QA API，每道题使用独立 session；History 和 Full Knowledge Injection 关闭，
Query Rewrite、Vector、Structured、Keyword、Rerank 和 LLM Generation 开启。Retrieval
Top-K 为 8，Context Top-K 为 5。Local fallback 不计入 Full-RAG，Trace 必须与实际执行一致。

| 指标 | 当前结果 |
| --- | ---: |
| Questions | 50 |
| API successes | 50/50 |
| Fact Contract passed | 48/50 |
| Pass rate | 96.0% |
| Mean fact recall | 0.970 |
| Average latency | 3027.64 ms |
| Retrieval success | 50/50 |
| Local fallback | 0 |
| Quality Gate | eligible=true |

失败题为 #14（多事实问题只回答了题字作者）和 #50（对整个景区游览时长进行谨慎拒答）。
它们保留在原始结果中，没有通过修改知识库、放宽 Fact Contract 或 fallback 隐藏。

### 模型身份说明

运行配置请求 `deepseek-chat`，Provider trace 实际返回 `deepseek-flash`。该差异已写入
manifest 和每题 trace；因此本结果是当前运行环境下的可审查 Baseline，正式材料必须披露
这一可复现性限制，不能把请求模型名直接当作实际执行模型名。

## 当前完整消融结果

权威消融目录为 `evaluation/results/ablation_20260917_013925/`，同样对应提交
`0522c3869bf5dd23a35769e0e7f225737a239141`。7 个 profile 均完成 50/50 请求，所有质量门禁
通过，结果来自同一测试集和冻结控制变量。

| Profile | Accuracy | Fact Recall | Avg Latency |
| --- | ---: | ---: | ---: |
| Vector only | 94.0% | 0.960 | 2336.08 ms |
| Structured only | 66.0% | 0.694 | 2172.20 ms |
| Keyword only | 96.0% | 0.977 | 2221.56 ms |
| Full retrieval | 98.0% | 0.980 | 2882.68 ms |
| Vector + Rerank | 94.0% | 0.950 | 2873.62 ms |
| Full without Rerank | 90.0% | 0.933 | 2358.02 ms |
| Full without Rewrite | 98.0% | 0.993 | 2414.48 ms |

这些是一次随机 LLM 运行的观察值，不足以单独证明因果贡献。尤其 Full Retrieval 与
Full without Rewrite 本次准确率相同，Rerank 的差异也应表述为本次实验观察，而不是普遍规律。

## Scene State 验收

当前提交下重新执行 40 个场景 Gold case：

- field accuracy：1.0
- critical missing-field accuracy：1.0
- cases：40/40
- 覆盖老人、儿童、轮椅、行动不便、时间约束、演艺偏好、必去景点、已游览景点、缺少关键字段和多约束输入。

该测试只验证确定性场景抽取，不等价于真实用户研究，也不验证路线可行性。
证据文件：`evaluation/results/scene/scene_benchmark_v1.json`。

## Route Planner / Validator 验收

当前提交下重新执行 60 个路线案例：

- feasible classification：60/60
- hard violations：0
- infeasible precision / recall / F1：1.0 / 1.0 / 1.0
- 核心路线重复执行 9 次，与参考结果一致。

该 benchmark 验证的是结构化场景输入下的确定性规划和约束校验，不验证地图实时可达性、
现场拥堵、真实步行时间或路线推荐的用户满意度。步行时长和未现场核验的设施信息仍标记为 estimated。
证据文件：`evaluation/results/route/route_validator_v1.json`。

## 历史 Retrieval Gold 结果

`evaluation/results/20260915T195912Z_b01d12d8/` 是提交 `7b5c...` 下的 88-query Retrieval
Gold benchmark，5 个 profile 均 88/88 eligible。其 Recall@5、MRR 和延迟仍可作为历史检索
对照，但由于不是当前 `0522c386...` 提交下重新生成，不把它作为当前 Full-RAG Baseline 的主指标。

## 解释边界

Fact Contract pass rate 不是用户满意度、真实世界事实准确率、导航安全性或商业转化率。
路线结果也不是实时地图导航保证。所有正式展示应同时给出配置、提交 SHA、数据哈希、模型身份、
原始 trace 和失败样本。
