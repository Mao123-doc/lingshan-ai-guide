import docx
from docx.shared import Cm, Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
import zipfile

src = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")
dst = os.path.join(os.getcwd(), "tmp", "test_docx_insert_pic.docx")

doc = docx.Document(src)

# Let's find the paragraph with text containing "图 8"
target_p_idx = -1
for idx, p in enumerate(doc.paragraphs):
    if "极限约束下的诚实拒绝与就近降级" in p.text:
        target_p_idx = idx
        print(f"Found caption at paragraph {idx}: {p.text}")
        break

if target_p_idx != -1:
    # Insert a paragraph before target_p_idx
    cap_p = doc.paragraphs[target_p_idx]
    # In python-docx, insert_paragraph_before()
    pic_p = cap_p.insert_paragraph_before()
    pic_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pic_p.paragraph_format.keep_with_next = True
    pic_p.paragraph_format.space_before = Pt(8)
    pic_p.paragraph_format.space_after = Pt(4)
    run = pic_p.add_run()
    img_path = os.path.join(os.getcwd(), "tmp", "image12.jpeg")
    run.add_picture(img_path, width=Cm(12.0))
    print("Inserted picture successfully!")

doc.save(dst)

# Verify saved file
doc2 = docx.Document(dst)
print("Total inline shapes now:", len(doc2.inline_shapes))
with zipfile.ZipFile(dst, "r") as z:
    media = [f for f in z.namelist() if f.startswith("word/media/")]
    print("Total media in saved docx:", len(media))
