"""Build the responsive hero images from the two source photographs.

The landing page needs two different CROPS, not two sizes of one crop: a
landscape frame where the equipment sits right of the headline, and a portrait
frame where it sits below it. That is art direction, which <picture media>
does and srcset alone cannot — so each crop gets its own ladder of widths in
each format.

    python3 scripts/generate-hero-images.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "source"
OUT = ROOT / "public" / "assets" / "hero"

# (source, output stem, widths). Widths stop at the source's own resolution —
# upscaling only adds bytes.
CROPS = [
    ("hero-wide.jpg", "wide", (768, 1152, 1672)),
    ("hero-tall.jpg", "tall", (480, 720, 941)),
]

# AVIF carries this kind of soft, warm photograph at roughly half of WebP.
FORMATS = [
    ("avif", {"format": "AVIF", "quality": 55}),
    ("webp", {"format": "WEBP", "quality": 74, "method": 6}),
    ("jpg", {"format": "JPEG", "quality": 80, "optimize": True, "progressive": True}),
]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for src, stem, widths in CROPS:
        base = Image.open(SOURCE / src).convert("RGB")
        for w in widths:
            if w > base.width:
                continue
            im = base.resize((w, round(base.height * w / base.width)), Image.LANCZOS)
            for ext, opts in FORMATS:
                p = OUT / f"{stem}-{w}.{ext}"
                im.save(p, **opts)
                kb = p.stat().st_size / 1024
                total += kb
                print(f"  {p.relative_to(ROOT)}  {im.width}x{im.height}  {kb:.0f}KB")
    print(f"  — {total/1024:.1f}MB total")


if __name__ == "__main__":
    main()
