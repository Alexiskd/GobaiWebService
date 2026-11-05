// Maths Web Mercator (schéma XYZ), sans dépendance. Même convention que le backend (`tile-math.ts`) :
// x croît vers l'Est depuis -180°, y croît vers le Sud depuis ~85,05° N.
export const MAX_LATITUDE = 85.0511287798066;
const RAD = Math.PI / 180;

/** Latitude (°) de la ligne de grille `row` sur `n` lignes (row peut être fractionnaire). */
export const rowToLat = (row, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
/** Longitude (°) de la colonne de grille `col` sur `n` colonnes. */
export const colToLon = (col, n) => (col / n) * 360 - 180;

/** Emprise d'une tuile en degrés. */
export function tileBounds(z, x, y) {
  const n = 2 ** z;
  return { west: colToLon(x, n), east: colToLon(x + 1, n), north: rowToLat(y, n), south: rowToLat(y + 1, n) };
}

/** Point de la sphère unité pour (lon°, lat°) — repère de la Terre du moteur : (cos la cos lo, sin la, -cos la sin lo). */
export function lonLatToXYZ(lon, lat, r = 1) {
  const lo = lon * RAD, la = lat * RAD;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

/** Inverse de `lonLatToXYZ` : [lon°, lat°] d'un vecteur (pas forcément unitaire). */
export function xyzToLonLat([x, y, z]) {
  const len = Math.hypot(x, y, z) || 1;
  return [Math.atan2(-z, x) / RAD, Math.asin(Math.max(-1, Math.min(1, y / len))) / RAD];
}

export const tileKey = (z, x, y) => `${z}/${x}/${y}`;
export const parentOf = ({ z, x, y }) => (z === 0 ? null : { z: z - 1, x: x >> 1, y: y >> 1 });
export const childrenOf = ({ z, x, y }) => [
  { z: z + 1, x: x * 2, y: y * 2 }, { z: z + 1, x: x * 2 + 1, y: y * 2 },
  { z: z + 1, x: x * 2, y: y * 2 + 1 }, { z: z + 1, x: x * 2 + 1, y: y * 2 + 1 },
];

/** Remplace {z} {x} {y} dans un modèle d'URL (n'importe quel ordre). */
export const fillTemplate = (template, { z, x, y }) =>
  template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
