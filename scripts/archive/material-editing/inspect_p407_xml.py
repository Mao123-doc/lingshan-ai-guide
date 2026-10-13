import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")

with zipfile.ZipFile(docx_path) as z:
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = root.findall(".//w:p", ns)

    for i in range(404, 413):
        p = paragraphs[i]
        xml_str = ET.tostring(p, encoding="utf-8").decode("utf-8")
        txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
        print(f"=== P{i+1}: text=\"{txt}\" ===")
        print(xml_str[:300] + "..." if len(xml_str) > 300 else xml_str)
