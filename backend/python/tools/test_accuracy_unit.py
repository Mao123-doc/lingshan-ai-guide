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
    @staticmethod
    def _question(question_id):
        questions = json.loads(
            Path(__file__).with_name("test_questions.json").read_text(encoding="utf-8")
        )
        return next(question for question in questions if question["id"] == question_id)

    def test_height_accepts_all_correct_measurement_scales_without_wrong_fact(self):
        question = self._question(1)
        result = MODULE.evaluate_answer(
            "灵山大佛通高88米，佛体高79米，含台基总高101.5米。",
            question,
        )

        self.assertEqual(result["fact_recall"], 1.0)
        self.assertFalse(result["has_forbidden_fact"])
        self.assertTrue(result["passed"])

    def test_wall_size_requires_both_length_and_height(self):
        question = self._question(13)
        result = MODULE.evaluate_answer("灵山大照壁长39.8米。", question)

        self.assertEqual(result["fact_hits"], 1)
        self.assertEqual(result["min_fact_hits"], 2)
        self.assertFalse(result["passed"])

    def test_temple_relics_require_multiple_independent_facts(self):
        question = self._question(12)
        result = MODULE.evaluate_answer("祥符禅寺内有六角井。", question)

        self.assertEqual(result["fact_hits"], 1)
        self.assertEqual(result["min_fact_hits"], 3)
        self.assertFalse(result["passed"])

    def test_history_route_requires_multiple_scenic_spots(self):
        question = self._question(37)
        result = MODULE.evaluate_answer("推荐路线：灵山大佛。", question)

        self.assertEqual(result["fact_hits"], 1)
        self.assertEqual(result["min_fact_hits"], 4)
        self.assertFalse(result["passed"])

    def test_history_route_with_required_spots_passes_fact_coverage(self):
        question = self._question(37)
        result = MODULE.evaluate_answer(
            "历史文化路线：祥符禅寺→灵山大佛→灵山梵宫→五印坛城。",
            question,
        )

        self.assertEqual(result["fact_hits"], 4)
        self.assertEqual(result["min_fact_hits"], 4)
        self.assertTrue(result["passed"])

    def test_history_route_from_knowledge_guide_passes_fact_coverage(self):
        question = self._question(37)
        result = MODULE.evaluate_answer(
            "历史文化路线：祥符禅寺→灵山大佛→灵山梵宫→五印坛城→三圣殿。",
            question,
        )

        self.assertTrue(result["passed"])

    def test_family_route_from_knowledge_guide_passes_fact_coverage(self):
        question = self._question(38)
        result = MODULE.evaluate_answer(
            "亲子路线：九龙灌浴→百子戏弥勒→灵山梵宫→五印坛城。",
            question,
        )

        self.assertTrue(result["passed"])

    def test_history_route_with_noncanonical_old_spot_does_not_replace_a_required_fact(self):
        question = self._question(37)
        result = MODULE.evaluate_answer(
            "历史文化路线：祥符禅寺→灵山大佛→灵山梵宫→无尽意斋。",
            question,
        )

        self.assertEqual(result["fact_hits"], 3)
        self.assertFalse(result["passed"])

    def test_family_route_with_noncanonical_other_area_spot_does_not_replace_a_required_fact(self):
        question = self._question(38)
        result = MODULE.evaluate_answer(
            "亲子路线：九龙灌浴→百子戏弥勒→梵天花海。",
            question,
        )

        self.assertEqual(result["fact_hits"], 2)
        self.assertFalse(result["passed"])

    def test_grounded_paraphrases_are_accepted_by_fact_contracts(self):
        cases = [
            (10, "五印坛城是典型的藏式碉楼建筑风格。", "style"),
            (12, "祥符禅寺内有千年古银杏。", "ginkgo"),
            (23, "佛教文化博览馆位于灵山大佛的座基内。", "location"),
            (30, "灵山胜境是国家AAAAA级旅游景区。", "level"),
            (50, "建议至少安排半天；想深度体验可以安排一整天。", "duration"),
            (48, "梵宫星空穹顶高28米，用100公斤纯金绘制。", "material"),
        ]

        for question_id, answer, fact_id in cases:
            with self.subTest(question_id=question_id):
                result = MODULE.evaluate_answer(answer, self._question(question_id))
                self.assertIn(fact_id, result["matched_fact_ids"])

    def test_temple_relics_accept_knowledge_base_aliases(self):
        result = MODULE.evaluate_answer(
            "祥符禅寺内有六角古井、千年古银杏和江南第一钟。",
            self._question(12),
        )

        self.assertEqual(result["fact_hits"], 3)
        self.assertTrue(result["passed"])

    def test_five_directions_accept_compact_direction_aliases(self):
        result = MODULE.evaluate_answer(
            "五方五佛对应东、南、西、北、中五个方位。",
            self._question(34),
        )

        self.assertEqual(result["fact_hits"], 5)
        self.assertTrue(result["passed"])

    def test_single_character_alias_requires_a_standalone_token(self):
        self.assertTrue(MODULE._contains_any("东、南、西、北、中五个方位", ["东"]))
        self.assertFalse(MODULE._contains_any("东阳木雕与中国文化", ["东"]))
        self.assertFalse(MODULE._contains_any("东阳木雕与中国文化", ["中"]))

    def test_numeric_fact_does_not_match_as_part_of_a_longer_number(self):
        self.assertFalse(MODULE._contains_any("高188米", ["88米"]))

    def test_numeric_fact_matches_when_standalone_in_text(self):
        self.assertTrue(MODULE._contains_any("高88米", ["88米"]))

    def test_meter_fact_does_not_match_as_part_of_a_longer_meter_value(self):
        self.assertFalse(MODULE._contains_any("高17米", ["7米"]))

    def test_bare_number_does_not_match_time(self):
        self.assertFalse(MODULE._contains_any("演出时间14:00", ["4"]))

    def test_number_with_unit_matches_natural_sentence(self):
        self.assertTrue(MODULE._contains_any("一天4场", ["4场"]))

    def test_year_matches_longer_date(self):
        self.assertTrue(MODULE._contains_any("1997年11月15日", ["1997年"]))

    def test_evaluation_config_disables_history_and_full_knowledge(self):
        self.assertFalse(MODULE.EVALUATION_CONFIG["enableHistory"])
        self.assertFalse(MODULE.EVALUATION_CONFIG["includeFullKnowledge"])
        self.assertEqual(MODULE.EVALUATION_CONFIG["retrievalTopK"], 8)
        self.assertEqual(MODULE.EVALUATION_CONFIG["contextTopK"], 5)

    def test_ablation_profiles_define_the_six_experiment_variants(self):
        profiles = MODULE.get_ablation_profiles()

        self.assertEqual(
            set(profiles),
            {
                "vector_only",
                "structured_only",
                "keyword_only",
                "full_retrieval",
                "vector_rerank",
                "full_without_rerank",
                "full_without_rewrite",
            },
        )
        self.assertEqual(
            profiles["vector_only"]["enableVectorRetrieval"], True
        )
        self.assertEqual(
            profiles["vector_only"]["enableStructuredRetrieval"], False
        )
        self.assertEqual(
            profiles["vector_only"]["enableKeywordRetrieval"], False
        )
        self.assertEqual(
            profiles["structured_only"]["enableVectorRetrieval"], False
        )
        self.assertEqual(
            profiles["structured_only"]["enableStructuredRetrieval"], True
        )
        self.assertEqual(
            profiles["structured_only"]["enableKeywordRetrieval"], False
        )
        self.assertEqual(
            profiles["keyword_only"]["enableVectorRetrieval"], False
        )
        self.assertEqual(
            profiles["keyword_only"]["enableStructuredRetrieval"], False
        )
        self.assertEqual(
            profiles["keyword_only"]["enableKeywordRetrieval"], True
        )
        self.assertTrue(profiles["full_retrieval"]["enableRerank"])
        self.assertFalse(profiles["full_without_rerank"]["enableRerank"])
        self.assertFalse(profiles["full_without_rewrite"]["enableQueryRewrite"])

    def test_ablation_profiles_keep_evaluation_controls_fixed(self):
        profiles = MODULE.get_ablation_profiles()
        for config in profiles.values():
            self.assertFalse(config["enableHistory"])
            self.assertFalse(config["includeFullKnowledge"])
            self.assertEqual(config["retrievalTopK"], 8)
            self.assertEqual(config["contextTopK"], 5)

    def test_embedding_model_is_not_loaded_during_module_import(self):
        self.assertIsNone(MODULE._embedder)

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

    def test_summary_uses_all_questions_and_reports_categories(self):
        questions = [
            {"id": 1, "category": "景点数据"},
            {"id": 2, "category": "历史背景"},
        ]
        results = [
            {"question_id": 1, "api_success": True, "passed": True},
            {"question_id": 2, "api_success": False, "passed": False},
        ]

        summary = MODULE.summarize_results(results, questions)

        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["passed"], 1)
        self.assertEqual(summary["accuracy"], 50.0)
        self.assertEqual(summary["api_success_rate"], 0.5)
        self.assertEqual(summary["by_category"]["景点数据"]["total"], 1)
        self.assertEqual(summary["by_category"]["历史背景"]["api_failures"], 1)


if __name__ == "__main__":
    unittest.main()
