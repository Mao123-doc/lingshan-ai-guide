# 统一可信路线规划实验重跑方案与结果

> 本文记录 2026-09-21 对当前工作区的重跑方案、实际命令和实验数据。结果以当前工作区代码为准；工作区存在其他未提交改动，未在本文中将其归因到某个单独提交。

**Goal:** 验证推荐页重写、统一 `/route/plan` 请求、场景状态提取和路线规划改动没有破坏既定的前端、API、40 组场景和 60 组路线基线，并明确 RAG 实验是否具备可重跑条件。

**Architecture:** 按依赖从低到高分三层执行：静态/单元验证，确定性场景与路线验证，最后是需要在线 LLM 与向量服务的 RAG 运行验证。每层使用独立命令和现有 fixture；不覆盖 `evaluation/results/baseline_20260917_020000/`、`evaluation/results/ablation_20260917_013925/`、`evaluation/results/scene/scene_benchmark_v1.json` 或 `evaluation/results/route/route_validator_v1.json`。

**Tech Stack:** TypeScript/tsx, Node test runner, Vitest, Playwright Chromium, Python unittest, existing evaluation runners.

**Spec:** `docs/superpowers/specs/2026-09-21-unified-route-planning-design.md`

## Global Constraints

- 景点路网基线保持 23 个景点、31 条道路；本次验证不得修改正式路线资产。
- 路线 60/60 分类正确，物理硬违规必须为 0。
- 场景状态 40/40，关键缺失字段识别保持 100%。
- RAG 50 题基线与 7 组消融数据不得被新运行覆盖；只有在 `vector_search=true` 且无 fallback 时才可形成新的 Full-RAG 结果。
- 前端展示保持推荐页既有视觉结构；页面标题以“按你的情况规划路线”为准。

## Review Focus

- 推荐页移动端旧标题断言：由 `frontend/e2e/mobile.spec.ts` 固定为当前页面标题。
- 统一 API 的纯结构化请求：由 `backend/tests/api/visitor.test.ts` 验证不调用场景抽取。
- `/recommend` 兼容层：由同一 API 测试验证与相同显式场景调用 `/route/plan` 结果等价。
- 时间不足和无障碍硬约束：由 60 组路线 benchmark 验证拒绝与硬违规门禁。
- RAG fallback 不能冒充 Full-RAG：由 `run_runtime_smoke.py` 的 health gate 验证向量服务不可用时不产生合格样本。

## Execution Plan

### Task 1: 前端单元和构建验证

**Files:**
- Test: `frontend/src/pages/visitor/__tests__/RecommendPage.test.tsx`
- Build: `frontend/tsconfig*.json`, `frontend/vite.config.ts`

**Command:**

```powershell
npm run test:unit --prefix frontend
npm run build --prefix frontend
```

**Pass criteria:** 4 个测试文件、15 个测试全部通过；TypeScript 构建和 Vite 构建成功。chunk 体积 warning 不作为失败。

**Observed:** 4 files passed, 15 tests passed；frontend build passed。

### Task 2: 后端 API 和统一规划服务契约

**Files:**
- Test: `backend/tests/api/visitor.test.ts`
- Test: `backend/src/services/route/route-planning-service.test.ts`
- Test: `backend/src/services/route/route-preferences.test.ts`

**Command:**

```powershell
npm test --prefix backend
```

**Pass criteria:** 所有 Node tests 通过；必须覆盖 `/route/plan`、`/recommend` 适配层、显式字段优先级、缺失硬约束追问和 fallback 诚实标记。

**Observed:** 28 tests passed, 0 failed。

### Task 3: 场景状态 40 组 benchmark

**Files:**
- Fixture: `evaluation/scene/scene_gold_v1.json`
- Test: `backend/src/services/scene/scene-benchmark.test.ts`
- Implementation: `backend/src/services/scene/scene-state.ts`

**Command:**

```powershell
cd backend
npx tsx src/services/scene/scene-benchmark.test.ts
```

**Pass criteria:** 40/40 case passed；field accuracy 1.0；`missingCriticalFields` 40/40。

**Observed:** 40/40 passed，field accuracy `1.0`；关键缺失字段 `40/40`。

### Task 4: 路线 60 组形式化 benchmark

**Files:**
- Fixture/assets: `data/route/spots.json`, `data/route/edges.json`, `data/route/performances.json`, `data/route/facilities.json`
- Test: `backend/src/services/route/route-benchmark.test.ts`
- Validator: `backend/src/services/route/route-validator.ts`

**Command:**

```powershell
cd backend
npx tsx src/services/route/route-benchmark.test.ts
```

**Pass criteria:** 60 cases；可行性分类 60/60；hard violations 0；infeasible precision/recall/F1 均不低于 0.9；确定性重复 9 次一致。

**Observed:** 60/60 分类正确；hard violations `0`；infeasible precision `1.0`、recall `1.0`、F1 `1.0`；重复一致性通过。

### Task 5: Python 评测工具回归

**Files:**
- Tests: `backend/python/tools/test_*.py`
- Runners: `backend/python/tools/run_ablation.py`, `backend/python/tools/run_runtime_smoke.py`

**Command:**

```powershell
python -m unittest discover -s backend/python/tools -p "test_*.py"
```

**Pass criteria:** 工具、质量门禁和评测 runner 测试全部通过。

**Observed:** 70 tests passed, 0 failed。

### Task 6: 浏览器 E2E 与移动端回归

**Files:**
- Tests: `frontend/e2e/core-journeys.spec.ts`, `frontend/e2e/mobile.spec.ts`

**Command:**

```powershell
npm run test:e2e --prefix frontend -- --project=chromium
```

**Pass criteria:** 13 个 Chromium E2E 全部通过；推荐页、统一路线规划、移动端可达性和无横向溢出均通过。

**Observed:** 首次运行 12/13，通过修正 `mobile.spec.ts` 的过期标题断言后再次运行，最终 13/13 passed。

### Task 7: RAG runtime readiness gate

**Files:**
- Runner: `backend/python/tools/run_runtime_smoke.py`
- Output: `evaluation/results/rerun_20260921_1405/runtime_smoke.json`
- Output: `evaluation/results/rerun_20260921_1405/runtime_smoke_manifest.json`

**Command:**

```powershell
python backend/python/tools/run_runtime_smoke.py `
  --api-base http://127.0.0.1:8010 `
  --output evaluation/results/rerun_20260921_1405/runtime_smoke.json `
  --manifest-output evaluation/results/rerun_20260921_1405/runtime_smoke_manifest.json
```

**Pass criteria:** health `status=ok`、LLM 可用、`vector_search=true`、无 fallback，之后才允许执行 50 题 Full-RAG 或 7 组消融并纳入质量门禁。

**Observed:**

```json
{
  "ready": false,
  "health": {
    "status": "ok",
    "llm": "deepseek-chat (DeepSeek)",
    "knowledge_chunks": 57,
    "knowledge_indexed": true,
    "vector_search": false
  },
  "failures": ["vector_unavailable"],
  "records": []
}
```

首次 smoke 时向量服务未启动；随后启动仓库现有的 `backend/python/vector_service.py`，重启后端使其重新连接，health 变为 `vector_search=true`。第二次 smoke 的 5 个样本仍全部 `fallbackUsed=true`，`full_rag_count=0`，原因是 DeepSeek 重排/生成调用失败。因此当前环境不具备可审计的 Full-RAG 重跑条件，不能把 fallback 数据写成新的 96.0% 基线。

在向量服务恢复后，已执行 7 profile、每组 50 题的消融，结果保存于 `evaluation/results/rerun_20260921_ablation/`。这些是实际观测数据，但质量门禁全部不合格（每组 `trace_inconsistent=50`、`generation_not_executed=50`、`missing_model_identity=50`），不得替换权威消融结果：

| Profile | 通过 | Accuracy | Fact recall | 平均延迟 | 质量门禁 |
|---|---:|---:|---:|---:|---|
| vector_only | 41/50 | 82.0% | 0.858 | 109.02 ms | 不合格 |
| structured_only | 27/50 | 54.0% | 0.594 | 3.50 ms | 不合格 |
| keyword_only | 45/50 | 90.0% | 0.929 | 4.62 ms | 不合格 |
| full_retrieval | 45/50 | 90.0% | 0.941 | 109.06 ms | 不合格 |
| vector_rerank | 41/50 | 82.0% | 0.858 | 108.16 ms | 不合格 |
| full_without_rerank | 45/50 | 90.0% | 0.941 | 107.90 ms | 不合格 |
| full_without_rewrite | 45/50 | 90.0% | 0.941 | 109.74 ms | 不合格 |

向量服务恢复且 LLM provider 可用后，可用以下命令生成新的、独立的 RAG 结果目录：

```powershell
python backend/python/tools/run_ablation.py `
  --profiles full_retrieval `
  --output-dir evaluation/results/rerun_20260921_full_retrieval `
  --run-id rerun_20260921_full_retrieval `
  --base-url http://127.0.0.1:8010 `
  --report-path evaluation/results/rerun_20260921_full_retrieval/report.md

python backend/python/tools/run_ablation.py `
  --profiles vector_only,structured_only,keyword_only,full_retrieval,vector_rerank,full_without_rerank,full_without_rewrite `
  --output-dir evaluation/results/rerun_20260921_ablation `
  --run-id rerun_20260921_ablation `
  --base-url http://127.0.0.1:8010 `
  --report-path evaluation/results/rerun_20260921_ablation/report.md
```

## Final Evidence Matrix

| 层级 | 实验 | 结果 | 是否可作为新数据 |
|---|---|---:|---|
| 前端 | Unit | 15/15 | 是 |
| 前端 | Chromium E2E | 13/13 | 是 |
| 后端 | API/规划服务 | 28/28 | 是 |
| 场景 | Gold benchmark | 40/40，1.0 | 是 |
| 路线 | Formal benchmark | 60/60，0 hard violation | 是 |
| 工具 | Python tests | 70/70 | 是 |
| RAG | Runtime smoke | vector 已恢复，但 `full_rag_count=0` | 否，等待 LLM provider |
| RAG | 7-profile ablation | 7×50 已执行；质量门禁 0/7 | 否，观测数据不可替代权威基线 |

## Self-Review

- 规格覆盖：统一规划 API、兼容层、场景状态、路线硬约束、前端迁移和回归门禁均有对应任务；RAG 只在环境满足时重跑，未伪造结果。
- 完整性检查：本文没有未定义的实验入口。
- 类型/接口检查：API 以现有 `/api/v1/visitor/route/plan`、`/api/v1/visitor/recommend` 和现有 TypeScript 测试为准。
- 测试遗漏检查：E2E 首次暴露旧标题断言，已更新并复跑为 13/13；RAG 先后记录了向量服务未启动和 LLM provider 失败两个 readiness 结果。
- 数据保护检查：未覆盖历史 baseline、ablation、scene、route 权威结果目录；仅新增 `rerun_20260921_1405` smoke 输出和 `rerun_20260921_ablation` 观测目录。
