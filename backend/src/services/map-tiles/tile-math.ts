/**
 * Mathématiques des tuiles « XYZ » (Web Mercator, EPSG:3857), le schéma utilisé par plusieurs fonds cartographiques :
 *  - le monde au zoom `z` est une grille de 2^z × 2^z tuiles ;
 *  - `x` croît vers l'Est depuis le méridien ±180°, `y` croît vers le Sud depuis la latitude de coupure (≈ 85,05° N).
 */
export const TILE_SIZE = 256;
/** Latitude de coupure du Web Mercator : au-delà, la projection n'est pas définie. */
export const MAX_LATITUDE = 85.0511287798066;
export const MAX_ZOOM = 22;

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface Bounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const RAD = Math.PI / 180;

/** Nombre de tuiles par côté au zoom `z`. */
export const tilesPerSide = (z: number): number => 2 ** z;

/** Tuile qui contient le point (lon, lat) au zoom `z`. La latitude est ramenée dans ±MAX_LATITUDE. */
export function lonLatToTile(lon: number, lat: number, z: number): TileCoord {
  const n = tilesPerSide(z);
  const latRad = clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) * RAD;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  return { z, x: clamp(Math.floor(x), 0, n - 1), y: clamp(Math.floor(y), 0, n - 1) };
}

/** Emprise géographique d'une tuile, en degrés. */
export function tileBounds(z: number, x: number, y: number): Bounds {
  const n = tilesPerSide(z);
  const latAt = (row: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
  return {
    west: (x / n) * 360 - 180,
    east: ((x + 1) / n) * 360 - 180,
    north: latAt(y),
    south: latAt(y + 1),
  };
}

/** Taille de la grille au zoom `z` : Web Mercator = carré, géographique (plate carrée) = deux fois plus large que haute. */
export function gridSize(z: number, projection: 'mercator' | 'equirectangular' = 'mercator'): { cols: number; rows: number } {
  const n = tilesPerSide(z);
  return { cols: projection === 'equirectangular' ? 2 * n : n, rows: n };
}

/** Vrai si (z, x, y) désigne une tuile qui existe. */
export function isValidTile(z: number, x: number, y: number, projection: 'mercator' | 'equirectangular' = 'mercator'): boolean {
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > MAX_ZOOM) return false;
  const { cols, rows } = gridSize(z, projection);
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

/** Remplace {z}, {x}, {y} dans un modèle d'URL. */
export function fillTemplate(template: string, { z, x, y }: TileCoord): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
