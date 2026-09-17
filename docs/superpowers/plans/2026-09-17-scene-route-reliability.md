# Scene Route Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Every task must use RED → GREEN → verification and end with the listed acceptance gate.

**Goal:** Make scene-constrained route planning reliable for natural user input, event schedules, accessible travel, multi-stop paths, and conversational clarification without changing RAG, LLM, retrieval, evaluation, prompts, or model parameters.

**Architecture:** Keep scene extraction, route planning, route validation, API response mapping, and visitor presentation as separate contracts. Treat time/location/budget/mobility as hard constraints, requested performances as explicit preferences that cannot be silently substituted, and route usefulness as an optimization objective only after hard constraints are satisfied.

**Tech Stack:** TypeScript, Express, Zod, Node test runner via `tsx --test`, React/Vite, Vitest, Playwright.

**Spec:** The design contract is recorded below in this plan and must be reviewed against the existing route data before implementation. Do not edit knowledge facts to make a case pass.

## Global Constraints

- Do not modify RAG, Query Rewrite, Retrieval, Rerank, LLM, prompts, Evaluation, Top-K, or model parameters.
- Do not guess the current time when the user did not provide it.
- Do not silently replace an exact requested performance time with another performance.
- Preserve the existing uncommitted visitor-language changes in `frontend/`.
- Do not stage unrelated files. Before each commit inspect `git diff --stat`, `git status --short`, and `git diff --check`.
- Do not run the full 50-question LLM baseline as part of this work.

## Current Failure Contract to Preserve as Regression Evidence

The following cases must be captured before production changes:

1. The exact elderly-user query with current time `10:00` rejects the `14:00` show because the three-hour deadline is `13:00`.
2. The same query with `13:00` can reach the `14:00` show.
3. `现在中午12点` currently fails to parse `currentTime`.
4. A performance step currently uses the venue `visit_minutes` rather than `performance.duration_minutes`.
5. Direct-edge lookup can miss a valid multi-edge path.

## Phase 0 — Freeze and Baseline

- [ ] Record current branch, commit, status, and diff without touching existing frontend changes.
- [ ] Run the existing scene and route tests from `backend/package.json`.
- [ ] Add a route scenario test file only if the existing benchmark cannot express the five baseline cases.
- [ ] Record JSON-level outputs for the six fixed inputs in the implementation report.

**Gate:** The baseline is reproducible, no unrelated file is modified, and current failures are explicitly known.

## Phase 1 — Natural Scene Time Parsing

**Files:** `backend/src/services/scene/scene-state.ts`, `backend/src/services/scene/scene-state.test.ts`, related API tests if present.

- [ ] Add RED tests for `上午10点`, `早上十点`, `下午一点半`, `中午12点`, `中午十二点`, and missing current time.
- [ ] Implement the smallest shared clock parser extension; do not add a general normalization framework.
- [ ] Keep event time parsing separate from current-time parsing so `两点的《吉祥颂》` remains `14:00` for the performance request.
- [ ] Keep missing current time as a clarification condition when a performance or time budget requires it.

**Acceptance:** All supported expressions map to the expected `HH:mm`; no input causes the parser to use machine time; missing time produces a structured clarification state.

**Commit gate:** `fix(route): improve natural scene time parsing`

## Phase 2 — Event-Aware Performance Timing

**Files:** `backend/src/services/route/route-contract.ts`, `route-planner.ts`, `route-validator.ts`, and route tests.

- [ ] Add RED tests proving that a 20-minute performance is not represented as a 60-minute venue visit.
- [ ] Represent walking, waiting, performance start, performance duration, and optional venue visit separately.
- [ ] Calculate the performance end from `performance.duration_minutes`.
- [ ] Validate performance location, start time, duration, and budget independently.
- [ ] Preserve exact-time preference semantics: an infeasible `14:00` request is rejected with a reason; any alternative is explicit, never silent.

**Acceptance:** At `13:00` the `14:00` show ends at `14:20` unless an explicitly modelled additional visit is selected; at `10:00` the exact `14:00` request is not marked feasible under a three-hour budget.

**Commit gate:** `fix(route): make performance timing event-aware`

## Phase 3 — Accessible Graph Pathfinding

**Files:** `backend/src/services/route/pathfinding.ts` (new if needed), `route-planner.ts`, `route-validator.ts`, route tests.

- [ ] Add RED tests for a route requiring more than one graph edge.
- [ ] Replace direct-edge-only lookup with deterministic shortest-path search weighted by walking minutes.
- [ ] Filter edges according to supported mobility constraints.
- [ ] Return path segments or an equivalent auditable representation so the validator can verify every transition.
- [ ] Keep `limited_walking` distinct from `wheelchair`; do not invent unsupported accessibility guarantees.

**Acceptance:** Every adjacent route transition is graph-valid, walking totals equal edge totals, inaccessible edges are never selected, and repeated runs are deterministic.

**Commit gate:** `fix(route): add accessible graph pathfinding`

## Phase 4 — Useful Multi-Stop Itineraries

**Files:** `route-planner.ts`, `route-contract.ts`, route tests.

- [ ] Add RED tests for the three-hour elderly-user scenario and for no-useful-route explanations.
- [ ] Rank candidates in this order: hard constraints, required performance, mobility, requested stops, useful coverage, walking/waiting cost.
- [ ] Treat remaining time as a budget and do not return an unexplained 20-minute route when additional valid stops exist.
- [ ] If only a short route is safe or reachable, expose the reason in structured output.

**Acceptance:** The canonical three-hour case returns a meaningful itinerary or a clear limitation; it never presents an arbitrary short route as a complete answer.

**Commit gate:** `fix(route): optimize useful accessible itineraries`

## Phase 5 — Conversational Clarification and Visitor Output

**Files:** Locate the actual `/api/v1/visitor/route/plan` handler with `rg`; then modify only the necessary API mapping and visitor UI files. Preserve existing uncommitted frontend wording changes.

- [ ] Add API/UI tests for missing `currentTime`.
- [ ] Map internal missing fields to a human question such as “你现在大约几点开始游览？”.
- [ ] Keep internal IDs, reason codes, and trace fields available for diagnostics but never display them to visitors.
- [ ] Display rejected exact performances and explicit alternatives in natural Chinese.

**Acceptance:** Missing information starts a follow-up interaction rather than showing `currentTime`; the user can answer and retry; no technical identifier appears in visitor-facing output.

**Commit gate:** `fix(visitor): make route clarification conversational`

## Phase 6 — Route Reliability Benchmark and Full Verification

**Files:** `backend/src/services/route/route-scenario.test.ts`, `route-benchmark.test.ts`, related frontend tests.

- [ ] Cover natural time variants, missing time, exact and feasible performances, event duration, multi-edge paths, elderly mobility, wheelchair mobility, impossible constraints, and repeated determinism.
- [ ] Add assertions for `route_is_connected`, `route_within_time_budget`, `performance_time_correct`, `walking_time_consistent`, and `has_explanation_for_rejection`.
- [ ] Run focused backend tests, all backend tests, frontend unit tests, frontend E2E tests, frontend/backend builds, and `git diff --check`.
- [ ] Run the canonical live smoke cases only after deterministic tests pass; do not run the 50-question LLM baseline.

**Acceptance thresholds:**

- Scene parsing: 100% of the defined natural-language regression cases pass.
- Route connectivity: 100% of benchmark plans validate.
- Performance timing: 100% of benchmark event durations are correct.
- Impossible request marked feasible: 0.
- Missing-information result exposing technical field names: 0.
- Same input producing different deterministic route results: 0.

**Commit gate:** `test(route): add route reliability benchmark`

## Final Review and Integration Gate

- [ ] Review the complete diff for scope: route planning, scene parsing, API/UI clarification, and tests only.
- [ ] Confirm existing frontend uncommitted changes were either intentionally committed separately or remain untouched.
- [ ] Run `git status --short`, `git diff --stat`, `git diff --check`, backend tests/build, frontend unit/E2E/build.
- [ ] Only then create the final PR or merge commit. Do not claim route reliability from the RAG 50-question score.

## Required Execution Report

For each phase, report:

- files changed;
- RED command and failure evidence;
- GREEN command and result;
- acceptance checks;
- remaining risks;
- commit SHA and exact scope.

