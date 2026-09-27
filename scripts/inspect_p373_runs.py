import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path) as z:
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = root.findall(".//w:p", ns)

    for i in range(372, 381):
        p = paragraphs[i]
        txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
        print(f"=== P{i+1}: text='{txt}' ===")
        for r in p.findall(".//w:r", ns):
            rtxt = "".join([t.text for t in r.findall(".//w:t", ns) if t.text])
            blips = r.findall(".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip")
            print(f"   run: text='{rtxt}' blips={len(blips)}")
