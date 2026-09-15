import importlib.util
import json
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("run_ablation.py")
SPEC = importlib.util.spec_from_file_location("run_ablation", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
try:
    SPEC.loader.exec_module(MODULE)
except FileNotFoundError:
    MODULE = None


class AblationRunnerTests(unittest.TestCase):
    def test_profile_result_preserves_answer_trace_and_evaluation(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        question = {"id": 1, "question": "问题"}
        config = {"enableVectorRetrieval": True}
        response = {
            "answer": "答案",
            "session_id": "session-1",
            "used_llm": True,
            "evaluation_trace": {
                "retrievalMode": "vector",
                "retrievedIds": ["chunk_1"],
            },
            "response_time_ms": 123,
        }
        evaluation = {
            "question_id": 1,
            "passed": True,
            "fact_recall": 1.0,
            "fact_hits": 1,
        }

        record = MODULE.build_question_result(
            question, "vector_only", config, "session-1", response, evaluation, 123
        )

        self.assertEqual(record["question_id"], 1)
        self.assertEqual(record["answer"], "答案")
        self.assertEqual(record["evaluation"], evaluation)
        self.assertEqual(record["trace"], response["evaluation_trace"])
        self.assertEqual(record["latency_ms"], 123)
        self.assertEqual(record["session_id"], "session-1")

    def test_session_ids_are_unique_by_profile_and_question(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        ids = {
            MODULE.build_ablation_session_id("run-1", profile, question_id)
            for profile in ("vector_only", "full_retrieval")
            for question_id in (1, 2)
        }

        self.assertEqual(len(ids), 4)
        self.assertIn("ablation_run-1_vector_only_q1", ids)

    def test_aggregate_metrics_are_computed_from_saved_records(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        records = [
            {
                "api_success": True,
                "evaluation": {"passed": True, "fact_recall": 1.0},
                "trace": {"retrievalMode": "vector", "retrievedIds": ["a"]},
                "latency_ms": 100,
            },
            {
                "api_success": True,
                "evaluation": {"passed": False, "fact_recall": 0.5},
                "trace": {"retrievalMode": "none", "retrievedIds": []},
                "latency_ms": 300,
            },
            {
                "api_success": False,
                "evaluation": None,
                "trace": None,
                "latency_ms": 50,
            },
        ]

        metrics = MODULE.aggregate_records(records)

        self.assertEqual(metrics["total"], 3)
        self.assertEqual(metrics["api_successes"], 2)
        self.assertEqual(metrics["accuracy"], 33.3)
        self.assertEqual(metrics["pass_rate"], 0.5)
        self.assertEqual(metrics["fact_recall"], 0.75)
        self.assertEqual(metrics["avg_latency_ms"], 200.0)
        self.assertEqual(metrics["retrieval_success_rate"], 0.5)

    def test_api_failure_is_saved_without_being_silently_dropped(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        record = MODULE.build_question_result(
            {"id": 7, "question": "问题"},
            "keyword_only",
            {},
            "session-7",
            {"answer": "", "error": "timeout"},
            {"passed": False, "api_success": False, "error": "timeout"},
            30,
        )

        self.assertFalse(record["api_success"])
        self.assertEqual(record["error"], "timeout")
        self.assertFalse(record["evaluation"]["passed"])


if __name__ == "__main__":
    unittest.main()
