#!/usr/bin/env python3
"""Run configuration-driven retrieval ablation experiments."""

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path


TOOLS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_DIR.parents[2]
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from test_accuracy import (  # noqa: E402
    evaluate_api_result,
    get_ablation_profiles,
    load_questions,
)


PROFILE_FILES = {
    "vector_only": "vector_only.json",
    "structured_only": "structured_only.json",
    "keyword_only": "keyword_only.json",
    "full_retrieval": "full_retrieval.json",
    "vector_rerank": "vector_rerank.json",
    "full_without_rewrite": "full_without_rewrite.json",
}


def build_ablation_session_id(run_id: str, profile: str, question_id: int) -> str:
    return f"ablation_{run_id}_{profile}_q{question_id}"


def call_qa_api_at(base_url: str, query: str, session_id: str, config: dict) -> dict:
    url = base_url.rstrip("/") + "/api/v1/visitor/qa"
    payload = json.dumps(
        {
            "query": query,
            "session_id": session_id,
            "evaluation_config": config,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return {"answer": "", "error": str(error)[:300]}


def build_question_result(
    question: dict,
    profile: str,
    config: dict,
    session_id: str,
    response: dict,
    evaluation: dict,
    latency_ms: int | float,
) -> dict:
    api_success = bool(evaluation.get("api_success", not response.get("error")))
    return {
        "question_id": question["id"],
        "question": question["question"],
        "profile": profile,
        "config": config,
        "session_id": session_id,
        "answer": response.get("answer", ""),
        "api_success": api_success,
        "error": response.get("error") or evaluation.get("error"),
        "used_llm": response.get("used_llm"),
        "retrieved_chunks": response.get("retrieved_chunks"),
        "trace": response.get("evaluation_trace"),
        "evaluation": evaluation,
        "latency_ms": latency_ms,
    }


def aggregate_records(records: list[dict]) -> dict:
    total = len(records)
    successful = [record for record in records if record.get("api_success")]
    passed = [
        record
        for record in records
        if (record.get("evaluation") or {}).get("passed", False)
    ]
    evaluated = [record for record in successful if record.get("evaluation")]
    retrieval_successes = [
        record
        for record in successful
        if (record.get("trace") or {}).get("retrievalMode") != "none"
        and bool((record.get("trace") or {}).get("retrievedIds"))
    ]

    def average(values: list[float]) -> float | None:
        return round(sum(values) / len(values), 3) if values else None

    fact_recalls = [
        float(record["evaluation"].get("fact_recall", 0.0))
        for record in evaluated
    ]
    latencies = [float(record.get("latency_ms", 0)) for record in successful]
    return {
        "total": total,
        "api_successes": len(successful),
        "api_success_rate": round(len(successful) / total, 3) if total else 0.0,
        "passed": len(passed),
        "accuracy": round(len(passed) / total * 100, 1) if total else 0.0,
        "pass_rate": round(len(passed) / len(successful), 3) if successful else 0.0,
        "fact_recall": average(fact_recalls),
        "avg_latency_ms": average(latencies),
        "retrieval_success_rate": (
            round(len(retrieval_successes) / len(successful), 3)
            if successful
            else 0.0
        ),
    }


def run_profile(
    profile: str,
    config: dict,
    questions: list[dict],
    run_id: str,
    base_url: str,
) -> dict:
    records = []
    for index, question in enumerate(questions, start=1):
        session_id = build_ablation_session_id(run_id, profile, question["id"])
        started = time.perf_counter()
        response = call_qa_api_at(base_url, question["question"], session_id, config)
        measured_latency = round((time.perf_counter() - started) * 1000)

        evaluation = evaluate_api_result(response, question, session_id)
        latency = response.get("response_time_ms")
        if not isinstance(latency, (int, float)):
            latency = measured_latency
        record = build_question_result(
            question, profile, config, session_id, response, evaluation, latency
        )
        records.append(record)
        status = "PASS" if evaluation.get("passed") else "FAIL"
        print(f"[{profile} {index}/{len(questions)}] {status} q{question['id']}")

    return {
        "schema_version": 1,
        "run_id": run_id,
        "profile": profile,
        "config": config,
        "question_count": len(questions),
        "records": records,
        "metrics": aggregate_records(records),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def run_experiments(
    profiles: list[str],
    output_dir: Path,
    base_url: str,
    run_id: str,
    dry_run: bool = False,
) -> dict[str, dict]:
    all_profiles = get_ablation_profiles()
    unknown = sorted(set(profiles) - set(all_profiles))
    if unknown:
        raise ValueError(f"Unknown profiles: {', '.join(unknown)}")

    if dry_run:
        return {name: {"profile": name, "config": all_profiles[name]} for name in profiles}

    questions = load_questions()
    results = {}
    for profile in profiles:
        result = run_profile(
            profile, all_profiles[profile], questions, run_id, base_url
        )
        results[profile] = result
        write_json(output_dir / PROFILE_FILES[profile], result)

    component_profiles = {
        name: results[name]
        for name in ("vector_rerank", "full_without_rewrite")
        if name in results
    }
    if component_profiles:
        write_json(
            output_dir / "component_ablation.json",
            {
                "schema_version": 1,
                "run_id": run_id,
                "profiles": component_profiles,
            },
        )
    return results


def parse_args() -> argparse.Namespace:
    profiles = ",".join(get_ablation_profiles())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profiles", default=profiles)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=PROJECT_ROOT / "results",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8010")
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    run_id = args.run_id or time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    profiles = [profile.strip() for profile in args.profiles.split(",") if profile.strip()]
    results = run_experiments(
        profiles,
        args.output_dir,
        args.base_url,
        run_id,
        dry_run=args.dry_run,
    )
    if args.dry_run:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({name: value["metrics"] for name, value in results.items()}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
