# 知识库原始语料说明

后端启动时会自动从 `data/raw/` 加载以下文件构建 RAG 知识库：

| 文件 | 说明 |
|------|------|
| `knowledge_guide.txt` | 灵山胜境导览长文本（景点介绍、历史文化） |
| `knowledge_dataset.txt` | 景点结构化数据集（文本格式） |
| `灵山胜境 景点结构化数据集.docx` | 结构化数据原始文档（供人工查阅） |
| `灵山胜境：历史、文化、景点特色与个性化游览指南.docx` | 导览手册原始文档（供人工查阅） |
| `景点景区旅游数据行为分析数据.xlsx` | 游客行为分析数据（供运营参考） |

文本文件（`.txt`）参与分块与向量索引；Office 文档仅作为语料来源存档。

如需更换语料：替换 `knowledge_guide.txt` / `knowledge_dataset.txt` 后，
在管理后台「知识库」页面点击 **重建索引**，或调用
`POST /api/v1/admin/knowledge/reindex`。
