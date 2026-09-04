"""Generate the app icons from the brand mark.

The mark is the same heart used everywhere in the UI — the feather-style path
in components/Icon.tsx — on the header's brand gradient (--orange to
--orange-dark at 135deg). Keeping it generated rather than hand-drawn means the
icons cannot drift from the icon set the pages actually render.

    python3 scripts/generate-icons.py
"""

import math
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
FONTS = ROOT / ".cache" / "fonts"   # gitignored; only the social card needs it

CREAM = (253, 249, 244)
INK = (28, 25, 23)
MUTED = (92, 80, 72)
ORANGE = (255, 108, 29)       # --orange   #FF6C1D
ORANGE_DARK = (224, 86, 15)   # --orange-dark #E0560F
WHITE = (255, 255, 255)

# components/Icon.tsx, PATHS.heart — a 24x24 viewBox.
HEART = (
    "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2"
    "-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"
)
STROKE_UNITS = 2.0  # Icon.tsx default strokeWidth
SS = 4              # supersample factor; PIL has no antialiased drawing


# --- the smallest SVG path reader that covers the heart --------------------

def _tokens(d):
    num, out = "", []
    for ch in d:
        if ch.isdigit() or ch == ".":
            # A second '.' starts a new number: "1.5.5" is 1.5 then .5
            if ch == "." and "." in num:
                out.append(float(num))
                num = "."
            else:
                num += ch
        elif ch == "-":
            if num:
                out.append(float(num))
            num = "-"
        elif ch in " ,":
            if num:
                out.append(float(num))
            num = ""
        else:
            if num:
                out.append(float(num))
            num = ""
            out.append(ch)
    if num:
        out.append(float(num))
    return out


def _cubic(p0, p1, p2, p3, steps=48):
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1],
        )


def _arc(p0, rx, ry, large, sweep, p1, steps=48):
    """Endpoint -> centre parameterisation, per the SVG implementation notes."""
    x0, y0 = p0
    x1, y1 = p1
    dx2, dy2 = (x0 - x1) / 2, (y0 - y1) / 2
    # No rotation on either arc in this path, so phi is 0 throughout.
    lam = dx2 * dx2 / (rx * rx) + dy2 * dy2 / (ry * ry)
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * dy2 * dy2 - ry * ry * dx2 * dx2
    den = rx * rx * dy2 * dy2 + ry * ry * dx2 * dx2
    co = math.sqrt(max(num / den, 0))
    if large == sweep:
        co = -co
    cxp, cyp = co * rx * dy2 / ry, -co * ry * dx2 / rx
    cx, cy = cxp + (x0 + x1) / 2, cyp + (y0 + y1) / 2

    def angle(ux, uy, vx, vy):
        d = (ux * vx + uy * vy) / (math.hypot(ux, uy) * math.hypot(vx, vy))
        a = math.acos(max(-1, min(1, d)))
        return -a if ux * vy - uy * vx < 0 else a

    t0 = angle(1, 0, (dx2 - cxp) / rx, (dy2 - cyp) / ry)
    dt = angle((dx2 - cxp) / rx, (dy2 - cyp) / ry, (-dx2 - cxp) / rx, (-dy2 - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    for i in range(1, steps + 1):
        a = t0 + dt * i / steps
        yield (cx + rx * math.cos(a), cy + ry * math.sin(a))


def path_points(d):
    tk, i = _tokens(d), 0
    pts, cur, start, cmd = [], (0.0, 0.0), (0.0, 0.0), None
    while i < len(tk):
        if isinstance(tk[i], str):
            cmd = tk[i]
            i += 1
        if cmd == "M":
            cur = start = (tk[i], tk[i + 1]); pts.append(cur); i += 2; cmd = "L"
        elif cmd == "c":
            c1 = (cur[0] + tk[i], cur[1] + tk[i + 1])
            c2 = (cur[0] + tk[i + 2], cur[1] + tk[i + 3])
            end = (cur[0] + tk[i + 4], cur[1] + tk[i + 5])
            pts.extend(_cubic(cur, c1, c2, end)); cur = end; i += 6
        elif cmd == "A":
            end = (tk[i + 5], tk[i + 6])
            pts.extend(_arc(cur, tk[i], tk[i + 1], int(tk[i + 3]), int(tk[i + 4]), end))
            cur = end; i += 7
        elif cmd == "l":
            end = (cur[0] + tk[i], cur[1] + tk[i + 1]); pts.append(end); cur = end; i += 2
        elif cmd in ("Z", "z"):
            pts.append(start); cur = start
        else:
            raise ValueError(f"unhandled path command {cmd!r}")
    return pts


# --- drawing ---------------------------------------------------------------

HEART_PTS = path_points(HEART)
HX0, HX1 = min(p[0] for p in HEART_PTS), max(p[0] for p in HEART_PTS)
HY0, HY1 = min(p[1] for p in HEART_PTS), max(p[1] for p in HEART_PTS)


def resample(pts, step):
    """Walk the polyline emitting a point every `step` units of arc length."""
    out, carry = [pts[0]], 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg == 0:
            continue
        t = step - carry
        while t <= seg:
            out.append((x0 + (x1 - x0) * t / seg, y0 + (y1 - y0) * t / seg))
            t += step
        carry = (carry + seg) % step
    return out


def gradient(size):
    """linear-gradient(135deg, #FF6C1D, #E0560F) — top-left to bottom-right."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1)) if size > 1 else 0
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(ORANGE, ORANGE_DARK))
    return img


def mark(size, *, radius_ratio=0.225, heart_ratio=0.56, bleed=False):
    s = size * SS
    img = gradient(s).convert("RGBA")

    if not bleed:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, s - 1, s - 1), radius=round(s * radius_ratio), fill=255
        )
        img.putalpha(mask)

    scale = heart_ratio * s / (HX1 - HX0)
    ox = (s - (HX1 - HX0) * scale) / 2 - HX0 * scale
    oy = (s - (HY1 - HY0) * scale) / 2 - HY0 * scale
    pts = [(p[0] * scale + ox, p[1] * scale + oy) for p in HEART_PTS]

    # Stamp a disc every pixel along the path rather than using ImageDraw's
    # joint="curve": that draws each segment separately and leaves a visible
    # spike at every join once the stroke is this thick.
    r = max(0.5, STROKE_UNITS * scale / 2)
    draw = ImageDraw.Draw(img)
    for x, y in resample(pts, 1.0):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


# --- social card -----------------------------------------------------------

# Noto Sans Thai is what the pages already fall back to, so the card cannot
# drift from whichever heading face the site settles on.
FONT_URLS = {
    "NotoSansThai-Regular.ttf": "https://fonts.gstatic.com/s/notosansthai/v29/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpzE.ttf",
    "NotoSansThai-Bold.ttf": "https://fonts.gstatic.com/s/notosansthai/v29/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU3NqpzE.ttf",
}


def font(name, size):
    FONTS.mkdir(parents=True, exist_ok=True)
    path = FONTS / name
    if not path.exists():
        urllib.request.urlretrieve(FONT_URLS[name], path)
    return ImageFont.truetype(str(path), size)


def og_image():
    """1200x630 — the size Facebook, LINE, X and Slack all crop from."""
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)

    d.rectangle((0, 0, W, 14), fill=ORANGE)
    d.rectangle((0, H - 90, W, H), fill=INK)

    img.paste(mark(132), (80, 96), mark(132))

    bold, reg = font("NotoSansThai-Bold.ttf", 34), font("NotoSansThai-Regular.ttf", 30)
    d.text((240, 120), "ศูนย์ยืม-คืนกายอุปกรณ์", font=bold, fill=INK)
    d.text((240, 172), "การแพทย์", font=bold, fill=INK)

    head = font("NotoSansThai-Bold.ttf", 72)
    d.text((80, 290), "ยืมกายอุปกรณ์การแพทย์", font=head, fill=INK)
    d.text((80, 382), "ฟรี ที่บ้านคุณ", font=head, fill=ORANGE_DARK)

    d.text(
        (80, 476),
        "วีลแชร์ · ไม้ค้ำยัน · เตียงผู้ป่วย · เครื่องผลิตออกซิเจน",
        font=reg,
        fill=MUTED,
    )

    foot = font("NotoSansThai-Bold.ttf", 28)
    d.text((80, H - 65), "ส่งคำขอออนไลน์ ไม่ต้องสมัครสมาชิก", font=foot, fill=CREAM)
    return img


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)

    for name, size, kw in [
        ("favicon-16x16.png", 16, {}),
        ("favicon-32x32.png", 32, {}),
        ("favicon-48x48.png", 48, {}),
        ("favicon-96x96.png", 96, {}),
        ("icon-192.png", 192, {}),
        ("icon-512.png", 512, {}),
        # iOS masks the corners itself, so ship a full square.
        ("apple-touch-icon.png", 180, {"bleed": True}),
        # Maskable icons are cropped to a circle inscribed in the middle 80%.
        ("icon-maskable-512.png", 512, {"bleed": True, "heart_ratio": 0.44}),
    ]:
        p = ASSETS / name
        mark(size, **kw).save(p)
        print(f"  {p.relative_to(ROOT)}")

    # One .ico carrying every size Windows and older browsers ask for.
    ico = ROOT / "app" / "favicon.ico"
    mark(256).save(ico, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f"  {ico.relative_to(ROOT)}")

    try:
        p = ASSETS / "og-image.png"
        og_image().save(p)
        print(f"  {p.relative_to(ROOT)}")
    except OSError as e:
        # The card needs a webfont; the icons do not. Never fail the run for it.
        print(f"  skipped og-image.png (could not fetch the font: {e})")


if __name__ == "__main__":
    main()
