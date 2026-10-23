import docx
import sys
import os
import re

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(docx_path)

for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if re.match(r"^图\s*\d+\s{1,}", txt) and not txt.startswith("图 6 的当前原型") and not txt.startswith("图 7 概括了") and not txt.startswith("图 9 展示受限"):
        print(f"[{idx:03d}] runs={len(p.runs)}: {txt}")
        for r_i, r in enumerate(p.runs):
            print(f"   r{r_i}: {repr(r.text)}")
