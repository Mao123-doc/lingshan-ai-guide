"""Deterministic retrieval benchmark primitives and result aggregation.

This module deliberately does not call an LLM or alter the RAG service.  It
validates a gold retrieval manifest and scores saved API traces by canonical
document IDs.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def recall_at_k(retrieved_ids: list[str], gold_ids: set[str], k: int) -> float:
    if not gold_ids:
        return 0.0
    retrieved = set(retrieved_ids[: max(k, 0)])
    return 1.0 if retrieved.intersection(gold_ids) else 0.0


def recall_at_k_groups(
    retrieved_groups: list[list[str]], gold_ids: set[str], k: int
) -> float:
    if not gold_ids:
        return 0.0
    return 1.0 if any(set(group).intersection(gold_ids) for group in retrieved_groups[: max(k, 0)]) else 0.0


def reciprocal_rank_at_k(retrieved_ids: list[str], gold_ids: set[str], k: int) -> float:
    for rank, document_id in enumerate(retrieved_ids[: max(k, 0)], start=1):
        if document_id in gold_ids:
            return 1.0 / rank
    return 0.0


def reciprocal_rank_at_k_groups(
    retrieved_groups: list[list[str]], gold_ids: set[str], k: int
) -> float:
    for rank, group in enumerate(retrieved_groups[: max(k, 0)], start=1):
        if set(group).intersection(gold_ids):
            return 1.0 / rank
    return 0.0


def percentile(values: Iterable[float], percentage: float) -> float | None:
    ordered = sorted(float(value) for value in values)
    if not ordered:
        return None
    if percentage <= 0:
        return ordered[0]
    if percentage >= 100:
        return ordered[-1]
    position = (len(ordered) - 1) * percentage / 100
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return round(ordered[lower], 3)
    weight = position - lower
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * weight, 3)


def validate_gold_records(
    records: list[dict[str, Any]], known_document_ids: set[str]
) -> list[str]:
    errors: list[str] = []
    seen_question_ids: set[int] = set()
    for index, record in enumerate(records):
        question_id = record.get("question_id")
        if not isinstance(question_id, int):
            errors.append(f"record {index}: question_id must be an integer")
        elif question_id in seen_question_ids:
            errors.append(f"record {index}: duplicate question_id {question_id}")
        else:
            seen_question_ids.add(question_id)

        query = record.get("query")
        if not isinstance(query, str) or not query.strip():
            errors.append(f"record {index}: query is required")

        gold_ids = record.get("gold_document_ids")
        if not isinstance(gold_ids, list) or not gold_ids:
            errors.append(f"record {index}: gold_document_ids must be non-empty")
            continue
        if len(gold_ids) != len(set(gold_ids)):
            errors.append(f"record {index}: duplicate gold_document_ids")
        unknown = sorted(set(gold_ids) - known_document_ids)
        if unknown:
            errors.append(
                f"record {index}: unknown document id(s): {', '.join(unknown)}"
            )
    return errors


def stage_execution_state(stage: dict[str, Any] | None) -> str:
    """Return execution state from status, never from configured alone."""

    if not stage:
        return "missing"
    status = stage.get("status") or stage.get("outcome")
    if status in {"executed", "skipped", "failed", "unavailable"}:
        return str(status)
    if stage.get("executed") is True:
        return "executed"
    if stage.get("executed") is False:
        return "skipped"
    return "unknown"


def record_outcome(record: dict[str, Any]) -> str:
    if not record.get("api_success", False):
        return "api_failure"
    if record.get("fallback_used", False):
        return "local_fallback"
    if record.get("retrieval_error"):
        return "retrieval_failure"
    if not record.get("retrieved_ids"):
        return "no_result"
    return "ok"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_retrieved_ids(response: dict[str, Any]) -> list[str]:
    trace = response.get("evaluation_trace") or response.get("trace") or {}
    ids = trace.get("retrievedIds") or trace.get("retrieved_ids")
    if isinstance(ids, list):
        return [str(item) for item in ids]
    chunks = response.get("retrieved_chunks") or []
    if isinstance(chunks, list):
        return [str(chunk.get("id")) for chunk in chunks if chunk.get("id")]
    return []


def extract_stage_map(response: dict[str, Any]) -> dict[str, dict[str, Any]]:
    trace = response.get("evaluation_trace") or response.get("trace") or {}
    retrieval = trace.get("retrieval") or {}
    return {
        "vector": retrieval.get("vector") or {},
        "structured": retrieval.get("structured") or {},
        "keyword": retrieval.get("keyword") or {},
    }


def _compact_text(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def canonicalize_documents(
    evidence_documents: list[dict[str, Any]],
    field_texts: dict[str, str],
) -> tuple[list[str], list[str]]:
    """Map returned chunk text to structured IDs using exact source spans.

    This is an evaluation-only namespace adapter. It never changes the
    returned ranking. A document is mapped only when a sufficiently long
    contiguous span from a structured field is present in the evidence text;
    unmatched IDs remain visible to prevent silent credit.
    """

    groups, unmatched = canonicalize_document_groups(evidence_documents, field_texts)
    canonical_ids = [document_id for group in groups for document_id in group]
    return list(dict.fromkeys(canonical_ids)), unmatched


def canonicalize_document_groups(
    evidence_documents: list[dict[str, Any]],
    field_texts: dict[str, str],
) -> tuple[list[list[str]], list[str]]:
    """Return canonical IDs grouped by original evidence rank."""

    fragments: dict[str, list[str]] = {}
    for document_id, text in field_texts.items():
        compact = _compact_text(text)
        if len(compact) < 12:
            fragments[document_id] = [compact] if compact else []
            continue
        window = 16 if len(compact) >= 16 else len(compact)
        starts = range(0, max(1, len(compact) - window + 1), 4)
        fragments[document_id] = [compact[start : start + window] for start in starts]

    groups: list[list[str]] = []
    unmatched: list[str] = []
    for evidence in evidence_documents:
        evidence_id = str(evidence.get("id", ""))
        compact_evidence = _compact_text(str(evidence.get("text", "")))
        matches = [
            document_id
            for document_id, snippets in fragments.items()
            if any(snippet and snippet in compact_evidence for snippet in snippets)
        ]
        if not matches:
            unmatched.append(evidence_id)
            continue
        groups.append(list(dict.fromkeys(matches)))
    return groups, unmatched


def load_structured_field_texts(path: Path) -> dict[str, str]:
    """Parse the current structured dataset into canonical field documents."""

    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    fields = (
        "location",
        "params",
        "coreFunction",
        "culture",
        "description",
        "highlights",
        "openingInfo",
        "notes",
    )
    records: dict[str, str] = {}
    index = 0
    code_pattern = re.compile(r"^(LS|NH)-\d+$")
    while index < len(lines):
        if not code_pattern.match(lines[index]):
            index += 1
            continue
        spot_id = lines[index]
        index += 1
        while index < len(lines) and not lines[index]:
            index += 1
        if index >= len(lines):
            break
        index += 1  # spot name
        values: list[str] = []
        for _ in fields:
            while index < len(lines) and not lines[index]:
                index += 1
            if index >= len(lines):
                values.append("")
                continue
            values.append(lines[index])
            index += 1
        for field, value in zip(fields, values):
            if value:
                records[f"{spot_id}_{field}"] = value
    return records


def score_record(record: dict[str, Any], gold: dict[str, Any]) -> dict[str, Any]:
    retrieved_ids = list(record.get("retrieved_ids") or [])
    retrieved_groups = list(record.get("retrieved_rank_groups") or [])
    gold_ids = set(gold["gold_document_ids"])
    outcome = record_outcome(record)
    if retrieved_groups:
        recall = lambda k: recall_at_k_groups(retrieved_groups, gold_ids, k)
        mrr = reciprocal_rank_at_k_groups(retrieved_groups, gold_ids, 5)
    else:
        recall = lambda k: recall_at_k(retrieved_ids, gold_ids, k)
        mrr = reciprocal_rank_at_k(retrieved_ids, gold_ids, 5)
    return {
        "question_id": gold["question_id"],
        "query": gold["query"],
        "gold_document_ids": sorted(gold_ids),
        "retrieved_ids": retrieved_ids,
        "retrieved_rank_groups": retrieved_groups,
        "recall_at_1": recall(1),
        "recall_at_3": recall(3),
        "recall_at_5": recall(5),
        "mrr_at_5": mrr,
        "outcome": outcome,
        "eligible_for_retrieval_metrics": outcome in {"ok", "no_result"},
        "latency_ms": record.get("latency_ms"),
        "stages": record.get("stages") or {},
        "error": record.get("error"),
    }


def aggregate_scored_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    if not records:
        return {
            "count": 0,
            "recall_at_1": None,
            "recall_at_3": None,
            "recall_at_5": None,
            "mrr_at_5": None,
            "no_result_rate": None,
            "api_failure_rate": None,
            "latency_p50_ms": None,
            "latency_p95_ms": None,
        }

    observable = [
        item for item in records if item["outcome"] not in {"api_failure", "local_fallback"}
    ]
    eligible = [item for item in observable if item["eligible_for_retrieval_metrics"]]

    def mean(items: list[dict[str, Any]], key: str) -> float | None:
        return round(sum(float(item[key]) for item in items) / len(items), 4) if items else None

    latencies = [item["latency_ms"] for item in records if isinstance(item.get("latency_ms"), (int, float))]
    return {
        "count": len(records),
        "eligible_count": len(eligible),
        "observable_count": len(observable),
        "local_fallback_count": sum(item["outcome"] == "local_fallback" for item in records),
        "recall_at_1": mean(eligible, "recall_at_1"),
        "recall_at_3": mean(eligible, "recall_at_3"),
        "recall_at_5": mean(eligible, "recall_at_5"),
        "mrr_at_5": mean(eligible, "mrr_at_5"),
        "no_result_rate": round(sum(item["outcome"] == "no_result" for item in observable) / len(observable), 4) if observable else None,
        "api_failure_rate": round(sum(item["outcome"] == "api_failure" for item in records) / len(records), 4),
        "latency_p50_ms": percentile(latencies, 50),
        "latency_p95_ms": percentile(latencies, 95),
    }
