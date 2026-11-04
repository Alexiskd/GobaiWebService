export const MARS_CONFIG = Symbol('MARS_CONFIG');

export interface MarsConfig {
  trekBaseUrl: string;
  trekProduct: string;
  trekStyle: string;
  trekMatrixSet: string;
  trekMaxZoom: number;
  usgsBaseUrl: string;
  usgsMap: string;
  usgsMaxZoom: number;
  opmTileUrl: string;
  opmHillshadeUrl: string;
  opmMaxZoom: number;
  ctxTileUrl: string;
  ctxMaxZoom: number;
  cesiumAssetId: number;
  cesiumToken: string | null;
  httpTimeoutMs: number;
  healthTimeoutMs: number;
  userAgent: string;
  tileCacheEntries: number;
  tileCacheTtlMs: number;
  capabilitiesCacheTtlMs: number;
  maxUpstreamBytes: number;
}

function readString(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: string,
): string {
  const value = env[name]?.trim();
  return value ? value : fallback;
}

function readInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    return fallback;
  }

  return value;
}

export function loadMarsConfig(
  env: NodeJS.ProcessEnv = process.env,
): MarsConfig {
  const token = env.CESIUM_ION_TOKEN?.trim();

  return {
    trekBaseUrl: readString(
      env,
      'MARS_TREK_BASE_URL',
      'https://trek.nasa.gov/tiles/Mars/EQ',
    ).replace(/\/+$/, ''),
    trekProduct: readString(
      env,
      'MARS_TREK_PRODUCT',
      'Mars_Viking_MDIM21_ClrMosaic_global_232m',
    ),
    trekStyle: readString(env, 'MARS_TREK_STYLE', 'default'),
    trekMatrixSet: readString(env, 'MARS_TREK_MATRIX_SET', 'default028mm'),
    trekMaxZoom: readInt(env, 'MARS_TREK_MAX_ZOOM', 7, 0, 14),
    usgsBaseUrl: readString(
      env,
      'MARS_USGS_BASE_URL',
      'https://planetarymaps.usgs.gov/cgi-bin/mapserv',
    ).replace(/\/+$/, ''),
    usgsMap: readString(env, 'MARS_USGS_MAP', '/maps/mars/mars_simp_cyl.map'),
    usgsMaxZoom: readInt(env, 'MARS_USGS_MAX_ZOOM', 7, 0, 12),
    opmTileUrl: readString(
      env,
      'MARS_OPM_TILE_URL',
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-basemap-v0-2/all/{z}/{x}/{y}.png',
    ),
    opmHillshadeUrl: readString(
      env,
      'MARS_OPM_HILLSHADE_URL',
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mars-hillshade/all/{z}/{x}/{y}.png',
    ),
    opmMaxZoom: readInt(env, 'MARS_OPM_MAX_ZOOM', 6, 0, 14),
    ctxTileUrl: readString(
      env,
      'MARS_CTX_TILE_URL',
      'https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX1/MapServer/tile/{z}/{y}/{x}',
    ),
    ctxMaxZoom: readInt(env, 'MARS_CTX_MAX_ZOOM', 12, 0, 17),
    cesiumAssetId: readInt(
      env,
      'MARS_CESIUM_ASSET_ID',
      3_644_333,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    cesiumToken: token ? token : null,
    httpTimeoutMs: readInt(env, 'MARS_HTTP_TIMEOUT_MS', 20_000, 1_000, 120_000),
    healthTimeoutMs: readInt(
      env,
      'MARS_HEALTH_TIMEOUT_MS',
      10_000,
      1_000,
      60_000,
    ),
    userAgent: readString(
      env,
      'MARS_USER_AGENT',
      'space-backend-mars/1.0 (+https://nestjs.com)',
    ),
    tileCacheEntries: readInt(
      env,
      'MARS_TILE_CACHE_ENTRIES',
      1_024,
      1,
      8_192,
    ),
    tileCacheTtlMs: readInt(
      env,
      'MARS_TILE_CACHE_TTL_MS',
      86_400_000,
      1_000,
      30 * 86_400_000,
    ),
    capabilitiesCacheTtlMs: readInt(
      env,
      'MARS_CAPABILITIES_CACHE_TTL_MS',
      3_600_000,
      1_000,
      7 * 86_400_000,
    ),
    maxUpstreamBytes: readInt(
      env,
      'MARS_MAX_UPSTREAM_BYTES',
      8_000_000,
      1_024,
      64_000_000,
    ),
  };
}
