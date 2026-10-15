# 第三方资源与引用核对

本项目的 MIT 许可证仅覆盖有权按该许可发布的项目代码，不覆盖第三方模型、照片、语料和专有库。

| 资源 | 可核实的来源线索 | 交付与待核实事项 |
|---|---|---|
| npm 第三方依赖 | 前后端 package.json 与 package-lock.json 的包名、版本、resolved、license 字段 | 通过 npm 安装，提交包不含 node_modules。各包遵守自身许可证 |
| ChromaDB、sentence-transformers | backend/python/requirements.txt、vector_service.py 导入 | 通过 pip 安装；目前未锁定所有传递依赖，安装后记录版本 |
| BAAI/bge-large-zh-v1.5 | vector_service.py 中的精确模型名称 | 首次运行由 SentenceTransformer 下载；不提交权重，使用方须核对模型分发源及许可 |
| 灵山知识文本 | data/raw 两个 TXT，docs/knowledge-corpus.md 对应的原始资料名 | 无法仅凭本仓库证明采集来源和授权；提交者须确认合法来源，不能将“权威兜底策略”当作景区授权证明 |
| 路线景点与道路 | data/route 四个 JSON 的 source/confidence 字段 | 道路中存在 estimated，不将其宣传为全部现场测绘或实时官方道路 |
| 景点照片 | frontend/public 中对应景点的图片文件名 | 尚无逐图授权记录。正式再分发前须核实来源及使用权限 |
| Live2D 及 Hibiki 资源 | frontend/public/live2dcubismcore.min.js 的版权头、相关 npm 包名 | 2026-10-15恢复引用；Cubism2运行时来自已安装live2d-widget的本地SDK，保留原版权/许可头，作为classic script载入。Hibiki模型、动作与纹理沿用仓库资源；不能将根MIT当作第三方授权 |
| portrait 图 | PNG 内含 prompt 字段 | 2026-10-15恢复用于数字人静态替代和风格展示；保留图像，该字段本身不能证明生成平台授权条件 |

本说明补齐已知引用线索，不虚构授权或确认尚未取得的许可。版权署名不会为匿名评审随意删除。正式材料不得展示所属学校、学校 Logo 或指导教师信息；普通景区“佛学院”字样不能直接判为参赛学校泄露。
