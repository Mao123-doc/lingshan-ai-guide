# 脚本入口

从项目根目录执行命令。

| 用途 | 脚本 |
| --- | --- |
| 启动 / 停止服务 | `scripts/start.bat` / `scripts/stop.bat` |
| 发布验证 | `scripts/verify-release.ps1` |
| 竞赛材料审计 | `scripts/audit_competition_materials.ps1`、`scripts/audit_competition_materials.py` |
| 构建材料发布包 | `scripts/build_release_package.py` |
| 运行消融 | `scripts/run_ablation.py` |
| 制作图表与候选素材 | `scripts/generate_charts.py`、`scripts/generate_all_candidates.py` |
| MiniMax PPT 工具 | `scripts/pptx_minimax/` |
| 历史材料加工 | [archive/material-editing](archive/material-editing/) |

历史目录收纳一次性 Word/PPT 排版、段落定位、图片检查与补丁脚本；它们不是后端或前端测试套件。迁移后仍从项目根目录运行，Word 路径指向 `竞赛汇报与文档材料包/03_申报文档与技术报告/Word工作稿/`。这些脚本依赖当时文稿内容与段落位置，不应批量重跑。
