"""Rebuild the phone through the dissolve (12.4 s to 13.0 s) so there is one clean phone on every frame.
In the footage two slightly different phones are cross-faded there, which shows as a doubled rim and a dark
matte around it. Here the rim and the border of the phone are re-drawn from two clean frames, both warped onto
one outline that changes shape smoothly; the live content (dots, percentage) is kept from each frame; and the
area just around the phone is refilled from its surroundings so no matte shows."""
import cv2, numpy as np, json
from fill_common import membrane_fill
BAR = {int(k): np.array(v) for k, v in json.load(open('bar_ref.json')).items()}
PH = {int(k): np.array(v[0]) for k, v in json.load(open('phone_raw.json')).items()}
def sstep(a, b, v):
    u = np.clip((v - a) / (b - a), 0, 1); return u * u * (3 - 2 * u)

def to_local(f, q):
    cx, cy, w, h, a = BAR[f]; a = np.deg2rad(a); R = np.array([[np.cos(a), np.sin(a)], [-np.sin(a), np.cos(a)]])
    return ((q - [cx, cy]) @ R.T) / w
def from_local(f, l):
    cx, cy, w, h, a = BAR[f]; a = np.deg2rad(a); R = np.array([[np.cos(a), np.sin(a)], [-np.sin(a), np.cos(a)]])
    return (l * w) @ R + [cx, cy]

# phone shape (relative to its own content) before and after the dissolve
CA = np.mean([to_local(f, PH[f]) for f in range(580, 593)], axis=0)
_fb = np.arange(624, 651); _lb = np.array([to_local(f, PH[f]) for f in _fb])
_kb = np.polyfit(_fb, _lb.reshape(len(_fb), 8), 1)
def CB(f): return (_kb[0] * f + _kb[1]).reshape(4, 2)
F_IN, F_OUT = 594, 627
REF_A, REF_B = 590, 628
def morph(f): return float(sstep(596, 622, f))
def quad(f): k = morph(f); return from_local(f, CA * (1 - k) + CB(f) * k).astype(np.float32)
def master(f): return float(sstep(594, 600, f) * (1 - sstep(622, 627, f)))
def bg_strength(f): return float(sstep(602, 609, f) * (1 - sstep(621, 627, f)))

# canonical phone space
W0, H0, P = 300, 540, 170
CAN = np.array([[P, P], [P + W0, P], [P + W0, P + H0], [P, P + H0]], np.float32)
def rrect(x0, y0, x1, y1, r):
    m = np.zeros((H0 + 2 * P, W0 + 2 * P), np.uint8)
    cv2.rectangle(m, (int(x0 + r), int(y0)), (int(x1 - r), int(y1)), 255, -1); cv2.rectangle(m, (int(x0), int(y0 + r)), (int(x1), int(y1 - r)), 255, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x1 - r, y1 - r), (x0 + r, y1 - r)): cv2.circle(m, (int(cx), int(cy)), int(r), 255, -1)
    return m.astype(np.float32) / 255
E = 0.03 * W0
SIL = cv2.GaussianBlur(rrect(P - E, P - E, P + W0 + E, P + H0 + E, 0.17 * W0), (0, 0), 1.6)
CONTENT = cv2.GaussianBlur(rrect(P + 0.14 * W0, P + 0.115 * H0, P + 0.86 * W0, P + 0.90 * H0, 0.07 * W0), (0, 0), 0.02 * H0)
def halo_can(d): return rrect(P - d, P - d, P + W0 + d, P + H0 + d, 0.17 * W0 + d)

def warp_can(m, q, shape, interp=cv2.INTER_LINEAR):
    return cv2.warpPerspective(m, cv2.getPerspectiveTransform(CAN, q.astype(np.float32)), (shape[1], shape[0]), flags=interp)

_ref = {}
def prepare(clean):
    """clean(f) -> frame f with bar and cards already removed (float32)."""
    for name, f in (('A', REF_A), ('B', REF_B)):
        img = clean(f); q = PH[f].astype(np.float32)
        _ref[name] = (img, q)
    img, q = _ref['B']
    hard = warp_can(halo_can(0.42 * W0), q, img.shape) > 0.5
    bg = membrane_fill(img, hard).astype(np.float32)
    sil = warp_can(SIL, q, img.shape)
    _ref['glow'] = np.clip(img - bg, 0, None) * (1 - sil)[..., None]

def fix_phone(img, f):
    if f < F_IN or f > F_OUT: return img
    S = master(f)
    if S <= 0: return img
    k = morph(f); g = bg_strength(f); q = quad(f); shape = img.shape
    sil = warp_can(SIL, q, shape)[..., None]; con = warp_can(CONTENT, q, shape)[..., None]
    comp = img.copy()
    if g > 0:
        hard = warp_can(halo_can(0.50 * W0), q, shape) > 0.5
        ys, xs = np.nonzero(hard); pad = 4
        y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, shape[0]); x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, shape[1])
        fill = membrane_fill(img[y0:y1, x0:x1], hard[y0:y1, x0:x1]).astype(np.float32)
        soft = cv2.GaussianBlur(warp_can(halo_can(0.43 * W0), q, shape), (0, 0), 6.0)[y0:y1, x0:x1, None] * g
        comp[y0:y1, x0:x1] = comp[y0:y1, x0:x1] * (1 - soft) + fill * soft
        HB = cv2.getPerspectiveTransform(_ref['B'][1], q)
        comp += cv2.warpPerspective(_ref['glow'], HB, (shape[1], shape[0])) * (k * g)
    WA = cv2.warpPerspective(_ref['A'][0], cv2.getPerspectiveTransform(_ref['A'][1], q), (shape[1], shape[0]), flags=cv2.INTER_CUBIC)
    WB = cv2.warpPerspective(_ref['B'][0], cv2.getPerspectiveTransform(_ref['B'][1], q), (shape[1], shape[0]), flags=cv2.INTER_CUBIC)
    band = WA * (1 - k) + WB * k
    comp = comp * (1 - sil) + band * sil
    comp = comp * (1 - con) + img * con
    return img * (1 - S) + comp * S
