"""Deterministic quality gates for saved RAG evaluation records."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _iter_stages(value: Any):
    if isinstance(value, dict):
        if 'configured' in value or 'status' in value:
            yield value
        for child in value.values():
            yield from _iter_stages(child)
    elif isinstance(value, list):
        for child in value:
            yield from _iter_stages(child)


def load_gate_config(path: str | Path) -> dict:
    config_path = Path(path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    if config.get('schema_version') != 1 or not isinstance(config.get('thresholds'), dict):
        raise ValueError(f'invalid quality gate config: {config_path}')
    return config
def trace_is_consistent(trace: dict | None) -> bool:
    """Reject configured stages that did not execute and executed disabled stages."""
    for stage in _iter_stages(trace or {}):
        configured = stage.get('configured')
        status = stage.get('status')
        if configured is True and status != 'executed':
            return False
        if configured is False and status == 'executed':
            return False
    return True


def classify_record(record: dict) -> dict:
    """Classify one record before it enters Full-RAG quality denominators."""
    if not record.get('api_success', False):
        return {'eligible': False, 'outcome': 'api_failure'}
    if record.get('fallback_used', False) or record.get('outcome') == 'local_fallback':
        return {'eligible': False, 'outcome': 'local_fallback'}
    if not trace_is_consistent(record.get('trace')):
        return {'eligible': False, 'outcome': 'trace_inconsistent'}
    if not isinstance(record.get('evaluation'), dict):
        return {'eligible': False, 'outcome': 'missing_evaluation'}
    return {'eligible': True, 'outcome': 'eligible'}


def validate_formal_run(records: list[dict], expected_count: int) -> dict:
    """Validate that a saved Full-RAG run is complete and auditable."""
    failures: list[str] = []
    question_ids = [record.get('question_id') for record in records]

    def add_failure(name: str) -> None:
        if name not in failures:
            failures.append(name)

    if len(records) != expected_count:
        add_failure('record_count_mismatch')
    if len(question_ids) != len(set(question_ids)):
        add_failure('duplicate_question_id')

    api_failures = 0
    fallback_count = 0
    trace_inconsistent_count = 0
    missing_evaluation_count = 0
    missing_model_identity_count = 0
    generation_not_executed_count = 0

    for record in records:
        if not record.get('api_success', False):
            api_failures += 1
        if record.get('fallback_used', False):
            fallback_count += 1

        trace = record.get('trace') or {}
        if not trace_is_consistent(trace):
            trace_inconsistent_count += 1

        generation = trace.get('generation') or {}
        if generation.get('status') != 'executed' or generation.get('fallbackUsed', False):
            generation_not_executed_count += 1

        identity = generation.get('modelIdentity')
        if not isinstance(identity, dict) or identity.get('status') == 'unknown':
            missing_model_identity_count += 1

        if not isinstance(record.get('evaluation'), dict):
            missing_evaluation_count += 1

    if api_failures:
        add_failure('api_failure')
    if fallback_count:
        add_failure('local_fallback')
    if trace_inconsistent_count:
        add_failure('trace_inconsistent')
    if generation_not_executed_count:
        add_failure('generation_not_executed')
    if missing_model_identity_count:
        add_failure('missing_model_identity')
    if missing_evaluation_count:
        add_failure('missing_evaluation')

    return {
        'eligible': not failures,
        'failures': failures,
        'total': len(records),
        'expected_count': expected_count,
        'api_failures': api_failures,
        'fallback_count': fallback_count,
        'trace_inconsistent_count': trace_inconsistent_count,
        'generation_not_executed_count': generation_not_executed_count,
        'missing_model_identity_count': missing_model_identity_count,
        'missing_evaluation_count': missing_evaluation_count,
    }


def evaluate_run(
    records: list[dict],
    thresholds: dict,
    baseline: dict | None = None,
    metrics: dict | None = None,
) -> dict:
    classifications = [classify_record(record) for record in records]
    eligible_records = [
        record for record, classification in zip(records, classifications)
        if classification['eligible']
    ]
    passed_count = sum(
        bool((record.get('evaluation') or {}).get('passed'))
        for record in records
    )
    total = len(records)
    eligible_count = len(eligible_records)
    pass_rate = passed_count / total if total else 0.0
    fact_values = [
        float((record.get('evaluation') or {}).get('fact_recall', 0.0))
        for record in eligible_records
    ]
    fact_recall = sum(fact_values) / len(fact_values) if fact_values else 0.0

    refusal_records = [
        record for record in records
        if (record.get('question') or {}).get('expected_behavior') == 'abstain'
    ]
    refusal_accuracy = (
        sum(bool((record.get('evaluation') or {}).get('passed')) for record in refusal_records)
        / len(refusal_records)
        if refusal_records else None
    )

    failures: list[str] = []
    if pass_rate < thresholds.get('min_pass_rate', 0.0):
        failures.append('pass_rate_below_threshold')
    if fact_recall < thresholds.get('min_fact_recall', 0.0):
        failures.append('fact_recall_below_threshold')
    if refusal_accuracy is not None and refusal_accuracy < thresholds.get('min_refusal_accuracy', 0.0):
        failures.append('refusal_accuracy_below_threshold')

    fallback_count = sum(c['outcome'] == 'local_fallback' for c in classifications)
    trace_inconsistent_count = sum(c['outcome'] == 'trace_inconsistent' for c in classifications)
    if fallback_count:
        failures.append('local_fallback')
    if trace_inconsistent_count:
        failures.append('trace_inconsistent')

    current_metrics = metrics or {}
    hard_violations = int(current_metrics.get('route_hard_violations', 0))
    if hard_violations > thresholds.get('max_route_hard_violations', float('inf')):
        failures.append('route_hard_violations')

    if baseline:
        if pass_rate < baseline.get('pass_rate', pass_rate) or fact_recall < baseline.get('fact_recall', fact_recall):
            failures.append('baseline_regression')

    return {
        'eligible': not failures,
        'failures': failures,
        'total': total,
        'eligible_count': eligible_count,
        'api_failures': sum(c['outcome'] == 'api_failure' for c in classifications),
        'fallback_count': fallback_count,
        'trace_inconsistent_count': trace_inconsistent_count,
        'passed': passed_count,
        'pass_rate': round(pass_rate, 3),
        'fact_recall': round(fact_recall, 3),
        'refusal_total': len(refusal_records),
        'refusal_accuracy': round(refusal_accuracy, 3) if refusal_accuracy is not None else None,
        'route_hard_violations': hard_violations,
    }
