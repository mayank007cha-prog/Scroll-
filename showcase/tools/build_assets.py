"""Builds the optimised showcase assets from the Figma exports in assets/src.

    pip install pillow numpy
    python3 showcase/tools/build_assets.py

Outputs (in showcase/assets):
  bg-<env>.webp      environment photos (2048x1144)
  kb-<env>.webp      keyboard cut-outs with alpha
  hands-mask.png     union of the hand/arm silhouettes of all three photos.
                     The page uses it as a CSS mask over a copy of the
                     background stack, so keyboards slide *under* the hands.
"""
from pathlib import Path

import numpy as np

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "src"
OUT = ROOT / "assets"
ENVS = ["ember", "frost", "prism"]
W, H = 2048, 1144

# Hand + forearm outlines, traced in source-image pixels (2048x1144),
# before alignment.
HANDS = {
    "ember": [
        [(190, 1144), (200, 1130), (250, 1080), (300, 1040), (350, 1010), (400, 980), (450, 965),
         (470, 925), (495, 895), (520, 880), (550, 865), (590, 856), (625, 858), (645, 870),
         (652, 890), (654, 912), (645, 935), (632, 952), (605, 968), (560, 995), (535, 1010),
         (520, 1030), (510, 1070), (500, 1110), (495, 1144)],
        [(1570, 1144), (1560, 1110), (1540, 1070), (1520, 1040), (1507, 1010), (1505, 990),
         (1480, 975), (1450, 945), (1432, 925), (1425, 905), (1417, 880), (1425, 862), (1437, 850),
         (1465, 835), (1520, 830), (1560, 855), (1590, 885), (1615, 945), (1680, 990), (1740, 1005),
         (1780, 1040), (1840, 1080), (1900, 1120), (1920, 1144)],
    ],
    "frost": [
        [(150, 1144), (180, 1130), (225, 1080), (300, 1020), (350, 980), (390, 955), (430, 935),
         (450, 920), (475, 885), (500, 860), (530, 840), (550, 834), (585, 829), (615, 840),
         (640, 870), (652, 892), (647, 908), (615, 940), (580, 970), (535, 990), (530, 1020),
         (510, 1060), (480, 1110), (470, 1144)],
        [(1570, 1144), (1550, 1080), (1530, 1040), (1510, 1000), (1505, 970), (1490, 960),
         (1460, 945), (1435, 920), (1420, 890), (1416, 857), (1432, 830), (1450, 810), (1500, 804),
         (1550, 835), (1585, 870), (1605, 915), (1620, 922), (1660, 950), (1700, 970), (1750, 990),
         (1790, 1030), (1850, 1070), (1920, 1130), (1935, 1144)],
    ],
    "prism": [
        [(180, 1144), (225, 1110), (275, 1070), (325, 1030), (375, 995), (425, 965), (450, 952),
         (470, 925), (490, 895), (510, 875), (535, 860), (590, 847), (630, 860), (660, 895),
         (666, 920), (645, 940), (600, 980), (550, 1010), (527, 1020), (525, 1060), (510, 1110),
         (500, 1144)],
        [(1570, 1144), (1560, 1110), (1530, 1050), (1510, 1010), (1505, 990), (1470, 975),
         (1440, 945), (1425, 910), (1417, 885), (1432, 860), (1445, 845), (1470, 835), (1515, 832),
         (1560, 857), (1590, 890), (1607, 945), (1625, 947), (1680, 970), (1740, 1005),
         (1790, 1040), (1850, 1080), (1910, 1130), (1920, 1144)],
    ],
}

SS = 4  # supersampling for smooth polygon edges

# The frost photo was shot a touch higher than the other two. Map it onto the
# ember/prism framing (measured by edge correlation): y_src = A * y + B.
# Without this the cross-fade between environments shows a double image.
ALIGN = {"frost": (0.9851, -11.6)}
PAD = 24


def aligned(env, im):
    if env not in ALIGN:
        return im
    a, b = ALIGN[env]
    arr = np.asarray(im)
    padded = Image.fromarray(np.pad(arr, ((PAD, 0), (0, 0), (0, 0)), mode="edge"))
    return padded.transform((W, H), Image.AFFINE, (1, 0, 0, 0, a, b + PAD), resample=Image.BICUBIC)


def to_aligned(env, pt):
    x, y = pt
    if env not in ALIGN:
        return pt
    a, b = ALIGN[env]
    return x, (y - b) / a


def hand_mask(env):
    big = Image.new("L", (W * SS, H * SS), 0)
    draw = ImageDraw.Draw(big)
    for poly in HANDS[env]:
        pts = [to_aligned(env, pt) for pt in poly]
        draw.polygon([(x * SS, y * SS) for x, y in pts], fill=255)
    return big.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.6))


def main():
    for env in ENVS:
        bg = aligned(env, Image.open(SRC / f"bg-{env}.png").convert("RGB"))
        bg.save(OUT / f"bg-{env}.webp", quality=84, method=6)
        Image.open(SRC / f"kb-{env}.png").convert("RGBA").save(OUT / f"kb-{env}.webp", quality=90, method=6)

    union = Image.new("L", (W, H), 0)
    for env in ENVS:
        union = ImageChops.lighter(union, hand_mask(env))
    # Store as alpha so it works as a CSS luminance *or* alpha mask.
    rgba = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    rgba.putalpha(union)
    rgba.save(OUT / "hands-mask.png", optimize=True)


if __name__ == "__main__":
    main()
