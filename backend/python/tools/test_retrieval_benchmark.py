import importlib.util
import json
import unittest
from pathlib import Path


MODULE_PATH = (
    Path(__file__).resolve().parents[2]
    / ".."
    / "evaluation"
    / "retrieval"
    / "benchmark.py"
).resolve()
SPEC = importlib.util.spec_from_file_location("retrieval_benchmark", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC) if SPEC else None
if SPEC and SPEC.loader:
    try:
        SPEC.loader.exec_module(MODULE)
    except FileNotFoundError:
        MODULE = None


class RetrievalBenchmarkTests(unittest.TestCase):
    def setUp(self):
        if MODULE is None:
            self.fail("retrieval benchmark module has not been created")

    def test_recall_at_k_uses_gold_document_ids(self):
        self.assertEqual(MODULE.recall_at_k(["a", "b"], {"b", "c"}, 2), 1.0)
        self.assertEqual(MODULE.recall_at_k(["a"], {"b"}, 1), 0.0)

    def test_canonicalizes_chunk_evidence_against_structured_field_text(self):
        evidence = [{"id": "chunk_1", "text": "前文 长39.8m，高7m，采用优质青石雕刻而成。后文"}]
        fields = {"LS-001_params": "长39.8m，高7m，采用优质青石雕刻而成，被誉为华夏第一壁。"}
        canonical, unmatched = MODULE.canonicalize_documents(evidence, fields)
        self.assertEqual(canonical, ["LS-001_params"])
        self.assertEqual(unmatched, [])

    def test_structured_source_parser_recovers_canonical_documents(self):
        source = Path(__file__).resolve().parents[2] / ".." / "data" / "raw" / "knowledge_dataset.txt"
        fields = MODULE.load_structured_field_texts(source.resolve())
        self.assertEqual(len(fields), 176)
        self.assertIn("LS-011_params", fields)

    def test_mrr_at_k_returns_first_gold_rank(self):
        self.assertEqual(MODULE.reciprocal_rank_at_k(["x", "b", "a"], {"a", "b"}, 3), 0.5)
        self.assertEqual(MODULE.reciprocal_rank_at_k(["x"], {"a"}, 5), 0.0)

    def test_percentile_is_deterministic(self):
        self.assertEqual(MODULE.percentile([10, 20, 30, 40], 50), 25.0)
        self.assertEqual(MODULE.percentile([], 95), None)

    def test_gold_validation_rejects_missing_or_duplicate_ids(self):
        records = [
            {"question_id": 1, "query": "q", "gold_document_ids": ["LS-001_params"]},
            {"question_id": 1, "query": "duplicate", "gold_document_ids": ["LS-002_params"]},
        ]
        errors = MODULE.validate_gold_records(records, {"LS-001_params", "LS-002_params"})
        self.assertTrue(any("duplicate" in error for error in errors))

    def test_gold_validation_rejects_unknown_document_id(self):
        records = [{"question_id": 1, "query": "q", "gold_document_ids": ["missing"]}]
        errors = MODULE.validate_gold_records(records, {"LS-001_params"})
        self.assertTrue(any("unknown" in error for error in errors))

    def test_execution_state_does_not_confuse_configured_with_executed(self):
        self.assertEqual(
            MODULE.stage_execution_state({"configured": True, "status": "skipped"}),
            "skipped",
        )
        self.assertEqual(
            MODULE.stage_execution_state({"configured": True, "status": "executed"}),
            "executed",
        )

    def test_aggregate_excludes_local_fallback_from_retrieval_denominator(self):
        records = [
            {
                "recall_at_1": 1.0,
                "recall_at_3": 1.0,
                "recall_at_5": 1.0,
                "mrr_at_5": 1.0,
                "outcome": "ok",
                "eligible_for_retrieval_metrics": True,
                "latency_ms": 10,
            },
            {
                "recall_at_1": 0.0,
                "recall_at_3": 0.0,
                "recall_at_5": 0.0,
                "mrr_at_5": 0.0,
                "outcome": "local_fallback",
                "eligible_for_retrieval_metrics": False,
                "latency_ms": 20,
            },
        ]
        summary = MODULE.aggregate_scored_records(records)
        self.assertEqual(summary["eligible_count"], 1)
        self.assertEqual(summary["recall_at_5"], 1.0)
        self.assertEqual(summary["local_fallback_count"], 1)

    def test_empty_and_failed_records_are_explicit(self):
        self.assertEqual(MODULE.record_outcome({"api_success": False}), "api_failure")
        self.assertEqual(
            MODULE.record_outcome({"api_success": True, "fallback_used": True}),
            "local_fallback",
        )
        self.assertEqual(MODULE.record_outcome({"api_success": True, "retrieved_ids": []}), "no_result")
        self.assertEqual(
            MODULE.record_outcome({"api_success": True, "retrieved_ids": ["a"]}),
            "ok",
        )


if __name__ == "__main__":
    unittest.main()
