import docx
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
src = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(src)

targets = [
    "图 8 展示受限预算下的拒绝案例",
    "核心 AI 能力被封装为可交互的 Web 产品",
    "前端交互：React 实现问答页",
    "特别说明：图 12 看板",
    "在同一 50 题集上比较七种检索配置",
    "见图 14 、图 15",
    "而非直接猜测规划，如图 18"
]

for idx, p in enumerate(doc.paragraphs):
    for t in targets:
        if t in p.text:
            print(f"=== Target '{t}' at P{idx} ===")
            for r_idx, r in enumerate(p.runs):
                if any(k in r.text for k in ["图", "8", "9", "10", "11", "12", "13", "14", "15", "18"]):
                    print(f"  R{r_idx}: {repr(r.text)}")
