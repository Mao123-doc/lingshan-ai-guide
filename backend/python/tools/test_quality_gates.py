import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name('quality_gates.py')
SPEC = importlib.util.spec_from_file_location('quality_gates', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC) if SPEC else None
if SPEC and SPEC.loader:
    try:
        SPEC.loader.exec_module(MODULE)
    except FileNotFoundError:
        MODULE = None


class QualityGateTests(unittest.TestCase):
    def setUp(self):
        if MODULE is None:
            self.fail('quality_gates.py has not been created')

    def test_local_fallback_is_rejected_as_full_rag_success(self):
        verdict = MODULE.classify_record({
            'api_success': True,
            'fallback_used': True,
            'evaluation': {'passed': True, 'fact_recall': 1.0},
        })

        self.assertFalse(verdict['eligible'])
        self.assertEqual(verdict['outcome'], 'local_fallback')

    def test_configured_but_skipped_stage_is_trace_inconsistency(self):
        verdict = MODULE.classify_record({
            'api_success': True,
            'fallback_used': False,
            'trace': {
                'rewrite': {'configured': True, 'status': 'skipped'},
                'generation': {'configured': True, 'status': 'executed'},
            },
            'evaluation': {'passed': True, 'fact_recall': 1.0},
        })

        self.assertFalse(verdict['eligible'])
        self.assertEqual(verdict['outcome'], 'trace_inconsistent')

    def test_baseline_regression_blocks_quality_gate(self):
        result = MODULE.evaluate_run(
            [{'api_success': True, 'fallback_used': False, 'trace': {}, 'evaluation': {
                'passed': False, 'fact_recall': 0.7,
            }}],
            {'min_pass_rate': 0.76, 'min_fact_recall': 0.835},
            baseline={'pass_rate': 0.9, 'fact_recall': 0.9},
        )

        self.assertFalse(result['eligible'])
        self.assertIn('pass_rate_below_threshold', result['failures'])
        self.assertIn('baseline_regression', result['failures'])

    def test_out_of_scope_refusal_accuracy_is_reported_separately(self):
        result = MODULE.evaluate_run([
            {'api_success': True, 'fallback_used': False, 'trace': {}, 'question': {'expected_behavior': 'abstain'},
             'evaluation': {'passed': True, 'fact_recall': 0.0}},
            {'api_success': True, 'fallback_used': False, 'trace': {}, 'question': {'expected_behavior': 'abstain'},
             'evaluation': {'passed': False, 'fact_recall': 0.0}},
        ], {'min_refusal_accuracy': 0.9})

        self.assertEqual(result['refusal_total'], 2)
        self.assertEqual(result['refusal_accuracy'], 0.5)
        self.assertIn('refusal_accuracy_below_threshold', result['failures'])

    def test_route_hard_violations_always_block(self):
        result = MODULE.evaluate_run(
            [], {'max_route_hard_violations': 0},
            metrics={'route_hard_violations': 1},
        )

        self.assertFalse(result['eligible'])
        self.assertIn('route_hard_violations', result['failures'])

    def test_versioned_gate_config_contains_explicit_thresholds(self):
        config_path = Path(__file__).resolve().parents[3] / 'evaluation' / 'retrieval' / 'retrieval_gate_config.json'
        config = MODULE.load_gate_config(config_path.resolve())

        self.assertEqual(config['schema_version'], 1)
        self.assertIn('min_recall_at_5', config['thresholds'])


if __name__ == '__main__':
    unittest.main()
