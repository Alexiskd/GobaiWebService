# Usage (depuis frontend/) : python tools/gen-crayon-textures.py public/textures/crayon   (numpy + Pillow)
# Générateur du pack « crayon » : vrais traits dessinés (pression, pointes effilées, cire qui saute sur le grain du
# papier), sur un canevas 3×3 replié sur lui-même → tuiles parfaitement raccordables.
import numpy as np, json, os, sys
from PIL import Image
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
N = 256
PALETTE = {  # couleurs relevées sur la planche (médianes des échantillons, les codes écrits étaient inexacts)
  'cobalt': '#1f4288', 'petrole': '#185264', 'foret': '#1a5e4c', 'sauge': '#507149',
  'corail': '#a34542', 'brique': '#803935', 'bordeaux': '#54312e', 'ocre': '#bc870f',
  'marine': '#1c2d5f', 'ardoise': '#193d5a', 'sarcelle': '#215c66', 'canard': '#0d4852',
  'moutarde': '#c39a3a', 'caramel': '#ab795e', 'mauve': '#91626c', 'prune': '#613745',
  'terre': '#613d1d', 'taupe': '#7f6e5a',
}
fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
def norm(a): a = a - a.min(); return a / (a.max() + 1e-9)
def noise(lo, hi, seed):
    r = np.hypot(fx, fy); f = ((r >= lo) & (r <= hi)).astype(float)
    w = np.random.default_rng(seed).standard_normal((N, N))
    return norm(np.real(np.fft.ifft2(np.fft.fft2(w) * f)))
def smooth(e0, e1, x): t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

def strokes(seed, families, count):
    """Couverture [0..1] et teinte relative de `count` traits ; familles = [(angle, poids)]."""
    rng = np.random.default_rng(seed)
    M = 3 * N
    cov = np.zeros((M, M)); tint = np.zeros((M, M)); wsum = np.zeros((M, M)) + 1e-6
    angles = [a for a, _ in families]; weights = np.array([w for _, w in families], float); weights /= weights.sum()
    for _ in range(count):
        ang = np.deg2rad(rng.choice(angles, p=weights) + rng.normal(0, 4))
        L = rng.uniform(50, 190); w = rng.uniform(2.2, 6.5); p = rng.uniform(0.25, 0.75)
        cx, cy = rng.uniform(N, 2 * N, 2)
        dx, dy = np.cos(ang), np.sin(ang)
        h = int(L / 2 + w + 2)
        x0, x1, y0, y1 = int(cx - h), int(cx + h), int(cy - h), int(cy + h)
        ys, xs = np.mgrid[y0:y1, x0:x1].astype(float)
        rx, ry = xs - cx, ys - cy
        along = rx * dx + ry * dy
        across = -rx * dy + ry * dx
        bow = 0.0008 * along ** 2 * rng.choice([-1, 1])          # léger arc du poignet
        prof = smooth(w / 2 + 0.8, w / 2 - 0.8, np.abs(across - bow))
        t = np.abs(along) / (L / 2)
        taper = smooth(1.0, 0.72, t) * (0.75 + 0.25 * np.cos(along / L * 3.1))
        v = p * prof * taper
        sl = (slice(y0, y1), slice(x0, x1))
        cov[sl] = 1 - (1 - cov[sl]) * (1 - v)
        tint[sl] += v * rng.uniform(0.86, 1.16); wsum[sl] += v
    fold = lambda a, op: op([a[i * N:(i + 1) * N, j * N:(j + 1) * N] for i in range(3) for j in range(3)])
    cover = 1 - fold(1 - cov, lambda b: np.prod(b, axis=0))
    tone = fold(tint, lambda b: np.sum(b, axis=0)) / fold(wsum, lambda b: np.sum(b, axis=0))
    tone = np.where(fold(wsum, lambda b: np.sum(b, axis=0)) > 1e-3, tone, 1.0)
    return cover, tone

def hexrgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float) / 255

def tile(hexcol, seed, cross=False, count=240, paper_k=0.62):
    c = hexrgb(hexcol)
    fam = [(-35, 1)] if not cross else [(-35, 0.62), (43, 0.38)]
    cover, tone = strokes(seed, fam, count)
    tooth = norm(0.65 * noise(0.22, 0.5, seed + 1) + 0.35 * noise(0.08, 0.2, seed + 2))  # grain du papier
    blotch = noise(0.0, 0.02, seed + 3)
    # La cire ne prend que sur les reliefs du papier : moins on appuie, plus le grain apparaît.
    wax = smooth(0.12, 0.55, cover * (0.8 + 0.3 * blotch) - (1 - tooth) * 0.55 + 0.25)
    paper = c * paper_k * (0.9 + 0.2 * noise(0.05, 0.3, seed + 4))[..., None]   # papier sombre teinté
    pigment = c[None, None, :] * (0.9 + 0.35 * (tone[..., None] - 1)) * (1.02 + 0.12 * tooth[..., None])
    img = paper * (1 - wax[..., None]) + pigment * wax[..., None]
    img *= c / img.reshape(-1, 3).mean(0)                    # moyenne = couleur de la palette
    return np.clip(img, 0, 1)

def white_layer(seed, strength):
    cover, _ = strokes(seed, [(-35, 1)], 260)
    tooth = noise(0.22, 0.5, seed + 1)
    return np.clip(smooth(0.0, 0.6, cover - (1 - tooth) * 0.5 + 0.2) * strength, 0, 1)

def save(arr, name, alpha=None, q=88):
    a8 = (arr * 255 + 0.5).astype(np.uint8)
    im = Image.fromarray(a8, 'RGB') if alpha is None else Image.fromarray(np.dstack([a8, (alpha * 255 + 0.5).astype(np.uint8)]), 'RGBA')
    im.save(os.path.join(OUT, name), 'WEBP', quality=q, method=6)

if __name__ == '__main__':
    for i, (name, hexcol) in enumerate(PALETTE.items()):
        save(tile(hexcol, 100 + i * 10), f'{name}.webp')
        save(tile(hexcol, 500 + i * 10, cross=True, count=320, paper_k=0.5), f'{name}-ombre.webp')   # hachures croisées
    save(np.ones((N, N, 3)), 'hachures-blanches.webp', alpha=white_layer(901, 0.2))
    g = noise(0.2, 0.5, 902)
    save(np.ones((N, N, 3)), 'grain.webp', alpha=smooth(0.55, 0.95, g) * 0.16)
    json.dump(PALETTE, open(os.path.join(OUT, 'palette.json'), 'w'), indent=2, ensure_ascii=False)
    print('ok', len(os.listdir(OUT)))
