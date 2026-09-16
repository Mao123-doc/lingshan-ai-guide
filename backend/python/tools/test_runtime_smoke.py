import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("run_runtime_smoke.py")
SPEC = importlib.util.spec_from_file_location("run_runtime_smoke", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC) if SPEC else None
if SPEC and SPEC.loader:
    try:
        SPEC.loader.exec_module(MODULE)
    except FileNotFoundError:
        MODULE = None


class RuntimeSmokeTests(unittest.TestCase):
    def setUp(self):
        if MODULE is None:
            self.fail("run_runtime_smoke.py has not been created")

    def test_configured_but_not_executed_is_not_full_rag(self):
        record = {
            "api_success": True,
            "fallback_used": False,
            "trace": {
                "rewrite": {"configured": True, "status": "skipped"},
                "generation": {"configured": True, "status": "executed"},
            },
        }

        self.assertFalse(MODULE.is_full_rag_record(record))

    def test_local_fallback_is_not_full_rag(self):
        record = {
            "api_success": True,
            "fallback_used": True,
            "trace": {
                "rewrite": {"configured": True, "status": "executed"},
                "generation": {"configured": True, "status": "executed"},
            },
        }

        self.assertFalse(MODULE.is_full_rag_record(record))

    def test_missing_llm_health_blocks_before_questions(self):
        health = {
            "status": "ok",
            "llm": "offline",
            "vector_search": True,
        }

        with patch.object(MODULE, "load_questions") as load_questions:
            result = MODULE.run_smoke(
                base_url="http://127.0.0.1:8010",
                require_llm=True,
                require_vector=True,
                health_payload=health,
            )

        self.assertFalse(result["ready"])
        self.assertIn("llm_unavailable", result["failures"])
        load_questions.assert_not_called()

    def test_console_json_is_safe_for_windows_legacy_encoding(self):
        rendered = MODULE.console_json({"answer": "答案 💡"})

        self.assertTrue(rendered.isascii())

    def test_manifest_contains_only_sanitized_runtime_evidence(self):
        result = {
            "schema_version": 1,
            "health": {
                "status": "ok",
                "llm": "deepseek-chat",
                "vector_search": True,
                "knowledge_chunks": 57,
            },
            "question_ids": [1, 3, 31, 37, 42],
            "full_rag_count": 5,
            "records": [{
                "question_id": 1,
                "api_success": True,
                "used_llm": True,
                "fallback_used": False,
                "full_rag": True,
                "latency_ms": 100,
                "trace": {
                    "rewrite": {"configured": True, "status": "executed"},
                    "generation": {"configured": True, "status": "executed"},
                },
                "evaluation": {"fact_hits": 1, "min_fact_hits": 1, "passed": True},
            }],
        }

        manifest = MODULE.build_manifest(result, "abc123")

        self.assertEqual(manifest["commit_sha"], "abc123")
        self.assertEqual(manifest["full_rag_count"], 5)
        self.assertNotIn("DEEPSEEK_API_KEY", str(manifest))
        self.assertNotIn("answer", manifest["records"][0])


if __name__ == "__main__":
    unittest.main()
