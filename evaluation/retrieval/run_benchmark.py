#!/usr/bin/env python3
"""Run the reproducible retrieval benchmark against the real QA API."""

from __future__ import annotations

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from benchmark import (
    aggregate_scored_records,
    canonicalize_documents,
    extract_retrieved_ids,
    extract_stage_map,
    load_json,
    load_structured_field_texts,
    score_record,
    sha256_file,
    stage_execution_state,
    validate_gold_records,
)


ROOT = Path(__file__).resolve().parents[2]
GOLD_PATH = ROOT / "evaluation" / "retrieval" / "retrieval_gold_v1.json"
LEGACY_MANIFEST_PATH = ROOT / "evaluation" / "manifests" / "legacy-v1.json"

COMMON_CONFIG = {
    "enableQueryRewrite": True,
    "enableHistory": False,
    "includeFullKnowledge": False,
    "retrievalTopK": 8,
    "contextTopK": 5,
}

PROFILES: dict[str, dict[str, Any]] = {
    "vector_only": {
        **COMMON_CONFIG,
        "enableVectorRetrieval": True,
        "enableStructuredRetrieval": False,
        "enableKeywordRetrieval": False,
        "enableRerank": False,
    },
    "structured_only": {
        **COMMON_CONFIG,
        "enableVectorRetrieval": False,
        "enableStructuredRetrieval": True,
        "enableKeywordRetrieval": False,
        "enableRerank": False,
    },
    "keyword_only": {
        **COMMON_CONFIG,
        "enableVectorRetrieval": False,
        "enableStructuredRetrieval": False,
        "enableKeywordRetrieval": True,
        "enableRerank": False,
    },
    # These names follow the goal's experiment matrix.  The current base
    # implementation is still a priority fallback; the summary says so.
    "fused": {
        **COMMON_CONFIG,
        "enableVectorRetrieval": True,
        "enableStructuredRetrieval": True,
        "enableKeywordRetrieval": True,
        "enableRerank": False,
    },
    "fused_rerank": {
        **COMMON_CONFIG,
        "enableVectorRetrieval": True,
        "enableStructuredRetrieval": True,
        "enableKeywordRetrieval": True,
        "enableRerank": True,
    },
}


def expected_document_ids() -> set[str]:
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
    return {
        f"{prefix}-{number:03d}_{field}"
        for prefix, count in (("LS", 16), ("NH", 6))
        for number in range(1, count + 1)
        for field in fields
    }


def git_sha() -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()


def get_json(url: str, timeout: int = 15) -> dict[str, Any]:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def verify_runtime(base_url: str) -> dict[str, Any]:
    backend_health = get_json(base_url.rstrip("/") + "/health")
    vector_health = get_json("http://127.0.0.1:8002/health")
    if backend_health.get("llm") == "offline":
        raise RuntimeError("backend health reports llm=offline")
    if not backend_health.get("vector_search"):
        raise RuntimeError("backend health reports vector_search=false")
    if vector_health.get("model") != "BAAI/bge-large-zh-v1.5":
        raise RuntimeError("vector health did not report BAAI/bge-large-zh-v1.5")
    return {"backend": backend_health, "vector": vector_health}


def call_qa(base_url: str, query: str, session_id: str, config: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps(
        {"query": query, "session_id": session_id, "evaluation_config": config},
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        base_url.rstrip("/") + "/api/v1/visitor/qa",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return {"http_status": response.status, "body": json.loads(response.read().decode("utf-8"))}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        return {"http_status": error.code, "error": detail, "body": {}}
    except Exception as error:
        return {"http_status": None, "error": str(error)[:500], "body": {}}


def build_raw_record(
    gold: dict[str, Any],
    response: dict[str, Any],
    latency_ms: float,
    field_texts: dict[str, str],
) -> dict[str, Any]:
    body = response.get("body") or {}
    trace = body.get("evaluation_trace") or {}
    generation = trace.get("generation") or {}
    fallback_used = bool(generation.get("fallbackUsed")) or body.get("used_llm") is False
    stages = extract_stage_map(body)
    retrieval_error = any(stage_execution_state(stage) == "failed" for stage in stages.values())
    evidence_documents = trace.get("retrievedDocuments") or []
    raw_retrieved_ids = extract_retrieved_ids(body)
    canonical_ids, unmatched_evidence_ids = canonicalize_documents(evidence_documents, field_texts)
    metric_retrieved_ids = canonical_ids or raw_retrieved_ids
    return {
        "question_id": gold["question_id"],
        "query": gold["query"],
        "category": gold.get("category"),
        "http_status": response.get("http_status"),
        "api_success": response.get("http_status") == 200 and not response.get("error"),
        "error": response.get("error"),
        "answer": body.get("answer", ""),
        "used_llm": body.get("used_llm"),
        "fallback_used": fallback_used,
        "rewritten_query": trace.get("rewrittenQuery"),
        "retrieved_ids": metric_retrieved_ids,
        "retrieved_ids_raw": raw_retrieved_ids,
        "retrieved_documents": evidence_documents,
        "unmatched_evidence_ids": unmatched_evidence_ids,
        "retrieved_scores": trace.get("retrievedScores", []),
        "reranked_ids": trace.get("rerankedIds", []),
        "context_ids": trace.get("contextIds", []),
        "stages": stages,
        "rewrite": trace.get("rewrite"),
        "rerank": trace.get("rerank"),
        "generation": generation,
        "retrieval_mode": trace.get("retrievalMode"),
        "retrieval_error": retrieval_error,
        "latency_ms": round(latency_ms, 3),
    }


def run_profile(
    name: str,
    config: dict[str, Any],
    gold_records: list[dict[str, Any]],
    base_url: str,
    run_id: str,
    field_texts: dict[str, str],
) -> dict[str, Any]:
    raw_records: list[dict[str, Any]] = []
    scored_records: list[dict[str, Any]] = []
    for index, gold in enumerate(gold_records, start=1):
        session_id = f"retrieval_{run_id}_{name}_q{gold['question_id']}"
        started = time.perf_counter()
        response = call_qa(base_url, gold["query"], session_id, config)
        latency_ms = (time.perf_counter() - started) * 1000
        raw = build_raw_record(gold, response, latency_ms, field_texts)
        raw["session_id"] = session_id
        raw_records.append(raw)
        scored_records.append(score_record(raw, gold))
        print(
            f"[{name} {index}/{len(gold_records)}] q{gold['question_id']} "
            f"status={scored_records[-1]['outcome']} "
            f"ids={len(raw['retrieved_ids'])}",
            flush=True,
        )

    by_category: dict[str, list[dict[str, Any]]] = {}
    for item in scored_records:
        category = next(
            gold.get("category", "unknown")
            for gold in gold_records
            if gold["question_id"] == item["question_id"]
        )
        by_category.setdefault(category, []).append(item)
    return {
        "profile": name,
        "retrieval_semantics": "legacy_priority_fallback",
        "config": config,
        "raw_records": raw_records,
        "scored_records": scored_records,
        "metrics": aggregate_scored_records(scored_records),
        "metrics_by_category": {
            category: aggregate_scored_records(items)
            for category, items in sorted(by_category.items())
        },
    }


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8010")
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--profiles", default=",".join(PROFILES))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest = load_json(GOLD_PATH)
    gold_records = manifest["records"]
    field_texts = load_structured_field_texts(ROOT / "data" / "raw" / "knowledge_dataset.txt")
    if len(field_texts) != 176:
        raise SystemExit(f"Unexpected structured field document count: {len(field_texts)}")
    errors = validate_gold_records(gold_records, expected_document_ids())
    if errors:
        raise SystemExit("Invalid retrieval gold manifest:\n" + "\n".join(errors))

    runtime = verify_runtime(args.base_url)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "_" + uuid.uuid4().hex[:8]
    output_dir = args.output_dir or ROOT / "evaluation" / "results" / run_id
    profiles = [name.strip() for name in args.profiles.split(",") if name.strip()]
    unknown = sorted(set(profiles) - set(PROFILES))
    if unknown:
        raise SystemExit("Unknown profiles: " + ", ".join(unknown))

    write_json(output_dir / "config.json", {
        "run_id": run_id,
        "profiles": profiles,
        "gold_manifest": str(GOLD_PATH.relative_to(ROOT)).replace("\\", "/"),
        "gold_record_count": len(gold_records),
        "runtime": runtime,
        "profile_configs": {name: PROFILES[name] for name in profiles},
        "retrieval_semantics": "legacy_priority_fallback",
    })
    write_json(output_dir / "hashes.json", {
        "git_sha": git_sha(),
        "gold_sha256": sha256_file(GOLD_PATH),
        "legacy_manifest_sha256": sha256_file(LEGACY_MANIFEST_PATH),
        "legacy_dataset_sha256": load_json(LEGACY_MANIFEST_PATH)["dataset"]["sha256"],
        "knowledge_sha256": load_json(LEGACY_MANIFEST_PATH)["knowledge"],
    })

    results = {
        name: run_profile(name, PROFILES[name], gold_records, args.base_url, run_id, field_texts)
        for name in profiles
    }
    write_json(output_dir / "raw_results.json", results)
    write_json(output_dir / "summary.json", {
        "run_id": run_id,
        "git_sha": git_sha(),
        "gold_record_count": len(gold_records),
        "profiles": {name: result["metrics"] for name, result in results.items()},
        "retrieval_semantics": "legacy_priority_fallback",
        "fallback_policy": "local_fallback records are excluded from retrieval metric denominators and retained in raw results",
    })
    print(json.dumps({name: result["metrics"] for name, result in results.items()}, ensure_ascii=False, indent=2))
    print(f"RESULT_DIR={output_dir}")


if __name__ == "__main__":
    main()
