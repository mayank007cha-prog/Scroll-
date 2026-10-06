"""2x super-resolution for the environment photos (Real-ESRGAN x2plus).

The Figma exports are 2048 px wide, which looks soft on high-DPI screens
where the scene is drawn ~2900 device px wide. This writes
assets/src/bg-<env>@2x.png (4096x2288) and kb-<env>@2x.png (keyboard
cut-outs; colour through the model, alpha via Lanczos) for build_assets.py.

    pip install torch pillow numpy
    curl -LO https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth
    python3 showcase/tools/upscale.py RealESRGAN_x2plus.pth

The network definition below follows RRDBNet from BasicSR (Apache-2.0),
inlined so the only dependency is torch. Weights: Real-ESRGAN (BSD-3-Clause).
"""
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch import nn
from torch.nn import functional as F

SRC = Path(__file__).resolve().parent.parent / "assets" / "src"
ENVS = ["ember", "frost", "prism"]


class ResidualDenseBlock(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1 = ResidualDenseBlock(nf, gc)
        self.rdb2 = ResidualDenseBlock(nf, gc)
        self.rdb3 = ResidualDenseBlock(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    """x2 variant: input is pixel-unshuffled by 2, then upsampled 4x."""

    def __init__(self, nf=64, nb=23, gc=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3 * 4, nf, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(F.pixel_unshuffle(x, 2))
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


@torch.no_grad()
def upscale(model, img, tile=256, pad=16):
    """Tiled inference so memory stays flat; tiles overlap by `pad`."""
    x = torch.from_numpy(np.asarray(img, dtype=np.float32) / 255).permute(2, 0, 1)[None]
    _, _, h, w = x.shape
    out = torch.zeros(1, 3, h * 2, w * 2)
    for y0 in range(0, h, tile):
        for x0 in range(0, w, tile):
            y1, x1 = min(y0 + tile, h), min(x0 + tile, w)
            py0, px0 = max(y0 - pad, 0), max(x0 - pad, 0)
            py1, px1 = min(y1 + pad, h), min(x1 + pad, w)
            res = model(x[:, :, py0:py1, px0:px1])
            oy, ox = (y0 - py0) * 2, (x0 - px0) * 2
            out[:, :, y0 * 2:y1 * 2, x0 * 2:x1 * 2] = res[:, :, oy:oy + (y1 - y0) * 2, ox:ox + (x1 - x0) * 2]
        print(f"  row {y0 // tile + 1}/{(h + tile - 1) // tile}", flush=True)
    arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255).round().astype(np.uint8)
    return Image.fromarray(arr)


def main(weights):
    model = RRDBNet()
    state = torch.load(weights, map_location="cpu")
    model.load_state_dict(state.get("params_ema", state.get("params", state)))
    model.eval()
    for env in ENVS:
        print(env, flush=True)
        img = Image.open(SRC / f"bg-{env}.png").convert("RGB")
        upscale(model, img).save(SRC / f"bg-{env}@2x.png")

        kb = Image.open(SRC / f"kb-{env}.png").convert("RGBA")
        big = upscale(model, kb.convert("RGB"))
        big.putalpha(kb.getchannel("A").resize(big.size, Image.LANCZOS))
        big.save(SRC / f"kb-{env}@2x.png")


if __name__ == "__main__":
    main(sys.argv[1])
