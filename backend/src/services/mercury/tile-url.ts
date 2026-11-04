import type {
  CuratedLayer,
  ProviderDefinition,
  TileScheme,
} from './mercury.types';
import { tileBBox, tileGrid } from './tile-math';

export function buildTileUrl(
  provider: ProviderDefinition,
  layer: CuratedLayer,
  zoom: number,
  x: number,
  y: number,
): string {
  if (layer.kind === 'wmts' && layer.wmts) {
    return [
      layer.wmts.baseUrl,
      layer.wmts.style,
      layer.wmts.matrixSet,
      zoom,
      y,
      `${x}.${layer.wmts.extension}`,
    ].join('/');
  }

  if (layer.kind === 'arcgis-image' && layer.arcgis) {
    return buildArcgisExportUrl(layer, layer.scheme, zoom, x, y);
  }

  if (layer.kind === 'wms' && layer.wms) {
    return buildWmsGetMapUrl(layer, layer.scheme, zoom, x, y);
  }

  if (layer.kind === 'xyz' && layer.xyz) {
    const grid = tileGrid(layer.scheme, zoom);
    const tileY = layer.xyz.tms ? grid.rows - 1 - y : y;
    const sourceZoom = zoom + (layer.xyz.zoomOffset ?? 0);

    return layer.xyz.urlTemplate
      .replaceAll('{z}', String(sourceZoom))
      .replaceAll('{x}', String(x))
      .replaceAll('{y}', String(tileY));
  }

  throw new Error(
    `Aucune source de tuiles configurée pour ${provider.id}/${layer.id}.`,
  );
}

export function buildProxyUrl(
  provider: ProviderDefinition,
  layer: CuratedLayer,
  zoom: number,
  x: number,
  y: number,
): string {
  return `/api/v1/mercury/providers/${provider.id}/layers/${layer.id}/tile/${zoom}/${x}/${y}`;
}

function buildArcgisExportUrl(
  layer: CuratedLayer,
  scheme: TileScheme,
  zoom: number,
  x: number,
  y: number,
): string {
  const arcgis = layer.arcgis;
  if (!arcgis) {
    throw new Error(`Configuration ArcGIS ImageServer manquante pour ${layer.id}.`);
  }

  const bbox = tileBBox(scheme, zoom, x, y);
  const params = new URLSearchParams({
    bbox: [bbox.west, bbox.south, bbox.east, bbox.north]
      .map(formatNumber)
      .join(','),
    bboxSR: arcgis.bboxSrs,
    imageSR: arcgis.imageSrs,
    size: `${layer.tileSize},${layer.tileSize}`,
    format: arcgis.format,
    interpolation: arcgis.interpolation,
    f: 'image',
  });

  return `${arcgis.exportImageUrl}?${params.toString()}`;
}

function buildWmsGetMapUrl(
  layer: CuratedLayer,
  scheme: TileScheme,
  zoom: number,
  x: number,
  y: number,
): string {
  const wms = layer.wms;
  if (!wms) {
    throw new Error(`Configuration WMS manquante pour ${layer.id}.`);
  }

  const bbox = tileBBox(scheme, zoom, x, y);
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: wms.version,
    REQUEST: 'GetMap',
    LAYERS: layer.upstreamLayer,
    STYLES: '',
    WIDTH: String(layer.tileSize),
    HEIGHT: String(layer.tileSize),
    FORMAT: layer.format,
    TRANSPARENT: 'TRUE',
  });

  if (wms.version === '1.3.0') {
    params.set('CRS', wms.srs);
  } else {
    params.set('SRS', wms.srs);
  }

  const axes =
    wms.axisOrder === 'yx'
      ? [bbox.south, bbox.west, bbox.north, bbox.east]
      : [bbox.west, bbox.south, bbox.east, bbox.north];
  params.set('BBOX', axes.map(formatNumber).join(','));

  const separator = wms.getMapUrl.includes('?') ? '&' : '?';
  return `${wms.getMapUrl}${separator}${params.toString()}`;
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(8)));
}
