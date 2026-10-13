import os
import sys
import zipfile
import xml.etree.ElementTree as ET

# Ensure stdout uses UTF-8
sys.stdout.reconfigure(encoding="utf-8")

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")
print("Target docx:", docx_path)

with zipfile.ZipFile(docx_path, "r") as z:
    media = [f for f in z.namelist() if f.startswith("word/media/")]
    print(f"\n--- Total Media Files in DOCX ({len(media)}) ---")
    for m in sorted(media):
        info = z.getinfo(m)
        print(f"  {m}: {info.file_size} bytes")

    # Read rels
    rels_xml = z.read("word/_rels/document.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rel_map = {}
    for rel in rels_root:
        rel_map[rel.attrib.get("Id")] = rel.attrib.get("Target")

    # Read document
    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)

    ns = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
        "v": "urn:schemas-microsoft-com:vml"
    }

    paragraphs = root.findall(".//w:p", ns)
    print(f"\nTotal paragraphs: {len(paragraphs)}")

    # Let's track figures and their images
    # We want to inspect all paragraphs
    # Let's print out all paragraphs that have drawings OR captions
    for idx, p in enumerate(paragraphs, 1):
        texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
        full_text = "".join(texts).strip()

        drawings = p.findall(".//w:drawing", ns)
        blips = p.findall(".//a:blip", ns)
        blip_targets = [rel_map.get(b.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")) for b in blips]

        # Check drawing dimensions if present
        extents = p.findall(".//wp:extent", ns)
        extent_str = ""
        if extents:
            cx = int(extents[0].attrib.get("cx", 0))
            cy = int(extents[0].attrib.get("cy", 0))
            # 1 inch = 914400 EMUs, 1 cm = 360000 EMUs
            extent_str = f" [size: {cx/360000:.1f}cm x {cy/360000:.1f}cm]"

        # Check if text mentions 图
        has_fig = "图" in full_text
        has_drawing = len(drawings) > 0

        if has_drawing or (has_fig and len(full_text) < 150):
            # Print paragraph info
            img_info = f" | images: {blip_targets}{extent_str}" if blip_targets else ""
            print(f"P{idx:03d} | text: {full_text}{img_info}")
