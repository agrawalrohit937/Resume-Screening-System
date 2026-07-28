"""
Coordinate calibration helper.

Run this against your real Canva-exported background to see a grid of
(x_frac, y_frac) labels overlaid on it. Read off the fractions under
wherever text/logos/QR need to sit, then paste them into layout.json.

Usage:
    python calibrate_layout.py path/to/background.png

Produces: path/to/background.calibration.png
"""
import sys

from PIL import Image, ImageDraw


def calibrate(image_path: str, step: float = 0.05):
    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size

    x = 0.0
    while x <= 1.0:
        px = int(x * w)
        draw.line([(px, 0), (px, h)], fill=(255, 0, 0), width=1)
        x += step

    y = 0.0
    while y <= 1.0:
        # y_frac in layout.json is measured from the BOTTOM (ReportLab
        # convention), so label accordingly even though PIL draws from top.
        py = int((1 - y) * h)
        draw.line([(0, py), (w, py)], fill=(255, 0, 0), width=1)
        draw.text((4, py + 2), f"y={y:.2f}", fill=(255, 0, 0))
        x = 0.0
        while x <= 1.0:
            px = int(x * w)
            if abs(x % 0.2) < 1e-6:
                draw.text((px + 2, py - 12), f"x={x:.2f}", fill=(0, 0, 255))
            x += step
        y += step

    out_path = image_path.rsplit(".", 1)[0] + ".calibration.png"
    img.save(out_path)
    print(f"Saved grid overlay to {out_path}")
    print("Note: y values are measured from the BOTTOM of the page (ReportLab convention).")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python calibrate_layout.py path/to/background.png")
        sys.exit(1)
    calibrate(sys.argv[1])
