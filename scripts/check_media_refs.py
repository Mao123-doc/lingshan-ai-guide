import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    rels_xml = z.read("word/_rels/document.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rId_to_target = {}
    target_to_rId = {}
    for rel in rels_root:
        rId = rel.attrib.get("Id")
        tgt = rel.attrib.get("Target")
        rId_to_target[rId] = tgt
        target_to_rId[tgt] = rId

    media_in_zip = sorted([f for f in z.namelist() if f.startswith("word/media/")])
    print(f"Total media files in zip: {len(media_in_zip)}")

    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)

    ns = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
        "v": "urn:schemas-microsoft-com:vml"
    }

    # Find all image references in document.xml
    blips = root.findall(".//a:blip", ns)
    used_rIds = set()
    for b in blips:
        embed = b.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
        if embed:
            used_rIds.add(embed)

    print("\nMedia file usage check:")
    for mf in media_in_zip:
        basename = os.path.basename(mf)
        rel_target = f"media/{basename}"
        rid = target_to_rId.get(rel_target)
        is_used = rid in used_rIds if rid else False
        print(f"  {basename:15s} | rId: {str(rid):10s} | used in doc: {is_used}")
