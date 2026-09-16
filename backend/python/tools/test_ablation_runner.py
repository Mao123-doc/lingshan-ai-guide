import importlib.util
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory


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

    def test_profile_result_preserves_reported_model_identity(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        record = MODULE.build_question_result(
            {"id": 1, "question": "问题"},
            "full_retrieval",
            {},
            "session-1",
            {"answer": "答案", "model": "deepseek-chat (DeepSeek)"},
            {"passed": True, "api_success": True},
            10,
        )

        self.assertEqual(record["reported_model"], "deepseek-chat (DeepSeek)")

    def test_run_manifest_binds_current_inputs_and_runtime(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            dataset = root / "test_questions.json"
            guide = root / "knowledge_guide.txt"
            dataset.write_text('[{"id": 1}]', encoding="utf-8")
            guide.write_text("guide", encoding="utf-8")

            manifest = MODULE.build_run_manifest(
                run_id="run-1",
                profiles=["full_retrieval"],
                profile_configs={"full_retrieval": {"enableRerank": True}},
                questions=[{"id": 1}],
                commit_sha="abc123",
                health={"status": "ok", "llm": "deepseek-chat", "vector_search": True},
                dataset_path=dataset,
                knowledge_paths=[guide],
            )

        self.assertEqual(manifest["schema_version"], 2)
        self.assertEqual(manifest["run_id"], "run-1")
        self.assertEqual(manifest["git_sha"], "abc123")
        self.assertEqual(manifest["dataset"]["count"], 1)
        self.assertEqual(len(manifest["dataset"]["sha256"]), 64)
        self.assertEqual(len(manifest["knowledge"][0]["sha256"]), 64)
        self.assertEqual(manifest["runtime"]["vector_search"], True)
        self.assertEqual(manifest["profiles"], ["full_retrieval"])

    def test_run_manifest_records_observed_model_identities(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            dataset = root / "test_questions.json"
            guide = root / "knowledge_guide.txt"
            dataset.write_text('[{"id": 1}]', encoding="utf-8")
            guide.write_text("guide", encoding="utf-8")

            manifest = MODULE.build_run_manifest(
                run_id="run-1",
                profiles=["full_retrieval"],
                profile_configs={"full_retrieval": {}},
                questions=[{"id": 1}],
                commit_sha="abc123",
                health={"status": "ok"},
                dataset_path=dataset,
                knowledge_paths=[guide],
                observed_model_identities=[{
                    "status": "mismatch",
                    "requestedModel": "deepseek-chat",
                    "providerModel": "deepseek-flash",
                }],
            )

        self.assertEqual(manifest["observed_model_identities"][0]["status"], "mismatch")

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

    def test_question_result_preserves_fallback_execution_state(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        record = MODULE.build_question_result(
            {"id": 8, "question": "问题"},
            "full_retrieval",
            {},
            "session-8",
            {"answer": "答案", "fallback_used": True},
            {"passed": True, "api_success": True},
            40,
        )

        self.assertTrue(record["fallback_used"])

    def test_report_contains_comparison_tables_and_fixed_settings(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        results = {
            "full_retrieval": {
                "config": {"enableRerank": True, "enableQueryRewrite": True},
                "metrics": {
                    "accuracy": 80.0,
                    "fact_recall": 0.8,
                    "avg_latency_ms": 100.0,
                },
                "records": [],
            },
            "vector_only": {
                "config": {"enableRerank": False, "enableQueryRewrite": True},
                "metrics": {
                    "accuracy": 50.0,
                    "fact_recall": 0.5,
                    "avg_latency_ms": 80.0,
                },
                "records": [],
            },
        }

        report = MODULE.build_ablation_report(results)

        self.assertIn("## 1. 实验目的", report)
        self.assertIn("## 2. 实验设置", report)
        self.assertIn("## 3. 实验结果", report)
        self.assertIn("## 4. 错误分析", report)
        self.assertIn("## 5. 结论", report)
        self.assertIn("| Vector Only | 50.0 | 0.5 | 80.0 |", report)
        self.assertIn("BAAI/bge-large-zh-v1.5", report)
        self.assertIn("requested model", report)
        self.assertIn("provider model identity", report)

    def test_report_marks_missing_profile_without_inventing_metrics(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        report = MODULE.build_ablation_report({})

        self.assertIn("数据尚未生成", report)
        self.assertNotIn("0.0", report)

    def test_report_classifies_parallel_retrieval_trace_without_crashing(self):
        if MODULE is None:
            self.fail("run_ablation.py has not been created")

        results = {
            "full_retrieval": {
                "metrics": {"accuracy": 100.0, "fact_recall": 1.0, "avg_latency_ms": 10.0},
                "records": [
                    {
                        "api_success": True,
                        "trace": {
                            "retrieval": {
                                "vector": {"status": "executed"},
                                "structured": {"status": "executed"},
                                "keyword": {"status": "executed"},
                                "candidates": [{"canonicalId": "LS-001"}],
                                "fusion": {"method": "rrf"},
                            },
                            "retrievalMode": "fusion",
                            "retrievedIds": ["LS-001"],
                        },
                        "evaluation": {"passed": True},
                    }
                ],
            }
        }

        report = MODULE.build_ablation_report(results)

        self.assertIn("- Evaluator: 0", report)


if __name__ == "__main__":
    unittest.main()
