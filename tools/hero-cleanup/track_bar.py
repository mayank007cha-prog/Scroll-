"""Track the loading bar frame by frame (backward and forward from a clean frame).
Writes bar_raw.json: per frame a rotated rect (cx, cy, w, h, angle) or null."""
import cv2, numpy as np, json
def load(f): return cv2.imread('src/%04d.png' % f)
def lum(im): return im.astype(np.float32).max(axis=2)

def detect(f, pred):
    """pred = ((cx,cy),(w,h),ang). Returns rotated rect fitted to bright pixels gated by pred."""
    (cx, cy), (w, h), ang = pred
    im = load(f); g = lum(im)
    gate = np.zeros(g.shape, np.uint8)
    box = cv2.boxPoints(((cx, cy), (w * 1.14 + 6, h * 1.5 + 5), ang)).astype(np.int32)
    cv2.fillConvexPoly(gate, box, 255)
    core = np.zeros(g.shape, np.uint8)
    cv2.fillConvexPoly(core, cv2.boxPoints(((cx, cy), (w * 0.9, h * 0.55), ang)).astype(np.int32), 255)
    x0, y0, bw, bh = cv2.boundingRect(box); x0 = max(x0 - 4, 0); y0 = max(y0 - 4, 0)
    win = g[y0:y0 + bh + 8, x0:x0 + bw + 8]; gw = gate[y0:y0 + bh + 8, x0:x0 + bw + 8]
    vals = win[gw > 0]
    if vals.size < 20: return None, 0
    bg, pk = np.percentile(vals, 25), np.percentile(vals, 99.5)
    if pk - bg < 10: return None, pk - bg
    m = ((win > bg + 0.30 * (pk - bg)) & (gw > 0)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    cw = core[y0:y0 + bh + 8, x0:x0 + bw + 8]
    keep = np.zeros_like(m)
    for i in range(1, n):
        if (cw[lab == i] > 0).any(): keep[lab == i] = 1
    pts = cv2.findNonZero(keep)
    if pts is None or len(pts) < 8: return None, pk - bg
    pts = (pts.reshape(-1, 2) + np.array([x0, y0])).astype(np.float32)
    (rx, ry), (rw, rh), ra = cv2.minAreaRect(pts)
    if rw < rh: rw, rh, ra = rh, rw, ra + 90
    while ra - ang > 90: ra -= 180
    while ra - ang < -90: ra += 180
    return ((rx, ry), (rw, rh), ra), pk - bg

START = 620
init = ((674.0, 484.5), (176.0, 43.0), 2.0)     # rough bar position at f620, refined below
r, c = detect(START, init); r, c = detect(START, r)
print('start', r, c)
out = {START: (r, c)}
for direction, rng in ((-1, range(START - 1, 465, -1)), (1, range(START + 1, 692))):
    pred = r; miss = 0
    for f in rng:
        d, c = detect(f, pred)
        if d is None:
            miss += 1; out[f] = (None, c)
            if miss > 6: break
            continue
        (px, py), (pw, ph), pa = pred; (dx, dy), (dw, dh), da = d
        ok = abs(dw / pw - 1) < 0.10 and abs(dh / ph - 1) < 0.16 and abs(dx - px) < 6 + 0.05 * pw and abs(dy - py) < 5 + 0.2 * ph and abs(da - pa) < 6
        out[f] = (d if ok else None, c)
        if ok: pred = d; miss = 0
        else:
            miss += 1
            if miss > 10: break
json.dump({str(k): ([v[0][0][0], v[0][0][1], v[0][1][0], v[0][1][1], v[0][2]] if v[0] else None, float(v[1])) for k, v in sorted(out.items())}, open('bar_raw.json', 'w'))
ks = sorted(out)
print('frames', ks[0], ks[-1], 'valid', sum(1 for k in ks if out[k][0]), 'of', len(ks))
for k in ks[::6]:
    v = out[k]
    print(k, 'None' if v[0] is None else 'c=(%.1f,%.1f) w=%.1f h=%.1f a=%.1f' % (v[0][0][0], v[0][0][1], v[0][1][0], v[0][1][1], v[0][2]), 'contrast %.0f' % v[1])
