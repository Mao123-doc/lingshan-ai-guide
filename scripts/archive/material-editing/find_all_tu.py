import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = root.findall(".//w:p", ns)

    all_tu = []
    for idx, p in enumerate(paragraphs):
        p_num = idx + 1
        txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
        if "图" in txt:
            # find all snippets with 图
            all_tu.append((p_num, txt))

    print(f"Total paragraphs with '图': {len(all_tu)}")
    for p_num, txt in all_tu:
        # Highlight occurrences of 图 and surrounding 20 chars
        parts = []
        pos = 0
        while True:
            idx = txt.find("图", pos)
            if idx == -1:
                break
            snippet = txt[max(0, idx-10): min(len(txt), idx+20)]
            parts.append(snippet)
            pos = idx + 1
        print(f"P{p_num:04d}: {' | '.join(parts)}")
