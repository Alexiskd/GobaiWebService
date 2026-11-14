// Maths Web Mercator (schéma XYZ), sans dépendance. Même convention que le backend (`tile-math.ts`) :
// x croît vers l'Est depuis -180°, y croît vers le Sud depuis ~85,05° N.
// Latitude limite de la projection Web Mercator, en degrés.
export const MAX_LATITUDE = 85.0511287798066;
// Facteur de conversion des degrés en radians.
const RAD = Math.PI / 180;

/** Latitude (°) de la ligne de grille `row` sur `n` lignes (row peut être fractionnaire). */
// rowToLat : latitude d'une ligne de la grille, par la formule inverse de Mercator.
export const rowToLat = (row, n) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
/** Longitude (°) de la colonne de grille `col` sur `n` colonnes. */
// colToLon : longitude d'une colonne de la grille, de -180 à 180.
export const colToLon = (col, n) => (col / n) * 360 - 180;

/** Emprise d'une tuile en degrés. */
// Déclare et exporte tileBounds : le niveau et les coordonnées de la tuile.
export function tileBounds(z, x, y) {
  // Nombre de tuiles par côté à ce niveau.
  const n = 2 ** z;
  // Renvoie les limites ouest, est, nord et sud.
  return { west: colToLon(x, n), east: colToLon(x + 1, n), north: rowToLat(y, n), south: rowToLat(y + 1, n) };
// Fin de tileBounds.
}

/** Point de la sphère unité pour (lon°, lat°) — repère de la Terre du moteur : (cos la cos lo, sin la, -cos la sin lo). */
// Déclare et exporte lonLatToXYZ : longitude, latitude et rayon (1 par défaut).
export function lonLatToXYZ(lon, lat, r = 1) {
  // Longitude et latitude en radians.
  const lo = lon * RAD, la = lat * RAD;
  // Le point 3D : y vers le pôle Nord, z opposé au sinus de la longitude.
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
// Fin de lonLatToXYZ.
}

/** Inverse de `lonLatToXYZ` : [lon°, lat°] d'un vecteur (pas forcément unitaire). */
// Déclare et exporte xyzToLonLat : reçoit un vecteur.
export function xyzToLonLat([x, y, z]) {
  // Sa longueur, 1 si elle est nulle.
  const len = Math.hypot(x, y, z) || 1;
  // La longitude par l'arc tangente, la latitude par l'arc sinus borné, en degrés.
  return [Math.atan2(-z, x) / RAD, Math.asin(Math.max(-1, Math.min(1, y / len))) / RAD];
// Fin de xyzToLonLat.
}

// tileKey : clé d'une tuile, de la forme « z/x/y ».
export const tileKey = (z, x, y) => `${z}/${x}/${y}`;
// parentOf : la tuile parente, au niveau du dessus ; null au niveau 0.
export const parentOf = ({ z, x, y }) => (z === 0 ? null : { z: z - 1, x: x >> 1, y: y >> 1 });
// childrenOf : les quatre tuiles enfants, au niveau du dessous (début).
export const childrenOf = ({ z, x, y }) => [
  // Les deux du haut.
  { z: z + 1, x: x * 2, y: y * 2 }, { z: z + 1, x: x * 2 + 1, y: y * 2 },
  // Les deux du bas.
  { z: z + 1, x: x * 2, y: y * 2 + 1 }, { z: z + 1, x: x * 2 + 1, y: y * 2 + 1 },
// Fin de la liste.
];

/** Remplace {z} {x} {y} dans un modèle d'URL (n'importe quel ordre). */
// fillTemplate : remplit un modèle d'adresse…
export const fillTemplate = (template, { z, x, y }) =>
  // … en remplaçant {z}, {x} et {y} par leurs valeurs.
  template.replace('{z}', z).replace('{x}', x).replace('{y}', y);
