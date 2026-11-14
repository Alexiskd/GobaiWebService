// Découpages de tuiles pris en charge. Même convention que le backend (`tile-math.ts`, champ `projection`).
// Importe les conversions d'une colonne en longitude et d'une ligne en latitude.
import { colToLon, rowToLat } from './mercator';

/** Web Mercator XYZ (Terre) : 2^z × 2^z tuiles, latitudes coupées à ±85,05°. */
// Déclare et exporte le découpage Mercator (début de l'objet).
export const MERCATOR = {
  // Son identifiant.
  id: 'mercator',
  // Sa tuile racine unique.
  roots: [{ z: 0, x: 0, y: 0 }],
  // Nombre de colonnes au niveau z.
  cols: (z) => 2 ** z,
  // Nombre de lignes au niveau z.
  rows: (z) => 2 ** z,
  // Latitude du bord haut d'une ligne.
  lat: (row, z) => rowToLat(row, 2 ** z),
  // Longitude du bord gauche d'une colonne.
  lon: (col, z) => colToLon(col, 2 ** z),
  /** Taille au sol d'une tuile (rayons de l'astre) : (2π/2^z)·cos(lat). */
  // Taille au sol d'une tuile, réduite par le cosinus de la latitude (jamais sous 0,05).
  groundSize: (z, midLat) => ((2 * Math.PI) / 2 ** z) * Math.max(Math.cos((midLat * Math.PI) / 180), 0.05),
// Fin de l'objet.
};

/** Géographique / plate carrée (Lune, NASA Trek) : 2^(z+1) × 2^z tuiles, du pôle Nord au pôle Sud. */
// Déclare et exporte le découpage équirectangulaire (début de l'objet).
export const EQUIRECTANGULAR = {
  // Son identifiant.
  id: 'equirectangular',
  // Ses deux tuiles racines, côte à côte.
  roots: [{ z: 0, x: 0, y: 0 }, { z: 0, x: 1, y: 0 }],
  // Nombre de colonnes au niveau z : deux fois plus que de lignes.
  cols: (z) => 2 ** (z + 1),
  // Nombre de lignes au niveau z.
  rows: (z) => 2 ** z,
  // Latitude du bord haut d'une ligne : de 90 à -90, régulièrement.
  lat: (row, z) => 90 - (row / 2 ** z) * 180,
  // Longitude du bord gauche d'une colonne : de -180 à 180, régulièrement.
  lon: (col, z) => (col / 2 ** (z + 1)) * 360 - 180,
  /** Une tuile couvre 180°/2^z en latitude (la plus grande de ses deux dimensions). */
  // Taille au sol d'une tuile : π divisé par le nombre de lignes.
  groundSize: (z) => Math.PI / 2 ** z,
// Fin de l'objet.
};

// projectionOf : le découpage équirectangulaire si son identifiant est demandé, Mercator sinon.
export const projectionOf = (id) => (id === 'equirectangular' ? EQUIRECTANGULAR : MERCATOR);

/** Emprise d'une tuile en degrés, pour un découpage donné. */
// Déclare et exporte tileBoundsIn : le découpage et les coordonnées de la tuile.
export function tileBoundsIn(proj, z, x, y) {
  // Renvoie les limites ouest, est, nord et sud de la tuile.
  return { west: proj.lon(x, z), east: proj.lon(x + 1, z), north: proj.lat(y, z), south: proj.lat(y + 1, z) };
// Fin de tileBoundsIn.
}
