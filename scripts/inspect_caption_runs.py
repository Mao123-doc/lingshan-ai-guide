import docx
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
src = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(src)

captions = [
    "图 4- 1", "图 7- 1", "图 8  极限约束", "图 9  问答页", "图 10  语音交互",
    "图 11  知识库", "图 12  运营数据", "图 13  七组检索", "图 14  边缘案例一",
    "图 15  边缘案例二", "图 16  原型路线", "图 17  原型需求", "图 18  信息不足"
]

for p in doc.paragraphs:
    for c in captions:
        if c in p.text:
            print(f"=== Found '{c}' (len={len(p.text)}) ===")
            print(f"  Alignment: {p.alignment}")
            print(f"  Runs count: {len(p.runs)}")
            for idx, r in enumerate(p.runs):
                print(f"    R{idx}: font={r.font.name}, sz={r.font.size}, b={r.bold}, text={repr(r.text)}")
