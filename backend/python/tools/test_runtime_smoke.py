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


if __name__ == "__main__":
    unittest.main()
