import cv2, numpy as np, json
from scipy.signal import savgol_filter
def load(f): return cv2.imread('src/%04d.png' % f)

def bar_track(first=472, last=690):
    raw = json.load(open('bar_raw.json'))
    fs = np.array(sorted(int(k) for k, v in raw.items() if v[0] is not None and int(k) <= 683))
    P = np.array([raw[str(f)][0] for f in fs], np.float64)          # cx, cy, w, h, ang
    P[:, 2:4] = np.log(P[:, 2:4])
    allf = np.arange(first, last + 1)
    out = np.zeros((len(allf), 5))
    for j in range(5):
        y = np.interp(np.arange(fs[0], fs[-1] + 1), fs, P[:, j])
        y = savgol_filter(y, 11, 2)
        # extend before the first / after the last tracked frame along the local trend
        k0 = np.polyfit(np.arange(14), y[:14], 1); k1 = np.polyfit(np.arange(10), y[-10:], 1)
        for i, f in enumerate(allf):
            if f < fs[0]: out[i, j] = np.polyval(k0, f - fs[0])
            elif f > fs[-1]: out[i, j] = np.polyval(k1, f - fs[-1] + 9)
            else: out[i, j] = y[f - fs[0]]
    out[:, 2:4] = np.exp(out[:, 2:4])
    return {int(f): out[i] for i, f in enumerate(allf)}

def pill_mask(shape, p, margin, ss=4):
    """Anti-aliased mask (0..1) of a rounded bar: rotated rect (w,h) grown by margin, ends fully round."""
    cx, cy, w, h, ang = p
    H, W = shape[:2]; big = np.zeros((H * ss, W * ss), np.uint8)
    hw, hh = (w / 2 + margin) * ss, (h / 2 + margin) * ss
    a = np.deg2rad(ang); ux = np.array([np.cos(a), np.sin(a)]); uy = np.array([-np.sin(a), np.cos(a)])
    c = np.array([cx + 0.5, cy + 0.5]) * ss
    rad = hh
    e1, e2 = c - ux * (hw - rad), c + ux * (hw - rad)
    box = np.array([e1 - uy * hh, e2 - uy * hh, e2 + uy * hh, e1 + uy * hh])
    cv2.fillConvexPoly(big, np.round(box).astype(np.int32), 255)
    cv2.circle(big, tuple(np.round(e1).astype(int)), int(round(rad)), 255, -1)
    cv2.circle(big, tuple(np.round(e2).astype(int)), int(round(rad)), 255, -1)
    return cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
