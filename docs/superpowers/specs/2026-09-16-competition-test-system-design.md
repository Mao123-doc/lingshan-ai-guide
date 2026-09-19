# 竞赛交付级测试体系设计

## 目标

在 `codex/scene-agent-upgrade` 分支建立可复现、可审计、能覆盖真实运行链路的测试体系，证明游客端、管理端、RAG、路线规划、外部模型和移动端主流程在比赛现场可用。

测试结论必须区分四类事实：

1. 代码和 API 是否按契约工作；
2. AI 回答和检索质量是否达到冻结基线；
3. 外部服务是否真实执行；
4. 用户在桌面和手机浏览器上是否能完成任务。

## 范围

覆盖当前代码中的 35 个 API：15 个 Visitor API、18 个 Admin API、2 个 Auth API；覆盖游客首页、问答、推荐、管理登录、仪表盘、知识库、数字人和报告页面；覆盖 SSE、WebSocket、定位、语音识别、TTS、图片识别、DeepSeek/Agnes、BGE Vector 和数据持久化。

## 不在范围内

- 不用测试修改来掩盖知识库事实错误；
- 不把 local fallback 计入 Full-RAG 成功；
- 不把 Fact Contract pass rate 解释成通用用户满意度、导航安全率或幻觉率；
- 不在 PR Gate 中调用收费模型；
- 不为追求分数降低 Fact Contract、路线约束或拒答标准。

## 四种执行档位

### PR Gate

完全确定性，使用本地 Stub 和临时数据目录，不访问公网，目标运行时间不超过 10 分钟。每次提交和 PR 必须执行。

### Integration

启动真实 Express 应用，但 LLM、Vector、TTS 使用本地 Stub；验证 API、文件、索引和页面之间的契约，目标不超过 15 分钟。

### Runtime Smoke

真实调用 DeepSeek/Agnes、`BAAI/bge-large-zh-v1.5`、Vector Service、TTS 和多模态服务。只在合并前、发布前执行，失败必须保留原始 Trace。

### Competition Rehearsal

真实模型、桌面 Chromium、手机视口和一台 Android Chrome；执行完整比赛脚本三遍，并绑定到同一个 commit SHA。

## 测试隔离设计

正式数据路径仍由默认配置决定，测试通过 `DATA_ROOT` 指向临时目录。Vector URL、LLM Base URL 和测试服务端口全部可以由环境变量覆盖。Express 应用拆成可导入的 `createApp()`，监听端口只留在启动入口。

所有集成测试结束后验证正式 `data/` 目录哈希不变。测试报告禁止写入 API Key、Token、绝对路径和完整用户隐私数据。

## 功能分层

### Visitor

测试景点列表和详情、问答非流式/SSE、历史隔离、反馈、推荐、场景路线、附近景点、附近设施、定位拒绝、TTS、图片识别、数字人配置和运行状态。

### RAG

测试 Query Rewrite、Vector、Structured、Keyword、RRF Fusion、Rerank、Context、LLM、Trace、fallback、超时和知识库外问题。

### Route

测试地点、时间、剩余时长、行动能力、同行人、偏好演出、硬约束、已游览点、开放时间、连通性、替代路线和不可行状态。

“想看/希望看”属于偏好；“必须看/一定要看”属于硬约束，测试合同必须分别验证。

### Admin

测试登录、Token、仪表盘、会话过滤、导出、情感分析、报告、知识库上传/删除/重建/测试问答、数字人配置和 WebSocket 推送。

## 质量门槛

### 确定性质量

- 所有 P0/P1 用例通过率：100%；
- 35/35 API 有成功契约和非法输入测试；
- 18 个 Admin API 全部有未授权测试；
- 12 条核心浏览器旅程全部通过；
- Backend/Frontend build exit code：0；
- Frontend lint exit code：0；
- `git diff --check`：通过；
- 正式数据目录无变化。

### RAG 基线

沿用当前冻结 Full-RAG 配置。50 题 API success 必须为 50/50，local fallback 必须为 0，Trace 与真实执行一致。Fact Contract pass rate 不得低于当前 78.0% 基线两个百分点，mean fact recall 不得低于当前 0.855 基线 0.02。

88 条 Retrieval Gold 的 Recall@5 不低于 0.98，Recall@3 不低于 0.95，API/channel failure 为 0。

### Scene/Route

Scene Gold 字段准确率不低于 0.95，关键字段识别率不低于 0.98；Route 60 案例分类准确率不低于 0.95，infeasible F1 不低于 0.90，hard violations 必须为 0；相同输入重复 10 次必须输出一致结果。

### Runtime

- LLM health 不得为 offline；
- BGE 模型名称必须是 `BAAI/bge-large-zh-v1.5`；
- 真实 Smoke 不允许 fallback；
- 真实 QA p95 完成时间不超过 8 秒；
- 真实 QA 首字 p95 不超过 3 秒；
- 普通 API p95 不超过 500ms；
- 路线规划 p95 不超过 300ms。

## P0/P1/P2

### P0

认证可绕过、空路线误报成功、硬约束违规、Trace 把 configured 当 executed、fallback 冒充 Full-RAG、SSE 永不结束、数据损坏、正式数据被测试污染、核心移动端流程不可用。

### P1

TTS、语音打断、图片识别、定位、WebSocket、后台统计、知识库生命周期、外部服务失败恢复、错误提示和移动端布局问题。

### P2

非核心视觉差异、次要浏览器兼容性、非关键图表样式、极端弱网下的非阻断性能问题。

## 证据格式

每次完整验收生成 `evaluation/verification/<run-id>/`，至少包含 `manifest.json`、`summary.md`、测试结果、runtime smoke、RAG/Route 结果、截图和 Playwright trace。Manifest 记录 commit、配置、模型、数据集哈希、服务 health、fallback 状态和时间。

## Git 边界

测试合同、测试隔离、后端 API、前端组件、浏览器 E2E、AI 质量门禁、Runtime Smoke、可靠性与发布验收分别形成独立提交。每次提交必须先完成 RED→GREEN、相关回归、build、`git diff --check`，工作区无非预期修改。
