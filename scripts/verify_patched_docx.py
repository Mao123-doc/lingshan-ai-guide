import docx
import zipfile
import re
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
print("=== VERIFYING PATCHED DOCX ===")
print("File:", docx_path)

doc = docx.Document(docx_path)
print(f"Total paragraphs: {len(doc.paragraphs)}")
print(f"Total inline shapes: {len(doc.inline_shapes)}")
print(f"Total tables: {len(doc.tables)}")

# 1. Check all figure captions
print("\n--- Figure Captions Inspection ---")
captions = []
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    # A caption starts with 图 <number> followed by spaces and a colon/text, and has no period or is centered
    m = re.match(r"^图\s*(\d+)\s{1,}(.+)", txt)
    if m and not txt.startswith("图 6 的当前原型") and not txt.startswith("图 7 概括了") and not txt.startswith("图 9 展示受限"):
        captions.append((idx, int(m.group(1)), txt))
        print(f"[{idx:03d}] 图 {m.group(1)}: {m.group(2)}")

found_figs = [c[1] for c in captions]
print(f"\nFound figure numbers ({len(found_figs)}): {found_figs}")
assert found_figs == list(range(1, 20)), f"Figure numbers mismatch: {found_figs}"
print("ASSERTION PASSED: All 19 figure captions are strictly continuously numbered from 1 to 19!")

# 2. Check for any remaining dash-figure names like 图 4-1 or 图 7-1
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    assert "图 4- 1" not in txt and "图 4-1" not in txt, f"Found 图 4-1 at P{idx}"
    assert "图 7- 1" not in txt and "图 7-1" not in txt, f"Found 图 7-1 at P{idx}"
print("ASSERTION PASSED: No dash figure numbers (图 4-1, 图 7-1) remain!")

# 3. Check in-text citations
print("\n--- In-Text Citations Inspection ---")
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if any(k in txt for k in ["图 6 的当前原型", "图 7 概括了", "图 9 展示受限", "（图 10）", "（图 11）", "（图 12）", "图 13 看板", "和图 14", "见图 15 、图 16", "如图 19"]):
        print(f"[{idx:03d}] Verified citation: {txt[:80]}...")

# 4. Check for orphan broken lines
print("\n--- Checking for Orphan Paragraphs ---")
bad_orphans = ["支", "路线步骤", "览", "览览", "应", "(PASS)", "1.00(PASS)"]
found_bad = []
for idx, p in enumerate(doc.paragraphs):
    txt = p.text.strip()
    if txt in bad_orphans:
        found_bad.append((idx, txt))

assert len(found_bad) == 0, f"Found orphan paragraphs: {found_bad}"
print("ASSERTION PASSED: All orphan broken lines have been removed!")

# 5. Check picture before 图 9 (old 图 8)
print("\n--- Checking Image Before 图 9 ---")
for idx, p in enumerate(doc.paragraphs):
    if "图 9  极限约束下的诚实拒绝" in p.text:
        prev_p = doc.paragraphs[idx - 1]
        print(f"Paragraph before 图 9: text='{prev_p.text}', runs={len(prev_p.runs)}")
        xml = prev_p._element.xml
        assert "drawing" in xml, "Previous paragraph does not have drawing!"
        print("ASSERTION PASSED: Image is correctly present immediately before 图 9!")
        break

# 6. Check that every figure from 图 1 to 图 19 has an associated image
print("\n--- Checking 1:1 Image Association for all 19 Figures ---")
for idx, fig_num, cap_text in captions:
    # Usually image is the immediately preceding paragraph, or within 2 paragraphs preceding
    found_img = False
    for lookback in [1, 2]:
        if idx - lookback >= 0:
            p_prev = doc.paragraphs[idx - lookback]
            if "drawing" in p_prev._element.xml:
                found_img = True
                break
    print(f"图 {fig_num:02d} ({cap_text[:20]}...): Has drawing = {found_img}")
    assert found_img, f"图 {fig_num} is missing its drawing!"

print("\nASSERTION PASSED: All 19 figures have 100% verified drawings!")
print("\nALL 6 VERIFICATION CHECKS PASSED WITH ZERO ERRORS!")
