"""Monitor wallpaper: dark circuit board with red traces, drawn as SVG so it
stays crisp at any size (recreated from a low-res reference image).

    python3 showcase/tools/make_wallpaper.py   ->  showcase/assets/screen-circuit.svg
"""
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "screen-circuit.svg"
W, H = 760, 330
rng = random.Random(4)


def trace(x0, y0, length, kinks):
    """45-degree trace going up-right, with short vertical/horizontal jogs."""
    pts = [(x0, y0)]
    x, y = x0, y0
    seg = length / (kinks + 1)
    for _ in range(kinks):
        x, y = x + seg, y - seg
        pts.append((x, y))
        jog = rng.choice([("v", -rng.randint(14, 40)), ("h", rng.randint(14, 46))])
        if jog[0] == "v":
            y += jog[1]
        else:
            x += jog[1]
        pts.append((x, y))
    x, y = x + seg, y - seg
    pts.append((x, y))
    return pts


paths, dots = [], []
for i in range(26):
    core = abs(i - 12) < 6           # bright bundle in the middle
    x0 = 300 + i * 17 + rng.randint(-6, 6)
    y0 = H + 20 - (i % 3) * 6
    pts = trace(x0, y0, rng.randint(240, 420), rng.choice([1, 2, 2, 3]))
    op = rng.uniform(0.75, 1.0) if core else rng.uniform(0.22, 0.45)
    w = 1.6 if core else 1.1
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    paths.append((d, op, w))
    if rng.random() < 0.55:
        x, y = pts[-1]
        dots.append((x, y, op))
    # small branch stubs ending in a pad
    if rng.random() < 0.4:
        x, y = pts[1]
        dots.append((x + 10, y - 10, op * 0.8))
        paths.append((f"M{x:.1f} {y:.1f} L{x + 10:.1f} {y - 10:.1f}", op * 0.8, w * 0.8))

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">',
       '<defs><radialGradient id="v" cx="35%" cy="40%" r="80%"><stop offset="0" stop-color="#0d1018"/>'
       '<stop offset="1" stop-color="#05060a"/></radialGradient>'
       '<filter id="g" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>',
       f'<rect width="{W}" height="{H}" fill="url(#v)"/>',
       '<g fill="none" stroke="#ff3b1f" stroke-linecap="round" stroke-linejoin="round">']
glow = "".join(f'<path d="{d}" stroke-opacity="{op * 0.5:.2f}" stroke-width="{w * 2.6:.1f}"/>' for d, op, w in paths if op > 0.6)
svg.append(f'<g filter="url(#g)">{glow}</g>')
svg += [f'<path d="{d}" stroke-opacity="{op:.2f}" stroke-width="{w}"/>' for d, op, w in paths]
svg.append('</g><g fill="#ff3b1f">')
svg += [f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.4" fill-opacity="{op:.2f}"/>' for x, y, op in dots]
svg.append("</g></svg>")
OUT.write_text("".join(svg))
print(OUT, OUT.stat().st_size, "bytes")
