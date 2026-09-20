---
name: competition-deck-designer
description: >-
  Expert skill for designing, structuring, and producing award-winning competition presentation
  decks and high-fidelity storyboards for AI + Scenario Innovation contests (especially in cultural
  tourism, digital humans, and intelligent agents). Provides design tokens (Cyber-Guofeng), 14-slide
  narrative structures, data visualization standards, and slide-by-slide script copywriting rules.
---

# 竞赛级 AI 演示文稿设计专家 (Competition Deck Designer)

本 Skill 专门用于指导和规范面向高校与行业算法/场景创新竞赛（如“人工智能算法精英大赛”、“互联网+”、“挑战杯”等）的 PPT 视觉设计、叙事结构构建与分镜产出。

---

## 1. 核心叙事法则：因果闭环故事线 (Causal Storyline)

在 AI 场景创新赛道中，评委通常在 5~8 分钟内听完汇报，切忌“功能流水账”或“纯算法炫技”。全篇必须严格遵循**六步因果推进链**：

```text
1. 场景与真实痛点 (Pain Point)      --> 为什么通用 AI / 传统导览在此场景失效？
2. 破局定位与总体框架 (Solution)    --> 从问答升级为决策，构建端到端闭环
3. 核心机制拆解 (Key Innovations)   --> 聚焦 3 大不可替代的核心技术
4. 严格量化证据 (Empirical Proof)   --> 消融实验、硬核指标、基线对比（有据可查）
5. 典型高潮案例 (Hero Case)        --> 复杂多约束场景实测还原（含防御性拒绝）
6. 落地形态与推广迁移 (Impact)      --> 数字人多模态交付、跨场景低成本复制
```

---

## 2. 视觉设计系统：国风数智 (Cyber-Guofeng Design Tokens)

针对灵山胜境及文旅数智化项目，统一采用“国风数智新国潮”视觉语言，平衡东方文化底蕴与硬核 AI 科技感：

### 色彩规范 (Color Palette)
- **主背景色 (Background Base)**:
  - 深邃黛青：`#0F172A` / `#1E293B`（深色科技底）
  - 汉白玉浅底：`#F8FAFC` / `#FFFFFF`（浅色卡片底）
- **科技主色 (Primary Tech Color)**:
  - 松柏数智绿 / 青碧：`#0D9488` / `#14B8A6` / `#059669`（代表算法、连接与生机）
  - 科技天青：`#0284C7` / `#38BDF8`（代表数据流、检索与云端）
- **文旅强调色 (Accent / Cultural Heritage)**:
  - 琉璃金 / 禅意暖金：`#D97706` / `#F59E0B` / `#B45309`（代表灵山胜境、庄严与高光）
  - 朱砂红（微量）：`#DC2626`（仅用于警示、痛点与不可行拒绝标注）
- **中性层级色 (Text & Borders)**:
  - 标题高亮白：`#F8FAFC`
  - 正文浅灰：`#94A3B8`
  - 卡片边框微光：`rgba(20, 184, 166, 0.2)`

### 排版与栅格法则 (Typography & Layout Grid)
1. **标题直接写结论**：禁止使用《技术架构》《实验结果》等名词性标题，必须写《多路检索覆盖事实与语义双重盲区》《消融实验证实重排使准确率提升8个百分点》等结论型大标题。
2. **3秒抓眼球原则**：每页设立 1 个核心视觉焦点（高清晰架构图 / 真实 UI 样机 / 突出数字指标卡片），辅助以不超过 3 个信息卡片。
3. **字号阶梯**：
   - 页面大标题：`28 ~ 32 pt`（加粗）
   - 卡片核心指标数字：`36 ~ 44 pt`（特粗）
   - 卡片小标题：`16 ~ 18 pt`（加粗）
   - 正文与说明：`12 ~ 14 pt`（常规）

---

## 3. 14 页标准分镜结构定义

| 页码 | 页面属性 | 核心目的 | 推荐构图 | 必备元素 |
| :---: | :--- | :--- | :--- | :--- |
| **P1** | 封面 (Cover) | 亮出项目定位与气场 | 大图居中/居右，左侧强排版 | 数字人立绘、禅意科技背景、项目一句话定位、参赛赛道 |
| **P2** | 场景痛点 (Problem) | 建立评委共情，说明真实难题 | 三列对比卡片 | 3类真实游客提问（老人、限时、演出冲突） |
| **P3** | 破局定位 (Concept) | 阐明项目核心主张（知-懂-定） | 三角对立平衡结构 | 知识获取 vs 游客理解 vs 路线决策 |
| **P4** | 全景闭环 (Architecture) | 展示完整业务闭环链路 | 横向泳道流图 | 游客输入 $\rightarrow$ 状态抽取 $\rightarrow$ 检索/规划 $\rightarrow$ 交互 |
| **P5** | 核心机制 1 (Retrieval) | 说明如何做到回答又准又全 | 左架构图 + 右分流表 | Vector + Structured + Keyword $\rightarrow$ Rerank 机制 |
| **P6** | 对比攻坚 (Why Hybrid?) | 证明单一向量检索的不足 | 对比矩阵表格 | 语义问题 vs 事实问题 vs 规则问题的召回差异 |
| **P7** | 量化证明 (Ablation) | 展现硬核消融实验数据 | 大柱状图 + 关键结论标注 | 7组 Profile 柱状图，重点标出 Full RAG 98% 与 Rerank 贡献 |
| **P8** | 核心机制 2 (State) | 说明如何听懂游客潜台词 | 左输入文本 + 右状态标签卡 | 游客自然语言 $\rightarrow$ 提取出老人/儿童/轮椅/时间等标签 |
| **P9** | 核心机制 3 (Planner) | 证明路线真实可走 | 漏斗过滤拓扑图 | 物理路网 $\rightarrow$ 约束过滤 $\rightarrow$ 时间窗对齐 $\rightarrow$ 可行方案 |
| **P10**| 专项评测 (Evaluation) | 全面证明系统各模块可靠性 | 3张核心指标大卡片 | 96%知识准确率、100%字段抽取、0硬性违背 |
| **P11**| 英雄案例 (Hero Case) | 复杂需求全程实战还原 | 上下时间轴 / 步骤分解流 | 老人+3小时+吉祥颂案例，附带不可行时的“诚实拒绝” |
| **P12**| 产品落地 (Product UI) | 证明具备工程交付与可展示性 | 手机/大屏产品样机 (Mockups)| 数字人 Live2D 交互界面、地图动线渲染、语音对讲 |
| **P13**| 推广价值 (Scalability) | 证明行业通用性与商业潜力 | 辐射扩散拓扑矩阵 | 灵山模式 $\rightarrow$ 博物馆、历史街区、产业园快速迁移 |
| **P14**| 总结收官 (Conclusion) | 升华价值，留下深刻记忆 | 居中聚拢结构 | 三大核心能力回顾 + 三大硬核指标 + 团队愿景 |

---

## 4. 图表与素材生成标准

1. **架构图**：必须明确分层（感知层、状态层、知识层、规划层、交互层），并标注各层之间的协议与数据流。
2. **消融图表**：使用双轴或分组柱状图，横轴为 Profile，纵轴为 Accuracy / Fact Recall 与 Latency，用琉璃金色或亮青色突出最终完整方案。
3. **真实场景图**：必须使用高分辨率原画或实景，配合阴影与圆角（Border Radius 8~12px），展现工业级现代审美。
