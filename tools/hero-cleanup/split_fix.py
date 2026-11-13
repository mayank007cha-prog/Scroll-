"""Smooth the moment the ball lands and becomes four dots (2.7 s to 3.4 s), and one two-frame stutter at 5.06 s.

The footage switches between differently lit renders in a single frame at f133 and over three frames at f153-155.
Here each switch is turned into a longer cross-fade, with the balls of both renders moved onto the same positions
first so nothing doubles."""
import cv2, numpy as np
def load(f): return cv2.imread('src/%04d.png' % f).astype(np.float32)
def sstep(a, b, v):
    u = np.clip((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)

# ---- four dots: centres per frame (measured), used to move a frame's dots onto another frame's positions
def centres(f):
    g = load(f).max(axis=2); m = cv2.morphologyEx((g > 165).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    c = sorted([tuple(cen[i]) for i in range(1, n) if st[i, 4] > 2500], key=lambda p: p[0])
    return np.array(c) if len(c) == 4 else None
_C = {f: centres(f) for f in range(148, 166)}
_fs = np.array(sorted(f for f, c in _C.items() if c is not None))
_arr = np.array([_C[f] for f in _fs])                                   # (frames, 4, 2)
def pos(f):
    out = np.zeros((4, 2))
    for i in range(4):
        for j in range(2):
            y = _arr[:, i, j]; k = np.polyfit(_fs, y, 3); out[i, j] = np.polyval(k, f)   # smooth path through all frames
    return out

def move_dots(img, src_pos, dst_pos, radius=74):
    """Shift each dot (with its reflection) from src_pos to dst_pos; the dark gaps between dots absorb the difference."""
    H, W = img.shape[:2]
    xs = np.arange(W, dtype=np.float32)
    knots_x, knots_dx, knots_dy = [-1e4], [0.0], [0.0]
    for i in range(4):
        gap_l = (dst_pos[i, 0] - dst_pos[i - 1, 0]) / 2 - 2 if i > 0 else radius
        gap_r = (dst_pos[i + 1, 0] - dst_pos[i, 0]) / 2 - 2 if i < 3 else radius
        d = dst_pos[i] - src_pos[i]
        knots_x += [dst_pos[i, 0] - min(radius, gap_l), dst_pos[i, 0] + min(radius, gap_r)]
        knots_dx += [d[0], d[0]]; knots_dy += [d[1], d[1]]
    knots_x[1] = max(knots_x[1], 0); 
    kx = [knots_x[1] - 160] + knots_x[1:] + [knots_x[-1] + 160]; kdx = [0.0] + knots_dx[1:] + [0.0]; kdy = [0.0] + knots_dy[1:] + [0.0]
    dx = np.interp(xs, kx, kdx).astype(np.float32); dy = np.interp(xs, kx, kdy).astype(np.float32)
    mapx = np.tile(xs - dx, (H, 1)); mapy = np.arange(H, dtype=np.float32)[:, None] - dy[None, :]
    return cv2.remap(img, mapx, mapy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

LOOK0, LOOK1 = 148, 161            # cross-fade of the two dot renders now runs over these frames
def look_fix(f):
    k = float(sstep(LOOK0 - 0.5, LOOK1 + 0.5, f)); p = pos(f)
    A = load(f) if f <= 152 else move_dots(load(152), pos(152), p)
    B = load(f) if f >= 156 else move_dots(load(156), pos(156), p)
    return A * (1 - k) + B * k

# ---- landing: the single ball (f<=132) to the bright splitting blob (f>=133)
W_A = {131: 183, 132: 186}; W_B = {133: 203, 134: 223, 135: 243}
K_LAND = {131: 0.14, 132: 0.38, 133: 0.64, 134: 0.86}
def hstretch(img, s, cx=640.0):
    H, W = img.shape[:2]; xs = np.arange(W, dtype=np.float32)
    # stretch only around the ball; fall back to identity away from it
    src = cx + (xs - cx) / s; t = np.clip((np.abs(xs - cx) - 170) / 120, 0, 1); src = src * (1 - t) + xs * t
    return cv2.remap(img, np.tile(src.astype(np.float32), (H, 1)), np.tile(np.arange(H, dtype=np.float32)[:, None], (1, W)), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
def land_fix(f):
    k = K_LAND[f]
    if f <= 132: A = load(f); B = hstretch(load(133), W_A[f] / W_B[133])
    else: A = hstretch(load(132), W_B[f] / W_A[132]); B = load(f)
    return A * (1 - k) + B * k

# ---- stutter at f243-244: re-space the frames around it so the motion advances evenly
H0, H1 = 237, 251
_d = np.load('diff.npy')                      # _d[i] = change from frame i to i+1
def _flow_mid(a, b, t):
    """Frame between a and b at fraction t, following the motion from a to b."""
    ga = cv2.cvtColor(np.clip(a, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY); gb = cv2.cvtColor(np.clip(b, 0, 255).astype(np.uint8), cv2.COLOR_BGR2GRAY)
    fl = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 4, 21, 3, 5, 1.1, 0)
    bl = cv2.calcOpticalFlowFarneback(gb, ga, None, 0.5, 4, 21, 3, 5, 1.1, 0)
    H, W = ga.shape; gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    wa = cv2.remap(a, gx + bl[..., 0] * t * -1 * -1 * 0 + (-fl[..., 0]) * t, gy + (-fl[..., 1]) * t, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    wb = cv2.remap(b, gx + (-bl[..., 0]) * (1 - t), gy + (-bl[..., 1]) * (1 - t), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    return wa * (1 - t) + wb * t
def hold_src(f):
    """Source position (fractional frame) to show at output frame f inside the re-spaced window."""
    steps = _d[H0:H1]                               # changes H0->H0+1 ... H1-1->H1
    cum = np.concatenate([[0], np.cumsum(steps)])
    target = (f - H0) / (H1 - H0) * cum[-1]
    return H0 + float(np.interp(target, cum, np.arange(len(cum))))
def hold_fix(f):
    s = hold_src(f); i = int(np.floor(s)); t = s - i
    if t < 0.03: return load(i)
    if t > 0.97: return load(i + 1)
    return _flow_mid(load(i), load(i + 1), t)

GLITCH = 667
def fix(f):
    """Returns the corrected frame f, or None when the frame needs no change here."""
    if f == GLITCH: return _flow_mid(load(GLITCH - 1), load(GLITCH + 1), 0.5)   # one broken frame in the footage: rebuilt from its neighbours
    if f in K_LAND: return land_fix(f)
    if LOOK0 <= f <= LOOK1: return look_fix(f)
    if H0 < f < H1: return hold_fix(f)
    return None

if __name__ == '__main__':
    print('re-spaced source positions:', ' '.join('%d>%.2f' % (f, hold_src(f)) for f in range(H0, H1 + 1)))
    rows = []
    for fr in ([129, 130, 131, 132, 133, 134, 135, 136], [146, 148, 150, 152, 154, 156, 158, 160]):
        top, bot = [], []
        for f in fr:
            o = fix(f); a = load(f); o = a if o is None else o
            v = lambda I: cv2.resize(np.clip(I[330:720, 260:1020] * 1.2, 0, 255).astype(np.uint8), (380, 195))
            ta, tb = v(a), v(o); cv2.putText(ta, str(f), (4, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            top.append(ta); bot.append(tb)
        rows += [np.hstack(top), np.hstack(bot)]
    cv2.imwrite('m/splitfix.png', np.vstack(rows))
    # change between neighbouring frames, before and after
    def chg(seq): return [float(np.abs(cv2.resize(seq[i + 1], (320, 180)).mean(axis=2) - cv2.resize(seq[i], (320, 180)).mean(axis=2)).mean()) for i in range(len(seq) - 1)]
    for a, b in ((126, 140), (144, 165), (236, 252)):
        before = [load(f) for f in range(a, b)]; after = [(fix(f) if fix(f) is not None else load(f)) for f in range(a, b)]
        print('frames %d-%d change before:' % (a, b), ' '.join('%.1f' % x for x in chg(before)))
        print('                    after: ', ' '.join('%.1f' % x for x in chg(after)))
