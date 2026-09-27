import docx
import sys
import os
import re

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(docx_path)

print("=== ALL TABLES AND CAPTIONS ===")
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if re.match(r"^表\s*\d+", txt):
        print(f"P{idx:03d}: {txt}")
