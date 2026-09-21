# RAG Evaluation and Ablation Evidence

> **Evidence status (2026-09-21):** The tables below remain the historical, quality-gated run from `evaluation/results/ablation_20260917_013925/`; they are not results from the 2026-09-21 rerun. The new rerun is recorded separately because DeepSeek rerank/generation calls failed and all seven quality gates were ineligible.

## Current evaluation semantics

The current Full-RAG path executes Query Rewrite, Vector, Structured and Keyword retrieval,
fuses candidates with RRF (`k=60`), optionally reranks, builds context, and calls the LLM.
The evaluator records Fact Contract hits. Local fallback is not a successful Full-RAG execution.
Each question uses an isolated session with conversation history disabled.

## Formal 50-question Full-RAG baseline

Authoritative artifacts: `evaluation/results/baseline_20260917_020000/`.

Configuration:

- Query Rewrite: on
- Vector / Structured / Keyword: on
- Rerank: on
- History: off
- Full knowledge injection: off
- Retrieval Top-K: 8
- Context Top-K: 5
- Embedding: `BAAI/bge-large-zh-v1.5`
- Requested LLM: `deepseek-chat`
- Provider model observed in trace: `deepseek-flash`

| Metric | Result |
|---|---:|
| Questions | 50 |
| API successes | 50/50 |
| Fact Contract passed | 48/50 |
| Pass rate | 96.0% |
| Mean fact recall | 0.970 |
| Average latency | 3027.64 ms |
| Retrieval success | 50/50 |
| Local fallback | 0 |
| Quality Gate | eligible=true |

This is a Fact Contract baseline. It is not a real-user accuracy, satisfaction, or navigation-safety claim.

## Full 7-profile component ablation

Authoritative artifacts: `evaluation/results/ablation_20260917_013925/`.

All profiles use the same 50 questions, isolated sessions, history off, full knowledge injection off,
Retrieval Top-K 8, Context Top-K 5, and the same evaluator. All seven quality gates are eligible;
there are zero API failures, zero local fallbacks, zero trace inconsistencies, and zero missing model identities.

| Profile | Accuracy | Fact Recall | Avg Latency |
|---|---:|---:|---:|
| Vector only | 94.0% | 0.960 | 2336.08 ms |
| Structured only | 66.0% | 0.694 | 2172.20 ms |
| Keyword only | 96.0% | 0.977 | 2221.56 ms |
| Full retrieval | 98.0% | 0.980 | 2882.68 ms |
| Vector + Rerank | 94.0% | 0.950 | 2873.62 ms |
| Full without Rerank | 90.0% | 0.933 | 2358.02 ms |
| Full without Rewrite | 98.0% | 0.993 | 2414.48 ms |

The numbers are observations from one live-provider run. They support traceable comparison on this
test set, not universal causal claims. The requested/provider model mismatch is recorded in each manifest.

## 2026-09-21 rerun diagnostic (not a replacement baseline)

The independent rerun is stored in `evaluation/results/rerun_20260921_ablation/`. All seven profiles completed 50 API calls, but every profile failed the quality gate because generation was not executed successfully, traces were inconsistent with the configured generation path, and model identity was unavailable. The observed values were: Vector only 82.0% accuracy, Structured only 54.0%, Keyword only 90.0%, Full Retrieval 90.0%, Vector + Rerank 82.0%, Full without Rerank 90.0%, and Full without Rewrite 90.0%. These are provider-failure diagnostics only; they must not be used to claim module contribution, latency improvement, or a new baseline.

The 2026-09-21 runtime smoke also recorded `vector_search=true` after the local vector service was started, but `full_rag_count=0` because the LLM provider failed. See `evaluation/results/rerun_20260921_1405/`.

## Reproduction

Run the current Full-RAG baseline:

```powershell
python backend/python/tools/run_ablation.py `
  --profiles full_retrieval `
  --output-dir evaluation/results/baseline_<timestamp> `
  --run-id baseline_<timestamp> `
  --base-url http://127.0.0.1:8012 `
  --report-path evaluation/results/baseline_<timestamp>/report.md
```

Run the complete component ablation:

```powershell
python backend/python/tools/run_ablation.py `
  --profiles vector_only,structured_only,keyword_only,full_retrieval,vector_rerank,full_without_rerank,full_without_rewrite `
  --output-dir evaluation/results/ablation_<timestamp> `
  --run-id ablation_<timestamp> `
  --base-url http://127.0.0.1:8012 `
  --report-path evaluation/results/ablation_<timestamp>/report.md
```

The manifest, raw per-question traces, configuration, hashes, and quality gate are the authoritative evidence.
