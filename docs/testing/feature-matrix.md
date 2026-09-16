# Feature Test Matrix

本文档是当前 `codex/competition-hardening` 分支的测试合同清单。每个 API 至少需要一个成功契约、一个非法输入或失败契约；Admin API 还必须有未授权契约。

## API inventory

### Visitor API

| Method | Endpoint | 主要契约 | 优先级 |
|---|---|---|---|
| GET | `/api/v1/visitor/spots` | 返回景点数组，字段完整 | P1 |
| GET | `/api/v1/visitor/spots/:spotId` | 已知景点 200，未知景点 404 | P1 |
| POST | `/api/v1/visitor/qa` | 非流式回答、Trace、session、模型状态 | P0 |
| POST | `/api/v1/visitor/tts` | 音频或明确不可用结果 | P1 |
| POST | `/api/v1/visitor/session/init` | 唯一 session、模型状态 | P0 |
| POST | `/api/v1/visitor/recommend` | 兴趣/时长/画像影响推荐 | P1 |
| POST | `/api/v1/visitor/route/plan` | 场景提取、路线、结果状态、拒绝原因 | P0 |
| POST | `/api/v1/visitor/feedback` | 反馈落盘，缺失字段可解释 | P1 |
| POST | `/api/v1/visitor/conversation-feedback` | 会话反馈更新 | P1 |
| GET | `/api/v1/visitor/hot-questions` | 返回热门问题数组 | P2 |
| POST | `/api/v1/visitor/vision/recognize` | 图片识别结果或明确失败 | P1 |
| GET | `/api/v1/visitor/status` | 运行状态和模型状态一致 | P0 |
| GET | `/api/v1/visitor/nearby` | 坐标下按距离返回景点 | P1 |
| GET | `/api/v1/visitor/nearby-facilities` | 设施类型和位置过滤 | P1 |
| GET | `/api/v1/visitor/dh-config` | 返回数字人配置 | P1 |

### Auth API

| Method | Endpoint | 主要契约 | 优先级 |
|---|---|---|---|
| POST | `/api/v1/auth/login` | 正确凭证返回 JWT，错误凭证 401 | P0 |
| POST | `/api/v1/auth/refresh` | 有效 Token 换新 Token，非法 Token 401 | P0 |

### Admin API

| Method | Endpoint | 主要契约 | 优先级 |
|---|---|---|---|
| GET | `/api/v1/admin/dashboard/summary` | 统计与原始会话一致 | P1 |
| GET | `/api/v1/admin/reports/sentiment` | 日/周/月报告结构稳定 | P1 |
| POST | `/api/v1/admin/reports/analyze-sentiment` | 文本分析或 LLM 不可用 503 | P1 |
| POST | `/api/v1/admin/knowledge/documents` | 文件解析、状态和文档 ID | P0 |
| GET | `/api/v1/admin/knowledge/documents` | 源文件、上传文件和解析文档列表 | P1 |
| DELETE | `/api/v1/admin/knowledge/documents/:id` | 只删除目标测试文件 | P0 |
| POST | `/api/v1/admin/knowledge/refresh-index` | 索引重建结果和 chunk 数 | P0 |
| GET | `/api/v1/admin/knowledge/stats` | chunk、索引和 Vector 状态 | P1 |
| GET | `/api/v1/admin/knowledge/test-qa` | 查询返回结构化检索结果 | P1 |
| POST | `/api/v1/admin/vision/recognize` | multipart 图片识别 | P1 |
| GET | `/api/v1/admin/digital-human/appearance` | 配置可读取 | P1 |
| PUT | `/api/v1/admin/digital-human/appearance` | 配置保存后可重新读取 | P1 |
| GET | `/api/v1/admin/conversations` | 分页、筛选、总数稳定 | P1 |
| GET | `/api/v1/admin/conversations/export` | UTF-8 BOM、CSV 列和筛选 | P1 |
| GET | `/api/v1/admin/top-unsatisfied` | 返回未满足问题统计 | P2 |
| GET | `/api/v1/admin/visitor-locations` | 返回位置统计 | P2 |
| GET | `/api/v1/admin/category-distribution` | 分类总数可解释 | P2 |
| POST | `/api/v1/admin/conversations/feedback` | 合法反馈更新，缺失字段 400 | P1 |

## Frontend routes

| Route | 页面 | 关键用户能力 | 优先级 |
|---|---|---|---|
| `/` | `HomePage` | 能力卡片、热门问题、景点、定位、附近设施 | P0 |
| `/qa` | `QAPage` | 文字、流式、语音、TTS、图片、反馈 | P0 |
| `/recommend` | `RecommendPage` | 普通推荐、场景约束路线 | P0 |
| `/admin/login` | `LoginPage` | 登录和错误提示 | P0 |
| `/admin/dashboard` | `DashboardPage` | 统计、会话、筛选、导出 | P1 |
| `/admin/knowledge` | `KnowledgeBasePage` | 上传、删除、重建、测试查询 | P0 |
| `/admin/digital-human` | `DigitalHumanPage` | 配置读取和保存 | P1 |
| `/admin/reports` | `SentimentReportPage` | 报告、周期切换、文本分析 | P1 |

## External/runtime dependencies

| Dependency | Required evidence |
|---|---|
| DeepSeek or Agnes | health online, model name, real generation |
| `BAAI/bge-large-zh-v1.5` | Vector health model exact match, real search |
| Vector Service `127.0.0.1:8002` | health, chunks > 0, search and rebuild |
| TTS service | decodable non-empty audio and stop behavior |
| Multimodal model | labeled image smoke and confidence behavior |
| WebSocket `/ws` | subscribe, broadcast, close and reconnect |
| Browser permissions | microphone, camera and geolocation allow/deny paths |

## Priority rule

- P0 blocks merge and competition delivery.
- P1 blocks competition delivery but may be developed after P0 infrastructure.
- P2 is reported in limitations and does not block the first release candidate.
