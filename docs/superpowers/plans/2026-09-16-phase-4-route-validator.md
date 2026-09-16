# Phase 4 Plan: Scenic Graph and Route Validator

## Scope

建立景点、边、演出和设施的数据合同，并实现独立 `validateRoute(plan, sceneState, graph)`。本阶段只负责事实结构和硬约束验证，不实现路线搜索、不替换旧 `/recommend`。

## Data Provenance

- 景点名称、ID、部分坐标和文化事实来自仓库现有数据或前端常量。
- 未有官方步行接口支撑的距离和时间统一标记为 `estimated`。
- 演出时间保留原始知识库来源和“以官方通知为准”的有效性说明。
- 设施数据中无法由现有事实确认的项目标记为 estimated/placeholder，不能对外宣称官方运营数据。

## Validator Contract

Validator 必须拒绝：

- 超过剩余时间的路线；
- 超出开放时间的步骤；
- 不连续或未知的地点；
- 行动能力不适配的边或景点；
- 演出地点/时间不匹配；
- 缺失必去景点、重复景点或重复已游览景点；
- 与数据合同不一致的步行/游览/总时长。

## Verification

1. Route graph schema parses all four JSON assets.
2. Every edge endpoint, performance location and facility location exists.
3. At least 30 validator assertions cover valid and invalid plans.
4. Backend build and all relevant retrieval/scene tests remain green.
