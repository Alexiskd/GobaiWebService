export const MERCURY_CONFIG = Symbol('MERCURY_CONFIG');

export interface MercuryConfig {
  lunaservCapabilitiesUrl: string;
  lunaservGetMapUrl: string;
  lunaservMaxZoom: number;
  usgsBaseUrl: string;
  usgsMap: string;
  usgsMaxZoom: number;
  trekImageServerBaseUrl: string;
  trekTerrainMaxZoom: number;
  trekWmtsBaseUrl: string;
  trekWmtsMaxZoom: number;
  opmTileUrl: string;
  opmMaxZoom: number;
  quickmapTileUrl: string;
  quickmapMaxZoom: number;
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

export function loadMercuryConfig(
  env: NodeJS.ProcessEnv = process.env,
): MercuryConfig {
  return {
    lunaservCapabilitiesUrl: readString(
      env,
      'MERCURY_LUNASERV_CAPABILITIES_URL',
      'https://wms.im-ldi.com/lunaserv/wms',
    ),
    lunaservGetMapUrl: readString(
      env,
      'MERCURY_LUNASERV_GETMAP_URL',
      'https://wms.im-ldi.com/',
    ),
    lunaservMaxZoom: readInt(env, 'MERCURY_LUNASERV_MAX_ZOOM', 7, 0, 12),
    usgsBaseUrl: readString(
      env,
      'MERCURY_USGS_BASE_URL',
      'https://planetarymaps.usgs.gov/cgi-bin/mapserv',
    ).replace(/\/+$/, ''),
    usgsMap: readString(
      env,
      'MERCURY_USGS_MAP',
      '/maps/mercury/mercury_simp_cyl.map',
    ),
    usgsMaxZoom: readInt(env, 'MERCURY_USGS_MAX_ZOOM', 7, 0, 12),
    trekImageServerBaseUrl: readString(
      env,
      'MERCURY_TREK_IMAGESERVER_BASE_URL',
      'https://trek.nasa.gov/mercury/arcgis/rest/services',
    ).replace(/\/+$/, ''),
    trekTerrainMaxZoom: readInt(
      env,
      'MERCURY_TREK_TERRAIN_MAX_ZOOM',
      8,
      0,
      12,
    ),
    trekWmtsBaseUrl: readString(
      env,
      'MERCURY_TREK_WMTS_BASE_URL',
      'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/1.0.0',
    ).replace(/\/+$/, ''),
    trekWmtsMaxZoom: readInt(env, 'MERCURY_TREK_WMTS_MAX_ZOOM', 7, 0, 14),
    opmTileUrl: readString(
      env,
      'MERCURY_OPM_TILE_URL',
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mercury-basemap-v0-1/all/{z}/{x}/{y}.png',
    ),
    opmMaxZoom: readInt(env, 'MERCURY_OPM_MAX_ZOOM', 7, 0, 14),
    quickmapTileUrl: readString(
      env,
      'MERCURY_QUICKMAP_TILE_URL',
      'https://tiles.arcgis.com/tiles/0xMt0kzpNJRZcyJb/arcgis/rest/services/Mercury_Basemap/MapServer/tile/{z}/{y}/{x}',
    ),
    quickmapMaxZoom: readInt(env, 'MERCURY_QUICKMAP_MAX_ZOOM', 5, 0, 14),
    httpTimeoutMs: readInt(
      env,
      'MERCURY_HTTP_TIMEOUT_MS',
      20_000,
      1_000,
      120_000,
    ),
    healthTimeoutMs: readInt(
      env,
      'MERCURY_HEALTH_TIMEOUT_MS',
      10_000,
      1_000,
      60_000,
    ),
    userAgent: readString(
      env,
      'MERCURY_USER_AGENT',
      'space-backend-mercury/1.0 (+https://nestjs.com)',
    ),
    tileCacheEntries: readInt(
      env,
      'MERCURY_TILE_CACHE_ENTRIES',
      1_024,
      1,
      8_192,
    ),
    tileCacheTtlMs: readInt(
      env,
      'MERCURY_TILE_CACHE_TTL_MS',
      86_400_000,
      1_000,
      30 * 86_400_000,
    ),
    capabilitiesCacheTtlMs: readInt(
      env,
      'MERCURY_CAPABILITIES_CACHE_TTL_MS',
      3_600_000,
      1_000,
      7 * 86_400_000,
    ),
    maxUpstreamBytes: readInt(
      env,
      'MERCURY_MAX_UPSTREAM_BYTES',
      8_000_000,
      1_024,
      64_000_000,
    ),
  };
}
