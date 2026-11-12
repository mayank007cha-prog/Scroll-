import cv2, numpy as np, json
from bar_common import load, pill_mask
from fill_common import membrane_fill, grain_like
BAR = {int(k): np.array(v) for k, v in json.load(open('bar_ref.json')).items()}

def bar_strength(f):
    return 1.0

def remove_bar(img, f):
    """img: BGR uint8/float frame f. Returns float32 frame with the loading bar painted out."""
    if f not in BAR: return img.astype(np.float32)
    p = BAR[f]; h = p[3]
    margin = 0.20 * h + 1.6
    soft = pill_mask(img.shape, p, margin)                 # anti-aliased edge of the patch
    hard = pill_mask(img.shape, p, margin + 0.8) > 0.02    # region that is re-synthesised (slightly larger)
    if not hard.any(): return img.astype(np.float32)
    ys, xs = np.nonzero(hard); pad = 6
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, img.shape[0]); x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, img.shape[1])
    sub = img[y0:y1, x0:x1]; m = hard[y0:y1, x0:x1]
    fill = membrane_fill(sub, m).astype(np.float32)
    ring = cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool) & ~m
    fill += grain_like(sub, ring, m.shape, seed=f) * m[..., None]
    out = img.astype(np.float32).copy()
    a = soft[y0:y1, x0:x1][..., None]
    out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - a) + fill * a
    return out

if __name__ == '__main__':
    tiles = []
    for f in (476, 490, 510, 540, 580, 600, 620, 650, 672, 682):
        im = load(f); out = np.clip(remove_bar(im, f), 0, 255).astype(np.uint8)
        cx, cy, w, h, a = BAR[f]; half = int(max(w * 1.0, 60))
        x0 = int(np.clip(cx - half, 0, 1280 - 2 * half)); y0 = int(np.clip(cy - half * 0.75, 0, 720 - half))
        def cr(I):
            c = I[y0:y0 + half, x0:x0 + 2 * half]; c = cv2.resize(c, (480, 240), interpolation=cv2.INTER_CUBIC); return c
        a_, b_ = cr(im), cr(out)
        cv2.putText(a_, 'f%d' % f, (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        tiles.append(np.vstack([a_, b_]))
    cv2.imwrite('m/barfill.png', np.vstack([np.hstack(tiles[:5]), np.hstack(tiles[5:])]))
