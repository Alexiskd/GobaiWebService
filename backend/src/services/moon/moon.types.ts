import type { Buffer } from 'node:buffer';

export const PROVIDER_IDS = [
  'moon-trek',
  'usgs-astro',
  'lroc-lunaserv',
  'opm',
  'cesium-moon',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ProviderKind =
  | 'wmts'
  | 'wms'
  | 'xyz'
  | 'arcgis-image'
  | '3d-tiles';
export type TileScheme = 'equirectangular' | 'web-mercator';
export type AxisOrder = 'xy' | 'yx';

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ProjectedBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  crs: string;
}

export interface WmtsSource {
  baseUrl: string;
  style: string;
  matrixSet: string;
  extension: 'jpg' | 'png' | 'webp';
}

export interface WmsSource {
  getMapUrl: string;
  version: '1.1.1' | '1.3.0';
  srs: string;
  axisOrder: AxisOrder;
}

export interface XyzSource {
  urlTemplate: string;
  tms: boolean;
}

export interface ArcgisImageSource {
  exportImageUrl: string;
  bboxSrs: string;
  imageSrs: string;
  format: 'jpg' | 'png';
  interpolation: 'RSP_BilinearInterpolation' | 'RSP_NearestNeighbor';
}

export interface Tiles3dSource {
  assetId: number;
}

export interface CuratedLayer {
  id: string;
  title: string;
  description: string;
  upstreamLayer: string;
  kind: ProviderKind;
  scheme: TileScheme | 'none';
  crs: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  format: string;
  attribution: string;
  license: string;
  wmts?: WmtsSource;
  wms?: WmsSource;
  xyz?: XyzSource;
  arcgis?: ArcgisImageSource;
  tiles3d?: Tiles3dSource;
}

export interface ProviderDefinition {
  id: ProviderId;
  name: string;
  kind: ProviderKind;
  description: string;
  docsUrl: string;
  attribution: string;
  license: string;
  requiresToken: boolean;
  capabilitiesUrl?: string;
  notes: string[];
  layers: CuratedLayer[];
}

export interface LayerSummary {
  id: string;
  title: string;
  kind: ProviderKind;
  scheme: TileScheme | 'none';
  crs: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  format: string;
  tileUrlTemplate: string;
}

export interface ProviderSummary {
  id: ProviderId;
  name: string;
  kind: ProviderKind;
  description: string;
  docsUrl: string;
  attribution: string;
  license: string;
  requiresToken: boolean;
  capabilitiesUrl: string | null;
  notes: string[];
  layers: LayerSummary[];
}

export interface LayerDetail extends LayerSummary {
  description: string;
  upstreamLayer: string;
  attribution: string;
  license: string;
  tileMatrixSet: string | null;
  style: string | null;
  xyzTemplate: string | null;
  tiles3dAssetId: number | null;
  sampleUpstreamUrl: string | null;
}

export interface UpstreamInfo {
  status: number;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  cacheControl: string | null;
}

export interface ImageInfo {
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

export interface TileCacheInfo {
  hit: boolean;
  stale: boolean;
  key: string;
  ttlMs: number;
  ageMs: number;
}

export interface TileModel {
  provider: {
    id: ProviderId;
    name: string;
    kind: ProviderKind;
  };
  layer: {
    id: string;
    title: string;
    upstreamLayer: string;
  };
  scheme: TileScheme;
  crs: string;
  zoom: number;
  x: number;
  y: number;
  tileSize: number;
  format: string;
  bbox: BBox;
  projectedBBox: ProjectedBBox | null;
  center: { lon: number; lat: number };
  tileRange: { maxX: number; maxY: number };
  upstreamUrl: string;
  proxyUrl: string;
  attribution: string;
  license: string;
  fetchedAt: string;
  upstream: UpstreamInfo | null;
  image: ImageInfo | null;
  cache: TileCacheInfo | null;
}

export interface TileFetchResult {
  model: TileModel;
  buffer: Buffer;
  contentType: string;
  etag: string;
  cacheHit: boolean;
  cacheStale: boolean;
  ttlMs: number;
}

export interface CoverageResult {
  provider: ProviderId;
  layer: string;
  scheme: TileScheme;
  zoom: number;
  bbox: BBox;
  range: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  count: number;
  total: number;
  truncated: boolean;
  urls: string[];
  upstreamUrls: string[];
}

export interface WmtsTileMatrixSummary {
  id: string;
  scaleDenominator: number | null;
  topLeft: { lon: number; lat: number } | null;
  matrixWidth: number | null;
  matrixHeight: number | null;
  tileWidth: number | null;
  tileHeight: number | null;
}

export interface WmtsTileMatrixSetSummary {
  id: string;
  matrices: WmtsTileMatrixSummary[];
}

export interface CapabilitiesLayerSummary {
  name: string;
  title: string;
}

export interface CapabilitiesSummary {
  provider: ProviderId;
  kind: ProviderKind;
  version: string | null;
  serviceTitle: string | null;
  fetchedAt: string;
  bytes: number | null;
  contentType: string | null;
  fetchMs: number | null;
  formats: string[];
  crs: string[];
  bbox: BBox | null;
  layers: CapabilitiesLayerSummary[];
  tileMatrixSets: WmtsTileMatrixSetSummary[];
  resourceUrlTemplate: string | null;
  tilejson?: Record<string, unknown>;
  note?: string;
}

export interface CapabilitiesResult {
  summary: CapabilitiesSummary;
  raw: string | null;
}

export interface TilesetSummary {
  provider: ProviderId;
  assetId: number;
  requiresToken: boolean;
  endpointUrl: string;
  attributions: string[];
  asset: {
    version: string | null;
    tilesetVersion: string | null;
    generator: string | null;
  };
  root: {
    geometricError: number | null;
    refine: string | null;
    boundingVolume: Record<string, unknown> | null;
    descendantCount: number;
    truncated: boolean;
  };
  geometricError: number | null;
  extensionsUsed: string[];
  extensionsRequired: string[];
  fetchedAt: string;
}

export interface HealthProviderResult {
  provider: ProviderId;
  kind: ProviderKind;
  status: 'up' | 'degraded' | 'down' | 'not_configured';
  httpStatus: number | null;
  latencyMs: number;
  contentType: string | null;
  error: string | null;
}

export interface HealthReport {
  checkedAt: string;
  summary: {
    up: number;
    degraded: number;
    down: number;
    notConfigured: number;
  };
  providers: HealthProviderResult[];
}
