import docx
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")
doc = docx.Document(docx_path)

for p in doc.paragraphs:
    if "核心 AI 能力被封装为可交互的 Web 产品" in p.text:
        assert p.runs[16].text == "9"
        assert p.runs[23].text == "10"
        p.runs[16].text = "10"
        p.runs[23].text = "11"
        print("Updated 核心 AI 能力: (图 9)->(图 10), (图 10)->(图 11)")
    elif "知识库管理页支持文件索引状态查看" in p.text:
        assert p.runs[15].text == "11"
        p.runs[15].text = "12"
        print("Updated 知识库管理页: (图 11)->(图 12)")
    elif "在同一 50 题集上比较七种检索配置" in p.text:
        assert p.runs[8].text == "13"
        p.runs[8].text = "14"
        print("Updated 在同一 50 题集: 和图 13 -> 和图 14")

doc.save(docx_path)
print("Saved final.docx successfully!")
