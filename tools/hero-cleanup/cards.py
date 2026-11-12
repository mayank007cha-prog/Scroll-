"""Hide the two glass cards that linger left and right of the phone while the laptop scene dissolves.
Each card is replaced by a seamless fill of what surrounds it, and the laptop's edge that runs behind
the card is redrawn through the patch so the screen outline stays whole."""
import cv2, numpy as np
from bar_common import load
from fill_common import membrane_fill, grain_like

def sstep(a, b, v):
    u = np.clip((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)
def strength(f): return float(sstep(588, 598, f) * (1 - sstep(613, 618, f)))
F0, F1 = 588, 617

# top-left corner and width of each card per frame (measured from the footage), other corners follow the card's shape
L_TL = {580: (439, 160), 584: (416, 152), 588: (389, 144), 592: (359, 135), 594: (344, 128), 596: (327, 123), 598: (310, 117), 600: (291, 112),
        602: (282, 111), 604: (274, 108), 606: (267, 106), 608: (260, 103), 610: (254, 101), 612: (246, 99), 618: (232, 96)}
L_W = {580: 150, 584: 157, 588: 168, 592: 177, 594: 183, 596: 190, 598: 195, 600: 204, 604: 208, 608: 216, 612: 222, 618: 230}
R_TL = {580: (1063, 244), 584: (1069, 238), 588: (1077, 230), 592: (1083, 224), 594: (1088, 220), 596: (1094, 215), 598: (1102, 209), 600: (1105, 205),
        602: (1112, 200), 604: (1112, 197), 606: (1115, 194), 608: (1120, 191), 610: (1126, 188), 612: (1132, 186), 618: (1146, 181)}
R_W = {580: 151, 584: 160, 588: 170, 592: 179, 594: 185, 596: 192, 598: 197, 600: 206, 604: 210, 608: 218, 612: 224, 618: 232}
def tab(t, f):
    ks = sorted(t); v = np.array([t[k] for k in ks], float)
    return np.array([np.interp(f, ks, v[:, j]) for j in range(v.shape[1])]) if v.ndim > 1 else float(np.interp(f, ks, v))
def quad(side, f):
    if side == 'L':
        tl = tab(L_TL, f); w = tab(L_W, f); tr = tl + (w, 0.035 * w); bl = tl + (-0.072 * w, 0.72 * w); br = tr + (-0.048 * w, 0.755 * w)
    else:
        tl = tab(R_TL, f); w = tab(R_W, f); tr = tl + (w, 0.034 * w); bl = tl + (-0.062 * w, 0.637 * w); br = bl + (0.995 * w, 0.078 * w)
    return np.array([tl, tr, br, bl], np.float32)

def poly_mask(shape, q, grow, ss=4):
    H, W = shape[:2]; big = np.zeros((H * ss, W * ss), np.uint8)
    cv2.fillConvexPoly(big, np.round(q * ss).astype(np.int32), 255)
    if grow > 0:
        k = int(round(grow * ss)) * 2 + 1; big = cv2.dilate(big, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    return cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255

def ridge_x(g, y, xg, half=14):
    """x of the bright laptop edge on row y near xg, with its contrast against the row."""
    y = int(np.clip(y, 2, g.shape[0] - 3)); x0 = int(max(xg - half, 0)); x1 = int(min(xg + half + 1, g.shape[1]))
    row = g[y - 1:y + 2, x0:x1].mean(axis=0); row = cv2.GaussianBlur(row[None, :], (0, 0), 1.0)[0]
    k = int(row.argmax()); return x0 + k, float(row[k] - np.median(row))

EDGE_GUESS = {'L': {584: 492}, 'R': {584: 1128}}   # where the laptop edge crosses just above each card at the start
_edge_cache = {}
def edge_line(side, f, g, hard):
    """Two points of the laptop edge: just above and just below the card patch."""
    q = quad(side, f)
    # march from the starting guess, frame by frame, so the search window follows the push-in
    if (side, f) not in _edge_cache:
        if f <= 584: _edge_cache[(side, f)] = EDGE_GUESS[side][584]
        else:
            prev = edge_top_x(side, f - 1)
            shift = quad(side, f)[0][0] - quad(side, f - 1)[0][0]
            _edge_cache[(side, f)] = prev + shift * (1.0 if side == 'L' else 1.0)
    xg = _edge_cache[(side, f)]
    col = int(np.clip(round(xg), 0, hard.shape[1] - 1))
    ys = np.nonzero(hard[:, col])[0]
    if len(ys) == 0: return None
    ya, yb = ys.min() - 3, ys.max() + 3
    xa, ca = ridge_x(g, ya, xg, 10)
    slope = -0.15 if side == 'L' else -0.105
    xb, cb = ridge_x(g, yb, xa + slope * (yb - ya), 9)
    _edge_cache[(side, f)] = xa
    return (xa, ya, ca), (xb, yb, cb)
def edge_top_x(side, f):
    if (side, f) in _edge_cache and f <= 584: return _edge_cache[(side, f)]
    g = load(f).astype(np.float32).mean(axis=2)
    hard = poly_mask(g.shape, quad(side, f), 12.0) > 0.02
    r = edge_line(side, f, g, hard)
    return _edge_cache[(side, f)]

def remove_cards(img, f, debug=None):
    if f < F0 or f > F1: return img.astype(np.float32)
    s = strength(f)
    out = img.astype(np.float32).copy()
    if s <= 0: return out
    g = img.astype(np.float32).mean(axis=2)
    for side in ('L', 'R'):
        q = quad(side, f)
        hard = poly_mask(img.shape, q, 12.0) > 0.02
        soft = cv2.GaussianBlur(poly_mask(img.shape, q, 8.0), (0, 0), 2.6)
        soft = np.where(hard, soft, 0)
        ys, xs = np.nonzero(hard); pad = 16
        y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.shape[0]); x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.shape[1])
        sub = out[y0:y1, x0:x1].copy(); m = hard[y0:y1, x0:x1]
        line = np.zeros_like(sub)
        pts = edge_line(side, f, g, hard)
        if pts and pts[0][2] > 4 and pts[1][2] > 4:
            (xa, ya, ca), (xb, yb, cb) = pts
            D = 8
            def profile(y, xc):
                xi = int(round(xc)); r = out[int(y) - 1:int(y) + 2, xi - D:xi + D + 1].mean(axis=0)
                base = np.linspace(0, 1, 2 * D + 1)[:, None] * (r[-1] - r[0]) + r[0]
                return np.maximum(r - base, 0)
            pa, pb = profile(ya, xa), profile(yb, xb)
            for y in range(max(ya - 10, y0), min(yb + 11, y1)):
                t = np.clip((y - ya) / max(yb - ya, 1), 0, 1)
                if y < ya or y > yb:
                    xc, c = ridge_x(g, y, xa + (xb - xa) * (y - ya) / max(yb - ya, 1), 4); p = profile(y, xc)
                else:
                    xc = xa + (xb - xa) * t; p = pa * (1 - t) + pb * t
                xi = int(np.floor(xc)); fr = xc - xi
                for k in range(-D, D + 1):
                    for xx, wgt in ((xi + k, 1 - fr), (xi + k + 1, fr)):
                        if x0 <= xx < x1: line[y - y0, xx - x0] += p[k + D] * wgt
            if debug is not None: debug.append((side, f, xa, ya, round(ca, 1), xb, yb, round(cb, 1)))
        elif debug is not None: debug.append((side, f, 'no edge', pts))
        fill = membrane_fill(sub - line, m).astype(np.float32) + line
        ring = cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & ~m
        fill += grain_like(sub, ring, m.shape, seed=f * 7 + (1 if side == 'L' else 2)) * m[..., None]
        a = (soft[y0:y1, x0:x1] * s)[..., None]
        out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - a) + fill * a
    return out

if __name__ == '__main__':
    dbg = []; rows = []
    for f in (590, 594, 598, 602, 606, 610, 614):
        im = load(f); res = np.clip(remove_cards(im, f, dbg), 0, 255).astype(np.uint8)
        def view(I):
            v = np.clip(I.astype(np.float32) * 2.2, 0, 255).astype(np.uint8)
            return np.hstack([v[40:350, 170:600], v[110:420, 980:1280]])
        a, b = view(im), view(res)
        cv2.putText(a, 'f%d before' % f, (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        rows.append(np.hstack([a, b]))
    for d in dbg: print(d)
    cv2.imwrite('m/cards_fix_a.png', np.vstack(rows[:4])); cv2.imwrite('m/cards_fix_b.png', np.vstack(rows[4:]))
