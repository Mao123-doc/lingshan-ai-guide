import docx
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
src = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(src)

for p in doc.paragraphs:
    if "核心 AI 能力被封装为可交互的 Web 产品" in p.text:
        print("=== 核心 AI 能力 runs ===")
        for i, r in enumerate(p.runs):
            print(f"  R{i}: {repr(r.text)}")
    elif "知识库管理页支持文件索引状态查看" in p.text:
        print("=== 知识库管理页 runs ===")
        for i, r in enumerate(p.runs):
            print(f"  R{i}: {repr(r.text)}")
    elif "在同一 50 题集上比较七种检索配置" in p.text:
        print("=== 在同一 50 题集 runs ===")
        for i, r in enumerate(p.runs):
            print(f"  R{i}: {repr(r.text)}")
