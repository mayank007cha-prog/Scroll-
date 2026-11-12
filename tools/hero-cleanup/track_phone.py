"""Track the phone's outline on every frame: fit a straight line to each of its four sides from the bright rim,
intersect them to get four corners. Start on a frame where the phone stands alone, then walk backward and forward."""
import cv2, numpy as np, json
def load(f): return cv2.imread('src/%04d.png' % f)
def lum(f): return cv2.GaussianBlur(load(f).astype(np.float32).max(axis=2), (0, 0), 1.0)

def line_fit(pts, wts):
    c = (pts * wts[:, None]).sum(0) / wts.sum()
    u, s, vt = np.linalg.svd((pts - c) * np.sqrt(wts)[:, None], full_matrices=False)
    return c, vt[0]
def intersect(l1, l2):
    (c1, d1), (c2, d2) = l1, l2
    A = np.array([d1, -d2]).T; t = np.linalg.solve(A, c2 - c1); return c1 + d1 * t[0]

def refine(g, quad, search):
    """quad: 4 corners TL,TR,BR,BL. Returns refined corners and the mean rim contrast."""
    lines = []; contrast = []
    cen = quad.mean(0)
    for i in range(4):
        a, b = quad[i], quad[(i + 1) % 4]
        d = (b - a) / np.linalg.norm(b - a); n = np.array([d[1], -d[0]])
        if np.dot(n, (a + b) / 2 - cen) < 0: n = -n                     # outward normal
        ts = np.linspace(0.20, 0.80, 28); offs = np.arange(-search, search + 0.01, 0.5)
        P = a[None, :] + ts[:, None] * (b - a)[None, :]
        X = P[:, None, 0] + offs[None, :] * n[0]; Y = P[:, None, 1] + offs[None, :] * n[1]
        prof = cv2.remap(g, X.astype(np.float32), Y.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        k = prof.argmax(axis=1); pk = prof[np.arange(len(ts)), k]; base = np.median(prof, axis=1)
        w = np.maximum(pk - base, 0) + 1e-3
        pts = P + offs[k][:, None] * n[None, :]
        c, dd = line_fit(pts, w)
        r = np.abs((pts - c) @ np.array([dd[1], -dd[0]]))            # drop outliers once
        keep = r < max(1.5, np.percentile(r, 75) * 1.5)
        if keep.sum() >= 6: c, dd = line_fit(pts[keep], w[keep])
        lines.append((c, dd)); contrast.append(float(np.median(pk - base)))
    q = np.array([intersect(lines[3], lines[0]), intersect(lines[0], lines[1]), intersect(lines[1], lines[2]), intersect(lines[2], lines[3])])
    return q, float(np.mean(contrast))

# start: phone alone at f640
g = lum(640)
m = (g > 120).astype(np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
x, y, w, h = st[big, :4]
quad = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], np.float64)
for _ in range(4): quad, c = refine(g, quad, 14)
print('f640 corners', quad.round(1).tolist(), 'contrast', round(c, 1))
out = {640: (quad, c)}
for rng in (range(639, 559, -1), range(641, 688)):
    q = quad.copy(); prev = None
    for f in rng:
        g = lum(f)
        pred = q if prev is None else q + (q - prev) * 0.9
        prev = q.copy()
        size = np.linalg.norm(q[1] - q[0])
        q2 = pred.copy()
        for _ in range(3): q2, c = refine(g, q2, max(5.0, 0.035 * size))
        if not np.isfinite(q2).all() or np.abs(q2 - pred).max() > 0.12 * size: q2 = pred; c = -1
        q = q2; out[f] = (q.copy(), c)
json.dump({str(k): [v[0].tolist(), v[1]] for k, v in sorted(out.items())}, open('phone_raw.json', 'w'))
for f in sorted(out)[::6]:
    q, c = out[f]; print(f, q.round(0).astype(int).tolist(), 'w=%.0f' % np.linalg.norm(q[1] - q[0]), 'contrast %.0f' % c)
