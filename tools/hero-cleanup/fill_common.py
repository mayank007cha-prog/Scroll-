import cv2, numpy as np
from scipy import sparse
from scipy.sparse.linalg import spsolve

def membrane_fill(img, mask):
    """Replace pixels where mask is True by the harmonic (soap-film) interpolation of the surrounding pixels.
    The result meets the untouched pixels with no step, so the patch has no visible edge."""
    H, W = mask.shape
    ys, xs = np.nonzero(mask)
    if len(ys) == 0: return img.copy()
    idx = -np.ones((H, W), np.int64); idx[ys, xs] = np.arange(len(ys))
    n = len(ys); rows, cols, vals = [], [], []
    diag = np.zeros(n); b = np.zeros((n, img.shape[2]), np.float64)
    f = img.astype(np.float64)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        yy, xx = ys + dy, xs + dx
        inside = (yy >= 0) & (yy < H) & (xx >= 0) & (xx < W)
        k = np.nonzero(inside)[0]
        j = idx[yy[k], xx[k]]
        unk = j >= 0
        diag[k] += 1
        rows.append(k[unk]); cols.append(j[unk]); vals.append(-np.ones(unk.sum()))
        kb = k[~unk]; b[kb] += f[yy[kb], xx[kb]]
    A = sparse.csc_matrix((np.concatenate(vals + [diag]), (np.concatenate(rows + [np.arange(n)]), np.concatenate(cols + [np.arange(n)]))), shape=(n, n))
    sol = spsolve(A, b)
    out = f.copy(); out[ys, xs] = sol.reshape(n, -1)
    return out

def grain_like(img, ring, shape, seed):
    """Noise with the same strength as the film grain measured in the ring of untouched pixels."""
    f = img.astype(np.float32)
    hp = f - cv2.GaussianBlur(f, (0, 0), 1.6)
    v = hp[ring]
    if v.size < 30: return np.zeros(shape + (3,), np.float32)
    sig = np.minimum(np.median(np.abs(v), axis=0) * 1.4826, 2.0) * 0.55
    rng = np.random.default_rng(seed)
    nz = rng.standard_normal(shape + (1,)).astype(np.float32) * np.ones(3, np.float32)   # luma-like grain
    nz = cv2.GaussianBlur(nz, (0, 0), 0.7)
    nz /= max(nz.std(), 1e-6)
    return nz * sig
