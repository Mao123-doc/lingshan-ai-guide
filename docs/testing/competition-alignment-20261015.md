# 参赛功能恢复验收记录

日期：2026-10-15（Asia/Shanghai）。功能依据为用户指定的 `lingxiaochan10-06.pptx` 与《项目方案2.0.pdf》，对应关系见[功能台账](../competition/feature-contract.md)。

## 已执行

| 检查 | 命令/证据 | 结果 |
| --- | --- | --- |
| 前端单元测试 | `npm run test:unit --prefix frontend` | 41项通过，包含流式分帧、权限/取消、评分、删除失败、看板恢复、导航、离线校验和进度纠偏 |
| 前端代码检查和生产构建 | `npm run lint --prefix frontend`、`npm run build --prefix frontend` | 通过；图表/渲染共享依赖存在大于500KB的构建提示 |
| 后端接口、认证、安全与可靠性 | `npm test --prefix backend` | 37项通过 |
| 检索、状态与路线算法 | `npm run test:algorithms --prefix backend` | 27个测试条目通过；历史路线60/60、硬违规0；场景40/40；新增返程/停检规划缓冲/场次选择/时间守恒回归通过 |
| 后端生产构建 | `npm run build --prefix backend` | 通过 |
| Python工具 | `python -m unittest discover -s backend/python/tools -p "test_*.py"` | 70项通过 |
| 桌面及移动浏览器 | `npm run test:e2e --prefix frontend -- --project=chromium --project=mobile-chromium --workers=4` | 26项通过；固定API响应，不等于在线模型效果 |
| 真实Express与生产前端 | `node scripts/verify-competition-runtime.cjs` | 独立临时DATA_ROOT，无实际用户凭据、无付费API；流式问答与反馈落盘、浏览器定位→实际附近API、视觉未配置错误、Live2D真实模型加载、后台真实统计与形象配置、断网刷新后本地应急规划、390px布局共8条检查通过，pageErrors为空 |

真实浏览器检查的本地产物在 `output/competition-runtime/`：`report.json`、`qa.png`、`live2d.png`、`offline-route.png`。脚本清理其临时数据及服务，不写入正式会话/反馈文件。模型不可用时验证的是知识摘录路径；视觉正常解析另由本地提供方替身API测试覆盖。

工程包另行解压到自动清理的临时目录，逐文件SHA-256与ZIP CRC核对通过；前后端分别执行全新 `npm ci --ignore-scripts` 后生产构建通过，没有复用原工作区node_modules。完整日志本地保存在 `output/package-fresh-install.log`。

## 明确未验证的内容

- 未重跑在线50题事实问答和七组消融；历史96.0%/98.0%不代表本次新增功能的在线准确率。
- 当前动态数字人为仓库Hibiki示例模型；尚未取得材料所述定制汉服Live2D模型，不能将汉服静态肖像说成定制动态模型。
- 未用真实摄像头、麦克风和游客设备完成实地试用；浏览器录音/播报的实际可用声音和权限依设备而定。
- 定位由浏览器模拟坐标验证真实后端计算，未做景区GPS现场精度测量。
- 未连接真实视觉提供方、重新下载向量模型，未在相同4核8G设备重测202.4 QPS。
- 未新增道路、实测坡度或接驳班次；estimated保留。自动纠偏需用户确认进度并开启，不代表被动定位监控。

## 审查与发布

独立审查发现并修复三项P2：离线路网校验和未核对、看板断线无重连、首个统计请求失败后永久加载。补充测试后复审通过。额外修复浏览器导航默认驾车模式、Live2D运行时ESM重复声明问题和工具区长列表遮挡数字人的布局。

发布分支为 `codex/competition-feature-alignment`，目标为已核实同源且归用户所有的 `OrdoAbChao7/lingshan-ai-guide-ablation`。旧 `myfork` 地址已失效。管理员运行配置停止跟踪但保留本地文件；真实环境配置、运行记录、依赖、构建缓存和旧解压副本不进入本次提交。

当前工程包统一位于 `submission/current/`，从源码生成，包含必需的数字人运行时和模型、所有有效界面及浏览器验收脚本。包内 `SUBMISSION_MANIFEST.json` 记录逐文件散列、源码版本及基准材料散列；ZIP自身散列见同目录 `SHA256SUMS.txt`。原PPT/PDF不被重写。
