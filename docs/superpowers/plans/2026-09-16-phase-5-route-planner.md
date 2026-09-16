# Phase 5 Plan: Deterministic Constrained Route Planner

## Scope

实现可测试、可解释、确定性的 constrained beam search。LLM 不参与最终可行性判断；Planner 只从经过 Route Validator 合同约束的数据中生成路线。

## Hard Constraints

- 当前地点、当前时间、剩余时长缺失时返回 clarification/infeasible；
- 景点必须可连续到达且在开放窗口内；
- mobility 不允许使用不可达边或景点；
- must-visit 必须满足，否则返回明确拒绝原因；
- 演出时间不可行时不得伪造参加，返回 `performance_unavailable`；
- 总路线不得超过剩余时长。

## Soft Objective

固定、显式的排序优先级：must-visit > 可满足的演出偏好 > 兴趣匹配 > 较短步行 > 较早完成时间。无训练权重、无随机性。

## Verification

1. Planner unit tests cover feasible, must-visit, performance, mobility, missing fields and determinism.
2. A 60-case route benchmark covers normal, mobility-limited, performance, tight-budget and infeasible scenarios.
3. Feasible plans have zero hard validator violations.
4. The same input produces identical output ten times.
