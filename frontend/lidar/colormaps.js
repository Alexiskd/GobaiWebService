// Palettes : dégradés d'altitude et classes ASPRS / IGN LiDAR HD. Aucune dépendance.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Turbo (Google) : approximation polynomiale officielle. */
function turbo(x) {
  x = clamp01(x);
  const v = [1, x, x * x, x * x * x];
  const w = [v[2] * v[2], v[3] * v[2]];
  const dot4 = (k) => v[0] * k[0] + v[1] * k[1] + v[2] * k[2] + v[3] * k[3];
  const r = dot4([0.13572138, 4.6153926, -42.66032258, 132.13108234]) + w[0] * -152.94239396 + w[1] * 59.28637943;
  const g = dot4([0.09140261, 2.19418839, 4.84296658, -14.18503333]) + w[0] * 4.27729857 + w[1] * 2.82956604;
  const b = dot4([0.1066733, 12.64194608, -60.58204836, 110.36276771]) + w[0] * -89.90310912 + w[1] * 27.34824973;
  return [clamp01(r) * 255, clamp01(g) * 255, clamp01(b) * 255];
}

const stops = (list) => (x) => {
  x = clamp01(x);
  for (let i = 1; i < list.length; i++) {
    const [p1, c1] = list[i];
    const [p0, c0] = list[i - 1];
    if (x <= p1) {
      const t = (x - p0) / (p1 - p0 || 1);
      return c0.map((c, k) => c + (c1[k] - c) * t);
    }
  }
  return list[list.length - 1][1];
};

export const GRADIENTS = {
  turbo: { label: 'Turbo', fn: turbo },
  viridis: {
    label: 'Viridis',
    fn: stops([[0, hex('#440154')], [0.25, hex('#3b528b')], [0.5, hex('#21918c')], [0.75, hex('#5ec962')], [1, hex('#fde725')]]),
  },
  terrain: {
    label: 'Relief',
    fn: stops([[0, hex('#1d4877')], [0.12, hex('#1b8a5a')], [0.35, hex('#8bc34a')], [0.55, hex('#fbdf72')], [0.75, hex('#b5651d')], [0.9, hex('#8d6e63')], [1, hex('#ffffff')]]),
  },
  grey: { label: 'Gris', fn: (x) => [clamp01(x) * 255, clamp01(x) * 255, clamp01(x) * 255] },
};

/** Table de 256 couleurs RGBA pour une texture 256 × 1. */
export function gradientLut(name = 'turbo') {
  const fn = (GRADIENTS[name] || GRADIENTS.turbo).fn;
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = fn(i / 255);
    lut[i * 4] = Math.round(r); lut[i * 4 + 1] = Math.round(g); lut[i * 4 + 2] = Math.round(b); lut[i * 4 + 3] = 255;
  }
  return lut;
}

/** Classes ASPRS (LAS 1.4) et classes propres au LiDAR HD de l'IGN (64 à 67). */
export const CLASSES = {
  0: { name: 'Jamais classé', color: '#9e9e9e' },
  1: { name: 'Non classé', color: '#cfd8dc' },
  2: { name: 'Sol', color: '#b07a45' },
  3: { name: 'Végétation basse', color: '#a5d66f' },
  4: { name: 'Végétation moyenne', color: '#55b04f' },
  5: { name: 'Végétation haute', color: '#1e7d3c' },
  6: { name: 'Bâtiment', color: '#e8573f' },
  7: { name: 'Bruit bas', color: '#ff3df5' },
  8: { name: 'Point clé', color: '#ffd54f' },
  9: { name: 'Eau', color: '#3b8fe6' },
  10: { name: 'Rail', color: '#8d6e63' },
  11: { name: 'Route', color: '#707070' },
  12: { name: 'Recouvrement', color: '#fff176' },
  13: { name: 'Câble de garde', color: '#eeeeee' },
  14: { name: 'Câble conducteur', color: '#ffee00' },
  15: { name: 'Pylône', color: '#ff9800' },
  16: { name: 'Connecteur', color: '#ffca28' },
  17: { name: 'Pont', color: '#9575cd' },
  18: { name: 'Bruit haut', color: '#ff3df5' },
  64: { name: 'Sursol pérenne', color: '#26c6da' },
  65: { name: 'Artefact', color: '#ff5252' },
  66: { name: 'Point virtuel', color: '#b0bec5' },
  67: { name: 'Divers bâti', color: '#f48fb1' },
};

/** Couleur stable pour une classe sans définition. */
function fallbackColor(c) {
  const h = (c * 137.508) % 360;
  const s = 0.55, l = 0.6;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export const classInfo = (c) => {
  const known = CLASSES[c];
  if (known) return { name: known.name, color: known.color };
  const [r, g, b] = fallbackColor(c);
  return { name: `Classe ${c}`, color: `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` };
};

/** Palette 256 × 1 : RGB = couleur de la classe, A = 255 si visible, 0 si masquée. */
export function classLut(visible) {
  const lut = new Uint8Array(256 * 4);
  for (let c = 0; c < 256; c++) {
    const [r, g, b] = hex(classInfo(c).color);
    lut[c * 4] = r; lut[c * 4 + 1] = g; lut[c * 4 + 2] = b;
    lut[c * 4 + 3] = !visible || visible[c] ? 255 : 0;
  }
  return lut;
}

export const COLOR_MODES = [
  { id: 'rgb', label: 'Couleurs' },
  { id: 'elevation', label: 'Altitude' },
  { id: 'intensity', label: 'Intensité' },
  { id: 'classification', label: 'Classes' },
  { id: 'returns', label: 'Retours' },
];
