# 灵小禅全国总决赛材料 95+ 整改问题状态跟踪表

| ID | 严重度 | 文件 | 当前表述 | 目标表述 | 证据 | 责任阶段 | 状态 |
|---|---|---|---|---|---|---|---|
| ISSUE-01 | 致命 (Fatal) | `14页高保真分镜设计稿与排版指南.md`<br>`系统总体技术架构说明.md` | 出现“13:45 抵达检票口” | 统一为“13:40 抵达梵宫检票口（前置 20 分钟演艺缓冲）” | `canonical_claims.yaml` (FACT-08, FACT-12) | 阶段 1 | 已解决 |
| ISSUE-02 | 致命 (Fatal) | `核心创新与项目展示报告(万字申报底稿).md`、路网资产 | 历史材料曾混用“23 核心景点、30/31 条道路” | 当前材料统一为“23 个路线节点、30 条当前登记道路边”；31 条保留为待补齐核验的目标口径，不能表述为已完成资产 | `canonical_claims.yaml` (FACT-07), `data/route/spots.json`, `data/route/edges.json`, `docs/superpowers/plans/2026-09-21-experiment-rerun.md` | 阶段 1 | 重新打开：待补齐第 31 条并复核发布包 |
| ISSUE-03 | 严重 (Major) | `用户调研实验设计与测评协议.md`<br>`14页高保真分镜设计稿与排版指南_optimized.md`<br>`核心创新与项目展示报告_optimized.md` | 偶有包装成“正式真实游客研究” | 统一标记为“探索性预调研 (n=50)”，注明 35 份现场+15 份定向回访，明确行动受限者分母与样本局限 | `canonical_claims.yaml` (FACT-10) | 阶段 2 | 已解决 |
| ISSUE-04 | 严重 (Major) | `locust_report.md`<br>申报书 TeX/MD<br>PPTX Slide 12 | 200 QPS 易被误解为含大模型全链路吞吐 | 明确 200 QPS 仅代表单台 4 核 8G 边缘节点“纯路线规划求解接口 (/api/route/plan)”吞吐，不含 LLM/ASR/TTS | `canonical_claims.yaml` (FACT-09), `locust_report.md` | 阶段 2 | 已解决 |
| ISSUE-05 | 严重 (Major) | 申报书 TeX/MD<br>分镜与 PPTX Slide 13 | 3~6 个月 ROI、投诉下降 40%、观光车利用率提升 25% 曾表述为确定事实 | 统一标注为“测算值 / 情景假设”，建立保守/中性/乐观三种情景，分离一次性建图成本与常态年运维 | `canonical_claims.yaml` (FACT-11) | 阶段 2 | 已解决 |
| ISSUE-06 | 致命 (Fatal) | `灵小禅_可信文旅决策智能体_技术报告与论文底稿_optimized.tex`<br>`核心创新与项目展示报告(万字申报底稿)_optimized.md` | 申报书部分章节需强化评分维度映射、防越权拦截示意及 5 小时英雄案例完整参数 | 对齐官方七大评分维度，明确区隔 96% 基线与 98% 消融观察值，完整展示 5 小时案例与 20 分钟诚实拒绝 | `canonical_claims.yaml`, 大赛 100 分标准 | 阶段 3 | 已解决 |
| ISSUE-07 | 致命 (Fatal) | `灵小禅_竞赛汇报PPT_初版.pptx`<br>`竞赛汇报PPT制作说明与讲稿.md` | 文件名包含“初版”；需核验每页字号、20秒口播、200 QPS 边界注记与 5 小时案例一致性 | 重命名为 `灵小禅_竞赛汇报PPT.pptx`，确保正好 14 页并导出 PDF，每页 20 秒口播对齐 | `canonical_claims.yaml`, `14页高保真分镜_optimized.md` | 阶段 4 | 已解决 |
| ISSUE-08 | 致命 (Fatal) | `scripts/audit_competition_materials.ps1` | 缺少自动化交叉审计门禁脚本 | 编写自动化 PowerShell 脚本，覆盖 TeX、MD、PPTX 解包 XML 与 PDF 提取文本的红线扫描 | `canonical_claims.yaml` | 阶段 5 | 已解决 |
| ISSUE-09 | 致命 (Fatal) | `release/competition_final/` | 缺少独立隔离的最终提交发布包 | 建立 `release/competition_final/`，仅收录冻结 PDF、PPTX、TeX、MD、讲稿及 SHA-256 清单，旧版完全隔离 | `canonical_claims.yaml`, 验收规范 | 阶段 6 | 已解决 |
