import docx
import sys
import os
import re

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")
doc = docx.Document(docx_path)

print("=== HEADING PARAGRAPHS AUDIT ===")
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    is_h = re.match(r"^第[一二三四五六七八九十]+章", txt) or re.match(r"^\d+\.\d+", txt) or txt in ["摘 要", "作品简介", "目 录"]
    if is_h:
        pf = p.paragraph_format
        align = p.alignment
        before = pf.space_before.pt if pf.space_before else 0
        after = pf.space_after.pt if pf.space_after else 0
        fonts = set(r.font.name for r in p.runs if r.font.name)
        sizes = set(r.font.size.pt for r in p.runs if r.font.size)
        bolds = set(r.bold for r in p.runs if r.bold is not None)
        print(f"P{idx:03d} [{align}] | sz={sizes} | b={bolds} | font={fonts} | before={before}pt after={after}pt | {txt}")
