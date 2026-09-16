# Retrieval Ablation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a configuration-driven retrieval ablation runner that executes the fixed 50-question dataset through the existing API and produces reproducible per-experiment results and comparison reports.

**Architecture:** Reuse the existing `POST /api/v1/visitor/qa` pipeline. Experiment profiles are represented in the Python runner as explicit `evaluation_config` payloads; the backend keeps one RAG implementation and emits the existing execution-state trace. The runner evaluates every answer with the existing Fact Contract evaluator and stores raw trace plus aggregate metrics.

**Tech Stack:** TypeScript/Express backend, Python standard library runner, existing evaluator, JSON result files, Markdown report.

**Spec:** `D:\Dev\.codex\attachments\017fb6cc-0dfa-4d44-b16b-f12472e54c6f\pasted-text-1.txt`

## Global Constraints

- Do not modify the knowledge base, questions, Fact Contract, prompt, Top-K, model, or formal answer semantics.
- Use the same 50 questions, evaluator version, model, embedding model, prompt, temperature, and Top-K in every profile.
- Only retrieval enablement, rewrite enablement, and rerank enablement vary by profile.
- Preserve trace for every question; configured and executed remain separate.
- Run evaluator tests, RAG config/trace tests, TypeScript build, and `git diff --check` at every implementation checkpoint.
- Do not run the full 50-question LLM experiments until the runner and tests are reviewed and the runtime is explicitly available.

### Task 1: Add profile validation and test coverage

**Files:**
- Modify: `backend/python/tools/test_accuracy.py`
- Test: `backend/python/tools/test_accuracy_unit.py`

**Interfaces:**
- Reuse `EVALUATION_CONFIG`, `load_questions`, `call_qa_api`, and `evaluate_api_result`.
- Add importable profile/config helpers without changing evaluator scoring semantics.

- [ ] Add tests for six named profiles and assert their boolean differences.
- [ ] Add tests that every profile keeps history off, full knowledge off, retrievalTopK 8, and contextTopK 5.
- [ ] Run the focused Python unit test and confirm the new assertions fail before implementation.
- [ ] Implement profile constants and a validator in the evaluator module.
- [ ] Run all Python evaluator tests and confirm pass.
- [ ] Run TypeScript tests/build and `git diff --check`.
- [ ] Commit with `feat(eval): define retrieval ablation profiles`.

### Task 2: Add the unattended ablation runner

**Files:**
- Create: `backend/python/tools/run_ablation.py`
- Modify: `backend/python/tools/test_accuracy.py` only if a narrowly scoped reusable helper is required.
- Test: `backend/python/tools/test_ablation_runner.py`

**Interfaces:**
- Input: running API, `test_questions.json`, named profiles.
- Output: `results/<profile>.json` with config, per-question answer/evaluation/trace/latency, and aggregate metrics.

- [ ] Write tests for result schema, independent session IDs, metric aggregation, and API failure preservation.
- [ ] Run focused runner tests and confirm RED.
- [ ] Implement a standard-library runner with `--profiles`, `--output-dir`, `--base-url`, and `--dry-run`.
- [ ] Use one unique session ID per question and profile; never share history across questions.
- [ ] Store raw API response and evaluator output, including trace and error classification fields.
- [ ] Compute accuracy/pass rate, fact recall, average latency, API success rate, and retrieval success rate from recorded data.
- [ ] Run runner unit tests, evaluator tests, RAG tests, TypeScript build, and `git diff --check`.
- [ ] Commit with `feat(eval): add retrieval ablation runner`.

### Task 3: Add report generation

**Files:**
- Modify: `backend/python/tools/run_ablation.py`
- Create: `docs/ablation_report.md` only after actual experiments complete.
- Test: `backend/python/tools/test_ablation_runner.py`

**Interfaces:**
- Input: result JSON files from Task 2.
- Output: comparison tables, error analysis, and configuration provenance in Markdown.

- [ ] Add tests for deterministic table formatting and missing-result handling.
- [ ] Implement report generation as a runner option, without changing experiment execution.
- [ ] Include fixed environment/model/configuration values and distinguish failed/skipped/executed trace states.
- [ ] Include retrieval, rerank, generation, and evaluator error buckets without inventing causal labels when trace is insufficient.
- [ ] Run all relevant tests and static checks.
- [ ] Commit with `feat(eval): generate retrieval ablation report`.

### Task 4: Execute formal six-profile experiment matrix

**Files:**
- Create: `results/vector_only.json`
- Create: `results/structured_only.json`
- Create: `results/keyword_only.json`
- Create: `results/full_retrieval.json`
- Create: `results/component_ablation.json`
- Create: `docs/ablation_report.md`

**Interfaces:**
- Input: frozen commit, running Vector Service, online LLM, backend, unchanged 50-question dataset.
- Output: six profile result records and final report.

- [ ] Verify clean Git state and record commit SHA before execution.
- [ ] Verify LLM online, vector health/model/chunk count, backend health, and frozen configuration.
- [ ] Run the runner without manual per-profile configuration edits.
- [ ] Verify every result has 50 question records, trace, answer, evaluation, and latency.
- [ ] Verify aggregate metrics equal recomputation from the saved per-question records.
- [ ] Generate the final report and inspect errors by retrieval/rerank/generation/evaluator evidence.
- [ ] Run `git diff --check` and review generated artifacts.
- [ ] Commit with `experiment: run retrieval ablation` only after result integrity review.

## Verification Matrix

| Requirement | Evidence |
|---|---|
| Configuration-driven pipeline | Profile payloads plus trace differences for vector-only and keyword-only |
| Same control variables | Saved config in every result JSON |
| No evaluator/RAG algorithm change | Diff review and existing test suite |
| Reproducible 50-question execution | Per-profile 50 records and deterministic session/profile metadata |
| Retrieval recall and fact accuracy | Recomputed aggregate metrics from raw records |
| Error traceability | Per-stage trace plus failure classification in each record |
