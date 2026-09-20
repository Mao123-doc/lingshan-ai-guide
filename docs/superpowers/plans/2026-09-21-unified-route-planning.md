# 统一可信路线规划修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将表单推荐、自然语言路线规划和旧 `/recommend` 入口收敛到同一个可验证、可解释且保持物理真实性的路线规划应用服务。

**Architecture:** HTTP 层只负责请求解析、契约校验和响应映射；`route-planning-service.ts` 统一执行 Scene State 抽取/合并、缺失字段判断、确定性规划、14 项验证和解释构造。`route-preferences.ts` 集中处理兴趣集合、同行软偏好和 pace 时长策略，`route-planner.ts` 与 `route-validator.ts` 共同消费同一套时长与可访问性规则。前端推荐表单和自然语言入口都调用 `/route/plan`，旧 `/recommend` 只作为带弃用响应头的兼容适配器。

**Tech Stack:** TypeScript, Express, Zod, Node `node:test`, React 19, Vitest, React Testing Library, Playwright, 现有 23 景点/31 道路路网与 14 项路线验证器。

**Spec:** `docs/superpowers/specs/2026-09-21-unified-route-planning-design.md`（批准提交 `dae4950`）

## Global Constraints

- 生产路线唯一链路为“用户输入（表单或自然语言） → 统一请求规范化 → Scene State → 确定性规划器 → 14 项形式化验证 → 可解释结果”。
- 路线物理依据始终是 23 景点、31 道路数字孪生路网；不得引入未经核验的实时客流、票价、消费价格或地图道路数据。
- `currentLocation`、`currentTime`、`remainingMinutes`、`mobility`、必去景点和演出时间窗按规格处理为硬约束/硬请求；缺少位置、时间或时长时返回 `outcome=needs_clarification`，不得默认“南门 09:00”。
- `interests` 去重并按稳定键排序；所有兴趣参与评分，输入顺序不得影响结果；软偏好不得覆盖可达性、开放时间、演出时间窗或总时间预算。
- `pace` 只调整建议停留时间：`slow=1.20`、`normal` 使用路网基准、`fast=0.85` 且不得低于 10 分钟；步行基准和演出时长不可缩短。
- `ageGroup` 与 `budget` 仅生成建议信息；预算不改变物理路线，年龄和“带长辈”不自动推断 `mobility`。
- 路线总时长必须包含步行、游览、等待和演出；不可行、不可达或验证硬违规时不得返回 `feasible`，必须返回诚实拒绝或经验证的降级方案。
- 不修改 RAG 架构、`Promise.all` 三路并行 + RRF（`k=60`）+ Cross-Encoder + 官方指南兜底的事实表述、50 题 96.0% 基线和 7 组消融权威数据。
- 不覆盖、删除、reset 或纳入当前工作区已有未提交改动；实施时只修改本计划列出的文件。

## Review Focus

- 缺少位置/时间/时长或请求为空时，必须区分 HTTP 400 与 HTTP 200 `needs_clarification`；由 Task 2 和 Task 3 的接口测试固定。
- 显式字段覆盖抽取字段后，`missingCriticalFields` 必须重新计算且不得让规划器专属字段越过 Zod 契约；由 Task 2 的合并测试固定。
- pace、mobility、兴趣顺序和同行类型不能通过缩短物理步行或猜测行动能力破坏可达性；由 Task 1 和 Task 4 的差异测试固定。
- 相同最优路线不能被随机打乱；预算/年龄等无路线影响字段仍必须在 `input_effects` 和消费建议中可审计；由 Task 2 和 Task 5 的解释测试固定。
- `/recommend`、前端 fixture 和现有权威路线/场景基准不能悄然绕回静态模板或改变 23/31/14 物理基线；由 Task 3、Task 5 和 Task 6 的链路审计与回归命令固定。

## 文件边界总览

实施者只应在下列边界内工作；若发现必须修改其他文件，应先更新计划并暂停实现审阅。

- Create: `backend/src/services/route/route-planning-service.ts` —— 统一请求规范化、Scene State 合并、规划/验证编排、解释和消费建议。
- Create: `backend/src/services/route/route-preferences.ts` —— 兴趣/同行偏好归一化、排序和 pace 时长策略。
- Modify: `backend/src/api/v1/visitor.ts` —— 移除生产模板决策，保留 HTTP 适配、兼容转换和安全的 Scene Extraction 响应清洗。
- Modify: `backend/src/services/scene/scene-state.ts` —— 保持权威契约，增加结构化表单所需的归一化映射和稳定枚举转换。
- Modify: `backend/src/services/route/route-planner.ts` —— 消费规范化偏好、统一停留时长并保持 24 宽 Beam Search 和确定性裁决。
- Modify: `backend/src/services/route/route-validator.ts` —— 消费同一时长策略，继续执行 14 项形式化仲裁。
- Create/Modify tests: `backend/src/services/route/route-preferences.test.ts`、`backend/src/services/route/route-planning-service.test.ts`、`backend/tests/api/visitor.test.ts`、现有 route/scene 测试。
- Modify: `frontend/src/services/api.ts` —— 定义统一结构化请求、响应、`InputEffect` 和弃用接口类型。
- Modify: `frontend/src/pages/visitor/RecommendPage.tsx` —— 合并两套推荐交互，提交结构化 Scene State，保留自然语言入口和同一结果组件。
- Modify: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx` —— 表单迁移、字段语义、解释和降级 UI 测试。
- Modify: `frontend/e2e/fixtures.ts` —— 仅将测试 mock 对齐统一 `/route/plan` 响应，不保留生产模板语义。
- Modify: `frontend/e2e/core-journeys.spec.ts`、`frontend/e2e/mobile.spec.ts` —— 验证迁移后推荐页的可用链路。

---

### Task 1: 建立偏好归一化与统一时长策略

**Files:**
- Create: `backend/src/services/route/route-preferences.ts`
- Test: `backend/src/services/route/route-preferences.test.ts`
- Modify: `backend/src/services/scene/scene-state.ts`
- Test: `backend/src/services/scene/scene-state.test.ts`

**Interfaces:**
- Consumes: `SceneState`、`RouteGraph` 中现有景点标签/属性、现有中英文兴趣和 mobility 枚举。
- Produces:
  - `export type NormalizedRoutePreferences = { interests: string[]; partyType?: string; mobility: SceneState['mobility']; pace: 'slow' | 'normal' | 'fast'; ageGroup?: string; budget?: SceneState['budget']; }`。
  - `export function normalizeRoutePreferences(scene: SceneState): NormalizedRoutePreferences`，兴趣去重后按稳定键排序。
  - `export function getVisitMinutes(baseMinutes: number, pace: NormalizedRoutePreferences['pace']): number`，返回向上取整后的建议停留时间。
  - `export function preferenceScore(spot: RouteGraph['spots'][number], preferences: NormalizedRoutePreferences): number`，兴趣总加分设上限；同行类型只读取既有标签，不推断 mobility。

- [ ] **Step 1: Write failing tests for stable normalization and pace rules**

  在 `route-preferences.test.ts` 添加以下行为断言：`['nature', 'culture', 'nature']` 与 `['culture', 'nature']` 产生相同规范化结果；`slow` 对 25 分钟返回 30，`normal` 返回 25，`fast` 对 25 分钟返回 22、对 8 分钟返回 10；`limited` 与 `wheelchair` 保持硬约束输入；`with_elderly` + `normal` 不自动改成 limited。

  在 `scene-state.test.ts` 添加中英文/表单值归一化断言：`文化` 映射到 `culture`、`自然` 映射到 `nature`、`带长辈` 映射为 `with_elderly`，非法 mobility/pace/budget 被 Zod 拒绝，且 `ageGroup` 与 `budget` 不出现在硬约束字段中。

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `npx tsx --test backend/src/services/route/route-preferences.test.ts backend/src/services/scene/scene-state.test.ts`

  Expected: FAIL because `route-preferences.ts` exports do not exist and the new structured normalization assertions are not implemented。

- [ ] **Step 3: Implement the minimal normalization module and schema mapping**

  在 `route-preferences.ts` 只加入上述导出；兴趣以 canonical key 的字典排序，偏好分数上限固定为一个实现常量并在测试中断言上限；pace 只改变 visit minutes，不改变 graph edge 的 `walk_minutes` 或 performance duration。扩展 `scene-state.ts` 的 `SceneStateSchema`/归一化辅助函数，使已有自然语言状态和结构化表单共享 canonical 值，保留 `missingCriticalFields` 权威字段。

- [ ] **Step 4: Run focused tests and verify pass**

  Run: `npx tsx --test backend/src/services/route/route-preferences.test.ts backend/src/services/scene/scene-state.test.ts`

  Expected: PASS；同时确认现有 `scene-state` 测试没有改变抽取字段和缺失字段语义。

- [ ] **Step 5: Commit only the task files**

  Run: `git add backend/src/services/route/route-preferences.ts backend/src/services/route/route-preferences.test.ts backend/src/services/scene/scene-state.ts backend/src/services/scene/scene-state.test.ts; git commit -m "feat(route): normalize route preferences and pace"`

  Expected: 提交只包含本任务文件，不包含工作区其他改动。

### Task 2: 实现统一路线规划应用服务

**Files:**
- Create: `backend/src/services/route/route-planning-service.ts`
- Test: `backend/src/services/route/route-planning-service.test.ts`
- Modify: `backend/src/services/route/route-planner.ts`
- Test: `backend/src/services/route/route-planner.test.ts`
- Modify: `backend/src/services/route/route-validator.ts`
- Test: `backend/src/services/route/route-validator.test.ts`

**Interfaces:**
- Consumes: `RoutePlanningRequest`（`query?`、`scene_state?`、`advisory_profile?`）、`loadRouteGraph()`、`extractSceneStateWithLLM()`、Task 1 的 preferences helpers、`planRoute()`、`validateRoute()`。
- Produces:
  - `export interface RoutePlanningRequest { query?: string; scene_state?: Partial<SceneState>; advisory_profile?: { ageGroup?: '青年' | '中年' | '老年'; budget?: '经济型' | '舒适型' | '豪华型' }; }`。
  - `export type RoutePlanningSource = 'explicit' | 'merged' | 'llm' | 'rules' | 'fallback'`。
  - `export interface InputEffect { field: string; kind: 'hard_constraint' | 'soft_preference' | 'advisory'; applied: boolean; summary: string; }`。
  - `export interface RouteExplanation { input_effects: InputEffect[]; route_rationale: string[]; clarification?: string; rejected_requests?: Array<{ item: string; reasonCode: string }>; consumer_advice?: string[]; }`。
  - `export async function planRouteRequest(request: RoutePlanningRequest): Promise<UnifiedRoutePlanResponse>`。

- [ ] **Step 1: Write failing service tests before implementation**

  在 `route-planning-service.test.ts` 建立可控 graph fixture 和抽取 mock，覆盖：纯 `scene_state` 不调用 LLM 且返回 `scene_extraction.source='explicit'`；纯 `query` 调用抽取；二者合并返回 `source='merged'`；显式 `currentTime` 覆盖抽取值后重新计算缺失字段；空请求拒绝；非法枚举拒绝；缺少位置/时间/时长返回 `needs_clarification`；route 与 validation 结果进入统一响应；硬违规不能返回 `feasible`。

  额外断言：预算变化不改变 route，但 `input_effects` 标为 `advisory` 且 consumer advice 明确预算不改变物理路线；相同 route 时 `route_rationale` 解释主导约束，不读取任何上一请求状态。

- [ ] **Step 2: Run focused service tests and verify failure**

  Run: `npx tsx --test backend/src/services/route/route-planning-service.test.ts`

  Expected: FAIL because the application service and unified response contract do not exist。

- [ ] **Step 3: Write failing planner/validator tests for shared duration accounting**

  在现有 route tests 中添加：`slow` 的 route total 包含 walk + adjusted visit + waiting + performance；`fast` 不减少 edge walk minutes 和 performance duration，visit minutes 不低于 10；validator 使用相同策略而不是重复一套 pace 计算；`limited/wheelchair` 的候选不含 inaccessible edge/spot；60/60 fixture 的硬违规仍为 0。

- [ ] **Step 4: Run planner/validator focused tests and verify failure**

  Run: `npx tsx --test backend/src/services/route/route-planner.test.ts backend/src/services/route/route-validator.test.ts`

  Expected: FAIL on the new pace, total-duration, or shared-strategy assertions。

- [ ] **Step 5: Implement the minimal application service and planner integration**

  在 `route-planning-service.ts` 按固定顺序实现：校验至少有 `query` 或 `scene_state`；结构化请求通过 `SceneStateSchema.partial().strict()`；有 query 才抽取；显式字段覆盖抽取字段；用合并后的 Scene State 重算 `missingCriticalFields`；缺少硬约束直接构造 clarification；否则加载唯一 route graph、调用 `planRoute` 和 `validateRoute`，将 evidence、`input_effects`、`route_rationale`、consumer advice 放入统一响应。不得把 `steps`、`feasible`、`outcome` 等规划器字段接受为输入。

  在 planner/validator 中注入或调用 Task 1 的同一 `getVisitMinutes`，保留 24 宽 Beam Search、稳定 ID 最终裁决、道路/景点可访问性过滤和演出时间窗逻辑。总时长按 walk、visit、waiting、performance 统一计算；硬验证失败时将 outcome 转为 `infeasible` 并保留审计原因。

- [ ] **Step 6: Run focused tests and verify pass**

  Run: `npx tsx --test backend/src/services/route/route-preferences.test.ts backend/src/services/route/route-planning-service.test.ts backend/src/services/route/route-planner.test.ts backend/src/services/route/route-validator.test.ts`

  Expected: PASS；相同输入 route 稳定，预算/年龄不改变物理规划，pace 不缩短物理步行，硬违规不被标为可执行。

- [ ] **Step 7: Commit only the task files**

  Run: `git add backend/src/services/route/route-planning-service.ts backend/src/services/route/route-planning-service.test.ts backend/src/services/route/route-planner.ts backend/src/services/route/route-planner.test.ts backend/src/services/route/route-validator.ts backend/src/services/route/route-validator.test.ts; git commit -m "feat(route): add unified planning application service"`

  Expected: 提交不包含 API、前端或 RAG 文件。

### Task 3: 收敛游客 API 并保留薄兼容层

**Files:**
- Modify: `backend/src/api/v1/visitor.ts`
- Modify: `backend/tests/api/visitor.test.ts`

**Interfaces:**
- Consumes: Task 2 的 `planRouteRequest()` 和统一 `RoutePlanningRequest`；现有安全的 scene extraction sanitizer。
- Produces: `POST /api/v1/visitor/route/plan` 接收纯 query、纯 scene_state 或二者；`POST /api/v1/visitor/recommend` 将旧字段转换为结构化 Scene State 后调用同一服务，返回统一 outcome/route/explanation/evidence/scene_extraction 主体并设置 `Deprecation: true`（或现有项目约定的弃用响应头）。

- [ ] **Step 1: Add failing API contract tests**

  在 `visitor.test.ts` 添加：纯结构化 `/route/plan` 返回 200、`source=explicit` 且 LLM mock 未调用；query + scene_state 返回 `source=merged`；空 body/既无 query 又无 scene_state 返回 400；非法枚举/规划器专属字段返回 400；缺位置/时间/时长返回 200 `needs_clarification`；旧 `/recommend` 等价场景与 `/route/plan` route 等价、返回统一结构、带弃用头且没有 `INTEREST_ROUTES` 静态响应字段；`/recommend` 缺位置或开始时间时进入 clarification，不产生默认事实。

- [ ] **Step 2: Run API tests and verify failure**

  Run: `npm test --prefix backend -- --test-name-pattern "route|recommend"`

  Expected: FAIL，因为当前 `/route/plan` 强制要求非空 query，`/recommend` 仍返回模板结构且没有统一服务/弃用头。

- [ ] **Step 3: Replace endpoint business logic with adapters**

  删除 `visitor.ts` 生产路径中的 `INTEREST_ROUTES` 选择、时长截断和 profile-only route 响应。`/route/plan` 只做 body 解析、统一错误码和 sanitizer 后调用 `planRouteRequest`；`/recommend` 将 `interests`、`duration`、`travelType`、`ageGroup`、`budget` 映射为 canonical Scene State/advisory profile，缺少 currentLocation/currentTime 时不造默认值，调用同一个服务并设置弃用头。保持 QA/RAG 路径完全不变。

- [ ] **Step 4: Run API tests and verify pass**

  Run: `npm test --prefix backend -- --test-name-pattern "route|recommend"`

  Expected: PASS；响应中不再出现静态 `tier/available_tiers/profile` 模板契约，旧入口只产生统一路线响应。

- [ ] **Step 5: Run complete backend TypeScript tests and build**

  Run: `npm test --prefix backend`; `npm run build --prefix backend`

  Expected: PASS；不改变 QA、RAG、认证和其他 visitor API 的既有测试。

- [ ] **Step 6: Commit only the task files**

  Run: `git add backend/src/api/v1/visitor.ts backend/tests/api/visitor.test.ts; git commit -m "refactor(api): route recommend through unified planner"`

  Expected: 提交不包含前端或评测数据文件。

### Task 4: 迁移前端推荐表单到结构化 `/route/plan`

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/visitor/RecommendPage.tsx`
- Modify: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx`

**Interfaces:**
- Consumes: 后端 `RoutePlanningRequest`、统一 `RoutePlanResponse`、`InputEffect`/`RouteExplanation`；当前结果卡片中的 steps、evidence、clarification、rejected requests。
- Produces: `visitorAPI.planRoute(request: RoutePlanningRequest)`；`visitorAPI.recommend` 标记为 deprecated 兼容调用且不被 `RecommendPage` 生产路径使用；表单直接提交 currentLocation/currentTime/remainingMinutes/mobility/pace/interests/可选约束，年龄和预算位于“个性化提示”区域并有不改变物理路线说明。

- [ ] **Step 1: Add failing component and API tests**

  更新 `RecommendPage.test.tsx` 的 mock 为 `planRoute` 统一响应，并添加断言：点击表单按钮调用 `visitorAPI.planRoute` 而非 `recommend`；请求包含结构化 location/time/minutes/mobility/pace 和全部 selected interests，兴趣顺序由 API/服务稳定处理；年龄/预算展示 advisory 文案；`needs_clarification`、`infeasible`、`feasible_with_rejected_preferences` 和可执行路线共用结果区域；UI 显示 `input_effects`/`route_rationale` 的用户语言但不显示 Beam Search、trace、内部 spot ID。

- [ ] **Step 2: Run frontend focused tests and verify failure**

  Run: `npm run test:unit --prefix frontend -- src/pages/visitor/__tests__/RecommendPage.test.tsx`

  Expected: FAIL，因为当前表单仍调用 `recommend`，且没有结构化字段控件和统一解释渲染。

- [ ] **Step 3: Update API types and migrate form state**

  在 `api.ts` 定义 `RoutePlanningRequest`、`SceneStateInput`、`AdvisoryProfile`、`InputEffect` 和完整 `RoutePlanResponse`；`planRoute` 接受 request object，保留 `planRouteQuery` 仅供自然语言入口封装。`RecommendPage.tsx` 将旧 `duration/travelType` 表单转换为 remainingMinutes/partyType，新增/保留位置、开始时间、mobility、pace、可选必去/演出/已游览字段；表单和自然语言按钮都写入同一个 `sceneRoute` 和结果渲染状态。年龄/预算不得被发送为路线硬约束，只作为 `advisory_profile`。

- [ ] **Step 4: Implement unified result explanations**

  在结果卡片中渲染 `input_effects` 的 summary、`route_rationale`、总时长拆分（步行/游览/等待/演出）和降级/拒绝原因；clarification 使用自然语言提示；保留现有导航、问答跳转和证据展示，但过滤内部 trace、Beam Search 分数及原始字段名。

- [ ] **Step 5: Run frontend focused tests and verify pass**

  Run: `npm run test:unit --prefix frontend -- src/pages/visitor/__tests__/RecommendPage.test.tsx`; `npm run build --prefix frontend`

  Expected: PASS；表单和自然语言入口调用同一 API/结果组件，预算变化只改变 advisory 展示，表单字段语义可见。

- [ ] **Step 6: Commit only the task files**

  Run: `git add frontend/src/services/api.ts frontend/src/pages/visitor/RecommendPage.tsx frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx; git commit -m "feat(frontend): submit structured route planning requests"`

  Expected: 提交只包含前端 API、推荐页和对应测试。

### Task 5: 对齐浏览器测试和兼容调用审计

**Files:**
- Modify: `frontend/e2e/fixtures.ts`
- Modify: `frontend/e2e/core-journeys.spec.ts`
- Modify: `frontend/e2e/mobile.spec.ts`
- Test: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx`

**Interfaces:**
- Consumes: Task 4 的结构化 request 和统一响应字段。
- Produces: 浏览器 mock 只响应 `/route/plan`；推荐页生产链路没有 `/recommend` 调用，旧接口仅由兼容测试覆盖。

- [ ] **Step 1: Add failing browser-level assertions**

  在 Playwright fixture 中记录请求路径和 body；新增断言要求 `/recommend` 页面提交 `/api/v1/visitor/route/plan`，body 含结构化 scene state；`core-journeys` 验证路线卡片、缺失事实追问和降级文案；`mobile` 验证新表单在窄屏仍可操作；添加断言没有调用旧 `/recommend`。

- [ ] **Step 2: Run targeted browser tests and verify failure**

  Run: `npm run test:e2e --prefix frontend -- e2e/core-journeys.spec.ts e2e/mobile.spec.ts`

  Expected: FAIL on old fixture path/old form controls before migration is reflected in mocks and assertions。

- [ ] **Step 3: Update fixture and browser expectations**

  将 fixture 的 route response 改成统一响应，补齐 `explanation.input_effects`、`route_rationale` 和时长拆分；删除推荐页对静态模板 response 的 mock 分支。仅保留旧 `/recommend` 的后端兼容测试，不在前端生产或浏览器 fixture 中使用它。

- [ ] **Step 4: Run targeted browser tests and verify pass**

  Run: `npm run test:e2e --prefix frontend -- e2e/core-journeys.spec.ts e2e/mobile.spec.ts`

  Expected: PASS；浏览器链路只命中统一规划端点，移动端控件可见且没有 page error。

- [ ] **Step 5: Commit only the task files**

  Run: `git add frontend/e2e/fixtures.ts frontend/e2e/core-journeys.spec.ts frontend/e2e/mobile.spec.ts; git commit -m "test(frontend): verify unified route planning flow"`

  Expected: 提交不包含后端或评测数据。

### Task 6: 完成权威回归、物理基线和规格一致性验证

**Files:**
- Test only: `backend/src/services/route/route-benchmark.test.ts`
- Test only: `backend/src/services/scene/scene-benchmark.test.ts`
- Test only: `backend/tests/api/visitor.test.ts`
- Test only: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx`
- Read-only audit: `backend/src/services/rag-service.ts`、`backend/src/services/retrieval/hybrid-retriever.ts`、`docs/ablation_report.md`、`evaluation/results/scene/scene_benchmark_v1.json`、`evaluation/results/route/route_validator_v1.json`

**Interfaces:**
- Consumes: 所有前序任务的统一接口和测试；现有权威场景/路线 fixture。
- Produces: 可复现的完整测试记录；确认 40/40 场景、60/60 路线且物理硬违规为 0；确认 RAG 与权威评测文件未发生修改。

- [ ] **Step 1: Add final invariance tests before running the suite**

  增加/补齐测试：同一结构化输入重复两次 route 深相等；兴趣顺序互换 route、score、total duration 相等；受控 fixture 中 culture 与 nature 产生不同最优路线；180 与 360 分钟均不超预算且长预算可容纳更多有效行程；`limited/wheelchair` 不含不可访问道路/景点；演出不满足时返回 rejected-preference 或 infeasible 的诚实结果；软偏好相同最优路线时解释已应用条件且不伪造差异。

- [ ] **Step 2: Run the complete backend and frontend suites**

  Run: `npm test --prefix backend`; `npm run build --prefix backend`; `npm run test:unit --prefix frontend`; `npm run build --prefix frontend`; `npm run test:e2e --prefix frontend -- e2e/core-journeys.spec.ts e2e/mobile.spec.ts`

  Expected: 全部 PASS；无 TypeScript 类型错误、无推荐页旧接口调用、无静态模板生产路径。

- [ ] **Step 3: Run the project-mandated scene and route baselines**

  Run: `python -m unittest discover -s backend/python/tools -p "test_*.py"`; `npm test --prefix backend -- --test-name-pattern "scene|route|benchmark"`; then inspect `evaluation/results/scene/scene_benchmark_v1.json` and `evaluation/results/route/route_validator_v1.json` without rewriting them.

  Expected: 既有 23 景点、31 道路、14 项验证基线保持不变。

- [ ] **Step 4: Audit RAG and authoritative evaluation immutability**

  Run: `git diff --name-only dae4950..HEAD -- backend/src/services/rag-service.ts backend/src/services/retrieval/hybrid-retriever.ts docs/ablation_report.md evaluation/results`; `rg -n "INTEREST_ROUTES|/visitor/recommend|/visitor/route/plan|Promise\.all|RRF|k.?=.?60" backend/src frontend/src docs`

  Expected: RAG 文件和权威评测数据无本任务修改；生产推荐链路不再引用 `INTEREST_ROUTES`；检索表述仍是 `Promise.all` 三路并行 + RRF `k=60` + Cross-Encoder + 官方指南兜底。

- [ ] **Step 5: Perform final plan/spec self-review before claiming completion**

  逐项对照设计规格第 3、5、6、7、8、9、10、11、12 节，检查请求字段、字段语义、迁移顺序、错误 outcome、解释字段、前端表单和所有回归命令；执行占位符关键词扫描，预期无匹配；检查所有跨任务函数名、类型和字段名一致。

- [ ] **Step 6: Commit only verification/test changes if any**

  Run: `git status --short`; 若最终验证只产生日志/临时文件则删除本次产生且不再使用的临时文件；仅当本任务确实修改了列出的测试文件时运行 `git add backend/src/services/route/route-benchmark.test.ts backend/src/services/scene/scene-benchmark.test.ts backend/tests/api/visitor.test.ts frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx; git commit -m "test(route): preserve trusted planning baselines"`。

  Expected: 不提交 RAG、评测结果、设计规格或其他用户资产；工作区剩余改动仍保持原样。

## Execution Handoff

本计划按“偏好与时长策略 → 统一应用服务 → API 兼容层 → 前端结构化表单 → 浏览器链路 → 全量回归”的依赖顺序执行。每个任务先写失败测试，再实现最小修复并运行任务级测试；执行者应使用 `superpowers:executing-plans` 或 `superpowers:subagent-driven-development`，不得重新进行 brainstorming。完成 Task 6 且所有回归通过前，不得宣称修复完成；本计划本身不修改设计规格、RAG 架构或权威评测数据。
