import type { BBox, ProjectedBBox, TileScheme } from './mars.types';

export const MAX_MERCATOR_LAT = 85.05112878;
export const EARTH_RADIUS_M = 6_378_137;

const FULL_LON_SPAN = 360;
const FULL_LAT_SPAN = 180;

export interface TileGrid {
  columns: number;
  rows: number;
}

export interface TileIndex {
  x: number;
  y: number;
}

export interface TileIndexRange {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TileCoordinateCheck {
  minZoom: number;
  maxZoom: number;
}

export function normalizeLon(lon: number): number {
  if (!Number.isFinite(lon)) {
    return 0;
  }

  let value = ((((lon + 180) % 360) + 360) % 360) - 180;
  if (Object.is(value, -180) && lon > 0) {
    value = 180;
  }
  return value;
}

export function clampLat(lat: number, scheme: TileScheme): number {
  if (!Number.isFinite(lat)) {
    return 0;
  }

  const limit = scheme === 'web-mercator' ? MAX_MERCATOR_LAT : 90;
  return Math.min(Math.max(lat, -limit), limit);
}

export function tileGrid(scheme: TileScheme, zoom: number): TileGrid {
  if (scheme === 'web-mercator') {
    const side = 2 ** zoom;
    return { columns: side, rows: side };
  }

  return { columns: 2 ** (zoom + 1), rows: 2 ** zoom };
}

export function tileBBox(
  scheme: TileScheme,
  zoom: number,
  x: number,
  y: number,
): BBox {
  const grid = tileGrid(scheme, zoom);

  if (scheme === 'web-mercator') {
    const lonSpan = FULL_LON_SPAN / grid.columns;
    const world = 2 * Math.PI * EARTH_RADIUS_M;
    const span = world / grid.rows;

    const west = -180 + x * lonSpan;
    const northY = Math.PI * EARTH_RADIUS_M - y * span;
    const southY = Math.PI * EARTH_RADIUS_M - (y + 1) * span;

    return {
      west,
      east: west + lonSpan,
      north: mercatorToLat(northY),
      south: mercatorToLat(southY),
    };
  }

  const lonSpan = FULL_LON_SPAN / grid.columns;
  const latSpan = FULL_LAT_SPAN / grid.rows;
  const west = -180 + x * lonSpan;
  const north = 90 - y * latSpan;

  return {
    west,
    east: west + lonSpan,
    north,
    south: north - latSpan,
  };
}

export function tileCenter(
  scheme: TileScheme,
  bbox: BBox,
): { lon: number; lat: number } {
  const lon = round((bbox.west + bbox.east) / 2, 6);
  const lat =
    scheme === 'web-mercator'
      ? mercatorToLat(
          (latToMercatorY(bbox.north) + latToMercatorY(bbox.south)) / 2,
        )
      : round((bbox.south + bbox.north) / 2, 6);

  return { lon, lat };
}

export function tileFromLonLat(
  scheme: TileScheme,
  zoom: number,
  lon: number,
  lat: number,
): TileIndex {
  const grid = tileGrid(scheme, zoom);
  const safeLon = normalizeLon(lon);
  const safeLat = clampLat(lat, scheme);

  const x = Math.floor(((safeLon + 180) / FULL_LON_SPAN) * grid.columns);

  let y: number;
  if (scheme === 'web-mercator') {
    const sin = Math.sin((safeLat * Math.PI) / 180);
    y = Math.floor(
      ((1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2) * grid.rows,
    );
  } else {
    y = Math.floor(((90 - safeLat) / FULL_LAT_SPAN) * grid.rows);
  }

  return {
    x: clampIndex(x, grid.columns),
    y: clampIndex(y, grid.rows),
  };
}

export function tilesForBBox(
  scheme: TileScheme,
  zoom: number,
  bbox: BBox,
): TileIndexRange {
  const safe = clampBBox(bbox, scheme);
  const topLeft = tileFromLonLat(scheme, zoom, safe.west, safe.north);
  const bottomRight = tileFromLonLat(scheme, zoom, safe.east, safe.south);
  const grid = tileGrid(scheme, zoom);

  const minX = Math.min(topLeft.x, bottomRight.x);
  const maxX = Math.max(topLeft.x, bottomRight.x);
  const minY = Math.min(topLeft.y, bottomRight.y);
  const maxY = Math.max(topLeft.y, bottomRight.y);

  return {
    minX: clampIndex(minX, grid.columns),
    maxX: clampIndex(maxX, grid.columns),
    minY: clampIndex(minY, grid.rows),
    maxY: clampIndex(maxY, grid.rows),
  };
}

export function clampBBox(bbox: BBox, scheme: TileScheme): BBox {
  let west = Math.min(Math.max(bbox.west, -180), 180);
  let east = Math.min(Math.max(bbox.east, -180), 180);

  if (west > east) {
    [west, east] = [east, west];
  }

  const southLimit = scheme === 'web-mercator' ? MAX_MERCATOR_LAT : 90;
  let south = Math.min(Math.max(bbox.south, -southLimit), southLimit);
  let north = Math.min(Math.max(bbox.north, -southLimit), southLimit);

  if (south > north) {
    [south, north] = [north, south];
  }

  return { west, south, east, north };
}

export function projectBBox(
  scheme: TileScheme,
  bbox: BBox,
  crs: string,
): ProjectedBBox | null {
  if (scheme !== 'web-mercator') {
    return null;
  }

  const safe = clampBBox(bbox, scheme);

  return {
    minX: round(lonToMercatorX(safe.west), 3),
    minY: round(latToMercatorY(safe.south), 3),
    maxX: round(lonToMercatorX(safe.east), 3),
    maxY: round(latToMercatorY(safe.north), 3),
    crs,
  };
}

export function validateTileCoordinates(
  provider: string,
  layer: string,
  scheme: TileScheme,
  zoom: number,
  x: number,
  y: number,
  bounds: TileCoordinateCheck,
): string | null {
  if (!Number.isInteger(zoom)) {
    return 'Le niveau de zoom doit être un entier.';
  }

  if (zoom < bounds.minZoom || zoom > bounds.maxZoom) {
    return `Zoom ${zoom} hors plage pour ${provider}/${layer} (${bounds.minZoom}–${bounds.maxZoom}).`;
  }

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return 'Les indices de tuile x et y doivent être des entiers.';
  }

  const grid = tileGrid(scheme, zoom);
  if (x < 0 || x >= grid.columns || y < 0 || y >= grid.rows) {
    return `Tuile ${zoom}/${x}/${y} hors du quadrillage ${grid.columns}×${grid.rows}.`;
  }

  return null;
}

export function lonToMercatorX(lon: number): number {
  return (lon * Math.PI * EARTH_RADIUS_M) / 180;
}

export function latToMercatorY(lat: number): number {
  const safe = Math.min(Math.max(lat, -MAX_MERCATOR_LAT), MAX_MERCATOR_LAT);
  const rad = (safe * Math.PI) / 180;
  return EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

export function mercatorToLat(y: number): number {
  const value =
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) *
    (180 / Math.PI);
  return round(value, 6);
}

function clampIndex(value: number, size: number): number {
  return Math.min(Math.max(value, 0), Math.max(size - 1, 0));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}
