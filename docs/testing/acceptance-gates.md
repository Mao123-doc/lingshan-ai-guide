# Acceptance Gates

## Gate 0: Source and environment

通过条件：

- 当前分支和 commit SHA 已记录；
- 工作区没有非预期修改；
- Node、Python、npm 版本已记录；
- 测试报告不包含 API Key、JWT 或本机绝对路径；
- 正式 `data/` 文件在测试前后哈希一致。

## Gate 1: Deterministic PR Gate

通过条件：

- Python evaluator/retrieval/ablation tests 100% 通过；
- backend unit/contract tests 100% 通过；
- frontend unit tests 100% 通过；
- backend build exit 0；
- frontend lint exit 0；
- frontend build exit 0；
- `git diff --check` 通过；
- P0/P1 失败数为 0；
- PR Gate 不发生公网模型调用。

## Gate 2: API and data contract

通过条件：

- 35/35 API 至少一个成功契约和一个错误契约；
- 18 个 Admin API 全部验证未授权 401；
- 上传、删除、索引重建全部运行在临时数据根目录；
- 50 次并发写入后 JSON 可解析且记录不丢失；
- 路径穿越、非法文件类型和超大文件请求被拒绝；
- CSV 中文、引号、换行和筛选结果可被解析。

## Gate 3: Browser journeys

通过条件：

- 12/12 核心旅程通过；
- Desktop Chromium 和 Pixel 7 Chromium 均通过；
- 页面无未捕获异常；
- 自有资源无 404；
- 关键 API 无意外 4xx/5xx；
- 无横向滚动；
- 测试不能依靠 retry 后的偶然通过。

## Gate 4: AI quality

通过条件：

- Full-RAG API success 50/50；
- local fallback 0；
- Trace 与实际执行一致 50/50；
- Fact Contract pass rate ≥76%；
- mean fact recall ≥0.835；
- Retrieval Recall@5 ≥0.98，Recall@3 ≥0.95；
- Scene field accuracy ≥0.95，关键字段 ≥0.98；
- Route feasibility accuracy ≥0.95；
- Route hard violations = 0；
- out-of-scope/refusal contract accuracy ≥0.90。

## Gate 5: Runtime

通过条件：

- `/health` 中 `llm` 不为 `offline`；
- Vector health 正常且模型为 `BAAI/bge-large-zh-v1.5`；
- 5 题真实 Full-RAG Smoke 全部完成；
- 任何 fallback 请求不得算 Full-RAG 成功；
- TTS 音频可解码；
- WebSocket 事件可接收；
- 真实 QA p95 完成时间 ≤8 秒，首字 p95 ≤3 秒。

## Gate 6: Release rehearsal

通过条件：

- P0 未解决数为 0；
- P1 未解决数为 0；
- 演示脚本连续 3 次成功；
- 桌面和手机主流程均完成；
- 证据 Manifest 绑定当前 commit SHA；
- 工作区 clean。
