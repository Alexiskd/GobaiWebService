// Jeton d'injection de la configuration de Mercure.
export const MERCURY_CONFIG = Symbol('MERCURY_CONFIG');

// Forme de la configuration de Mercure.
export interface MercuryConfig {
  // lunaservCapabilitiesUrl : adresse des capacités de Lunaserv.
  lunaservCapabilitiesUrl: string;
  // lunaservGetMapUrl : adresse de ses requêtes GetMap.
  lunaservGetMapUrl: string;
  // lunaservMaxZoom : son niveau maximal.
  lunaservMaxZoom: number;
  // usgsBaseUrl : adresse du service de l'USGS.
  usgsBaseUrl: string;
  // usgsMap : carte de l'USGS.
  usgsMap: string;
  // usgsMaxZoom : niveau maximal de l'USGS.
  usgsMaxZoom: number;
  // trekImageServerBaseUrl : adresse des services ArcGIS de NASA Trek.
  trekImageServerBaseUrl: string;
  // trekTerrainMaxZoom : niveau maximal du relief de Trek.
  trekTerrainMaxZoom: number;
  // trekWmtsBaseUrl : adresse des tuiles WMTS de Trek.
  trekWmtsBaseUrl: string;
  // trekWmtsMaxZoom : leur niveau maximal.
  trekWmtsMaxZoom: number;
  // opmTileUrl : modèle d'adresse des tuiles OpenPlanetaryMap.
  opmTileUrl: string;
  // opmMaxZoom : leur niveau maximal.
  opmMaxZoom: number;
  // quickmapTileUrl : modèle d'adresse des tuiles du fond Mercury Basemap.
  quickmapTileUrl: string;
  // quickmapMaxZoom : leur niveau maximal.
  quickmapMaxZoom: number;
  // httpTimeoutMs : délai maximal d'un appel.
  httpTimeoutMs: number;
  // healthTimeoutMs : délai maximal d'un test de santé.
  healthTimeoutMs: number;
  // userAgent : en-tête User-Agent envoyé aux sources.
  userAgent: string;
  // tileCacheEntries : nombre de tuiles gardées en cache.
  tileCacheEntries: number;
  // tileCacheTtlMs : durée de vie d'une tuile en cache.
  tileCacheTtlMs: number;
  // capabilitiesCacheTtlMs : durée de vie des capacités en cache.
  capabilitiesCacheTtlMs: number;
  // maxUpstreamBytes : taille maximale d'une réponse d'une source.
  maxUpstreamBytes: number;
// Fin de MercuryConfig.
}

// Fonction readString ; ses paramètres :
function readString(
  // l'environnement ;
  env: NodeJS.ProcessEnv,
  // le nom de la variable ;
  name: string,
  // la valeur par défaut.
  fallback: string,
// Elle renvoie un texte.
): string {
  // Valeur de la variable, sans ses espaces.
  const value = env[name]?.trim();
  // La renvoie si elle n'est pas vide, sinon la valeur par défaut.
  return value ? value : fallback;
// Fin de readString.
}

// Fonction readInt ; ses paramètres :
function readInt(
  // l'environnement ;
  env: NodeJS.ProcessEnv,
  // le nom de la variable ;
  name: string,
  // la valeur par défaut ;
  fallback: number,
  // le minimum ;
  min: number,
  // le maximum.
  max: number,
// Elle renvoie un nombre.
): number {
  // Valeur de la variable, sans ses espaces.
  const raw = env[name]?.trim();
  // Vide :
  if (!raw) {
    // la valeur par défaut.
    return fallback;
  // Fin du cas.
  }

  // La convertit en nombre.
  const value = Number(raw);
  // Pas un entier, ou hors des bornes :
  if (!Number.isInteger(value) || value < min || value > max) {
    // la valeur par défaut.
    return fallback;
  // Fin du cas.
  }

  // Renvoie le nombre.
  return value;
// Fin de readInt.
}

// Fonction loadMercuryConfig ; son paramètre :
export function loadMercuryConfig(
  // l'environnement, celui du processus par défaut.
  env: NodeJS.ProcessEnv = process.env,
// Elle renvoie la configuration.
): MercuryConfig {
  // Renvoie :
  return {
    // l'adresse des capacités de Lunaserv, lue
    lunaservCapabilitiesUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_LUNASERV_CAPABILITIES_URL',
      // avec cette valeur par défaut.
      'https://wms.im-ldi.com/lunaserv/wms',
    // Fin de la lecture.
    ),
    // L'adresse des requêtes GetMap de Lunaserv, lue
    lunaservGetMapUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_LUNASERV_GETMAP_URL',
      // avec cette valeur par défaut.
      'https://wms.im-ldi.com/',
    // Fin de la lecture.
    ),
    // Le niveau maximal de Lunaserv : 7 par défaut, de 0 à 12.
    lunaservMaxZoom: readInt(env, 'MERCURY_LUNASERV_MAX_ZOOM', 7, 0, 12),
    // L'adresse de l'USGS, lue
    usgsBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_USGS_BASE_URL',
      // avec cette valeur par défaut ;
      'https://planetarymaps.usgs.gov/cgi-bin/mapserv',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // La carte de l'USGS, lue
    usgsMap: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_USGS_MAP',
      // avec cette valeur par défaut.
      '/maps/mercury/mercury_simp_cyl.map',
    // Fin de la lecture.
    ),
    // Le niveau maximal de l'USGS : 7 par défaut, de 0 à 12.
    usgsMaxZoom: readInt(env, 'MERCURY_USGS_MAX_ZOOM', 7, 0, 12),
    // L'adresse des services ArcGIS de NASA Trek, lue
    trekImageServerBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_TREK_IMAGESERVER_BASE_URL',
      // avec cette valeur par défaut ;
      'https://trek.nasa.gov/mercury/arcgis/rest/services',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // Le niveau maximal du relief de Trek, lu
    trekTerrainMaxZoom: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_TREK_TERRAIN_MAX_ZOOM',
      // 8 par défaut,
      8,
      // 0 au moins,
      0,
      // 12 au plus.
      12,
    // Fin de la lecture.
    ),
    // L'adresse des tuiles WMTS de Trek, lue
    trekWmtsBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_TREK_WMTS_BASE_URL',
      // par défaut la mosaïque MESSENGER en couleur renforcée à 665 m ;
      'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/1.0.0',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // Le niveau maximal des tuiles WMTS de Trek : 7 par défaut, de 0 à 14.
    trekWmtsMaxZoom: readInt(env, 'MERCURY_TREK_WMTS_MAX_ZOOM', 7, 0, 14),
    // Le modèle d'adresse OpenPlanetaryMap, lu
    opmTileUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_OPM_TILE_URL',
      // avec cette valeur par défaut.
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-mercury-basemap-v0-1/all/{z}/{x}/{y}.png',
    // Fin de la lecture.
    ),
    // Le niveau maximal d'OpenPlanetaryMap : 7 par défaut, de 0 à 14.
    opmMaxZoom: readInt(env, 'MERCURY_OPM_MAX_ZOOM', 7, 0, 14),
    // Le modèle d'adresse du fond Mercury Basemap, lu
    quickmapTileUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_QUICKMAP_TILE_URL',
      // avec cette valeur par défaut.
      'https://tiles.arcgis.com/tiles/0xMt0kzpNJRZcyJb/arcgis/rest/services/Mercury_Basemap/MapServer/tile/{z}/{y}/{x}',
    // Fin de la lecture.
    ),
    // Le niveau maximal du fond Mercury Basemap : 5 par défaut, de 0 à 14.
    quickmapMaxZoom: readInt(env, 'MERCURY_QUICKMAP_MAX_ZOOM', 5, 0, 14),
    // Le délai d'un appel, lu
    httpTimeoutMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_HTTP_TIMEOUT_MS',
      // 20 s par défaut,
      20_000,
      // 1 s au moins,
      1_000,
      // 120 s au plus.
      120_000,
    // Fin de la lecture.
    ),
    // Le délai d'un test de santé, lu
    healthTimeoutMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_HEALTH_TIMEOUT_MS',
      // 10 s par défaut,
      10_000,
      // 1 s au moins,
      1_000,
      // 60 s au plus.
      60_000,
    // Fin de la lecture.
    ),
    // L'en-tête User-Agent, lu
    userAgent: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MERCURY_USER_AGENT',
      // avec cette valeur par défaut.
      'space-backend-mercury/1.0 (+https://nestjs.com)',
    // Fin de la lecture.
    ),
    // Le nombre de tuiles en cache, lu
    tileCacheEntries: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_TILE_CACHE_ENTRIES',
      // 1 024 par défaut,
      1_024,
      // 1 au moins,
      1,
      // 8 192 au plus.
      8_192,
    // Fin de la lecture.
    ),
    // La durée de vie d'une tuile, lue
    tileCacheTtlMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_TILE_CACHE_TTL_MS',
      // un jour par défaut,
      86_400_000,
      // 1 s au moins,
      1_000,
      // 30 jours au plus.
      30 * 86_400_000,
    // Fin de la lecture.
    ),
    // La durée de vie des capacités, lue
    capabilitiesCacheTtlMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_CAPABILITIES_CACHE_TTL_MS',
      // une heure par défaut,
      3_600_000,
      // 1 s au moins,
      1_000,
      // 7 jours au plus.
      7 * 86_400_000,
    // Fin de la lecture.
    ),
    // La taille maximale d'une réponse, lue
    maxUpstreamBytes: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MERCURY_MAX_UPSTREAM_BYTES',
      // 8 Mo par défaut,
      8_000_000,
      // 1 ko au moins,
      1_024,
      // 64 Mo au plus.
      64_000_000,
    // Fin de la lecture.
    ),
  // Fin de l'objet.
  };
// Fin de loadMercuryConfig.
}
