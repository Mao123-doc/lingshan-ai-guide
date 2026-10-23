import docx
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")
src = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")
doc = docx.Document(src)

targets = [
    ("核心 AI 能力被封装为可交互的 Web 产品", [("（图 9）", "（图 10）"), ("（图 10）", "（图 11）")]),
    ("知识库管理页支持文件索引状态查看", [("（图 11）", "（图 12）")]),
    ("在同一 50 题集上比较七种检索配置", [("和图 13", "和图 14")]),
    ("完整方案通过 49/50 题", [("见图 14 、图 15", "见图 15 、图 16")]),
    ("当游客只说“ 带老人想看《吉祥颂》”", [("如图 18", "如图 19")]),
]

for p in doc.paragraphs:
    for t_str, rep_pairs in targets:
        if t_str in p.text:
            print(f"Checking paragraph with: {t_str}")
            print(f"  Current text snippet: {p.text[:120]}")
            for old, new in rep_pairs:
                if old in p.text:
                    print(f"  -> Needs replace '{old}' with '{new}'")
                    # Let's inspect where old appears across runs
                else:
                    print(f"  -> Already has or doesn't have '{old}' (has '{new}'? {'YES' if new in p.text else 'NO'})")
