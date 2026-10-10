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
    print(f"Total paragraphs: {len(paragraphs)}")

    for idx, p in enumerate(paragraphs):
        p_num = idx + 1
        txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
        drawings = p.findall(".//w:drawing", ns)
        if 0 < len(txt) <= 6 and len(drawings) == 0:
            print(f"P{p_num:04d} | len={len(txt)}: \"{txt}\"")
