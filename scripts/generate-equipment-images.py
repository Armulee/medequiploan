"""Build the equipment cut-outs the landing carousel shows.

Each source is a product shot on transparency at wildly different proportions
— crutches are tall, a hospital bed is wide. Cropping each to its own alpha
bounding box and then fitting that into a square frame is what makes them look
like one set rather than five unrelated photographs.

    python3 scripts/generate-equipment-images.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "source" / "equipment"
OUT = ROOT / "public" / "assets" / "equipment"

WIDTHS = (440, 880)
FILL = 0.94  # how much of the frame the longest side takes

# Alpha survives all three. PNG is only the last-resort <img> fallback for
# browsers with no WebP at all, so it is built at the small width only — the
# retina PNGs were 1.8MB of the repository for a case that barely exists.
FORMATS = [
    ("avif", {"format": "AVIF", "quality": 60}),
    ("webp", {"format": "WEBP", "quality": 82, "method": 6}),
    ("png", {"format": "PNG", "optimize": True}),
]
PNG_WIDTH = 440


def square(im, size):
    """Trim the transparent margin, then centre it in a square frame."""
    im = im.crop(im.getchannel("A").getbbox())
    scale = size * FILL / max(im.size)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    frame.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return frame


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for src in sorted(SOURCE.glob("*.webp")):
        base = Image.open(src).convert("RGBA")
        for w in WIDTHS:
            im = square(base, w)
            for ext, opts in FORMATS:
                if ext == "png" and w != PNG_WIDTH:
                    continue
                p = OUT / f"{src.stem}-{w}.{ext}"
                im.save(p, **opts)
                kb = p.stat().st_size / 1024
                total += kb
                print(f"  {p.relative_to(ROOT)}  {kb:.0f}KB")
    print(f"  — {total/1024:.2f}MB total")


if __name__ == "__main__":
    main()
