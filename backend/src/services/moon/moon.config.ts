export const MOON_CONFIG = Symbol('MOON_CONFIG');

export interface MoonConfig {
  trekBaseUrl: string;
  trekProduct: string;
  trekStyle: string;
  trekMatrixSet: string;
  trekMaxZoom: number;
  trekImageServerBaseUrl: string;
  trekTerrainMaxZoom: number;
  usgsBaseUrl: string;
  usgsMap: string;
  usgsMaxZoom: number;
  lrocCapabilitiesUrl: string;
  lrocGetMapUrl: string;
  lrocMaxZoom: number;
  opmTileUrl: string;
  opmMaxZoom: number;
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

export function loadMoonConfig(
  env: NodeJS.ProcessEnv = process.env,
): MoonConfig {
  const token = env.CESIUM_ION_TOKEN?.trim();

  return {
    trekBaseUrl: readString(
      env,
      'MOON_TREK_BASE_URL',
      'https://trek.nasa.gov/tiles/Moon/EQ',
    ).replace(/\/+$/, ''),
    trekProduct: readString(
      env,
      'MOON_TREK_PRODUCT',
      'LRO_WAC_Mosaic_Global_303ppd_v02',
    ),
    trekStyle: readString(env, 'MOON_TREK_STYLE', 'default'),
    trekMatrixSet: readString(env, 'MOON_TREK_MATRIX_SET', 'default028mm'),
    trekMaxZoom: readInt(env, 'MOON_TREK_MAX_ZOOM', 8, 0, 14),
    trekImageServerBaseUrl: readString(
      env,
      'MOON_TREK_IMAGESERVER_BASE_URL',
      'https://trek.nasa.gov/moon/trekarcgis/rest/services',
    ).replace(/\/+$/, ''),
    trekTerrainMaxZoom: readInt(env, 'MOON_TREK_TERRAIN_MAX_ZOOM', 8, 0, 14),
    usgsBaseUrl: readString(
      env,
      'MOON_USGS_BASE_URL',
      'https://planetarymaps.usgs.gov/cgi-bin/mapserv',
    ).replace(/\/+$/, ''),
    usgsMap: readString(env, 'MOON_USGS_MAP', '/maps/earth/moon_simp_cyl.map'),
    usgsMaxZoom: readInt(env, 'MOON_USGS_MAX_ZOOM', 7, 0, 12),
    lrocCapabilitiesUrl: readString(
      env,
      'MOON_LROC_CAPABILITIES_URL',
      'https://wms.im-ldi.com/lunaserv/wms',
    ),
    lrocGetMapUrl: readString(
      env,
      'MOON_LROC_GETMAP_URL',
      'https://wms.im-ldi.com/',
    ),
    lrocMaxZoom: readInt(env, 'MOON_LROC_MAX_ZOOM', 7, 0, 12),
    opmTileUrl: readString(
      env,
      'MOON_OPM_TILE_URL',
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png',
    ),
    opmMaxZoom: readInt(env, 'MOON_OPM_MAX_ZOOM', 7, 0, 14),
    cesiumAssetId: readInt(
      env,
      'MOON_CESIUM_ASSET_ID',
      2_684_829,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    cesiumToken: token ? token : null,
    httpTimeoutMs: readInt(env, 'MOON_HTTP_TIMEOUT_MS', 20_000, 1_000, 120_000),
    healthTimeoutMs: readInt(
      env,
      'MOON_HEALTH_TIMEOUT_MS',
      10_000,
      1_000,
      60_000,
    ),
    userAgent: readString(
      env,
      'MOON_USER_AGENT',
      'space-backend-moon/1.0 (+https://nestjs.com)',
    ),
    tileCacheEntries: readInt(
      env,
      'MOON_TILE_CACHE_ENTRIES',
      1_024,
      1,
      8_192,
    ),
    tileCacheTtlMs: readInt(
      env,
      'MOON_TILE_CACHE_TTL_MS',
      86_400_000,
      1_000,
      30 * 86_400_000,
    ),
    capabilitiesCacheTtlMs: readInt(
      env,
      'MOON_CAPABILITIES_CACHE_TTL_MS',
      3_600_000,
      1_000,
      7 * 86_400_000,
    ),
    maxUpstreamBytes: readInt(
      env,
      'MOON_MAX_UPSTREAM_BYTES',
      8_000_000,
      1_024,
      64_000_000,
    ),
  };
}
