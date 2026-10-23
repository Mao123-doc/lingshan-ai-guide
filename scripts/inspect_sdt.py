import zipfile
import xml.etree.ElementTree as ET
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    sdts = root.findall(".//w:sdt", ns)
    print(f"Total sdt blocks: {len(sdts)}")
    for sdt_idx, sdt in enumerate(sdts):
        print(f"\n--- SDT Block {sdt_idx + 1} ---")
        ps = sdt.findall(".//w:p", ns)
        print(f"Contains {len(ps)} paragraphs:")
        for p in ps:
            txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
            if txt:
                print(f"  {txt}")
