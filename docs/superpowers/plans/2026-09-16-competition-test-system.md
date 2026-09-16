# 竞赛交付级测试体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `codex/scene-agent-upgrade` 分支建立覆盖 API、RAG、路线、前端、真实运行服务和比赛演示的分层测试体系。

**Architecture:** 先建立应用工厂、临时数据根目录和外部服务 Stub，再按后端契约、前端状态、浏览器 E2E、AI 质量、Runtime Smoke、可靠性和发布演练分阶段交付。PR Gate 只执行确定性测试，真实模型只在 Runtime Smoke 和 Competition Rehearsal 中执行。

**Tech Stack:** TypeScript Node Test Runner, `tsx`, Supertest, Vitest, React Testing Library, Playwright, Python pytest, 本地 HTTP Stub, GitHub Actions。

**Spec:** `docs/superpowers/specs/2026-09-16-competition-test-system-design.md`

## Global Constraints

- 不修改 RAG 算法、Prompt、Top-K、模型参数或知识库内容来满足测试。
- 不在 PR Gate 调用 DeepSeek、Agnes、BGE、TTS 或视觉模型。
- 所有集成测试使用临时 `DATA_ROOT`，不能修改正式 `data/`。
- configured、executed、status、fallback_used 必须分别断言。
- 每个生产行为变更先写失败测试并确认 RED，再写最小实现。
- 任何 P0 失败都停止后续阶段。
- 真实 50 题 Baseline 只在 Runtime Smoke 通过后执行。

---

### Task 1: Freeze test contracts

**Files:**
- Create: `docs/testing/feature-matrix.md`
- Create: `docs/testing/acceptance-gates.md`
- Create: `docs/testing/core-journeys.md`
- Test: `backend/python/tools/test_ablation_runner.py` and existing domain tests as evidence sources

**Interfaces:**
- Consumes: current 35 endpoint definitions, 8 frontend routes, current evaluator, scene Gold, route Gold, retrieval Gold.
- Produces: a reviewed mapping from every endpoint and journey to normal/error/auth/runtime tests and numeric acceptance gates.

- [ ] **Step 1: Record the endpoint inventory**

  Copy the current Visitor, Auth and Admin endpoint list from `backend/src/api/v1/visitor.ts`, `backend/src/api/v1/auth.ts` and `backend/src/api/v1/admin.ts` into `docs/testing/feature-matrix.md`, including HTTP method, request shape, response shape, auth requirement and P0/P1/P2 priority.

- [ ] **Step 2: Record the 12 core journeys**

  Add explicit journeys for text QA, streaming QA, follow-up history, voice unsupported, image recognition, feasible route, infeasible route, nearby location, admin login/dashboard, knowledge lifecycle, digital-human configuration and report/export.

- [ ] **Step 3: Run the inventory audit**

  Run:

  ```powershell
  rg -n "visitorRouter\\.(get|post|put|delete)|adminRouter\\.(get|post|put|delete)|authRouter\\.(get|post|put|delete)" backend/src/api/v1
  rg -n "<Route path=" frontend/src/App.tsx
  ```

  Expected: every discovered endpoint and route appears exactly once in the matrix.

- [ ] **Step 4: Commit the contract documents**

  ```powershell
  git add docs/testing docs/superpowers/specs/2026-09-16-competition-test-system-design.md docs/superpowers/plans/2026-09-16-competition-test-system.md
  git commit -m "docs(test): freeze competition test contracts"
  ```

---

### Task 2: Add isolated application and service seams

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/src/config/paths.ts`
- Create: `backend/tests/helpers/test-environment.ts`
- Create: `backend/tests/helpers/stub-services.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/src/db/store.ts`
- Modify: `backend/src/api/v1/admin.ts`
- Modify: `backend/src/services/rag-service.ts`
- Modify: `backend/src/services/vector-search-service.ts`
- Modify: `backend/src/services/llm-service.ts`
- Test: `backend/tests/app-isolation.test.ts`

**Interfaces:**
- Consumes: `DATA_ROOT`, Vector URL and LLM configuration defaults.
- Produces: `createApp(): Express`, `resolveDataPath(name: string): string`, test-only stub endpoints and a test process that never writes formal data.

- [ ] **Step 1: Write the failing isolation test**

  Add tests that import `createApp()` without opening a listener, set `DATA_ROOT` to a temporary directory, send one request through Supertest, and assert that the formal `data/` snapshot is unchanged.

- [ ] **Step 2: Run the isolation test in RED**

  ```powershell
  npm exec -- tsx --test tests/app-isolation.test.ts
  ```

  Expected: FAIL because `createApp` and configurable data paths do not exist.

- [ ] **Step 3: Implement the smallest test seam**

  Move Express middleware and route mounting into `createApp()`. Keep `server.listen()` and WebSocket attachment in `index.ts`. Use `process.env.DATA_ROOT` with the current `data` path as the default. Make Vector and LLM base URLs overridable while preserving production defaults.

- [ ] **Step 4: Run the isolation test in GREEN**

  ```powershell
  npm exec -- tsx --test tests/app-isolation.test.ts
  npm run build
  ```

  Expected: all isolation assertions pass and backend build exits 0.

- [ ] **Step 5: Commit the test seams**

  ```powershell
  git add backend/src backend/tests
  git commit -m "test(infra): isolate application and external services"
  ```

---

### Task 3: Build backend API contract tests

**Files:**
- Create: `backend/tests/api/auth.test.ts`
- Create: `backend/tests/api/visitor.test.ts`
- Create: `backend/tests/api/admin.test.ts`
- Create: `backend/tests/api/data-lifecycle.test.ts`
- Create: `backend/tests/helpers/api-fixtures.ts`
- Modify: `backend/package.json`
- Test: all files under `backend/tests/api`

**Interfaces:**
- Consumes: `createApp()`, temporary `DATA_ROOT`, local LLM/Vector stubs.
- Produces: status/body contract assertions for all 35 endpoints and auth protection for all Admin endpoints.

- [ ] **Step 1: Write failing contract tests**

  Add one successful and one invalid-input case for each endpoint. Add a table-driven test that requests every Admin endpoint without a Bearer token and expects 401.

- [ ] **Step 2: Run the API suite in RED**

  ```powershell
  npm exec -- tsx --test tests/api/*.test.ts
  ```

  Expected: the suite fails because no API test files exist.

- [ ] **Step 3: Implement test helpers only**

  Add temporary file creation, deterministic JWT login, multipart fixtures, and local service stubs. Do not alter endpoint business rules to make assertions pass.

- [ ] **Step 4: Run the API suite in GREEN**

  ```powershell
  npm exec -- tsx --test tests/api/*.test.ts
  npm run build
  ```

  Acceptance: 35/35 endpoint contracts covered, 18/18 Admin auth cases pass, path traversal and invalid upload cases rejected, data lifecycle leaves valid JSON.

- [ ] **Step 5: Commit API tests**

  ```powershell
  git add backend/tests backend/package.json backend/package-lock.json
  git commit -m "test(api): cover visitor admin and auth contracts"
  ```

---

### Task 4: Add frontend component and state tests

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/pages/visitor/__tests__/HomePage.test.tsx`
- Create: `frontend/src/pages/visitor/__tests__/QAPage.test.tsx`
- Create: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx`
- Create: `frontend/src/pages/admin/__tests__/AdminFlows.test.tsx`
- Modify: `frontend/package.json`
- Test: all files under `frontend/src/**/__tests__`

**Interfaces:**
- Consumes: existing `visitorAPI`, `adminAPI`, browser capability APIs and route components.
- Produces: deterministic behavior tests for loading, success, empty, error and permission states.

- [ ] **Step 1: Write failing component tests**

  Use React Testing Library to assert home navigation, QA stream accumulation, TTS failure recovery, route outcome labels, AdminGuard redirect and knowledge upload state.

- [ ] **Step 2: Run frontend tests in RED**

  ```powershell
  npm run test -- --run
  ```

  Expected: FAIL because Vitest configuration and component suite are not present.

- [ ] **Step 3: Add minimal test configuration and tests**

  Mock only HTTP and browser APIs. Assert visible behavior and user actions instead of internal state or snapshots.

- [ ] **Step 4: Run frontend tests in GREEN**

  ```powershell
  npm run test -- --run --coverage
  npm run lint
  npm run build
  ```

  Acceptance: all P0 visitor/admin states pass, critical component statement coverage is at least 80%, branch coverage at least 70%, lint and build exit 0.

- [ ] **Step 5: Commit frontend tests**

  ```powershell
  git add frontend/src frontend/vitest.config.ts frontend/package.json frontend/package-lock.json
  git commit -m "test(frontend): cover critical visitor and admin states"
  ```

---

### Task 5: Add deterministic Playwright journeys

**Files:**
- Create: `frontend/playwright.config.ts`
- Create: `frontend/e2e/fixtures.ts`
- Create: `frontend/e2e/core-journeys.spec.ts`
- Create: `frontend/e2e/mobile.spec.ts`
- Modify: `frontend/package.json`
- Test: all files under `frontend/e2e`

**Interfaces:**
- Consumes: local frontend, isolated backend, Stub LLM/Vector/TTS, browser permissions.
- Produces: 12 journey results, screenshots and traces on failure.

- [ ] **Step 1: Write failing browser journeys**

  Add tests for the 12 journeys listed in `docs/testing/core-journeys.md`. Use role/text locators first; add `data-testid` only where a real accessible locator is impossible.

- [ ] **Step 2: Run Playwright in RED**

  ```powershell
  npx playwright test --project=chromium
  ```

  Expected: FAIL because Playwright configuration and journeys are not present.

- [ ] **Step 3: Configure isolated web servers**

  Start the test backend with temporary data and Stub services, then Vite with the test API target. Grant only required geolocation, microphone and camera permissions per test.

- [ ] **Step 4: Run desktop and mobile journeys in GREEN**

  ```powershell
  npx playwright test --project=chromium --project=mobile-chromium
  ```

  Acceptance: 12/12 journeys pass, no owned-resource 404/5xx, no uncaught page exception, no horizontal overflow at Pixel 7 viewport, and no test passes only after retry.

- [ ] **Step 5: Commit browser tests**

  ```powershell
  git add frontend/e2e frontend/playwright.config.ts frontend/package.json frontend/package-lock.json
  git commit -m "test(e2e): automate critical competition journeys"
  ```

---

### Task 6: Formalize AI quality gates

**Files:**
- Create: `backend/python/tools/test_quality_gates.py`
- Create: `backend/python/tools/test_questions_out_of_scope.json`
- Create: `evaluation/retrieval/retrieval_gate_config.json`
- Create: `evaluation/scene/scene_gate_config.json`
- Create: `evaluation/route/route_gate_config.json`
- Modify: `backend/python/tools/test_ablation_runner.py`
- Test: `backend/python/tools/test_quality_gates.py`
- Test: existing retrieval, scene, route and evaluator tests

**Interfaces:**
- Consumes: frozen 50-question results, 88 retrieval Gold cases, 40 scene cases, 60 route cases and Trace metadata.
- Produces: machine-readable quality gate result with baseline comparison, fallback count, trace consistency and thresholds.

- [ ] **Step 1: Write failing gate tests**

  Add tests for API failure preservation, fallback rejection, configured/executed mismatch, baseline regression, out-of-scope refusal and route hard-violation rejection.

- [ ] **Step 2: Run gate tests in RED**

  ```powershell
  python -m pytest backend/python/tools/test_quality_gates.py -q
  ```

  Expected: FAIL because the quality gate module and out-of-scope contract do not exist.

- [ ] **Step 3: Implement deterministic quality aggregation**

  Keep evaluator semantics unchanged. Read thresholds from versioned JSON files, compare against the current baseline, and emit explicit `eligible`, `fallback_used`, `trace_consistent`, `passed` fields.

- [ ] **Step 4: Run all quality gates**

  ```powershell
  python -m pytest backend/python/tools -q
  npm exec -- tsx --test src/services/scene/scene-benchmark.test.ts src/services/route/route-benchmark.test.ts src/services/rag-trace.test.ts src/services/retrieval/hybrid-retriever.test.ts
  ```

  Acceptance: RAG API success 50/50, fallback 0, pass rate at least 76%, mean fact recall at least 0.835, Recall@5 at least 0.98, scene accuracy at least 0.95, route hard violations 0.

- [ ] **Step 5: Commit quality gates**

  ```powershell
  git add backend/python/tools evaluation/retrieval evaluation/scene evaluation/route
  git commit -m "test(ai): establish competition quality gates"
  ```

---

### Task 7: Add real runtime smoke and evidence manifest

**Files:**
- Create: `backend/python/tools/run_runtime_smoke.py`
- Create: `evaluation/verification/.gitkeep`
- Create: `docs/testing/runtime-smoke.md`
- Modify: `backend/python/tools/test_ablation_runner.py`
- Test: `backend/python/tools/test_runtime_smoke.py`

**Interfaces:**
- Consumes: running Backend, Vector Service, real LLM credentials, BGE model and frozen configuration.
- Produces: sanitized manifest, five Full-RAG smoke results, TTS/vision/WebSocket status and explicit fallback rejection.

- [ ] **Step 1: Write failing runtime smoke tests**

  Test that a response with `configured=true` but `executed=false`, or `fallback_used=true`, is rejected as Full-RAG success. Test that missing LLM health stops the run before any question is sent.

- [ ] **Step 2: Run runtime smoke tests in RED**

  ```powershell
  python -m pytest backend/python/tools/test_runtime_smoke.py -q
  ```

  Expected: FAIL because the runtime smoke runner does not exist.

- [ ] **Step 3: Implement the bounded runner**

  Require `--require-llm`, `--require-vector`, `--require-no-fallback`; query health before questions; run only the fixed five smoke questions; write no secrets; return non-zero on blocked runtime or false Full-RAG execution.

- [ ] **Step 4: Run the real smoke**

  ```powershell
  python backend/python/tools/run_runtime_smoke.py --api-base http://127.0.0.1:8010 --require-llm --require-vector --require-no-fallback
  ```

  Acceptance: LLM online, exact BGE model loaded, five requests complete, all required Trace states accurate, no fallback, all results written to a run directory.

- [ ] **Step 5: Commit the runtime runner**

  ```powershell
  git add backend/python/tools docs/testing evaluation/verification
  git commit -m "test(runtime): add real-service smoke verification"
  ```

---

### Task 8: Reliability, security and release rehearsal

**Files:**
- Create: `backend/tests/reliability/failure-recovery.test.ts`
- Create: `backend/tests/security/upload-and-auth.test.ts`
- Create: `frontend/e2e/release-rehearsal.spec.ts`
- Create: `scripts/verify-release.ps1`
- Modify: `.github/workflows/ci.yml`
- Modify: `backend/package.json`
- Modify: `frontend/package.json`
- Test: all release and reliability tests

**Interfaces:**
- Consumes: all earlier gates, local failure stubs, browser journeys and runtime manifest.
- Produces: one release verdict bound to commit SHA and a competition evidence directory.

- [ ] **Step 1: Write failure and security tests**

  Cover LLM timeout, Vector outage, TTS outage, SSE interruption, WebSocket reconnect, malformed JSON, default secret rejection, path traversal, upload limits, CSV formula input and duplicate submission.

- [ ] **Step 2: Run failure tests in RED**

  ```powershell
  npm exec -- tsx --test tests/reliability/*.test.ts tests/security/*.test.ts
  ```

  Expected: FAIL because these suites are not present.

- [ ] **Step 3: Add release command and CI jobs**

  The release command runs Python tests, backend tests/build, frontend tests/lint/build, Playwright mocked E2E, `git diff --check`, and writes a manifest. GitHub Actions runs deterministic jobs on every PR; runtime smoke remains a manually triggered or protected release job.

- [ ] **Step 4: Run the complete release rehearsal**

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts/verify-release.ps1
  ```

  Acceptance: P0/P1 zero, all deterministic tests green, builds green, 12/12 E2E green, no production data changes, and manifest contains the current commit SHA.

- [ ] **Step 5: Commit release gates**

  ```powershell
  git add backend/tests frontend/e2e scripts .github/workflows/ci.yml backend/package.json frontend/package.json
  git commit -m "test(release): enforce competition delivery gates"
  ```

---

## Final verification

After Task 8, run the full release command once more from a clean worktree, inspect `git diff --check`, inspect the generated manifest, and confirm the branch contains no uncommitted changes. Only then may the branch be pushed or the PR described as competition-ready.
