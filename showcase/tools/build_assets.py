"""Builds the optimised showcase assets from the Figma exports in assets/src.

    pip install pillow numpy opencv-python-headless
    python3 showcase/tools/build_assets.py

Backgrounds come from the Figma "Keyboard Interaction" frames 1/2/3
(assets/src/frame-<env>.png: the photo with the monitor screen designed on
it). Figma only exports them at 2048 px, so for the 2x files the screen is
cut out of the frame and composited onto the upscaled photo, with its text
redrawn at 2x in Inter (tools/fonts, OFL) at the frame's exact positions.

Outputs (in showcase/assets):
  bg-<env>.webp      environment photos (2048x1144)
  bg-<env>@2x.webp   4096x2288 versions for high-DPI screens, built from
                     assets/src/bg-<env>@2x.png when present (see upscale.py).
                     When the 2x source exists, the felt texture and JPEG
                     noise on the dark hex wall are smoothed (clean_wall) and
                     the 1x file is downscaled from that cleaned image.
  kb-<env>.webp      keyboard cut-outs with alpha (2x when available)
  hands-mask.png     union of the hand/arm silhouettes of all three photos.
                     The page uses it as a CSS mask over a copy of the
                     background stack, so a board at rest sits *under* the
                     fingertips that overlap its edge.
  mist.png           horizontally tileable soft-noise mist (white + alpha),
                     drifted along the bottom of the frame around the hands.
"""
from pathlib import Path

import numpy as np

import cv2
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

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


def aligned(env, im, scale=1):
    if env not in ALIGN:
        return im
    a, b = ALIGN[env]
    pad = PAD * scale
    arr = np.asarray(im)
    padded = Image.fromarray(np.pad(arr, ((pad, 0), (0, 0), (0, 0)), mode="edge"))
    return padded.transform((W * scale, H * scale), Image.AFFINE, (1, 0, 0, 0, a, b * scale + pad),
                            resample=Image.BICUBIC)


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


def clean_wall(im):
    """Smooth the dark hex panels without touching the lit strips.

    Non-local-means removes the fine grain, then two bilateral passes flatten
    the blotchy felt while keeping edges. The result is blended in only on
    dark pixels of the wall (top of the frame, away from the monitor and PC);
    the lit strips are bright, so they stay untouched. Feathered, no seam.
    """
    bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    smooth = cv2.fastNlMeansDenoisingColored(bgr, None, 12, 12, 7, 35)
    for _ in range(2):
        smooth = cv2.bilateralFilter(smooth, 15, 20, 9)

    h, w = bgr.shape[:2]
    k = w / W  # mask boxes below are in 1x photo px
    value = bgr.max(axis=2).astype(np.float32) / 255
    dark = np.clip((0.46 - value) / 0.12, 0, 1)
    region = np.zeros((h, w), np.float32)
    region[: int(560 * k), :] = 1
    region[int(250 * k): int(640 * k), int(600 * k): int(1420 * k)] = 0  # monitor
    region[: int(900 * k), int(1520 * k):] = 0  # PC case
    m = cv2.GaussianBlur(dark * region, (0, 0), 6 * k)[..., None]
    out = bgr * (1 - m) + smooth * m
    return Image.fromarray(cv2.cvtColor(out.round().astype(np.uint8), cv2.COLOR_BGR2RGB))


# Text boxes in the Figma frames (frame px): (x, y) of "YOUR BOARD" and
# "YOUR VIBE", Inter ExtraBold / Light at 62.595 px.
SCREEN_TEXT = {
    "ember": ((815.0, 380.0), (860.0, 454.757)),
    "frost": ((815.5, 360.5), (860.5, 435.257)),
    "prism": ((815.5, 379.5), (860.5, 454.257)),
}
FONTS = Path(__file__).resolve().parent / "fonts"
TEXT_PX = 62.595


def screen_mask(frame, photo):
    """Where the Figma frame differs from the photo: the designed screen."""
    d = np.abs(np.asarray(frame, np.int16) - np.asarray(photo, np.int16)).max(axis=2)
    m = (d > 6).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    # Fill the interior (dark game pixels can match the black screen).
    flood = m.copy()
    cv2.floodFill(flood, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 255)
    return m | cv2.bitwise_not(flood)


def draw_screen_text(img, env, scale):
    bold = ImageFont.truetype(str(FONTS / "Inter-ExtraBold.ttf"), TEXT_PX * scale)
    light = ImageFont.truetype(str(FONTS / "Inter-Light.ttf"), TEXT_PX * scale)
    draw = ImageDraw.Draw(img)
    (bx, by), (vx, vy) = SCREEN_TEXT[env]
    # Ascender anchor at Figma's text-box origin lands within 1 px of the frame.
    draw.text((bx * scale, by * scale), "YOUR BOARD", font=bold, fill=(255, 255, 255), anchor="la")
    draw.text((vx * scale, vy * scale), "YOUR VIBE", font=light, fill=(255, 255, 255), anchor="la")


def frame_2x(env, big_photo):
    """The Figma frame at 2x: upscaled photo + the frame's screen, rebuilt
    crisply. The panel outline comes from the frame, smoothed and re-edged
    at 2x with a ~1 px anti-aliased edge; it is filled with the frame's own
    panel colour and the text is redrawn in Inter at 2x."""
    frame = Image.open(SRC / f"frame-{env}.png").convert("RGB")
    photo = Image.open(SRC / f"bg-{env}.png").convert("RGB")
    mask = screen_mask(frame, photo)

    # Smooth outline: blur the 1x mask, upscale, then re-sharpen around 0.5.
    soft = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 1.2)
    soft = cv2.resize(soft, big_photo.size, interpolation=cv2.INTER_CUBIC)
    alpha = np.clip((soft - 0.5) * 2.2 + 0.5, 0, 1)

    # Panel colour: the frame's screen away from the text and edges.
    inner = cv2.erode(mask, np.ones((25, 25), np.uint8)) > 0
    (bx, by), _ = SCREEN_TEXT[env]
    inner[int(by) - 20: int(by) + 180, int(bx) - 60: int(bx) + 480] = False
    colour = np.median(np.asarray(frame)[inner], axis=0)

    big = np.asarray(big_photo, np.float32)
    out = big * (1 - alpha[..., None]) + colour[None, None, :] * alpha[..., None]
    out = Image.fromarray(out.round().astype(np.uint8))
    draw_screen_text(out, env, 2)
    return out


def mist(w=1024, h=512, seed=7):
    """Tileable fractal mist: low-pass filtered noise (periodic via FFT)."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt((fx * 2.4) ** 2 + (fy * 0.8) ** 2)  # wide, low-lying banks
    f[0, 0] = 1
    field = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((h, w))) / f ** 1.9))
    field = (field - field.min()) / (field.max() - field.min())
    field = np.clip((field - 0.3) / 0.6, 0, 1) ** 1.2
    ramp = np.linspace(0, 1, h)[:, None] ** 1.6  # denser towards the bottom
    alpha = (field * ramp * 0.6 + ramp ** 3 * 0.2) * 255
    img = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    img.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return img


def main():
    for env in ENVS:
        hi = SRC / f"bg-{env}@2x.png"
        if hi.exists():
            big = aligned(env, frame_2x(env, clean_wall(Image.open(hi).convert("RGB"))), 2)
            big.save(OUT / f"bg-{env}@2x.webp", quality=82, method=6)
            bg = big.resize((W, H), Image.LANCZOS)
        else:
            bg = aligned(env, Image.open(SRC / f"frame-{env}.png").convert("RGB"))
        bg.save(OUT / f"bg-{env}.webp", quality=86, method=6)
        # Keyboards: ship the 2x cut-out when present (drawn ~1400 device px
        # wide on large high-DPI screens), else the original export.
        kb = SRC / f"kb-{env}@2x.png"
        kb = kb if kb.exists() else SRC / f"kb-{env}.png"
        Image.open(kb).convert("RGBA").save(OUT / f"kb-{env}.webp", quality=88, method=6)

    union = Image.new("L", (W, H), 0)
    for env in ENVS:
        union = ImageChops.lighter(union, hand_mask(env))
    # Store as alpha so it works as a CSS luminance *or* alpha mask.
    rgba = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    rgba.putalpha(union)
    rgba.save(OUT / "hands-mask.png", optimize=True)

    mist().save(OUT / "mist.png", optimize=True)


if __name__ == "__main__":
    main()
