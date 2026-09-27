import os
import sys
import zipfile
import xml.etree.ElementTree as ET
import re

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    paragraphs = root.findall(".//w:p", ns)
    print(f"Total paragraphs: {len(paragraphs)}")

    fig_mentions = []
    for idx, p in enumerate(paragraphs):
        p_num = idx + 1
        txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
        # Find all occurrences of 图
        if re.search(r"图\s*\d+", txt) or re.search(r"图\s*4-\s*1", txt) or re.search(r"图\s*7-\s*1", txt):
            # check if it's caption
            is_caption = txt.startswith("图 ") or txt.startswith("图1") or txt.startswith("图2") or txt.startswith("图3") or txt.startswith("图4") or txt.startswith("图5") or txt.startswith("图6") or txt.startswith("图7") or txt.startswith("图8") or txt.startswith("图9") or txt.startswith("图 4-") or txt.startswith("图 7-")
            fig_mentions.append((p_num, is_caption, txt))

    print(f"\n--- Total paragraphs with figure mentions: {len(fig_mentions)} ---")
    for p_num, is_caption, txt in fig_mentions:
        kind = "CAPTION  " if is_caption else "REFERENCE"
        print(f"P{p_num:04d} | {kind} | {txt}")
