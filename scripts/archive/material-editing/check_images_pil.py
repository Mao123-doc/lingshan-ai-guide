import os
import sys
import zipfile
from PIL import Image
import io

sys.stdout.reconfigure(encoding="utf-8")

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "03_申报文档与技术报告", "Word工作稿", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    for name in sorted(z.namelist()):
        if name.startswith("word/media/"):
            data = z.read(name)
            try:
                img = Image.open(io.BytesIO(data))
                print(f"{name:25s}: format={img.format}, size={img.size}, bytes={len(data)}")
            except Exception as e:
                print(f"{name:25s}: error {e}")
