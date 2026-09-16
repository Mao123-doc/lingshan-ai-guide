# Phase 6 Plan: Scene-aware Route API and Visitor Experience

## Scope

新增 `POST /api/v1/visitor/route/plan`，复用现有推荐页展示 Scene State、路线时间轴、拒绝请求和证据来源；保留旧 `/recommend` 以维持兼容性。

## API Contract

输入：`query`，可选经过 Zod 校验的 `scene_state` 覆盖字段。

输出：

- validated `scene_state`;
- `route.feasible`;
- 每步 arrive/start/end/walk/visit/reason;
- rejected requests and violations;
- source/confidence evidence for route spots。

缺少路线关键字段时返回 clarification/infeasible，不猜测当前时间、地点或剩余时长。

## UI Boundary

- 保留旧静态推荐接口和页面能力；
- 新增场景文本输入和可执行路线时间轴；
- estimated evidence 必须显示 confidence；
- 不引入新的地图或重型前端框架。

## Verification

1. Backend and frontend production builds pass.
2. Canonical Demo API runs ten times without 5xx and returns validator-valid route.
3. An infeasible wheelchair/time-budget request is explicitly rejected.
4. Existing `/recommend` remains available.
