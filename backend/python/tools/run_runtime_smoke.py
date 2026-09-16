#!/usr/bin/env python3
"""Run the bounded five-question Full-RAG runtime smoke check."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
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


def console_json(value: dict[str, Any]) -> str:
    """Render JSON using ASCII escapes for Windows legacy consoles."""
    return json.dumps(value, ensure_ascii=True, indent=2)


def _stage_summary(stage: Any) -> dict[str, Any]:
    if not isinstance(stage, dict):
        return {"configured": None, "executed": None, "status": "missing"}
    return {
        "configured": stage.get("configured"),
        "executed": stage.get("executed"),
        "status": stage.get("status"),
        "reason": stage.get("reason"),
        "model_identity": stage.get("modelIdentity"),
    }


def resolve_commit_sha() -> str:
    """Resolve the current repository SHA without exposing runtime secrets."""
    configured = os.environ.get("GIT_COMMIT_SHA")
    if configured:
        return configured
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return completed.stdout.strip() or "unknown"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


def build_manifest(result: dict[str, Any], commit_sha: str | None = None) -> dict[str, Any]:
    """Build a redacted evidence manifest without answers, credentials or paths."""
    health = result.get("health") or {}
    records = []
    for record in result.get("records", []):
        trace = record.get("trace") or {}
        retrieval = trace.get("retrieval") or {}
        evaluation = record.get("evaluation") or {}
        records.append({
            "question_id": record.get("question_id"),
            "api_success": record.get("api_success"),
            "used_llm": record.get("used_llm"),
            "fallback_used": record.get("fallback_used"),
            "full_rag": record.get("full_rag"),
            "latency_ms": record.get("latency_ms"),
            "retrieved_ids": trace.get("retrievedIds", []),
            "context_ids": trace.get("contextIds", []),
            "stages": {
                "rewrite": _stage_summary(trace.get("rewrite")),
                "vector": _stage_summary(retrieval.get("vector")),
                "structured": _stage_summary(retrieval.get("structured")),
                "keyword": _stage_summary(retrieval.get("keyword")),
                "rerank": _stage_summary(trace.get("rerank")),
                "generation": _stage_summary(trace.get("generation")),
            },
            "evaluation": {
                "fact_hits": evaluation.get("fact_hits"),
                "min_fact_hits": evaluation.get("min_fact_hits"),
                "fact_recall": evaluation.get("fact_recall"),
                "passed": evaluation.get("passed"),
            },
        })

    return {
        "schema_version": 1,
        "kind": "full-rag-runtime-smoke",
        "commit_sha": commit_sha or resolve_commit_sha(),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configuration": EVALUATION_CONFIG,
        "health": {
            "status": health.get("status"),
            "llm": health.get("llm"),
            "vector_search": health.get("vector_search"),
            "knowledge_chunks": health.get("knowledge_chunks"),
            "knowledge_indexed": health.get("knowledge_indexed"),
        },
        "question_ids": result.get("question_ids", []),
        "full_rag_count": result.get("full_rag_count", 0),
        "ready": result.get("ready", False),
        "failures": result.get("failures", []),
        "records": records,
    }


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
    require_no_fallback: bool = True,
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
        "require_no_fallback": require_no_fallback,
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
    if require_no_fallback:
        result["ready"] = result["full_rag_count"] == len(SMOKE_QUESTION_IDS)
    else:
        result["ready"] = all(record["api_success"] for record in result["records"])
    if not result["ready"]:
        result["failures"].append("not_full_rag")
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-base", default="http://127.0.0.1:8010")
    parser.add_argument("--require-llm", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--require-vector", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--require-no-fallback", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_ROOT / "results" / "runtime_smoke.json",
    )
    parser.add_argument(
        "--manifest-output",
        type=Path,
        default=PROJECT_ROOT / "evaluation" / "verification" / "runtime-smoke-latest.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = run_smoke(
        args.api_base,
        args.require_llm,
        args.require_vector,
        args.require_no_fallback,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = build_manifest(result)
    args.manifest_output.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(console_json(result))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
