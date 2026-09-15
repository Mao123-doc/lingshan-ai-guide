"""
Accuracy Test Runner — evaluates 50 standard questions against RAG pipeline.
Checks answer quality via keyword overlap and semantic similarity.
"""
import json, sys, os, time, uuid
from pathlib import Path

# Try to import semantic scoring
try:
    from sentence_transformers import SentenceTransformer
    _embedder = SentenceTransformer("BAAI/bge-large-zh-v1.5", device="cpu")
    _embedder.encode(["test"])
    HAS_EMBED = True
except Exception:
    _embedder = None
    HAS_EMBED = False


def load_questions() -> list:
    qfile = Path(__file__).parent / "test_questions.json"
    return json.loads(qfile.read_text(encoding="utf-8"))


def build_session_id(run_id: str, question: dict) -> str:
    return f"eval_{run_id}_q{question['id']}"


def call_qa_api(query: str, session_id: str) -> dict:
    """Call the running backend Q&A endpoint."""
    import urllib.request
    url = "http://127.0.0.1:8010/api/v1/visitor/qa"
    data = json.dumps({"query": query, "session_id": session_id}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"answer": "", "error": str(e)[:200]}


def keyword_score(answer: str, expected_keywords: list) -> float:
    """Score by keyword overlap."""
    if not answer or not expected_keywords:
        return 0.0
    hits = sum(1 for kw in expected_keywords if kw.lower() in answer.lower())
    return hits / len(expected_keywords)


def semantic_score(answer: str, question: str):
    """Score by semantic relevance using embeddings."""
    if not HAS_EMBED or not answer or len(answer) < 5:
        return None
    try:
        q_emb = _embedder.encode([question], normalize_embeddings=True)
        a_emb = _embedder.encode([answer[:500]], normalize_embeddings=True)
        import numpy as np
        similarity = np.dot(q_emb, a_emb.T)[0][0]
        return float(max(0, similarity))
    except Exception:
        return None


def _contains_any(answer: str, acceptable: list) -> bool:
    answer_lower = (answer or "").lower()
    return any(str(value).lower() in answer_lower for value in acceptable)


def _abstention_match(answer: str) -> bool:
    refusal_phrases = [
        "暂时无法准确回答",
        "知识库中暂未收录",
        "咨询景区游客中心",
    ]
    return _contains_any(answer, refusal_phrases)


def evaluate_answer(answer: str, question: dict) -> dict:
    """Score a single answer using facts when available and keywords as fallback."""
    kw_score = keyword_score(answer, question.get("expected_keywords", []))
    sem_score = semantic_score(answer, question["question"])

    facts = question.get("facts")
    if facts:
        matched_facts = sum(
            1 for fact in facts if _contains_any(answer, fact.get("acceptable", []))
        )
        fact_recall = matched_facts / len(facts)
    else:
        fact_recall = kw_score

    forbidden = question.get("forbidden", [])
    has_forbidden_fact = _contains_any(answer, forbidden)
    expected_behavior = question.get("expected_behavior", "answer")
    abstention_match = _abstention_match(answer)

    if expected_behavior == "abstain":
        passed = abstention_match and not has_forbidden_fact
    else:
        passed = bool(answer) and fact_recall == 1.0 and not has_forbidden_fact

    combined = None
    if sem_score is not None:
        combined = round(kw_score * 0.5 + sem_score * 0.5, 3)

    return {
        "question_id": question["id"],
        "question": question["question"],
        "expected_keywords": question.get("expected_keywords", []),
        "keyword_score": round(kw_score, 3),
        "semantic_score": round(sem_score, 3) if sem_score is not None else None,
        "combined_score": combined,
        "fact_recall": round(fact_recall, 3),
        "has_forbidden_fact": has_forbidden_fact,
        "expected_behavior": expected_behavior,
        "abstention_match": abstention_match,
        "passed": passed,
        "answer_preview": (answer or "")[:200],
    }


def evaluate_api_result(resp: dict, question: dict) -> dict:
    answer = resp.get("answer", "")
    if resp.get("error"):
        return {
            "question_id": question["id"],
            "question": question["question"],
            "api_success": False,
            "error": resp["error"],
            "answer_preview": "",
            "passed": False,
        }

    result = evaluate_answer(answer, question)
    result["api_success"] = True
    result["error"] = None
    return result


def main():
    print("=" * 60)
    print("  灵山胜境 AI 导游 — 标准测试集准确率评估")
    print("=" * 60)
    print(f"  语义评分: {'可用 (BGE-large)' if HAS_EMBED else '不可用 (仅关键词)'}")
    print()

    questions = load_questions()
    run_id = time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
    print(f"  测试题数: {len(questions)}")
    print()

    results = []
    passed_count = 0
    total_keyword = 0.0
    total_semantic = 0.0
    semantic_count = 0
    api_success_count = 0

    for i, q in enumerate(questions):
        print(f"  [{i+1:2d}/{len(questions)}] {q['question'][:40]}...", end=" ", flush=True)
        session_id = build_session_id(run_id, q)
        resp = call_qa_api(q["question"], session_id)
        eval_result = evaluate_api_result(resp, q)
        results.append(eval_result)
        if eval_result["api_success"]:
            api_success_count += 1
            total_keyword += eval_result["keyword_score"]
            if eval_result["semantic_score"] is not None:
                total_semantic += eval_result["semantic_score"]
                semantic_count += 1
        if eval_result["passed"]:
            passed_count += 1

        status = "✅" if eval_result["passed"] else "⚠️"
        if not eval_result["api_success"]:
            print(f"❌ API错误: {eval_result['error'][:50]}")
        else:
            sem = eval_result["semantic_score"]
            sem_text = f"{sem:.2f}" if sem is not None else "N/A"
            print(f"{status} FACT={eval_result['fact_recall']:.2f} KW={eval_result['keyword_score']:.2f} SEM={sem_text}")

        # Rate limit
        time.sleep(0.3)

    total = len(questions)
    accuracy = round(passed_count / total * 100, 1) if total > 0 else 0
    avg_kw = round(total_keyword / api_success_count, 3) if api_success_count > 0 else 0
    avg_sem = round(total_semantic / semantic_count, 3) if semantic_count > 0 else None
    api_success_rate = round(api_success_count / total, 3) if total > 0 else 0

    print()
    print("=" * 60)
    print("  评估结果")
    print("=" * 60)
    print(f"  通过数:      {passed_count}/{total}")
    print(f"  准确率:      {accuracy}%")
    print(f"  API成功率:   {api_success_rate * 100:.1f}%")
    print(f"  平均关键词分: {avg_kw}")
    print(f"  平均语义分:   {avg_sem if avg_sem is not None else 'N/A'}")

    # Flag weak questions
    weak = [r for r in results if not r["passed"]]
    if weak:
        print(f"\n  ⚠️ 需改进的题目 ({len(weak)}题):")
        for w in weak:
            print(f"    #{w['question_id']}: {w['question'][:50]}")
            print(f"       事实召回: {w.get('fact_recall', 0)}, 期望关键词: {w['expected_keywords']}")

    # Save detailed results
    outfile = Path(__file__).resolve().parent.parent.parent.parent / "data" / "test_results.json"
    outfile.write_text(json.dumps({
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "run_id": run_id,
        "total": total,
        "passed": passed_count,
        "accuracy": accuracy,
        "api_success_rate": api_success_rate,
        "avg_keyword_score": avg_kw,
        "avg_semantic_score": avg_sem,
        "semantic_available": HAS_EMBED,
        "results": results,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n  详细结果已保存到 data/test_results.json")

    return accuracy >= 90.0


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
