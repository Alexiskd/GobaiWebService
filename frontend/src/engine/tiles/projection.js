// Découpages de tuiles pris en charge. Même convention que le backend (`tile-math.ts`, champ `projection`).
import { colToLon, rowToLat } from './mercator.js';

/** Web Mercator XYZ (Terre) : 2^z × 2^z tuiles, latitudes coupées à ±85,05°. */
export const MERCATOR = {
  id: 'mercator',
  roots: [{ z: 0, x: 0, y: 0 }],
  cols: (z) => 2 ** z,
  rows: (z) => 2 ** z,
  lat: (row, z) => rowToLat(row, 2 ** z),
  lon: (col, z) => colToLon(col, 2 ** z),
  /** Taille au sol d'une tuile (rayons de l'astre) : (2π/2^z)·cos(lat). */
  groundSize: (z, midLat) => ((2 * Math.PI) / 2 ** z) * Math.max(Math.cos((midLat * Math.PI) / 180), 0.05),
};

/** Géographique / plate carrée (Lune, NASA Trek) : 2^(z+1) × 2^z tuiles, du pôle Nord au pôle Sud. */
export const EQUIRECTANGULAR = {
  id: 'equirectangular',
  roots: [{ z: 0, x: 0, y: 0 }, { z: 0, x: 1, y: 0 }],
  cols: (z) => 2 ** (z + 1),
  rows: (z) => 2 ** z,
  lat: (row, z) => 90 - (row / 2 ** z) * 180,
  lon: (col, z) => (col / 2 ** (z + 1)) * 360 - 180,
  /** Une tuile couvre 180°/2^z en latitude (la plus grande de ses deux dimensions). */
  groundSize: (z) => Math.PI / 2 ** z,
};

export const projectionOf = (id) => (id === 'equirectangular' ? EQUIRECTANGULAR : MERCATOR);

/** Emprise d'une tuile en degrés, pour un découpage donné. */
export function tileBoundsIn(proj, z, x, y) {
  return { west: proj.lon(x, z), east: proj.lon(x + 1, z), north: proj.lat(y, z), south: proj.lat(y + 1, z) };
}
