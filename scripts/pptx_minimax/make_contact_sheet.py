from __future__ import annotations

import sys
from pathlib import Path

VENDOR = Path(__file__).with_name("vendor")
sys.path.insert(0, str(VENDOR))

from PIL import Image, ImageDraw, ImageFont  # type: ignore  # noqa: E402


def slide_number(path: Path) -> int:
    digits = "".join(ch for ch in path.stem if ch.isdigit())
    return int(digits)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: make_contact_sheet.py <render_dir> <output.png>")
    render_dir = Path(sys.argv[1])
    output = Path(sys.argv[2])
    files = sorted(render_dir.glob("Slide*.PNG"), key=slide_number)
    if not files:
        files = sorted(render_dir.glob("幻灯片*.PNG"), key=slide_number)
    if len(files) != 14:
        raise SystemExit(f"expected 14 rendered slides, found {len(files)}")

    thumb_w, thumb_h = 480, 270
    label_h, gap, cols, rows = 24, 16, 4, 4
    canvas = Image.new("RGB", (cols * thumb_w + (cols + 1) * gap, rows * (thumb_h + label_h) + (rows + 1) * gap), "#0F172A")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for i, file in enumerate(files):
        img = Image.open(file).convert("RGB")
        img.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col, row = i % cols, i // cols
        x = gap + col * (thumb_w + gap)
        y = gap + row * (thumb_h + label_h + gap)
        canvas.paste(img, (x, y + label_h))
        draw.text((x, y + 4), f"P{i + 1:02d}", fill="#D4AF37", font=font)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output)
    print(output)


if __name__ == "__main__":
    main()
