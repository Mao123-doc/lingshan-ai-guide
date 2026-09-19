# Phase 3 Plan: Scene State

## Scope

建立经过 Zod 校验的 `SceneState` 契约，并用确定性规则提取当前地点、时间、剩余时长、同行人、行动能力、兴趣、必去景点、演出偏好、已游览景点和缺失关键字段。

## Boundaries

- 不修改 RAG 检索、Prompt、Fact Contract 或模型参数。
- 不把自由 JSON 直接传给未来 Route Engine。
- 不在本阶段修改旧 `/recommend`。
- 缺少当前地点或剩余时间时标记 `missingCriticalFields`，不猜测。
- 演出偏好只记录为稳定 performance ID 和用户指定时间，不判断路线可行性。

## Verification

1. Scene State unit tests cover the canonical demo, mobility, time parsing, performance preference, missing fields, and schema rejection.
2. A 40-case scene Gold fixture is evaluated independently.
3. Backend build and existing relevant tests remain green.
4. The fixture hash and extraction implementation SHA are recorded with the benchmark output.
