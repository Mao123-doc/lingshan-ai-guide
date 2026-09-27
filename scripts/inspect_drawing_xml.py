import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = root.findall(".//w:p", ns)
    
    # Check P490 which contains image11.jpeg
    p_img = paragraphs[489] # 0-indexed for P490
    print(ET.tostring(p_img, encoding="utf-8").decode("utf-8"))
