# Evaluation Evidence Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make the competition evidence package describe the current committed implementation and current verified Baseline/runtime evidence.

**Architecture:** Keep raw per-question JSON as the authoritative Full-RAG evidence, keep the existing retrieval Gold benchmark unchanged, and refresh only metadata and Markdown summaries from current verified outputs. No RAG behavior, evaluator semantics, model parameters, or knowledge content changes are included.

**Tech Stack:** PowerShell, TypeScript/tsx benchmark tests, Python evaluation artifacts, Markdown, Git.

**Spec:** Active competition delivery objective and current evaluation/route/scene contracts.

## Global Constraints

- Do not modify RAG algorithms, prompts, retrieval Top-K, Fact Contracts, knowledge content, or model parameters.
- Do not rerun the full 7-profile ablation in this refresh; use the already verified current-commit artifact.
- Treat provider model identity mismatch as an explicit reproducibility caveat.
- Do not report stale metrics as current evidence.

### Task 1: Refresh benchmark evidence metadata

**Files:**
- Modify: `evaluation/results/scene/scene_benchmark_v1.json`
- Modify: `evaluation/results/route/route_validator_v1.json`

**Verification:** Re-run the scene and route benchmark tests at the current commit, then update only SHA/derived evidence fields supported by their output and recompute hashes from the current files.

### Task 2: Refresh competition reports

**Files:**
- Modify: `docs/competition/evaluation-report.md`
- Modify: `docs/ablation_report.md`

**Verification:** Ensure the reports reference `baseline_20260917_020000`, the current 48/50 result, current ablation artifact `ablation_20260917_013925`, and explicitly state the provider model mismatch and evaluation limitations.

### Task 3: Verify the evidence package

**Files:**
- No source-code changes.

**Verification:** Run Python evaluator/configuration tests, TypeScript build, `git diff --check`, benchmark tests, and inspect `git diff --stat`, `git status`, and all evidence manifests before any commit decision.
