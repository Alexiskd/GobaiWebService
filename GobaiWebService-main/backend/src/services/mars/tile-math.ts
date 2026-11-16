// Types (effacés à la compilation) d'une emprise, d'une emprise projetée et d'un découpage en tuiles.
import type { BBox, ProjectedBBox, TileScheme } from './mars.types';

// Latitude maximale du Web Mercator.
export const MAX_MERCATOR_LAT = 85.05112878;
// Rayon utilisé par le Web Mercator, en mètres.
export const EARTH_RADIUS_M = 6_378_137;

// Tour complet en longitude : 360°.
const FULL_LON_SPAN = 360;
// Étendue en latitude : 180°.
const FULL_LAT_SPAN = 180;

// Forme d'une grille de tuiles.
export interface TileGrid {
  // columns : nombre de colonnes.
  columns: number;
  // rows : nombre de lignes.
  rows: number;
// Fin de TileGrid.
}

// Forme de la position d'une tuile.
export interface TileIndex {
  // x : colonne.
  x: number;
  // y : ligne.
  y: number;
// Fin de TileIndex.
}

// Forme d'une plage de tuiles.
export interface TileIndexRange {
  // minX : première colonne.
  minX: number;
  // maxX : dernière colonne.
  maxX: number;
  // minY : première ligne.
  minY: number;
  // maxY : dernière ligne.
  maxY: number;
// Fin de TileIndexRange.
}

// Forme des bornes de zoom d'une couche.
export interface TileCoordinateCheck {
  // minZoom : niveau minimal.
  minZoom: number;
  // maxZoom : niveau maximal.
  maxZoom: number;
// Fin de TileCoordinateCheck.
}

// Fonction normalizeLon : ramène une longitude entre −180° et 180°.
export function normalizeLon(lon: number): number {
  // Valeur non finie :
  if (!Number.isFinite(lon)) {
    // 0.
    return 0;
  // Fin du cas.
  }

  // Ramène la valeur dans l'intervalle, par deux modulos.
  let value = ((((lon + 180) % 360) + 360) % 360) - 180;
  // Si elle tombe sur −180 alors que la longitude était positive,
  if (Object.is(value, -180) && lon > 0) {
    // on garde 180.
    value = 180;
  // Fin du cas.
  }
  // Renvoie la valeur.
  return value;
// Fin de normalizeLon.
}

// Fonction clampLat : borne une latitude.
export function clampLat(lat: number, scheme: TileScheme): number {
  // Valeur non finie :
  if (!Number.isFinite(lat)) {
    // 0.
    return 0;
  // Fin du cas.
  }

  // Limite : celle du Web Mercator, ou 90°.
  const limit = scheme === 'web-mercator' ? MAX_MERCATOR_LAT : 90;
  // Renvoie la latitude bornée.
  return Math.min(Math.max(lat, -limit), limit);
// Fin de clampLat.
}

// Fonction tileGrid : la grille d'un niveau.
export function tileGrid(scheme: TileScheme, zoom: number): TileGrid {
  // En Web Mercator :
  if (scheme === 'web-mercator') {
    // côté de 2^zoom tuiles ;
    const side = 2 ** zoom;
    // autant de colonnes que de lignes.
    return { columns: side, rows: side };
  // Fin du cas.
  }

  // Sinon (plate carrée) : 2^(zoom+1) colonnes et 2^zoom lignes.
  return { columns: 2 ** (zoom + 1), rows: 2 ** zoom };
// Fin de tileGrid.
}

// Fonction tileBBox ; ses paramètres :
export function tileBBox(
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'emprise de la tuile, en degrés.
): BBox {
  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);

  // En Web Mercator :
  if (scheme === 'web-mercator') {
    // largeur d'une tuile, en degrés ;
    const lonSpan = FULL_LON_SPAN / grid.columns;
    // tour du monde, en mètres ;
    const world = 2 * Math.PI * EARTH_RADIUS_M;
    // hauteur d'une tuile, en mètres.
    const span = world / grid.rows;

    // Bord ouest.
    const west = -180 + x * lonSpan;
    // Bord nord, en mètres.
    const northY = Math.PI * EARTH_RADIUS_M - y * span;
    // Bord sud, en mètres.
    const southY = Math.PI * EARTH_RADIUS_M - (y + 1) * span;

    // Renvoie
    return {
      // l'ouest ;
      west,
      // l'est ;
      east: west + lonSpan,
      // le nord, converti en latitude ;
      north: mercatorToLat(northY),
      // le sud, converti en latitude.
      south: mercatorToLat(southY),
    // Fin de l'objet.
    };
  // Fin du cas.
  }

  // Sinon : largeur d'une tuile, en degrés ;
  const lonSpan = FULL_LON_SPAN / grid.columns;
  // hauteur d'une tuile, en degrés ;
  const latSpan = FULL_LAT_SPAN / grid.rows;
  // bord ouest ;
  const west = -180 + x * lonSpan;
  // bord nord.
  const north = 90 - y * latSpan;

  // Renvoie
  return {
    // l'ouest ;
    west,
    // l'est ;
    east: west + lonSpan,
    // le nord ;
    north,
    // le sud.
    south: north - latSpan,
  // Fin de l'objet.
  };
// Fin de tileBBox.
}

// Fonction tileCenter ; ses paramètres :
export function tileCenter(
  // le découpage ;
  scheme: TileScheme,
  // l'emprise.
  bbox: BBox,
// Elle renvoie la longitude et la latitude du centre.
): { lon: number; lat: number } {
  // Longitude : le milieu, à 6 décimales.
  const lon = round((bbox.west + bbox.east) / 2, 6);
  // Latitude :
  const lat =
    // en Web Mercator,
    scheme === 'web-mercator'
      // la latitude
      ? mercatorToLat(
          // du milieu calculé en mètres ;
          (latToMercatorY(bbox.north) + latToMercatorY(bbox.south)) / 2,
        // fin du calcul ;
        )
      // sinon le milieu, à 6 décimales.
      : round((bbox.south + bbox.north) / 2, 6);

  // Renvoie le centre.
  return { lon, lat };
// Fin de tileCenter.
}

// Fonction tileFromLonLat ; ses paramètres :
export function tileFromLonLat(
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la longitude ;
  lon: number,
  // la latitude.
  lat: number,
// Elle renvoie la tuile qui contient ce point.
): TileIndex {
  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);
  // Longitude ramenée entre −180° et 180°.
  const safeLon = normalizeLon(lon);
  // Latitude bornée.
  const safeLat = clampLat(lat, scheme);

  // Colonne.
  const x = Math.floor(((safeLon + 180) / FULL_LON_SPAN) * grid.columns);

  // Ligne.
  let y: number;
  // En Web Mercator :
  if (scheme === 'web-mercator') {
    // sinus de la latitude ;
    const sin = Math.sin((safeLat * Math.PI) / 180);
    // ligne :
    y = Math.floor(
      // formule du Web Mercator.
      ((1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2) * grid.rows,
    // Fin du calcul.
    );
  // Sinon :
  } else {
    // ligne : part de la distance au pôle Nord.
    y = Math.floor(((90 - safeLat) / FULL_LAT_SPAN) * grid.rows);
  // Fin du choix.
  }

  // Renvoie
  return {
    // la colonne, gardée dans la grille ;
    x: clampIndex(x, grid.columns),
    // la ligne, gardée dans la grille.
    y: clampIndex(y, grid.rows),
  // Fin de l'objet.
  };
// Fin de tileFromLonLat.
}

// Fonction tilesForBBox ; ses paramètres :
export function tilesForBBox(
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // l'emprise.
  bbox: BBox,
// Elle renvoie la plage de tuiles qui la couvre.
): TileIndexRange {
  // Emprise bornée.
  const safe = clampBBox(bbox, scheme);
  // Tuile du coin nord-ouest.
  const topLeft = tileFromLonLat(scheme, zoom, safe.west, safe.north);
  // Tuile du coin sud-est.
  const bottomRight = tileFromLonLat(scheme, zoom, safe.east, safe.south);
  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);

  // Première colonne.
  const minX = Math.min(topLeft.x, bottomRight.x);
  // Dernière colonne.
  const maxX = Math.max(topLeft.x, bottomRight.x);
  // Première ligne.
  const minY = Math.min(topLeft.y, bottomRight.y);
  // Dernière ligne.
  const maxY = Math.max(topLeft.y, bottomRight.y);

  // Renvoie
  return {
    // la première colonne, gardée dans la grille ;
    minX: clampIndex(minX, grid.columns),
    // la dernière colonne ;
    maxX: clampIndex(maxX, grid.columns),
    // la première ligne ;
    minY: clampIndex(minY, grid.rows),
    // la dernière ligne.
    maxY: clampIndex(maxY, grid.rows),
  // Fin de l'objet.
  };
// Fin de tilesForBBox.
}

// Fonction clampBBox : borne une emprise.
export function clampBBox(bbox: BBox, scheme: TileScheme): BBox {
  // Ouest, entre −180° et 180°.
  let west = Math.min(Math.max(bbox.west, -180), 180);
  // Est, entre −180° et 180°.
  let east = Math.min(Math.max(bbox.east, -180), 180);

  // S'ils sont inversés,
  if (west > east) {
    // les échange.
    [west, east] = [east, west];
  // Fin du cas.
  }

  // Limite en latitude : celle du Web Mercator, ou 90°.
  const southLimit = scheme === 'web-mercator' ? MAX_MERCATOR_LAT : 90;
  // Sud, borné.
  let south = Math.min(Math.max(bbox.south, -southLimit), southLimit);
  // Nord, borné.
  let north = Math.min(Math.max(bbox.north, -southLimit), southLimit);

  // S'ils sont inversés,
  if (south > north) {
    // les échange.
    [south, north] = [north, south];
  // Fin du cas.
  }

  // Renvoie l'emprise.
  return { west, south, east, north };
// Fin de clampBBox.
}

// Fonction projectBBox ; ses paramètres :
export function projectBBox(
  // le découpage ;
  scheme: TileScheme,
  // l'emprise ;
  bbox: BBox,
  // la projection.
  crs: string,
// Elle renvoie l'emprise en mètres, ou null.
): ProjectedBBox | null {
  // Hors Web Mercator :
  if (scheme !== 'web-mercator') {
    // null.
    return null;
  // Fin du cas.
  }

  // Emprise bornée.
  const safe = clampBBox(bbox, scheme);

  // Renvoie
  return {
    // le bord ouest en mètres, à 3 décimales ;
    minX: round(lonToMercatorX(safe.west), 3),
    // le bord sud ;
    minY: round(latToMercatorY(safe.south), 3),
    // le bord est ;
    maxX: round(lonToMercatorX(safe.east), 3),
    // le bord nord ;
    maxY: round(latToMercatorY(safe.north), 3),
    // la projection.
    crs,
  // Fin de l'objet.
  };
// Fin de projectBBox.
}

// Fonction validateTileCoordinates ; ses paramètres :
export function validateTileCoordinates(
  // le fournisseur ;
  provider: string,
  // la couche ;
  layer: string,
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne ;
  y: number,
  // les bornes de zoom.
  bounds: TileCoordinateCheck,
// Elle renvoie un message d'erreur, ou null si tout est valide.
): string | null {
  // Niveau non entier :
  if (!Number.isInteger(zoom)) {
    // message.
    return 'Le niveau de zoom doit être un entier.';
  // Fin du cas.
  }

  // Niveau hors des bornes :
  if (zoom < bounds.minZoom || zoom > bounds.maxZoom) {
    // message, avec la plage permise.
    return `Zoom ${zoom} hors plage pour ${provider}/${layer} (${bounds.minZoom}–${bounds.maxZoom}).`;
  // Fin du cas.
  }

  // Colonne ou ligne non entière :
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    // message.
    return 'Les indices de tuile x et y doivent être des entiers.';
  // Fin du cas.
  }

  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);
  // Tuile hors de la grille :
  if (x < 0 || x >= grid.columns || y < 0 || y >= grid.rows) {
    // message, avec la taille de la grille.
    return `Tuile ${zoom}/${x}/${y} hors du quadrillage ${grid.columns}×${grid.rows}.`;
  // Fin du cas.
  }

  // Tout est valide : null.
  return null;
// Fin de validateTileCoordinates.
}

// Fonction lonToMercatorX.
export function lonToMercatorX(lon: number): number {
  // Longitude en mètres.
  return (lon * Math.PI * EARTH_RADIUS_M) / 180;
// Fin de lonToMercatorX.
}

// Fonction latToMercatorY.
export function latToMercatorY(lat: number): number {
  // Latitude bornée à celle du Web Mercator.
  const safe = Math.min(Math.max(lat, -MAX_MERCATOR_LAT), MAX_MERCATOR_LAT);
  // En radians.
  const rad = (safe * Math.PI) / 180;
  // Formule du Web Mercator, en mètres.
  return EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + rad / 2));
// Fin de latToMercatorY.
}

// Fonction mercatorToLat.
export function mercatorToLat(y: number): number {
  // Latitude, en degrés :
  const value =
    // formule inverse du Web Mercator,
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) *
    // convertie des radians en degrés.
    (180 / Math.PI);
  // La renvoie à 6 décimales.
  return round(value, 6);
// Fin de mercatorToLat.
}

// Fonction clampIndex.
function clampIndex(value: number, size: number): number {
  // Garde la valeur entre 0 et la taille moins 1.
  return Math.min(Math.max(value, 0), Math.max(size - 1, 0));
// Fin de clampIndex.
}

// Fonction round.
function round(value: number, digits: number): number {
  // Puissance de 10 du nombre de décimales.
  const factor = 10 ** digits;
  // Arrondi.
  const rounded = Math.round(value * factor) / factor;
  // Renvoie 0 plutôt que −0.
  return Object.is(rounded, -0) ? 0 : rounded;
// Fin de round.
}
