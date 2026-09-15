import importlib.util
import sys
import types
import unittest
import json
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("test_accuracy.py")
fake_sentence_transformers = types.ModuleType("sentence_transformers")


class FakeSentenceTransformer:
    def __init__(self, *args, **kwargs):
        pass

    def encode(self, values, **kwargs):
        return [[1.0] for _ in values]


fake_sentence_transformers.SentenceTransformer = FakeSentenceTransformer
sys.modules.setdefault("sentence_transformers", fake_sentence_transformers)
SPEC = importlib.util.spec_from_file_location("test_accuracy", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EvaluationBaselineTests(unittest.TestCase):
    def test_question_set_has_explicit_fact_contract(self):
        questions = json.loads(
            Path(__file__).with_name("test_questions.json").read_text(encoding="utf-8")
        )

        self.assertEqual(len(questions), 50)
        for question in questions:
            self.assertIn(question.get("expected_behavior"), {"answer", "abstain"})
            self.assertIsInstance(question.get("facts"), list)
            self.assertGreater(len(question["facts"]), 0)

    def test_session_id_is_unique_per_question(self):
        first = MODULE.build_session_id("run-1", {"id": 1})
        second = MODULE.build_session_id("run-1", {"id": 2})

        self.assertNotEqual(first, second)
        self.assertEqual(first, "eval_run-1_q1")

    def test_api_failure_is_counted_as_failed_result(self):
        result = MODULE.evaluate_api_result(
            {"answer": "", "error": "timeout"},
            {"id": 1, "question": "问题", "expected_keywords": ["答案"]},
        )

        self.assertFalse(result["api_success"])
        self.assertFalse(result["passed"])
        self.assertEqual(result["error"], "timeout")

    def test_fact_score_rejects_forbidden_fact_even_when_required_fact_matches(self):
        question = {
            "id": 1,
            "question": "灵山大佛有多高？",
            "expected_keywords": ["88米"],
            "facts": [{"id": "height", "acceptable": ["88米"]}],
            "forbidden": ["79米"],
        }

        result = MODULE.evaluate_answer("灵山大佛高88米，但也有人说79米。", question)

        self.assertEqual(result["fact_recall"], 1.0)
        self.assertTrue(result["has_forbidden_fact"])
        self.assertFalse(result["passed"])

    def test_unavailable_semantic_score_is_not_a_fake_half(self):
        old_has_embed = MODULE.HAS_EMBED
        try:
            MODULE.HAS_EMBED = False
            self.assertIsNone(MODULE.semantic_score("回答", "问题"))
        finally:
            MODULE.HAS_EMBED = old_has_embed

    def test_abstention_question_accepts_knowledge_base_refusal(self):
        question = {
            "id": 2,
            "question": "知识库外问题",
            "expected_keywords": [],
            "expected_behavior": "abstain",
        }

        result = MODULE.evaluate_answer("我暂时无法准确回答这个问题，建议您咨询景区游客中心工作人员。", question)

        self.assertTrue(result["passed"])
        self.assertTrue(result["abstention_match"])


if __name__ == "__main__":
    unittest.main()
