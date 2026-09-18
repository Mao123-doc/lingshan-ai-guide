# LLM Scene Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated LLM natural-language scene extraction layer with explicit fallback while keeping `planRoute()` and `validateRoute()` as the only deterministic route execution path.

**Architecture:** Run the existing rule extractor first, optionally call the existing LLM client for a partial scene contract, validate and merge both results, then pass only a validated `SceneState` to the existing route planner. LLM output never contains route order, walking time, or feasibility decisions. Failures, low confidence, and invalid output fall back to the rule extractor and are recorded in a dedicated extraction trace.

**Tech Stack:** TypeScript, Express, Zod, existing `callLLMWithMetadata()`, Node test runner via `tsx`, existing route planner and validator.

**Spec:** `docs/superpowers/specs/2026-09-18-llm-scene-extraction-design.md`

## Global Constraints

- LLM only extracts structured scene information; it never generates a route.
- `planRoute()` and `validateRoute()` remain the only route execution and validation functions.
- LLM failure, invalid JSON, schema failure, timeout, or low confidence must use explicit fallback.
- Do not modify Retrieval, Query Rewrite, Rerank, Top-K, knowledge data, or Evaluation Fact Contract.
- Do not expose API keys or raw model responses in API responses or traces.
- Existing Scene/Route benchmarks and backend/frontend tests must remain passing.
- Every implementation task follows RED → GREEN → focused regression verification.

---

### Task 1: Freeze the current scene-planning contract

**Files:**
- Create: `backend/src/services/scene/scene-extractor.test.ts`
- Modify: `backend/src/services/scene/scene-state.test.ts`
- Test: `backend/src/services/scene/scene-benchmark.test.ts`, `backend/src/services/route/route-benchmark.test.ts`

**Interfaces:**
- Consumes: `extractSceneState(query)`, `SceneStateSchema`, existing route benchmarks.
- Produces: a regression fixture for current rule parsing and the minimum natural-language cases that the new extractor must support.

- [ ] **Step 1: Add failing contract cases for semantic variants**

Add table-driven cases for these inputs and expected fields:

```ts
[
  ['我和对象一起，从上午10点玩到下午5点', { partyType: 'couple', currentTime: '10:00', remainingMinutes: 420 }],
  ['陪家里老人，从景区入口开始，还有3小时', { partyType: 'with_elderly', currentLocation: 'south_gate', remainingMinutes: 180 }],
  ['现在在入口，还有两小时，想看下午4点的吉祥颂', { currentTime: '14:00', remainingMinutes: 120 }],
  ['中午想找地方吃饭，还有5小时', { mealRequested: true, remainingMinutes: 300 }],
]
```

- [ ] **Step 2: Run the focused test to verify RED**

```bash
cd backend
npx tsx src/services/scene/scene-extractor.test.ts
```

Expected: FAIL because the new extraction interface does not exist.

- [ ] **Step 3: Record the current baseline**

```bash
npx tsx src/services/scene/scene-benchmark.test.ts
npx tsx src/services/route/route-benchmark.test.ts
```

Expected: both pass before the new layer is connected to the API.

- [ ] **Step 4: Commit the test-only baseline**

```bash
git add backend/src/services/scene/scene-extractor.test.ts backend/src/services/scene/scene-state.test.ts
git commit -m "test(scene): define natural language extraction contract"
```

### Task 2: Add the extraction result contract and deterministic merge

**Files:**
- Create: `backend/src/services/scene/scene-extractor.ts`
- Modify: `backend/src/services/scene/scene-extractor.test.ts`
- Modify: `backend/src/services/scene/scene-state.ts` only if a shared schema/type export is required

**Interfaces:**
- Consumes: `SceneState`, `SceneStateSchema`, `extractSceneState(query)`.
- Produces: `SceneExtractionResult`, `mergeSceneStates(ruleState, llmState, metadata)`, and `validateSceneState(state)`.

The public contract must be:

```ts
export type SceneExtractionSource = 'llm' | 'rules' | 'fallback' | 'merged';
export type SceneExtractionStatus = 'success' | 'fallback' | 'failed' | 'skipped';

export interface SceneExtractionResult {
  state: SceneState;
  source: SceneExtractionSource;
  confidence: Record<string, number>;
  missingFields: string[];
  conflicts: string[];
  trace: {
    configured: boolean;
    executed: boolean;
    status: SceneExtractionStatus;
    model?: string;
    latencyMs?: number;
    fallbackUsed: boolean;
    reason?: string;
  };
}
```

- [ ] **Step 1: Write failing merge tests**

Assert that matching values merge, missing LLM fields are filled by rules, conflicting critical values are preserved as conflicts, and every merged result passes `SceneStateSchema.safeParse()`.

- [ ] **Step 2: Run the merge tests to verify RED**

```bash
cd backend
npx tsx src/services/scene/scene-extractor.test.ts
```

Expected: FAIL on missing merge functions or missing contract behavior.

- [ ] **Step 3: Implement pure merge and validation**

Use this order for each field: explicit matching value, explicit LLM value, rule value, unambiguous computed value, then missing. Reject LLM fields named `steps`, `walkingMinutes`, `totalMinutes`, `feasible`, or `outcome`.

- [ ] **Step 4: Run focused GREEN verification**

```bash
npx tsx src/services/scene/scene-extractor.test.ts
npx tsx src/services/scene/scene-benchmark.test.ts
```

- [ ] **Step 5: Commit the pure contract layer**

```bash
git add backend/src/services/scene/scene-extractor.ts backend/src/services/scene/scene-extractor.test.ts backend/src/services/scene/scene-state.ts
git commit -m "feat(scene): add validated extraction contract"
```

### Task 3: Implement the LLM adapter with explicit fallback

**Files:**
- Modify: `backend/src/services/scene/scene-extractor.ts`
- Modify: `backend/src/services/scene/scene-extractor.test.ts`
- Test: `backend/src/services/llm-service.test.ts`

**Interfaces:**
- Consumes: `callLLMWithMetadata(messages, options)` and Task 2 merge functions.
- Produces: `extractSceneStateWithLLM(query): Promise<SceneExtractionResult>`.

- [ ] **Step 1: Add mocked LLM RED tests**

Cover valid JSON, invalid JSON, empty response, timeout, unavailable model, and a response containing route fields. Valid JSON must produce `source='llm'`; every failure must produce `source='fallback'` and `fallbackUsed=true`.

- [ ] **Step 2: Run mocked tests to verify RED**

```bash
cd backend
npx tsx src/services/scene/scene-extractor.test.ts
```

- [ ] **Step 3: Implement the JSON-only adapter**

Use `callLLMWithMetadata()` with `{ temperature: 0, max_tokens: 500 }`. Require nullable fields, confidence values from 0 to 1, no route fields, no guessed values, and JSON-only output. Parse and validate with a dedicated Zod schema, map user-facing names through existing aliases, then merge with the rule result. Use `0.75` as the critical-field confidence threshold.

- [ ] **Step 4: Run GREEN verification**

```bash
npx tsx src/services/scene/scene-extractor.test.ts
npx tsx src/services/llm-service.test.ts
```

- [ ] **Step 5: Commit the LLM adapter**

```bash
git add backend/src/services/scene/scene-extractor.ts backend/src/services/scene/scene-extractor.test.ts
git commit -m "feat(scene): add LLM extraction with fallback"
```

### Task 4: Connect the extractor to the route API

**Files:**
- Modify: `backend/src/api/v1/visitor.ts:427-480`
- Modify: `backend/src/services/scene/scene-extractor.ts`
- Modify: the existing backend visitor API test file that owns `/route/plan`

**Interfaces:**
- Consumes: `extractSceneStateWithLLM(query)`, `SceneStateSchema`, `planRoute()`, and `validateRoute()`.
- Produces: an asynchronous route response with `scene_extraction` metadata and unchanged route fields.

- [ ] **Step 1: Add API RED tests**

Test valid LLM extraction, rule fallback after LLM failure, invalid merged state returning clarification instead of HTTP 500, and explicit `scene_state` override validation.

- [ ] **Step 2: Run API tests to verify RED**

```bash
cd backend
npm test -- --test-name-pattern="route"
```

- [ ] **Step 3: Wire the extractor into the handler**

Keep `query`, `scene_state`, `route`, `feasibility`, `outcome`, `explanation`, and `evidence`. Add sanitized `scene_extraction`; never return raw prompt, raw completion, or API configuration. All routes must still come from `planRoute()`.

- [ ] **Step 4: Run API GREEN verification**

```bash
npm test -- --test-name-pattern="route"
npm run build
```

- [ ] **Step 5: Commit API integration**

```bash
git add backend/src/api/v1/visitor.ts backend/tests
git commit -m "feat(route): use validated LLM scene extraction"
```

### Task 5: Add extraction trace and user-facing fallback behavior

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/visitor/RecommendPage.tsx`
- Modify: `frontend/src/pages/visitor/route-outcome.ts`
- Modify: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx`

**Interfaces:**
- Consumes: API `scene_extraction`, `outcome`, `clarification`, and `explanation`.
- Produces: natural-language clarification and optional competition/debug visibility without exposing internal trace terms to ordinary users.

- [ ] **Step 1: Add frontend RED tests**

Assert missing fields show a natural question, fallback is not shown as internal terminology to ordinary users, debug mode can show a clear fallback message, and route steps/performance labels remain unchanged.

- [ ] **Step 2: Run frontend tests to verify RED**

```bash
cd frontend
npm test -- --run
```

- [ ] **Step 3: Implement response types and display mapping**

Keep internal trace fields typed, map them to user-facing Chinese copy, and do not silently hide rejected route requests.

- [ ] **Step 4: Run frontend GREEN verification**

```bash
npm test -- --run
npm run build
```

- [ ] **Step 5: Commit frontend integration**

```bash
git add frontend/src/services/api.ts frontend/src/pages/visitor/RecommendPage.tsx frontend/src/pages/visitor/route-outcome.ts frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx
git commit -m "feat(ui): explain scene extraction fallback"
```

### Task 6: Build the natural-language benchmark and end-to-end gate

**Files:**
- Create: `evaluation/scene/scene_utterance_benchmark.json`
- Create: `backend/src/services/scene/scene-utterance-benchmark.test.ts`
- Modify: `backend/src/services/scene/scene-extractor.test.ts`
- Modify: the existing backend visitor API test file

**Interfaces:**
- Consumes: `extractSceneStateWithLLM()`, the route API, and the deterministic route validator.
- Produces: reproducible extraction accuracy and fallback evidence for at least 30 paraphrases.

- [ ] **Step 1: Add benchmark fixture**

Include at least five variants for each of couple/friends/elderly/children, location, explicit time, time range, remaining duration, indirect performance time, meal request, mobility limitation, and must-visit intent. Mark intentionally missing fields explicitly.

- [ ] **Step 2: Add benchmark assertions**

Assert per-field accuracy, no silent wrong critical fields, no route-field leakage, and truthful `source/status/fallbackUsed` metadata. Set the critical-field gate to 95%.

- [ ] **Step 3: Run benchmark to verify RED**

```bash
cd backend
npx tsx src/services/scene/scene-utterance-benchmark.test.ts
```

- [ ] **Step 4: Run the complete verification suite**

```bash
cd backend
npm test
npx tsx src/services/scene/scene-benchmark.test.ts
npx tsx src/services/route/route-benchmark.test.ts
npm run build
cd ../frontend
npm test -- --run
npm run build
cd ..
git diff --check
```

Expected: all commands exit 0; unavailable-LLM tests explicitly show fallback.

- [ ] **Step 5: Review and commit the complete feature**

```bash
git diff --stat
git status --short
git log --oneline -8
git add backend frontend evaluation
git commit -m "feat(scene): add reliable LLM structured extraction"
```

Before committing, confirm no changes to RAG, retrieval, rerank, prompt, knowledge data, Top-K, or evaluation contracts.

## Final Acceptance Checklist

- [ ] Natural-language benchmark reaches at least 95% on critical fields.
- [ ] Rule fallback works for missing API key, timeout, invalid JSON, and low confidence.
- [ ] `configured`, `executed`, `status`, and `fallbackUsed` are truthful.
- [ ] No LLM output can directly create route steps or feasibility decisions.
- [ ] All route results pass the existing deterministic validator.
- [ ] Existing Scene benchmark passes 40/40.
- [ ] Existing Route benchmark passes 60/60 with zero hard violations.
- [ ] Backend tests and build pass.
- [ ] Frontend tests and build pass.
- [ ] `git diff --check` passes.
