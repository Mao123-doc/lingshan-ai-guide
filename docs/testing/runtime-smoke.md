# Runtime Smoke 验收规范

Runtime Smoke 只验证真实运行链路，不作为 PR Gate 的确定性测试。

## 固定范围

Runner 只执行测试集中的 5 道题：`#1`、`#3`、`#31`、`#37`、`#42`。每题使用独立 session，配置来自 `test_accuracy.py` 的冻结 `EVALUATION_CONFIG`。

## 启动顺序

1. 启动 `backend/python/vector_service.py`，确认 `/health` 返回 `status=ok`、`chunks>0`、模型为 `BAAI/bge-large-zh-v1.5`。
2. 启动 Backend，确认 `/health` 中 `llm` 不是 `offline` 且 `vector_search=true`。
3. 使用以下命令运行 Smoke：

```powershell
python backend/python/tools/run_runtime_smoke.py `
  --api-base http://127.0.0.1:8010 `
  --require-llm `
  --require-vector `
  --require-no-fallback
```

## 通过条件

- 健康检查失败时不发送任何题目请求；
- 5 道题全部 `api_success=true`；
- Rewrite、Vector、Structured、Keyword、Rerank、Generation 的 Trace 与实际状态一致；
- `generation.status=executed` 且 `fallbackUsed=false`；
- `used_llm=true`；
- `full_rag_count=5`，命令退出码为 0；
- `evaluation/verification/runtime-smoke-latest.json` 只保存脱敏证据，不保存 API Key、JWT、回答全文或本机绝对路径。

## 失败处理

任何 `fallback_used=true`、LLM 调用失败、Trace 状态矛盾或 Vector 不可用都必须退出非零。失败 Smoke 只能用于错误定位，不能作为正式 Baseline 或消融数据。
