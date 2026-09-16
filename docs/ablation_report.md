# RAG Evaluation and Ablation Evidence

## Current evaluation semantics

The current Full-RAG path executes Vector, Structured and Keyword retrieval in parallel, fuses candidates with RRF (`k=60`), optionally reranks, builds context, and calls the LLM. The evaluator records Fact Contract hits and does not treat local fallback as a successful Full-RAG execution.

The older fallback-only interpretation of this report is obsolete. The authoritative retrieval ablation is stored under `evaluation/results/20260915T195912Z_b01d12d8/` and the current 50-question Full-RAG baseline is under `evaluation/results/formal_baseline_20260916/`.

## Formal 50-question Full-RAG baseline

Configuration:

- Query Rewrite: on
- Vector / Structured / Keyword: on
- Rerank: on
- History: off
- Full knowledge injection: off
- Retrieval Top-K: 8
- Context Top-K: 5
- LLM: `deepseek-chat`
- Embedding: `BAAI/bge-large-zh-v1.5`

| Metric | Result |
|---|---:|
| Questions | 50 |
| API successes | 50/50 |
| Fact Contract passed | 39/50 |
| Pass rate | 78.0% |
| Mean fact recall | 0.855 |
| Average latency | 2599.1 ms |
| Retrieval success | 50/50 |
| Local fallback | 0 |
| Retrieval channel failures | 0 |

This is a Fact Contract baseline. It is not a real-user accuracy, satisfaction, or navigation-safety claim.

## Retrieval Gold ablation

The 88-query retrieval benchmark uses the same runtime and five profiles. All profiles had 88/88 eligible and observable requests, zero API failures, and zero local fallbacks.

| Profile | Recall@1 | Recall@3 | Recall@5 | MRR@5 | p50 | p95 |
|---|---:|---:|---:|---:|---:|---:|
| vector_only | 0.3409 | 0.8977 | 0.9886 | 0.6259 | 2398.5 ms | 2923.5 ms |
| structured_only | 0.9318 | 1.0000 | 1.0000 | 0.9659 | 2169.3 ms | 2555.2 ms |
| keyword_only | 0.3182 | 0.7159 | 0.8295 | 0.5091 | 2215.1 ms | 2655.4 ms |
| fused | 0.3409 | 0.9659 | 0.9886 | 0.5947 | 2216.2 ms | 2701.3 ms |
| fused_rerank | 0.3409 | 0.9659 | 0.9886 | 0.5947 | 2636.7 ms | 3212.3 ms |

Structured-only is strongest on this Gold set. Fusion improves Recall@3 over Vector-only but does not beat Structured-only; Rerank adds latency without improving these retrieval metrics. This result is retained as-is and is not presented as evidence that fusion is universally better.

## Reproduction

```powershell
python backend/python/tools/run_ablation.py --profiles full_retrieval --output-dir evaluation/results/formal_baseline_20260916 --run-id formal_baseline_20260916 --report-path evaluation/results/formal_baseline_20260916/generated_report.md
```

The run manifest, raw responses, configuration, hashes and limitations are in `evaluation/results/formal_baseline_20260916/`. The retrieval Gold configuration and raw results are in `evaluation/results/20260915T195912Z_b01d12d8/`.
