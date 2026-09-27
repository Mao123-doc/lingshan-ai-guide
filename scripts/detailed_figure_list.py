import os
import sys
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image
import io

sys.stdout.reconfigure(encoding="utf-8")

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    rels_xml = z.read("word/_rels/document.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rel_map = {}
    for rel in rels_root:
        rel_map[rel.attrib.get("Id")] = rel.attrib.get("Target")

    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)

    ns = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    }

    paragraphs = root.findall(".//w:p", ns)

    # Let's track current heading / section
    current_h1 = ""
    current_h2 = ""

    results = []

    for idx, p in enumerate(paragraphs):
        p_num = idx + 1
        texts = [t.text for t in p.findall(".//w:t", ns) if t.text]
        full_text = "".join(texts).strip()

        # Check headings
        pStyle = p.find(".//w:pStyle", ns)
        style_val = pStyle.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val") if pStyle is not None else ""
        if style_val in ["1", "Heading1", "标题1"]:
            current_h1 = full_text
        elif style_val in ["2", "Heading2", "标题2"]:
            current_h2 = full_text

        # Find blips
        blips = p.findall(".//a:blip", ns)
        blip_targets = [rel_map.get(b.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")) for b in blips]

        extents = p.findall(".//wp:extent", ns)
        ext_list = []
        for ext in extents:
            cx = int(ext.attrib.get("cx", 0)) / 360000.0  # cm
            cy = int(ext.attrib.get("cy", 0)) / 360000.0  # cm
            ext_list.append(f"{cx:.1f}cm × {cy:.1f}cm")

        results.append({
            "p_num": p_num,
            "text": full_text,
            "style": style_val,
            "h1": current_h1,
            "h2": current_h2,
            "images": blip_targets,
            "extents": ext_list,
        })

    print(f"Total paragraphs analyzed: {len(results)}")
    
    # Print all items that have images or start with 图
    for i, r in enumerate(results):
        txt = r["text"]
        has_imgs = len(r["images"]) > 0
        is_fig_title = txt.startswith("图 ") or txt.startswith("图1") or txt.startswith("图2") or txt.startswith("图3") or txt.startswith("图4") or txt.startswith("图5") or txt.startswith("图6") or txt.startswith("图7") or txt.startswith("图8") or txt.startswith("图9") or txt.startswith("图 4-") or txt.startswith("图 7-")

        if has_imgs or is_fig_title:
            print(f"P{r['p_num']:04d} | [H1: {r['h1'][:15]} / H2: {r['h2'][:15]}]")
            if has_imgs:
                for img_tgt, ext in zip(r["images"], r["extents"]):
                    print(f"       -> IMAGE: {img_tgt} ({ext})")
            if txt:
                print(f"       -> TEXT:  {txt}")
