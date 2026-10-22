# 脚本入口

从项目根目录执行命令。

| 用途 | 脚本 |
| --- | --- |
| 启动 / 停止服务 | `scripts/start.bat` / `scripts/stop.bat` |
| 发布工程包 | `scripts/build_aic_submission.py` |
| 发布审计 | `scripts/audit_competition_materials.ps1`、`scripts/audit_competition_materials.py` |
| 发布校验 | `scripts/verify-release.ps1` |
| 运行检索消融 | `scripts/run_ablation.py` |
| 运行服务验证 | `scripts/verify-competition-runtime.cjs` |

材料生成和一次性排版脚本不属于运行时工程，已从主目录清理。临时抽帧、提取文本和排版试验不要重新放回仓库根目录。
