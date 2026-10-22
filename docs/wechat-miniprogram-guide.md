# 灵小禅（Lingshan AI Guide）微信小程序工程与联调指南

> **基准说明**：本项目依据第八届全球校园人工智能算法精英大赛（AIC）标准与 2026-10-15 恢复的完整参赛功能基准开发，在保留现有 React Web 前端（`frontend/`）、完整 Express 后端（`backend/`）与 Python/ChromaDB 算法底座的前提下，新增了原生微信小程序端工程（`miniprogram/`）。

---

## 1. 架构设计与目录全景

微信小程序前端采用 **原生微信小程序 + TypeScript + WXML + WXSS** 技术栈，与原 Web 系统共享 Express API 后端服务。AI 模型调用、RAG 向量检索与确定性运筹规划继续在服务端运行，不在客户端暴露任何密钥或大模型 Token。

```text
lingshan-ai-guide-Mao123-doc/
├── miniprogram/                      # 原生微信小程序工程根目录
│   ├── app.ts                        # 小程序生命周期入口与全局网络/路网预载
│   ├── app.json                      # 页面路由、窗口样式、TabBar与权限配置
│   ├── app.wxss                      # 东方禅意（Cyber-Guofeng）全局样式规范
│   ├── sitemap.json                  # 微信页面索引规则配置
│   ├── project.config.json           # 小程序本地工程配置（urlCheck: false）
│   ├── tsconfig.json                 # TypeScript 编译与类型配置
│   ├── package.json                  # miniprogram-api-typings 依赖
│   ├── assets/                       # 移动端静态优化资源
│   │   ├── images/                   # 512px 高质感数字人肖像（总计仅 255KB）
│   │   └── icons/                    # TabBar 81x81 禅意高清图标
│   ├── types/                        # 强类型数据契约
│   │   ├── api.d.ts                  # API 响应与错误标准
│   │   ├── chat.d.ts                 # 问答、SSE数据帧与证据追溯类型
│   │   ├── route.d.ts                # 多约束规划输入、输出与4种判定状态
│   │   └── spot.d.ts                 # 23核心景点、30拓扑道路与周边设施
│   ├── utils/                        # 核心工具层
│   │   ├── request.ts                # 统一 API Client（含 SSE 分块解码拼包）
│   │   ├── coord.ts                  # GCJ-02 火星坐标与 Haversine 距离换算
│   │   └── format.ts                 # 路线状态解释、时间换算与澄清追问文案
│   ├── services/                     # 业务服务层
│   │   ├── api.ts                    # 后端 RESTful 接口对接
│   │   ├── storage-service.ts        # 本地路网缓存与路线持久化
│   │   ├── voice-service.ts          # 微信原生录音与播报服务（带诚实状态）
│   │   ├── vision-service.ts         # 拍照识景、压缩与 Base64 转换
│   │   ├── location-service.ts       # 原生定位、周边设施与地图实景导航
│   │   └── offline-route.ts          # 本地纯确定性无网络应急路线规划器
│   ├── components/                   # 核心可复用组件
│   │   ├── digital-human/            # 数字人形象（4种风格微动效与情绪状态机）
│   │   └── evidence-drawer/          # 可信回答证据追溯抽屉（出处、分数、时延）
│   └── pages/                        # 页面视图层
│       ├── home/                     # 首页（品牌展区、状态监控、快捷问答）
│       ├── chat/                     # 智能问答（气泡对话、流式打字、工具栏）
│       ├── route/                    # 路线规划（自然语言/表单、4状态、纠偏）
│       ├── spots/                    # 景点导览（23景点搜索、分类、无障碍标签）
│       │   └── detail/               # 景点详情（文化故事、门票、实景导航调起）
│       └── profile/                  # 设置中心（形象切换、API配置、离线管理）
├── frontend/                         # 完整保留原有 React Web 游客端与管理后台
├── backend/                          # 完整保留原有 Express 后端服务
├── data/                             # 完整保留 23 景点与 30 道路路网数据
└── project.config.json               # 根目录配置（指向 miniprogramRoot: "miniprogram/"）
```

---

## 2. 功能迁移完成度矩阵

| 功能模块 | 对应后端接口 | 当前实现方式 | 平台限制与适配说明 | 状态评级 |
| --- | --- | --- | --- | --- |
| **首页品牌与状态** | `GET /visitor/status` | 原生 WXML/WXSS，实时探测服务与知识库切片数 | 网络离线时自动切换为本地离线模式提醒 | **已实现并验证** |
| **AI 问答（JSON模式）** | `POST /visitor/qa` | 原生网络请求，多轮上下文，回答持久化 | 稳定支持网络重试、耗时统计与模型标记 | **已实现并验证** |
| **AI 问答（流式SSE）** | `POST /visitor/qa` | `wx.request` + `enableChunked: true` 分块接收 | 采用状态机 UTF-8 跨块解码，未收到 `done` 绝不判定为成功 | **已实现并验证** |
| **证据追溯抽屉** | `POST /visitor/qa` | `evidence-drawer` 底部弹层组件 | 呈现真实信源出处、检索排序分值与端到端耗时 | **已实现并验证** |
| **多约束路线规划** | `POST /visitor/route/plan` | 包含自然语言与结构化表单双输入 | 完整处理 feasible, rejected, clarification, infeasible 4种状态 | **已实现并验证** |
| **信息缺失追问澄清** | `POST /visitor/route/plan` | 结构化缺少字段映射为友好自然语言提示 | 用户输入后追加至意图自动重新规划 | **已实现并验证** |
| **路线进度打卡与纠偏** | `POST /visitor/route/plan` | 本地比对计划用时，超时 10min 自动增量重算 | 严格保留返程死线，不猜测用户未确认的时间 | **已实现并验证** |
| **离线应急规划** | 纯本地确定性运筹 | 基于本地缓存的 23 景点 30 拓扑道路计算 | 断网不调用模型、不猜测过期演出，预留返程南门 | **已实现并验证** |
| **23 景点导览与搜索** | `GET /visitor/spots` | 列表瀑布流、按区域与无障碍过滤、关键字检索 | 离线时无缝读取本地缓存景点库 | **已实现并验证** |
| **景点详情与文化介绍** | `GET /visitor/spots/:id` | 详情卡片，文化渊源、核心看点、游览贴士 | 一键跳转 AI 深度讲解或加入路线 | **已实现并验证** |
| **地图实景导航调起** | 微信原生 API | `wx.openLocation` 传入火星坐标与景点名 | 原生调起微信内置腾讯地图，无需外部浏览器跳出 | **已实现并验证** |
| **定位与附近景点/设施** | `GET /nearby`, `nearby-facilities` | `wx.getLocation` 获取 GCJ-02 坐标后请求后端 | 明确标注直线距离；未授权时引导打开系统设置 | **已实现并验证** |
| **数字人多模态形象** | `GET /visitor/dh-config` | 高保真汉服肖像 + 4种预设 + 状态机微动效 | 诚实披露当前为静态立绘微动效，非动态定制汉服模型 | **因平台限制替代** |
| **拍照识景** | `POST /visitor/vision/recognize` | `wx.chooseMedia` 拍照/选图 + 自动压缩 + Base64 | 严格捕获未配置 503、超时 504 与低置信度追问 | **已实现并验证** |
| **语音交互** | 微信原生 API | `wx.getRecorderManager` + `InnerAudioContext` | 真实申请麦克风权限；云端未配置 ASR 时诚实降级为文字 | **已实现但未真机验证** |
| **回答评价反馈** | `POST /visitor/feedback` | 五星评价与评语输入，防重复提交 | 数据直接持久化落盘至后端 `feedback.json` | **已实现并验证** |
| **Web 管理后台** | `/admin/*` | 完整保留原有 React 管理后台与 JWT 认证 | 游客小程序不暴露任何管理端接口与密码凭据 | **完整保留** |

---

## 3. 微信开发者工具导入与调试指南

### 3.1 导入步骤
1. 打开 **微信开发者工具**（WeChat DevTools）。
2. 点击 **导入项目**（Import Project）。
3. 选择项目根目录：`e:\Projects\lingshan-ai-guide-Mao123-doc`（工具会根据根目录 `project.config.json` 自动识别 `miniprogram/` 为小程序根目录；亦可直接选择 `e:\Projects\lingshan-ai-guide-Mao123-doc\miniprogram`）。
4. **AppID 设置**：
   - 如果您已有个人或企业小程序 AppID，直接输入您的 AppID。
   - 如果暂时没有正式 AppID，可点击下拉菜单选择 **测试号**（或填入 `touristappid`），即可进行无限制本地编译与调试。
5. 点击 **确定** 导入项目。

### 3.2 开发者工具必选设置
在工具右上角点击 **详情**（Project Settings） $\to$ **本地设置**（Local Settings）：
- [x] **不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书**（关键：允许在开发调试阶段请求本地 `http://127.0.0.1:8010`）。
- [x] **启用代码自动热重载 (Compile Hot Reload)**。
- [x] **增强编译 (Enhance)**。

---

## 4. 本地后端联调与真机预览方案

### 4.1 启动后端服务
在项目终端中启动 Express 后端：
```powershell
# 启动 Express 核心服务（监听 8010 端口）
npm run start --prefix backend
# 或开发模式热重载
npm run dev --prefix backend
```

### 4.2 开发者工具模拟器调试
- 小程序默认配置的 API 地址为 `http://127.0.0.1:8010/api/v1`。
- 打开小程序后，首页状态栏应显示绿色圆点及当前大模型名称（或离线知识库模式）。
- 点击底部 TabBar 进入 **问答** 即可开始与 AI 对话。

### 4.3 手机真机预览调试
由于手机真机无法直接访问电脑本地的 `127.0.0.1`，请按以下步骤配置：
1. 确保手机与开发电脑处于 **同一个 Wi-Fi 局域网** 下。
2. 查看电脑局域网 IP（例如 `192.168.1.108`）。
3. 在微信开发者工具中，进入小程序的 **【设置】**（Profile）页面。
4. 在 **后端服务地址配置** 输入框中，将地址更改为您的局域网地址：
   ```text
   http://192.168.1.108:8010/api/v1
   ```
5. 点击 **保存并测试**，确认连接状态显示为“连接正常”。
6. 在微信开发者工具顶部点击 **预览**，使用手机微信扫描生成的二维码即可在手机端实际体验。
7. （可选）手机端打开小程序后，点击右上角 `···` $\to$ **开发调试** $\to$ **打开调试**，即可在真机上查看 vConsole 网络请求与日志。

---

## 5. 正式发布上线与部署要求清单

从本地调试走向微信线上正式发布，需要完成以下准备工作：

### 5.1 域名与 HTTPS 要求
- 微信生产环境强制要求所有网络请求必须使用 **ICP 备案的 HTTPS 域名**，且必须支持 TLS 1.2 及以上。
- 部署好后端服务后（如配置 Nginx 反向代理至 Node 8010 端口），在微信公众平台配置：
  - **request 合法域名**：`https://api.yourdomain.com`
  - **uploadFile 合法域名**：`https://api.yourdomain.com`（拍照识景如需上传文件）
  - **downloadFile 合法域名**：`https://api.yourdomain.com`

### 5.2 隐私权限保护指引（用户隐私协议）
由于小程序使用了定位与麦克风能力，在微信公众平台后台 **【设置】 $\to$ 【基本设置】 $\to$ 【服务内容声明】 $\to$ 【用户隐私保护指引】** 中需声明：
1. **地理位置 (wx.getLocation)**：声明用途为“根据游客实时位置计算到周边景点与卫生间等设施的直线距离”。
2. **麦克风 (wx.getRecorderManager)**：声明用途为“接收游客语音提问并转换为文字进行文旅问答”。
3. **相册/相机 (wx.chooseMedia)**：声明用途为“拍摄或选择景点建筑照片以进行智能识景”。

### 5.3 生产环境主包与体积控制
- 微信小程序主包严格限制在 **2.0 MB** 以内。
- 本工程经过严格资源优化，所有数字人肖像经过色彩量化压缩（5张总计仅 255 KB），TabBar 图标仅 3.5 KB，**当前整个小程序工程总大小仅 432 KB（0.42 MB）**，完全符合微信平台最严苛的代码包体积要求。

---

## 6. 自动化测试与质量保障

我们为小程序客户端底层逻辑及其 API 连通性提供了多维自动化验证：

```powershell
# 1. 验证微信小程序 TypeScript 类型检查（0 错误）
npm run typecheck --prefix miniprogram

# 2. 运行微信小程序专属客户端单元测试（UTF-8多字节跨块解码、确定性离线规划、坐标换算、点击参数清洗等）
npm test --prefix miniprogram

# 3. 运行后端关于微信小程序专属契约的回归测试（包含流式问答、反馈、路线与景点契约）
npm test --prefix backend

# 4. 运行算法层路线与状态抽取 27 项测试（60/60 边界路线硬违规为 0）
npm run test:algorithms --prefix backend
```

---

## 7. 语音与多模态扩展说明（WechatSI 插件）

- **AI 回答语音播报**：每个助手回答气泡下方均提供【🔊 播报】与【⏹️ 停止】操作。在播报时自动联动顶部灵小禅数字人呈现讲解光环与音浪跳动动效。
- **微信同声传译接入**：当在微信公众平台添加官方插件后，只需在 `app.json` 中配置：
  ```json
  "plugins": {
    "WechatSI": {
      "version": "0.3.5",
      "provider": "wx069ba97bb58d59c3"
    }
  }
  ```
  `voice-service.ts` 会自动探测并调用真实云端 TTS 生成原汁原味语音。未配置时将诚实采用高质感数字人动效与状态机友好降级，绝不虚构假数据。

