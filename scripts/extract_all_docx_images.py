import os
import zipfile
from PIL import Image

docx_path = os.path.join(os.getcwd(), "竞赛汇报与文档材料包", "upload", "final.docx")

with zipfile.ZipFile(docx_path, "r") as z:
    for i in range(1, 23):
        for ext in [".jpeg", ".png"]:
            name = f"word/media/image{i}{ext}"
            if name in z.namelist():
                out_path = os.path.join(os.getcwd(), "tmp", f"image{i}{ext}")
                os.makedirs(os.path.dirname(out_path), exist_ok=True)
                with open(out_path, "wb") as f:
                    f.write(z.read(name))
                print(f"Extracted {name} -> {out_path}")
