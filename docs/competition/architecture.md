# 灵山智慧导览：可信时空约束智能体架构

## 定位

项目不是“聊天机器人加景点资料”，而是一个面向景区真实决策的可信导览智能体：用 RAG 负责事实依据，用 Scene State 结构化游客需求，用确定性 Route Planner 负责路线可行性，再由 LLM 负责理解和解释。

核心原则是：模型可以提出解释，不能绕过硬约束替游客决定一条不可执行的路线。

## 数据流

```text
游客自然语言
  -> Scene State 提取（位置、时间、时长、同行人、行动能力、兴趣、必达点、演艺偏好）
  -> 结构化景点/演艺/设施数据
  -> 确定性约束规划器
  -> 可行性、时间线、拒绝原因、证据

游客问答
  -> Query Rewrite
  -> Vector / Structured / Keyword 并行检索
  -> RRF 融合
  -> Rerank
  -> Context
  -> LLM Generation
  -> Answer + Trace + Evaluation
```

## 当前实现边界

- Vector：Python vector service，模型为 `BAAI/bge-large-zh-v1.5`。
- Hybrid：Vector、Structured、Keyword 并行执行，使用 RRF `k=60` 融合。
- Route：`data/route/*.json` 是可校验的景点、边、演艺和设施合同；`route-planner.ts` 使用确定性约束搜索。
- Trace：区分 `configured`、`executed`、`skipped`、`failed`，避免把“配置开启”误写成“真实执行”。
- Evaluation：记录配置、数据哈希、Git SHA、原始结果与汇总指标。

## 演示主线

“我带腿脚不方便的妈妈，现在是 13:00，在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？”

规划器输出路线、到达时间、等待时间、演艺时间、步行时间、约束满足情况和证据；若条件不可满足，输出缺失约束和拒绝原因，而不是编造一条路线。

## 明确限制

目前步行时间和部分设施信息包含 `estimated` 标记，必须经过现场核验后才能对外宣称为运营级导航数据。系统也没有真实用户研究样本，因此不能把离线评测当作用户满意度证明。
