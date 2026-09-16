#!/usr/bin/env python3
"""Run the bounded five-question Full-RAG runtime smoke check."""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parents[2]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from quality_gates import trace_is_consistent  # noqa: E402
from run_ablation import call_qa_api_at  # noqa: E402
from test_accuracy import (  # noqa: E402
    EVALUATION_CONFIG,
    build_session_id,
    evaluate_api_result,
    load_questions,
)


SMOKE_QUESTION_IDS = (1, 3, 31, 37, 42)


def get_health(base_url: str, timeout: int = 10) -> dict[str, Any]:
    request = urllib.request.Request(base_url.rstrip("/") + "/health")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return {"status": "unreachable", "error": str(error)[:300]}


def validate_health(
    health: dict[str, Any],
    require_llm: bool = True,
    require_vector: bool = True,
) -> list[str]:
    failures = []
    if health.get("status") != "ok":
        failures.append("backend_unhealthy")
    if require_llm and (not health.get("llm") or health.get("llm") == "offline"):
        failures.append("llm_unavailable")
    if require_vector and health.get("vector_search") is not True:
        failures.append("vector_unavailable")
    return failures


def _trace_fallback_used(trace: dict[str, Any]) -> bool:
    generation = trace.get("generation") or {}
    return bool(generation.get("fallbackUsed"))


def is_full_rag_record(record: dict[str, Any]) -> bool:
    """Return true only when a record has a successful, non-fallback trace."""
    if not record.get("api_success", False):
        return False
    if record.get("fallback_used", False):
        return False
    if not record.get("used_llm", True):
        return False
    trace = record.get("trace") or {}
    if not trace_is_consistent(trace):
        return False
    if _trace_fallback_used(trace):
        return False
    generation = trace.get("generation") or {}
    return generation.get("status") == "executed"


def _build_record(question: dict, response: dict, evaluation: dict, latency_ms: int) -> dict:
    trace = response.get("evaluation_trace") or {}
    return {
        "question_id": question["id"],
        "question": question,
        "answer": response.get("answer", ""),
        "api_success": not bool(response.get("error")),
        "fallback_used": bool(response.get("fallback_used", False))
        or _trace_fallback_used(trace),
        "used_llm": response.get("used_llm"),
        "trace": trace,
        "evaluation": evaluation,
        "latency_ms": latency_ms,
    }


def run_smoke(
    base_url: str,
    require_llm: bool = True,
    require_vector: bool = True,
    health_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    health = health_payload if health_payload is not None else get_health(base_url)
    health_failures = validate_health(health, require_llm, require_vector)
    result: dict[str, Any] = {
        "schema_version": 1,
        "ready": not health_failures,
        "health": health,
        "failures": health_failures,
        "question_ids": list(SMOKE_QUESTION_IDS),
        "records": [],
    }
    if health_failures:
        return result

    questions_by_id = {question["id"]: question for question in load_questions()}
    missing = [question_id for question_id in SMOKE_QUESTION_IDS if question_id not in questions_by_id]
    if missing:
        result["ready"] = False
        result["failures"] = [f"missing_question_{question_id}" for question_id in missing]
        return result

    run_id = time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    for question_id in SMOKE_QUESTION_IDS:
        question = questions_by_id[question_id]
        session_id = build_session_id("smoke_" + run_id, question)
        started = time.perf_counter()
        response = call_qa_api_at(base_url, question["question"], session_id, EVALUATION_CONFIG)
        latency_ms = round((time.perf_counter() - started) * 1000)
        evaluation = evaluate_api_result(response, question, session_id)
        record = _build_record(question, response, evaluation, latency_ms)
        record["full_rag"] = is_full_rag_record(record)
        result["records"].append(record)

    result["full_rag_count"] = sum(bool(record["full_rag"]) for record in result["records"])
    result["ready"] = result["full_rag_count"] == len(SMOKE_QUESTION_IDS)
    if not result["ready"]:
        result["failures"].append("not_full_rag")
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default="http://127.0.0.1:8010")
    parser.add_argument("--require-llm", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--require-vector", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "results" / "runtime_smoke.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = run_smoke(args.api_base, args.require_llm, args.require_vector)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
