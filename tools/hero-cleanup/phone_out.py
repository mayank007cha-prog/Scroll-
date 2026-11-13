"""Let the phone's frame dissolve away from its sides between 12.0 s and 13.6 s, leaving the dots (then the ball)
and the percentage on a clean background.

For every frame: (1) the area the phone occupies is refilled smoothly from what surrounds it, (2) the light of the
dots, ball and number is lifted off the phone's glass and laid over that fill, (3) the result replaces the original
through a soft, slightly irregular edge that travels from the left and right sides toward the middle.
The dark matte the footage has around the phone after the dissolve is lifted to the surrounding level as well."""
import cv2, numpy as np, json
from scipy.signal import savgol_filter
from fill_common import membrane_fill
import phone_fix as pf
from phone_fix import BAR, PH, to_local, from_local, sstep, W0, H0, P, CAN, SIL, CONTENT, halo_can, warp_can

F0, F1 = 576, 693
WIPE0, WIPE1 = 576, 664

# ---- one smooth outline track for the whole range
_fa = np.arange(560, 594); _la = savgol_filter(np.array([to_local(f, PH[f]) for f in _fa]).reshape(len(_fa), 8), 15, 2, axis=0)
_fb = np.arange(624, 675); _kb = np.polyfit(_fb, np.array([to_local(f, PH[f]) for f in _fb]).reshape(len(_fb), 8), 2)
def CBq(f): return np.polyval(_kb, f).reshape(4, 2)
def quad(f):
    if f < 594: return from_local(f, _la[f - 560].reshape(4, 2)).astype(np.float32)
    if f <= 627:
        q = pf.quad(f)
        t = float(sstep(620, 627, f)); return (q * (1 - t) + from_local(f, CBq(f)) * t).astype(np.float32)
    g = min(f, 690); return from_local(g, CBq(g)).astype(np.float32)

# ---- canonical-space fields
_yy, _xx = np.mgrid[0:H0 + 2 * P, 0:W0 + 2 * P].astype(np.float32)
_U = (_xx - P) / W0; _V = (_yy - P) / H0
_rng = np.random.default_rng(5)
CONTENT2 = cv2.GaussianBlur(pf.rrect(P + 0.13 * W0, P + 0.115 * H0, P + 0.87 * W0, P + 0.845 * H0, 0.07 * W0), (0, 0), 0.02 * H0)   # dots/ball and number only
CONTENT3 = cv2.GaussianBlur(pf.rrect(P + 0.06 * W0, P + 0.085 * H0, P + 0.94 * W0, P + 0.94 * H0, 0.10 * W0), (0, 0), 0.02 * H0)    # everything inside the rim
_NOISE = cv2.GaussianBlur(cv2.resize(_rng.uniform(-1, 1, (9, 7)).astype(np.float32), (W0 + 2 * P, H0 + 2 * P), interpolation=cv2.INTER_CUBIC), (0, 0), 14)
_D = np.hypot((_U - 0.5) / 1.0, (_V - 0.5) / 2.4) + 0.06 * _NOISE          # distance that makes the left/right sides "far" and top/bottom "near"
def wipe_can(f):
    p = float(np.clip((f - WIPE0) / (WIPE1 - WIPE0), 0, 1)); e = p * p * (3 - 2 * p)
    r = 1.02 + (-0.34 - 1.02) * e; s = 0.30
    return sstep(r - s, r + s, _D).astype(np.float32)
def margin(f): return 0.10 + 0.40 * float(sstep(598, 612, f)) + 0.55 * float(sstep(610, 624, f))   # how far around the phone the refill reaches (in phone widths)
def glow_margin(f): return 0.08 + 0.24 * float(sstep(600, 618, f))            # the phone's own glow, which has to go with it
def halo_lift(f): return float(sstep(604, 612, f))

def fill_region(img, hard, max_unknowns=45000):
    """Seamless refill of `hard`; solved at reduced size when the region is large (the fill is smooth anyway)."""
    n = int(hard.sum())
    if n == 0: return img.copy()
    ys, xs = np.nonzero(hard); pad = 6
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.shape[0]); x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.shape[1])
    sub = img[y0:y1, x0:x1]; m = hard[y0:y1, x0:x1]
    out = img.copy()
    if n <= max_unknowns:
        out[y0:y1, x0:x1] = membrane_fill(sub, m).astype(np.float32); return out
    k = float(np.sqrt(max_unknowns / n))
    sw, sh = max(8, int(round(sub.shape[1] * k))), max(8, int(round(sub.shape[0] * k)))
    small = cv2.resize(sub, (sw, sh), interpolation=cv2.INTER_AREA)
    ms = cv2.resize(m.astype(np.float32), (sw, sh), interpolation=cv2.INTER_AREA) > 0.02
    fs = membrane_fill(small, ms).astype(np.float32)
    up = cv2.resize(fs, (sub.shape[1], sub.shape[0]), interpolation=cv2.INTER_CUBIC)
    mm = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2 / k)[..., None]
    out[y0:y1, x0:x1] = sub * (1 - mm) + up * mm
    return out

def phone_out(img, f):
    if f < F0 or f > F1: return img
    q = quad(f); shape = img.shape; mg = margin(f)
    sil = warp_can(SIL, q, shape)
    region = warp_can(halo_can(mg * W0), q, shape)
    hard = region > 0.5
    if not hard.any(): return img
    fill = fill_region(img, hard)
    hl = halo_lift(f)
    # outside the phone: wherever the footage is darker than the smooth fill (the matte), lift it to the fill; keep anything brighter
    wpx = float(np.linalg.norm(q[1] - q[0]))
    reach = cv2.GaussianBlur(warp_can(halo_can(max(mg - 0.22, 0.02) * W0), q, shape), (0, 0), max(2.0, 0.09 * wpx))[..., None]   # fades out before the refill's own edge
    lifted = img + (np.maximum(img, fill) - img) * (hl * reach)
    out_sil = (1 - sil)[..., None]
    frame = img * (1 - out_sil) + lifted * out_sil
    # light of dots / ball / number, lifted off the glass
    u = float(sstep(668, 682, f))                          # late on the ball outgrows the number's area: widen to everything inside the rim
    con = warp_can(CONTENT2 * (1 - u) + CONTENT3 * u, q, shape)
    core = warp_can(halo_can(glow_margin(f) * W0), q, shape) > 0.5
    bg = fill_region(lifted, core)                         # the phone's area refilled from just beyond its glow
    lum = frame.max(axis=2)
    zone = con > 0.5
    if zone.any():
        base = float(np.median(lum[zone]))
        elem = ((lum > base + 14) & (con > 0.05)).astype(np.uint8)
        elem = cv2.dilate(elem, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) > 0
        glass = fill_region(frame, elem & (sil > 0.5), max_unknowns=30000)
        over = np.clip(frame - np.minimum(glass, bg + 4), 0, None)      # never subtract more than the background level, so the ball keeps its full light
        h = float(sstep(664, 676, f))                                   # the fading phone's glass turns grey at the end: ask for more contrast there
        E = over * (sstep(6 + 18 * h, 24 + 40 * h, over.max(axis=2)) * con)[..., None]   # only what is clearly brighter than the glass: dots, ball, number and their glow
    else: E = 0
    comp = bg + E
    W = warp_can(wipe_can(f), q, shape)[..., None]
    out = frame * (1 - W) + comp * W
    t = float(sstep(686, 693, f))                          # hand back to the untouched footage as the phone's last trace leaves
    return out * (1 - t) + img * t

if __name__ == '__main__':
    import split_fix
    from bar_fill import remove_bar
    from cards import remove_cards
    def base(f):
        o = split_fix.fix(f); return split_fix.load(f) if o is None else o
    def clean(f): return remove_bar(np.clip(remove_cards(base(f), f), 0, 255), f).astype(np.float32)
    pf.prepare(clean)
    print('quad fit residual (px) at 630/650/670:', [float(np.abs(quad(f) - PH[f]).max().round(1)) for f in (630, 650, 670)])
    ts = []
    for f in (578, 586, 594, 602, 610, 618, 626, 634, 642, 650, 660, 672, 680, 688):
        a = split_fix.load(f); o = phone_out(pf.fix_phone(clean(f), f), f)
        v = lambda I: cv2.resize(np.clip(I * 1.6, 0, 255).astype(np.uint8), (426, 240))
        ta, tb = v(a), v(o); cv2.putText(ta, '%d  %.2fs' % (f, f / 48), (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        ts.append(np.vstack([ta, tb]))
    cv2.imwrite('m/wipe_a.png', np.hstack(ts[:7])); cv2.imwrite('m/wipe_b.png', np.hstack(ts[7:]))
