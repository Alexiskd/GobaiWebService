// ===========================================================================
// moon.config.ts — configuration par variables d'environnement
// ===========================================================================

// Jeton d'injection de la configuration de la Lune.
export const MOON_CONFIG = Symbol('MOON_CONFIG');

// Forme de la configuration de la Lune.
export interface MoonConfig {
  // trekBaseUrl : adresse des tuiles de NASA Trek.
  trekBaseUrl: string;
  // trekProduct : produit Trek.
  trekProduct: string;
  // trekStyle : style Trek.
  trekStyle: string;
  // trekMatrixSet : jeu de tuiles Trek.
  trekMatrixSet: string;
  // trekMaxZoom : niveau maximal de Trek.
  trekMaxZoom: number;
  // trekImageServerBaseUrl : adresse des services ArcGIS de NASA Trek.
  trekImageServerBaseUrl: string;
  // trekTerrainMaxZoom : niveau maximal du relief de Trek.
  trekTerrainMaxZoom: number;
  // usgsBaseUrl : adresse du service de l'USGS.
  usgsBaseUrl: string;
  // usgsMap : carte de l'USGS.
  usgsMap: string;
  // usgsMaxZoom : niveau maximal de l'USGS.
  usgsMaxZoom: number;
  // lrocCapabilitiesUrl : adresse des capacités de LROC Lunaserv.
  lrocCapabilitiesUrl: string;
  // lrocGetMapUrl : adresse de ses requêtes GetMap.
  lrocGetMapUrl: string;
  // lrocMaxZoom : son niveau maximal.
  lrocMaxZoom: number;
  // opmTileUrl : modèle d'adresse des tuiles OpenPlanetaryMap.
  opmTileUrl: string;
  // opmMaxZoom : leur niveau maximal.
  opmMaxZoom: number;
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
// Fin de MoonConfig.
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

// Fonction loadMoonConfig ; son paramètre :
export function loadMoonConfig(
  // l'environnement, celui du processus par défaut.
  env: NodeJS.ProcessEnv = process.env,
// Elle renvoie la configuration.
): MoonConfig {
  // Renvoie :
  return {
    // l'adresse de NASA Trek, lue
    trekBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_TREK_BASE_URL',
      // avec cette valeur par défaut ;
      'https://trek.nasa.gov/tiles/Moon/EQ',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // Le produit Trek, lu
    trekProduct: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_TREK_PRODUCT',
      // par défaut la mosaïque LRO WAC à 303 pixels par degré.
      'LRO_WAC_Mosaic_Global_303ppd_v02',
    // Fin de la lecture.
    ),
    // Le style Trek, « default » par défaut.
    trekStyle: readString(env, 'MOON_TREK_STYLE', 'default'),
    // Le jeu de tuiles Trek.
    trekMatrixSet: readString(env, 'MOON_TREK_MATRIX_SET', 'default028mm'),
    // Le niveau maximal de Trek : 8 par défaut, de 0 à 14.
    trekMaxZoom: readInt(env, 'MOON_TREK_MAX_ZOOM', 8, 0, 14),
    // L'adresse des services ArcGIS de NASA Trek, lue
    trekImageServerBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_TREK_IMAGESERVER_BASE_URL',
      // avec cette valeur par défaut ;
      'https://trek.nasa.gov/moon/trekarcgis/rest/services',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // Le niveau maximal du relief de Trek : 8 par défaut, de 0 à 14.
    trekTerrainMaxZoom: readInt(env, 'MOON_TREK_TERRAIN_MAX_ZOOM', 8, 0, 14),
    // L'adresse de l'USGS, lue
    usgsBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_USGS_BASE_URL',
      // avec cette valeur par défaut ;
      'https://planetarymaps.usgs.gov/cgi-bin/mapserv',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // La carte de l'USGS.
    usgsMap: readString(env, 'MOON_USGS_MAP', '/maps/earth/moon_simp_cyl.map'),
    // Le niveau maximal de l'USGS : 7 par défaut, de 0 à 12.
    usgsMaxZoom: readInt(env, 'MOON_USGS_MAX_ZOOM', 7, 0, 12),
    // L'adresse des capacités de LROC Lunaserv, lue
    lrocCapabilitiesUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_LROC_CAPABILITIES_URL',
      // avec cette valeur par défaut.
      'https://wms.im-ldi.com/lunaserv/wms',
    // Fin de la lecture.
    ),
    // L'adresse des requêtes GetMap de LROC Lunaserv, lue
    lrocGetMapUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_LROC_GETMAP_URL',
      // avec cette valeur par défaut (le service WMS de LunaServ ; la racine n'accepte que la 1.1.1 et ne porte pas les couches lunaires).
      'https://wms.im-ldi.com/lunaserv/wms',
    // Fin de la lecture.
    ),
    // Le niveau maximal de LROC Lunaserv : 7 par défaut, de 0 à 12.
    lrocMaxZoom: readInt(env, 'MOON_LROC_MAX_ZOOM', 7, 0, 12),
    // Le modèle d'adresse OpenPlanetaryMap, lu
    opmTileUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_OPM_TILE_URL',
      // avec cette valeur par défaut.
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png',
    // Fin de la lecture.
    ),
    // Le niveau maximal d'OpenPlanetaryMap : 7 par défaut, de 0 à 14.
    opmMaxZoom: readInt(env, 'MOON_OPM_MAX_ZOOM', 7, 0, 14),
    // Le délai d'un appel : 20 s par défaut, de 1 s à 120 s.
    httpTimeoutMs: readInt(env, 'MOON_HTTP_TIMEOUT_MS', 20_000, 1_000, 120_000),
    // Le délai d'un test de santé, lu
    healthTimeoutMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_HEALTH_TIMEOUT_MS',
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
      'MOON_USER_AGENT',
      // avec cette valeur par défaut.
      'space-backend-moon/1.0 (+https://nestjs.com)',
    // Fin de la lecture.
    ),
    // Le nombre de tuiles en cache, lu
    tileCacheEntries: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_TILE_CACHE_ENTRIES',
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
      'MOON_TILE_CACHE_TTL_MS',
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
      'MOON_CAPABILITIES_CACHE_TTL_MS',
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
      'MOON_MAX_UPSTREAM_BYTES',
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
// Fin de loadMoonConfig.
}
