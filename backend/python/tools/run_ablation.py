#!/usr/bin/env python3
"""Run configuration-driven retrieval ablation experiments."""

import argparse
import hashlib
import json
import subprocess
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
    "full_without_rerank": "full_without_rerank.json",
    "full_without_rewrite": "full_without_rewrite.json",
}

PROFILE_LABELS = {
    "vector_only": "Vector Only",
    "structured_only": "Structured Only",
    "keyword_only": "Keyword Only",
    "full_retrieval": "Full Retrieval",
    "vector_rerank": "Vector + Rerank",
    "full_without_rerank": "Full - Rerank",
    "full_without_rewrite": "Full - Rewrite",
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def resolve_commit_sha() -> str:
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


def _evidence_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
    except ValueError:
        return path.name


def build_run_manifest(
    run_id: str,
    profiles: list[str],
    profile_configs: dict[str, dict],
    questions: list[dict],
    commit_sha: str,
    health: dict,
    dataset_path: Path,
    knowledge_paths: list[Path],
    observed_model_identities: list[dict] | None = None,
) -> dict:
    return {
        "schema_version": 2,
        "kind": "rag-evaluation-run",
        "run_id": run_id,
        "git_sha": commit_sha,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": {
            "path": _evidence_path(dataset_path),
            "sha256": sha256_file(dataset_path),
            "count": len(questions),
        },
        "knowledge": [
            {"path": _evidence_path(path), "sha256": sha256_file(path)}
            for path in knowledge_paths
        ],
        "profiles": profiles,
        "profile_configs": profile_configs,
        "runtime": {
            "status": health.get("status"),
            "llm": health.get("llm"),
            "vector_search": health.get("vector_search"),
            "knowledge_chunks": health.get("knowledge_chunks"),
            "knowledge_indexed": health.get("knowledge_indexed"),
            "structured_spots": health.get("structured_spots"),
            "structured_fields": health.get("structured_fields"),
        },
        "evidence_policy": {
            "fallback_is_not_full_rag": True,
            "trace_must_be_consistent": True,
            "history_isolated_per_question": True,
        },
        "observed_model_identities": observed_model_identities or [],
    }


def collect_model_identities(results: dict[str, dict]) -> list[dict]:
    identities: dict[tuple[str, str, str], dict] = {}
    for result in results.values():
        for record in result.get("records", []):
            trace = record.get("trace") or {}
            for stage_name in ("rewrite", "rerank", "generation"):
                identity = (trace.get(stage_name) or {}).get("modelIdentity")
                if not isinstance(identity, dict):
                    continue
                key = (
                    str(identity.get("status", "unknown")),
                    str(identity.get("requestedModel", "")),
                    str(identity.get("providerModel", "")),
                )
                identities[key] = {
                    "status": identity.get("status"),
                    "requestedModel": identity.get("requestedModel"),
                    "providerModel": identity.get("providerModel"),
                }
    return [identities[key] for key in sorted(identities)]


def get_health(base_url: str, timeout: int = 10) -> dict:
    request = urllib.request.Request(base_url.rstrip("/") + "/health")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return {"status": "unreachable", "error": str(error)[:300]}


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
        "fallback_used": bool(response.get("fallback_used", False)),
        "error": response.get("error") or evaluation.get("error"),
        "used_llm": response.get("used_llm"),
        "reported_model": response.get("model"),
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


def classify_record_error(record: dict) -> str | None:
    if not record.get("api_success"):
        return "API"
    trace = record.get("trace") or {}
    retrieval = trace.get("retrieval") or {}
    retrieval_stages = [
        stage for stage in retrieval.values() if isinstance(stage, dict)
    ]
    if any(stage.get("status") == "failed" for stage in retrieval_stages):
        return "Retrieval"
    if (trace.get("retrievalMode") == "none") or not trace.get("retrievedIds"):
        return "Retrieval"
    if (trace.get("rerank") or {}).get("status") == "failed":
        return "Rerank"
    if (trace.get("generation") or {}).get("status") == "failed":
        return "Generation"
    if not (record.get("evaluation") or {}).get("passed", False):
        return "Evaluator"
    return None


def _metric(metrics: dict, key: str) -> str:
    value = metrics.get(key)
    return "N/A" if value is None else str(value)


def build_ablation_report(results: dict[str, dict]) -> str:
    lines = [
        "# RAG Retrieval Ablation Report",
        "",
        "## 1. 实验目的",
        "",
        "比较 Vector、Structured、Keyword Retrieval 及 Full Retrieval 的事实覆盖和延迟，并观察 Rerank 与 Query Rewrite 对同一 RAG Pipeline 的影响。实验只切换 evaluation_config，未复制或修改正式 RAG 实现。",
        "",
        "## 2. 实验设置",
        "",
        "- Dataset：`backend/python/tools/test_questions.json`，同一 50 题测试集",
        "- Evaluator：`backend/python/tools/test_accuracy.py`，Fact Contract 版本保持不变",
        "- LLM requested model：read from the runtime manifest; provider model identity is recorded per trace",
        "- Embedding：`BAAI/bge-large-zh-v1.5`",
        "- Prompt、temperature、retrievalTopK=8、contextTopK=5 保持不变",
        "- Evaluation 控制变量：`enableHistory=false`，`includeFullKnowledge=false`",
        "- 每题使用独立 session；每个 profile 保留原始 answer、evaluation 和 execution trace",
        "",
        "## 3. 实验结果",
        "",
        "### Retrieval Ablation",
        "",
        "| Method | Accuracy | Fact Recall | Avg Latency (ms) |",
        "|---|---:|---:|---:|",
    ]
    retrieval_profiles = (
        "vector_only",
        "structured_only",
        "keyword_only",
        "full_retrieval",
    )
    if not results:
        lines.append("| 数据尚未生成 | N/A | N/A | N/A |")
    else:
        for profile in retrieval_profiles:
            result = results.get(profile)
            if not result:
                lines.append(f"| {PROFILE_LABELS[profile]} | N/A | N/A | N/A |")
                continue
            metrics = result.get("metrics", {})
            lines.append(
                f"| {PROFILE_LABELS[profile]} | {_metric(metrics, 'accuracy')} | "
                f"{_metric(metrics, 'fact_recall')} | {_metric(metrics, 'avg_latency_ms')} |"
            )

    lines.extend(
        [
            "",
            "### Component Ablation",
            "",
            "| Configuration | Accuracy |",
            "|---|---:|",
        ]
    )
    for profile in ("full_retrieval", "full_without_rerank", "full_without_rewrite"):
        result = results.get(profile)
        if not result:
            lines.append(f"| {PROFILE_LABELS[profile]} | N/A |")
        else:
            lines.append(
                f"| {PROFILE_LABELS[profile]} | "
                f"{_metric(result.get('metrics', {}), 'accuracy')} |"
            )

    lines.extend(["", "## 4. 错误分析", ""])
    errors = {"API": 0, "Retrieval": 0, "Rerank": 0, "Generation": 0, "Evaluator": 0}
    for result in results.values():
        for record in result.get("records", []):
            category = classify_record_error(record)
            if category:
                errors[category] += 1
    if not results:
        lines.append("数据尚未生成，暂不做错误归因。")
    else:
        lines.append("错误分类基于保存的 trace；没有 trace 证据时不推断具体原因。")
        for category, count in errors.items():
            lines.append(f"- {category}: {count}")

    lines.extend(["", "## 5. 结论", ""])
    full = results.get("full_retrieval", {}).get("metrics")
    vector = results.get("vector_only", {}).get("metrics")
    no_rerank = results.get("full_without_rerank", {}).get("metrics")
    no_rewrite = results.get("full_without_rewrite", {}).get("metrics")
    if not full:
        lines.append("实验结果尚未生成，不能对模块贡献下结论。")
    else:
        lines.append(f"- Full Retrieval accuracy：{_metric(full, 'accuracy')}。")
        if vector:
            lines.append(
                f"- Full 相对 Vector Only 的 accuracy 差异："
                f"{round(full['accuracy'] - vector['accuracy'], 1)} 个百分点。"
            )
        if no_rerank:
            lines.append(
                f"- Rerank accuracy 差异："
                f"{round(full['accuracy'] - no_rerank['accuracy'], 1)} 个百分点。"
            )
        if no_rewrite:
            lines.append(
                f"- Rewrite accuracy 差异："
                f"{round(full['accuracy'] - no_rewrite['accuracy'], 1)} 个百分点。"
            )
        lines.append("- 具体模块贡献仅依据同一测试集、同一控制变量和保存的 trace 解读。")
    return "\n".join(lines) + "\n"


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
    dataset_path = TOOLS_DIR / "test_questions.json"
    knowledge_paths = [
        PROJECT_ROOT / "data" / "raw" / "knowledge_guide.txt",
        PROJECT_ROOT / "data" / "raw" / "knowledge_dataset.txt",
    ]
    manifest = build_run_manifest(
        run_id=run_id,
        profiles=profiles,
        profile_configs={name: all_profiles[name] for name in profiles},
        questions=questions,
        commit_sha=resolve_commit_sha(),
        health=get_health(base_url),
        dataset_path=dataset_path,
        knowledge_paths=knowledge_paths,
    )
    write_json(output_dir / "manifest.json", manifest)
    results = {}
    for profile in profiles:
        result = run_profile(
            profile, all_profiles[profile], questions, run_id, base_url
        )
        results[profile] = result
        write_json(output_dir / PROFILE_FILES[profile], result)

    manifest["observed_model_identities"] = collect_model_identities(results)
    write_json(output_dir / "manifest.json", manifest)

    component_profiles = {
        name: results[name]
        for name in ("vector_rerank", "full_without_rerank", "full_without_rewrite")
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
    parser.add_argument(
        "--report-path",
        type=Path,
        default=PROJECT_ROOT / "docs" / "ablation_report.md",
    )
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
        args.report_path.parent.mkdir(parents=True, exist_ok=True)
        args.report_path.write_text(build_ablation_report(results), encoding="utf-8")
        print(json.dumps({name: value["metrics"] for name, value in results.items()}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
