import os
import sys
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    rels_xml = z.read("word/_rels/document.xml.rels")
    rels_root = ET.fromstring(rels_xml)
    rel_map = {rel.attrib.get("Id"): rel.attrib.get("Target") for rel in rels_root}

    doc_xml = z.read("word/document.xml")
    root = ET.fromstring(doc_xml)

    ns = {
        "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    }

    paragraphs = root.findall(".//w:p", ns)

    cur_sec = "文档开头"

    # Map paragraph to figure details
    figs = []
    for idx, p in enumerate(paragraphs):
        p_num = idx + 1
        txt = "".join([t.text for t in p.findall(".//w:t", ns) if t.text]).strip()
        
        # Check if heading
        pStyle = p.find(".//w:pStyle", ns)
        style_val = pStyle.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val") if pStyle is not None else ""
        if style_val in ["1", "2", "3", "Heading1", "Heading2", "Heading3", "标题1", "标题2", "标题3"] or (txt.startswith("第") and "章" in txt[:5]) or (len(txt) > 0 and txt[0].isdigit() and "." in txt[:4] and len(txt) < 40):
            if any(k in txt for k in ["章", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "一、", "二、", "三、", "四、", "五、", "六、"]):
                cur_sec = txt

        blips = p.findall(".//a:blip", ns)
        blip_targets = [rel_map.get(b.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")) for b in blips]

        extents = p.findall(".//wp:extent", ns)
        ext_list = [f"{int(e.attrib.get('cx',0))/360000:.1f}cm × {int(e.attrib.get('cy',0))/360000:.1f}cm" for e in extents]

        if txt.startswith("图 ") or txt.startswith("图1") or txt.startswith("图2") or txt.startswith("图3") or txt.startswith("图4") or txt.startswith("图5") or txt.startswith("图6") or txt.startswith("图7") or txt.startswith("图8") or txt.startswith("图9") or txt.startswith("图 4-") or txt.startswith("图 7-"):
            figs.append({
                "type": "caption",
                "p_num": p_num,
                "section": cur_sec,
                "text": txt,
                "images": blip_targets,
                "extents": ext_list
            })
        elif blip_targets:
            figs.append({
                "type": "image",
                "p_num": p_num,
                "section": cur_sec,
                "text": txt,
                "images": blip_targets,
                "extents": ext_list
            })

    for f in figs:
        print(f"P{f['p_num']:04d} | [{f['section']}] | Type: {f['type']} | Img: {f['images']} {f['extents']} | Text: {f['text'][:80]}")
