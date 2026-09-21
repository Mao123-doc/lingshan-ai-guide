# 竞赛材料事实口径审计与修订计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将主动竞赛材料统一到当前可复现证据，区分历史合格 RAG 基线、2026-09-21 非合格 provider 观测，并修正路网资产数量口径。

**Architecture:** 以 `docs/competition/canonical_claims.yaml` 为事实台账，以 `docs/competition/evaluation-report.md` 和 `docs/ablation_report.md` 为评测解释中心，再同步申报书、PPT 分镜/讲稿、现场演示脚本和 `release/competition_final` 发布副本。历史归档目录只读，不改写历史版本。

**Tech Stack:** Markdown, YAML, LaTeX, PowerShell `rg`/文本审计，现有评测 JSON/Markdown 证据。

**Spec:** `docs/superpowers/specs/2026-09-21-unified-route-planning-design.md`；项目事实约束来自仓库 `AGENTS.md`。

## Global Constraints

- 历史合格 Full-RAG Baseline 仍引用 `evaluation/results/baseline_20260917_020000/`：48/50、96.0%、Fact Recall 0.970、平均延迟 3027.64 ms。
- 历史 7-profile 合格消融仍引用 `evaluation/results/ablation_20260917_013925/`；98.0% 只能称“单次受控运行观察值”，不能称权威基线或普遍规律。
- 2026-09-21 rerun 的 7-profile 结果质量门禁 0/7，不得替代历史权威数据；provider 失败下的 90.0% 只能作为诊断观测。
- 当前确定性证据保持场景 40/40、路线 60/60、hard violations 0；不得把它们扩大解释为真实游客理解 100% 或实时导航保证。
- 当前路线资产实际为 23 个 spot 记录和 30 个 edge 记录；材料不得继续把 31 条道路写成已由当前文件核验的事实，除非先补齐并重新验证正式资产。
- 不修改历史归档材料、官方评分规则原文、RAG 架构代码和权威评测结果目录。

## Task 1: 事实台账与评测中心

**Files:**
- Modify: `docs/competition/canonical_claims.yaml`
- Modify: `docs/ablation_report.md`
- Modify: `docs/competition/evaluation-report.md`
- Modify: `docs/competition/core-innovation-report.md`
- Modify: `docs/competition/limitations.md`

**Interfaces:** canonical claims define allowed wording; evaluation reports reference historical and rerun evidence paths.

- [ ] Add the 2026-09-21 rerun status and 7-profile observed table without replacing the historical baseline.
- [ ] Mark current RAG smoke as `full_rag_count=0` because generation/provider calls failed.
- [ ] Change route topology wording to the currently verifiable `23 route spots + 30 edge records`, with an explicit 31-road reconciliation gap.
- [ ] Add the distinction between 22 structured indexed spots and 23 route spot records.
- [ ] Run a focused numeric and forbidden-word scan over these files.

## Task 2: Active申报书与技术报告源稿

**Files:**
- Modify: `竞赛汇报与文档材料包/03_申报文档与技术报告/核心创新与项目展示报告(万字申报底稿)_optimized.md`
- Modify: `竞赛汇报与文档材料包/03_申报文档与技术报告/灵小禅_可信文旅决策智能体_技术报告与论文底稿_optimized.tex`
- Modify: `竞赛汇报与文档材料包/03_申报文档与技术报告/系统总体技术架构说明.md`
- Modify: `竞赛汇报与文档材料包/03_申报文档与技术报告/系统局限性与改进规划(答辩QA必备).md`
- Modify: `竞赛汇报与文档材料包/03_申报文档与技术报告/核心技术创新点速览.md`

**Interfaces:** source Markdown/TeX must use the same claims as the evaluation center; PDF regeneration is only valid after TeX compiles successfully.

- [ ] Relabel 96.0% and 98.0% as historical run-scoped evidence.
- [ ] Add the current rerun/provider failure limitation and reproducibility boundary.
- [ ] Correct the 23/30 topology inventory statement.
- [ ] Preserve the double-engine architecture and 40/40, 60/60 deterministic claims.
- [ ] Compile the TeX source and inspect the generated PDF text for stale numbers.

## Task 3: Active PPT storyboard, script and handoff material

**Files:**
- Modify: `竞赛汇报与文档材料包/00_交接必读_PPT与文档制作指南.md`
- Modify: `竞赛汇报与文档材料包/01_汇报PPT与导出版/14页高保真分镜设计稿与排版指南_optimized.md`
- Modify: `竞赛汇报与文档材料包/01_汇报PPT与导出版/竞赛汇报PPT制作说明与讲稿.md`
- Modify: `竞赛汇报与文档材料包/01_汇报PPT与导出版/PPT原生矢量图表与排版参数手册.md`

- [ ] Keep historical chart labels but add the exact evidence-run qualifier.
- [ ] Remove wording that implies the 2026-09-21 rerun proves Rerank or Rewrite causality.
- [ ] Correct topology count and add a footnote that 31 is not currently verified in `edges.json`.
- [ ] Keep official score/rubric wording unchanged.

## Task 4: Release package synchronization

**Files:**
- Modify the corresponding Markdown/YAML files under `release/competition_final/00_证据台账与交付规范`, `release/competition_final/01_汇报PPT与导出版`, and `release/competition_final/03_申报文档与技术报告`.
- Do not modify `release/competition_final` binary PDFs/PPTX until source text and rendered output are regenerated and inspected.

- [ ] Synchronize active source corrections into the release Markdown/YAML copies.
- [ ] Recompute or explicitly mark release checksums as stale until binary artifacts are regenerated.
- [ ] Scan release package for forbidden stale claims.

## Task 5: Verification

- [ ] Scan active materials excluding `历史版本归档` and official rule documents for `98.3%`, `97.5%`, unqualified current `98.0%`, `31 条道路`, and claims that current smoke is 5/5 Full-RAG.
- [ ] Confirm every retained 96.0%/98.0% claim names its historical evidence directory or says “单次受控运行观察值”.
- [ ] Confirm route/scene metrics and limitations are unchanged.
- [ ] Run TeX compilation and text extraction if the toolchain is available.
- [ ] Review `git diff --check`, generated output paths, and unrelated worktree changes; do not commit unrelated files.
