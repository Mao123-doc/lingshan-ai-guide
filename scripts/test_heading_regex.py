import docx
import re
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(docx_path)

h1_list = []
h2_list = []
h3_list = []

for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if re.match(r"^第[一二三四五六七八九十]+章\s+", txt):
        h1_list.append((idx, txt))
    elif re.match(r"^\d+\.\d+\s+[\u4e00-\u9fa5A-Za-z]", txt) and len(txt) < 35:
        h2_list.append((idx, txt))
    elif re.match(r"^\d+\.\d+\.\d+\s+[\u4e00-\u9fa5A-Za-z0-9]", txt) and len(txt) < 35:
        h3_list.append((idx, txt))

print(f"Total H1: {len(h1_list)}")
for idx, txt in h1_list:
    print(f"  H1: [{idx:03d}] {txt}")

print(f"\nTotal H2: {len(h2_list)}")
for idx, txt in h2_list:
    print(f"  H2: [{idx:03d}] {txt}")

print(f"\nTotal H3: {len(h3_list)}")
for idx, txt in h3_list:
    print(f"  H3: [{idx:03d}] {txt}")
