# Scene Constraint Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make ordinary visitor language produce correctly attributed time constraints and truthful route outcomes, including useful alternatives when soft preferences are impossible.

**Architecture:** Keep deterministic extraction and planning. Add role-aware temporal evidence in Scene State, make the planner distinguish executable/alternative/clarification/infeasible outcomes, and let the API/UI render that outcome instead of inferring success from a boolean alone.

**Tech Stack:** TypeScript, Zod, Node test runner via `tsx`, React, Ant Design, existing Express API.

**Spec:** `docs/superpowers/specs/2026-09-16-scene-constraint-repair-design.md`

## Global Constraints

- Do not modify RAG retrieval, knowledge content, LLM prompts, model parameters, Top-K, or Evaluation Gold data.
- Time expressions retain a semantic role and source phrase; never choose the last clock expression in the whole query.
- Hard constraints remain authoritative; soft preferences may be rejected only with an explicit reason.
- An empty `steps` array must never be returned with a successful/feasible route outcome.
- Ambiguous material constraints produce clarification, not a silent guess.
- Every production behavior change starts with a failing regression test.

---

### Task 1: Role-aware scene time extraction

**Files:**
- Modify: `backend/src/services/scene/scene-state.ts`
- Test: `backend/src/services/scene/scene-state.test.ts`

**Interfaces:** Preserve `extractSceneState(query: string): SceneState`, existing SceneState fields, and existing planner consumers. Add internal helpers that associate performance time with the performance phrase instead of selecting the final clock expression globally.

- [ ] **Step 1: Write the failing tests**

Add this case plus numeric, Chinese, meridiem and half-hour variants:

```ts
const state = extractSceneState('我带腿脚不方便的妈妈，现在在景区入口，只有三小时，还想看两点的《吉祥颂》，应该怎么走？现在上午10点');
assert.equal(state.currentTime, '10:00');
assert.equal(state.preferredPerformanceTimes?.[PERFORMANCE_IDS.JIXIANGSONG], '14:00');
```

- [ ] **Step 2: Verify RED**

Run `npm exec -- tsx --test src/services/scene/scene-state.test.ts` in `backend`. Expected: the new assertion fails because the current implementation assigns the final `10:00` token to the performance.

- [ ] **Step 3: Implement the minimum fix**

Make `detectPerformance` parse a time only in the clause naming the performance. Keep `extractClock` responsible for current time and preserve the existing duration parser.

- [ ] **Step 4: Verify GREEN**

Run `npm exec -- tsx --test src/services/scene/scene-state.test.ts src/services/scene/scene-benchmark.test.ts` in `backend`. Expected: all scene tests pass and the 40-case benchmark remains unchanged.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/services/scene/scene-state.ts backend/src/services/scene/scene-state.test.ts
git commit -m "fix(scene): preserve temporal constraint roles"
```

### Task 2: Truthful planner outcomes and alternatives

**Files:**
- Modify: `backend/src/services/route/route-planner.ts`
- Modify: `backend/src/services/route/route-validator.ts`
- Test: `backend/src/services/route/route-planner.test.ts`

**Interfaces:** Add an outcome field with values `feasible`, `feasible_with_rejected_preferences`, `needs_clarification`, or `infeasible`; preserve `feasible`, `steps`, `rejectedRequests`, and `violations` for compatibility. Use `performance_outside_time_budget`, `performance_already_started`, and `no_alternative_route` reason codes.

- [ ] **Step 1: Write the failing tests**

Cover 10:00 plus 180 minutes plus a 14:00 performance, an optional rejected performance with a valid alternative route, and a no-alternative case:

```ts
assert.notEqual(result.outcome, 'feasible');
assert.ok(result.steps.length > 0 || result.outcome === 'infeasible');
assert.ok(result.rejectedRequests.some(item => item.reasonCode === 'performance_outside_time_budget'));
```

- [ ] **Step 2: Verify RED**

Run `npm exec -- tsx --test src/services/route/route-planner.test.ts` in `backend`. Expected: current code returns an empty plan with `feasible=true` and `performance_unavailable`.

- [ ] **Step 3: Implement the minimum planner change**

Retain hard constraints, retry planning without rejected soft performance preferences, and select that alternative only if its steps validate. Set `infeasible` for no valid steps or unsatisfied hard constraints. Do not hide hard violations.

- [ ] **Step 4: Verify GREEN**

Run `npm exec -- tsx --test src/services/route/route-validator.test.ts src/services/route/route-planner.test.ts src/services/route/route-benchmark.test.ts` in `backend`. Expected: 60 cases, zero hard violations, infeasible F1 at least 0.90, deterministic output.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/services/route/route-planner.ts backend/src/services/route/route-validator.ts backend/src/services/route/route-planner.test.ts
git commit -m "fix(route): return truthful constrained outcomes"
```

### Task 3: API and recommendation UI outcome contract

**Files:**
- Modify: `backend/src/api/v1/visitor.ts`
- Modify: `frontend/src/pages/visitor/RecommendPage.tsx`
- Create: `frontend/src/pages/visitor/route-outcome.ts`
- Test: `frontend/tests/route-outcome.test.ts`

**Interfaces:** Keep `route`, `feasibility`, `explanation`, and `evidence`; forward `outcome` and structured reason messages. `getRouteOutcomeLabel(outcome, stepCount)` must never return an executable label for zero steps.

- [ ] **Step 1: Write the failing UI test**

```ts
assert.equal(getRouteOutcomeLabel('feasible', 0), '无法生成可执行路线');
assert.equal(getRouteOutcomeLabel('feasible', 1), '路线可执行');
assert.equal(getRouteOutcomeLabel('feasible_with_rejected_preferences', 1), '已调整部分偏好');
assert.equal(getRouteOutcomeLabel('infeasible', 0), '当前约束无法满足');
```

- [ ] **Step 2: Verify RED**

Run `node --experimental-strip-types --test tests/route-outcome.test.ts` in `frontend`. Expected: module-not-found before the helper exists.

- [ ] **Step 3: Implement API/UI behavior**

Forward planner `outcome` from `/route/plan`. Render a timeline only for non-empty valid steps; render adjustment details for alternatives; render conflict/next-action details for infeasible results; never show “路线可执行” for zero steps.

- [ ] **Step 4: Verify GREEN**

Run `node --experimental-strip-types --test tests/route-outcome.test.ts` and `npm run build` in `frontend`. Expected: test passes and build exits 0.

- [ ] **Step 5: Commit**

```powershell
git add backend/src/api/v1/visitor.ts frontend/src/pages/visitor/RecommendPage.tsx frontend/src/pages/visitor/route-outcome.ts frontend/tests/route-outcome.test.ts
git commit -m "fix(visitor): explain constrained route outcomes"
```

### Task 4: End-to-end verification

**Files:** No production file changes expected.

- [ ] **Step 1: Run relevant tests and builds**

Run the existing Python evaluator tests, all scene/route/RAG TypeScript tests, backend `npm run build`, frontend `npm run build`, and `git diff --check`.

- [ ] **Step 2: Run live smoke cases**

Verify:

1. `现在上午10点，还想看两点的《吉祥颂》，只有三小时` → current `10:00`, requested `14:00`, clear deadline explanation, never empty feasible.
2. Same request with enough time → valid timeline containing the performance.
3. Mandatory impossible performance → `infeasible`.
4. Missing current time → `needs_clarification`.

- [ ] **Step 3: Final review**

Run `git status --short --branch` and `git diff --check`; confirm no RAG, knowledge, model, Top-K, or Evaluation Gold files changed. Report exact outcomes and known pre-existing frontend lint issues.
