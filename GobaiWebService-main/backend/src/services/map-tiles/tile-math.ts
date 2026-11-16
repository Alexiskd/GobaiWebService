/**
 * Mathématiques des tuiles « XYZ » (Web Mercator, EPSG:3857), le schéma utilisé par plusieurs fonds cartographiques :
 *  - le monde au zoom `z` est une grille de 2^z × 2^z tuiles ;
 *  - `x` croît vers l'Est depuis le méridien ±180°, `y` croît vers le Sud depuis la latitude de coupure (≈ 85,05° N).
 */
// Côté d'une tuile, en pixels.
export const TILE_SIZE = 256;
/** Latitude de coupure du Web Mercator : au-delà, la projection n'est pas définie. */
// Latitude maximale du Web Mercator, en degrés.
export const MAX_LATITUDE = 85.0511287798066;
// Niveau de zoom maximal accepté.
export const MAX_ZOOM = 22;

// Forme des coordonnées d'une tuile.
export interface TileCoord {
  // z : le niveau de zoom.
  z: number;
  // x : la colonne.
  x: number;
  // y : la ligne.
  y: number;
// Fin de TileCoord.
}

// Forme d'une emprise géographique.
export interface Bounds {
  // north : latitude du bord nord.
  north: number;
  // south : latitude du bord sud.
  south: number;
  // west : longitude du bord ouest.
  west: number;
  // east : longitude du bord est.
  east: number;
// Fin de Bounds.
}

// Fonction clamp : ramène une valeur entre un minimum et un maximum.
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
// Facteur de conversion des degrés en radians.
const RAD = Math.PI / 180;

/** Nombre de tuiles par côté au zoom `z`. */
// Fonction tilesPerSide : nombre de tuiles par côté à un niveau, 2 puissance z.
export const tilesPerSide = (z: number): number => 2 ** z;

/** Tuile qui contient le point (lon, lat) au zoom `z`. La latitude est ramenée dans ±MAX_LATITUDE. */
// Fonction lonLatToTile : la tuile qui contient un point.
export function lonLatToTile(lon: number, lat: number, z: number): TileCoord {
  // Nombre de tuiles par côté.
  const n = tilesPerSide(z);
  // Latitude bornée à ±85,05°, en radians.
  const latRad = clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) * RAD;
  // Colonne, avec décimales : la longitude ramenée de −180…180 à 0…n.
  const x = ((lon + 180) / 360) * n;
  // Ligne, avec décimales : formule du Web Mercator, qui étire les latitudes vers les pôles.
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  // Renvoie la tuile : colonne et ligne arrondies vers le bas et gardées dans la grille.
  return { z, x: clamp(Math.floor(x), 0, n - 1), y: clamp(Math.floor(y), 0, n - 1) };
// Fin de lonLatToTile.
}

/** Emprise géographique d'une tuile, en degrés. */
// Fonction tileBounds : l'emprise d'une tuile.
export function tileBounds(z: number, x: number, y: number): Bounds {
  // Nombre de tuiles par côté.
  const n = tilesPerSide(z);
  // Fonction latAt : la latitude du haut d'une ligne, par la formule inverse du Web Mercator.
  const latAt = (row: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * 180) / Math.PI;
  // Renvoie :
  return {
    // bord ouest : la colonne ramenée en longitude ;
    west: (x / n) * 360 - 180,
    // bord est : la colonne suivante ;
    east: ((x + 1) / n) * 360 - 180,
    // bord nord : le haut de la ligne ;
    north: latAt(y),
    // bord sud : le haut de la ligne suivante.
    south: latAt(y + 1),
  // Fin de l'objet.
  };
// Fin de tileBounds.
}

/** Taille de la grille au zoom `z` : Web Mercator = carré, géographique (plate carrée) = deux fois plus large que haute. */
// Fonction gridSize : nombre de colonnes et de lignes à un niveau, selon la projection (Web Mercator par défaut).
export function gridSize(z: number, projection: 'mercator' | 'equirectangular' = 'mercator'): { cols: number; rows: number } {
  // Nombre de tuiles par côté.
  const n = tilesPerSide(z);
  // En projection géographique, deux fois plus de colonnes que de lignes.
  return { cols: projection === 'equirectangular' ? 2 * n : n, rows: n };
// Fin de gridSize.
}

/** Vrai si (z, x, y) désigne une tuile qui existe. */
// Fonction isValidTile : la tuile existe-t-elle ?
export function isValidTile(z: number, x: number, y: number, projection: 'mercator' | 'equirectangular' = 'mercator'): boolean {
  // Non si une valeur n'est pas un entier, ou si le zoom est hors de 0…22.
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > MAX_ZOOM) return false;
  // Taille de la grille à ce niveau.
  const { cols, rows } = gridSize(z, projection);
  // Oui si la colonne et la ligne sont dans la grille.
  return x >= 0 && x < cols && y >= 0 && y < rows;
// Fin de isValidTile.
}

/** Remplace {z}, {x}, {y} dans un modèle d'URL. */
// Fonction fillTemplate : remplit un modèle d'adresse avec les coordonnées d'une tuile.
export function fillTemplate(template: string, { z, x, y }: TileCoord): string {
  // Remplace {z}, {x} et {y} par leurs valeurs.
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
// Fin de fillTemplate.
}
