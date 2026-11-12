"""Tighten the left end of the tracked bar: find where the bright fill really starts along the bar's axis."""
import cv2, numpy as np, json
from bar_common import *
T = bar_track()
res = {}
for f, p in T.items():
    cx, cy, w, h, ang = p
    g = load(f).astype(np.float32).max(axis=2)
    a = np.deg2rad(ang); ux = np.array([np.cos(a), np.sin(a)]); uy = np.array([-np.sin(a), np.cos(a)])
    s = np.arange(-w * 0.75, w * 0.75, 0.5); t = np.linspace(-h * 0.22, h * 0.22, 7)
    X = cx + s[:, None] * ux[0] + t[None, :] * uy[0]; Y = cy + s[:, None] * ux[1] + t[None, :] * uy[1]
    prof = cv2.remap(g, X.astype(np.float32), Y.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).mean(axis=1)
    lo = np.percentile(prof, 15); hi = prof[(s > -w / 2) & (s < -w / 2 + max(h, 6))].max()
    left = -w / 2
    if hi - lo > 25:
        cand = np.nonzero((prof > lo + 0.5 * (hi - lo)) & (s > -w * 0.7) & (s < -w * 0.2))[0]
        if len(cand): left = s[cand[0]] - 0.75
    left = max(min(left, -w / 2 + 0.35 * w), -w / 2 - 2)          # never widen much, never eat more than a third
    right = w / 2
    res[f] = [cx + ux[0] * (left + right) / 2, cy + ux[1] * (left + right) / 2, right - left, h, ang]
fs = sorted(res); P = np.array([res[f] for f in fs])
from scipy.signal import savgol_filter
for j in range(5): P[:, j] = savgol_filter(P[:, j], 9, 2)
json.dump({str(f): list(map(float, P[i])) for i, f in enumerate(fs)}, open('bar_ref.json', 'w'))
T0 = T
print('width change, early frames:', [(f, round(T0[f][2], 1), round(P[fs.index(f)][2], 1)) for f in (474, 480, 488, 498, 520, 560, 620, 670)])
