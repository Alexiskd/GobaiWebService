/** Configuration de l'application, lue une seule fois au démarrage depuis l'environnement. */
export interface AppConfig {
  port: number;
  /** `true` = toutes les origines (développement). */
  corsOrigins: string[] | true;
  throttle: { ttlMs: number; limit: number };
  tiles: {
    gibs: { baseUrl: string };
    /** Identifiants OAuth Uber Maps (secret uniquement côté serveur). */
    uber: { clientId?: string; clientSecret?: string; locale: string };
    /** Tuiles de la Lune (NASA Moon Trek), indépendantes du fournisseur de la Terre. */
    moon: { baseUrl: string };
    /** Tuiles de Mars (NASA Mars Trek), indépendantes du fournisseur de la Terre. */
    mars: { baseUrl: string };
    /** Tuiles de Vénus (NASA Venus Trek), indépendantes du fournisseur de la Terre. */
    venus: { baseUrl: string };
    /** Cache disque des tuiles de la Lune et préchargement au démarrage (niveaux 0 à prefetchMaxZoom, -1 = aucun). */
    moonCache: { dir: string; prefetchMaxZoom: number; prefetchConcurrency: number };
    /** Couleurs naturelles de la Lune : image 2:1 équirectangulaire (JPEG/PNG). */
    moonColorUrl: string;
    /** Adresses de secours de cette texture, essayées dans l'ordre si `moonColorUrl` échoue. */
    moonColorFallbackUrls: string[];
    /** Modèle 3D de la Lune (glTF binaire) affiché en vue d'ensemble. */
    moonModelUrl: string;
  };
  /**
   * Imagerie Sentinel-2 sans nuages de l'Union européenne (EOX) : préchargée sur le disque du serveur puis servie en
   * tuiles Web Mercator de 256 px ; hors de l'emprise ou des niveaux couverts, le client utilise la couche terrestre active.
   */
  eu: {
    /** Couche WMTS EOX (millésime de la mosaïque). */
    layer: string;
    /** Modèle d'URL des tuiles, avec `{layer}`, `{z}`, `{x}` et `{y}`. */
    tileUrl: string;
    /** Emprise couverte : [ouest, sud, est, nord] en degrés. */
    bbox: [number, number, number, number];
    /** Dernier niveau servi par l'imagerie européenne. */
    maxZoom: number;
    /** Budget du préchargement disque (nombre de tuiles). */
    prefetchMaxTiles: number;
    /** Débit du préchargement (tuiles par seconde). */
    prefetchRate: number;
  };
  /** Frontières des pays : fichier TopoJSON (objet `countries`), Natural Earth via world-atlas par défaut. */
  borders: { sourceUrl: string; label: string };
  /** Noms des villes : GeoJSON de points (Natural Earth populated places par défaut). */
  cityLabels: { sourceUrl: string };
  /** API JPL Horizons (position exacte de la Lune). */
  horizons: { url: string };
  /** API de l'U.S. Naval Observatory (phases de la Lune). */
  usno: { url: string };
  /** Danuri (KPLO) : archive PDS de ShadowCam (mosaïques des cratères en ombre permanente). */
  danuri: { shadowcamPdsUrl: string };
  /** Signalisation WebRTC : relais des offres SDP et candidats ICE (aucune donnée d'application ne transite). */
  p2p: { maxPeers: number; maxRooms: number; iceServers: IceServerConfig[] };
  donations: {
    paypalDonateEnvironment: 'sandbox' | 'production';
    paypalHostedButtonId?: string;
    paypalBusiness?: string;
  };
}

/** Entrée `iceServers` rendue au navigateur (même forme que RTCIceServer, sans dépendance DOM côté serveur). */
export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

function positiveNumber(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Variable d'environnement ${name} invalide : « ${raw} » (nombre positif attendu)`);
  }
  return n;
}

/** Lit et valide l'environnement. Échoue vite, avec un message clair, plutôt que de planter plus tard. */
export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const cors = env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);
  const paypalHostedButtonId = env.PAYPAL_DONATE_HOSTED_BUTTON_ID?.trim() || undefined;
  const paypalBusiness = env.PAYPAL_DONATE_BUSINESS?.trim() || undefined;
  if (paypalHostedButtonId && paypalBusiness) {
    throw new Error('Configurez PAYPAL_DONATE_HOSTED_BUTTON_ID ou PAYPAL_DONATE_BUSINESS, pas les deux');
  }
  const paypalDonateEnvironment = env.PAYPAL_DONATE_ENV?.trim() || 'production';
  if (paypalDonateEnvironment !== 'sandbox' && paypalDonateEnvironment !== 'production') {
    throw new Error('Variable d’environnement PAYPAL_DONATE_ENV invalide : sandbox ou production attendu');
  }

  return {
    port: positiveNumber('PORT', env.PORT, 3001),
    corsOrigins: cors && cors.length ? cors : true,
    throttle: {
      ttlMs: positiveNumber('THROTTLE_TTL_SECONDS', env.THROTTLE_TTL_SECONDS, 60) * 1000,
      limit: positiveNumber('THROTTLE_LIMIT', env.THROTTLE_LIMIT, 300),
    },
    tiles: {
      uber: {
        clientId: env.UBER_CLIENT_ID?.trim() || undefined,
        clientSecret: env.UBER_CLIENT_SECRET?.trim() || undefined,
        locale: env.UBER_MAPS_LOCALE?.trim() || 'fr-FR',
      },
      gibs: {
        baseUrl: (env.GIBS_BASE_URL?.trim() || 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best').replace(/\/$/, ''),
      },
      moonModelUrl: env.MOON_MODEL_URL?.trim() || 'https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb',
      moonColorUrl: env.MOON_COLOR_URL?.trim() || 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
      // Secours : même carte couleur dérivée des données NASA/LRO, hébergée sur un CDN accessible même si
      // svs.gsfc.nasa.gov est bloqué ; 1024×512 au lieu de 2048×1024. Une liste vide désactive le secours.
      moonColorFallbackUrls: env.MOON_COLOR_FALLBACK_URLS === undefined
        ? ['https://cdn.jsdelivr.net/gh/mrdoob/three.js@r180/examples/textures/planets/moon_1024.jpg']
        : env.MOON_COLOR_FALLBACK_URLS.split(',').map((s) => s.trim()).filter(Boolean),
      moon: {
        baseUrl: (env.MOON_TILES_BASE_URL?.trim() || 'https://trek.nasa.gov/tiles/Moon/EQ').replace(/\/$/, ''),
      },
      mars: {
        baseUrl: (env.MARS_TILES_BASE_URL?.trim() || 'https://trek.nasa.gov/tiles/Mars/EQ').replace(/\/$/, ''),
      },
      venus: {
        baseUrl: (env.VENUS_TILES_BASE_URL?.trim() || 'https://trek.nasa.gov/tiles/Venus/EQ').replace(/\/$/, ''),
      },
      moonCache: {
        dir: env.MOON_TILE_CACHE_DIR?.trim() || 'cache/moon-tiles',
        prefetchMaxZoom: intInRange(env.MOON_PREFETCH_MAX_ZOOM, 4, -1, 10),
        prefetchConcurrency: intInRange(env.MOON_PREFETCH_CONCURRENCY, 4, 1, 16),
      },
    },
    eu: {
      layer: env.EU_TILE_LAYER?.trim() || 's2cloudless-2016_3857',
      tileUrl: env.EU_TILE_URL?.trim() || 'https://tiles.maps.eox.at/wmts/1.0.0/{layer}/default/g/{z}/{y}/{x}.jpg',
      bbox: parseBbox(env.EU_BBOX, [-25, 34, 45, 72]),
      maxZoom: intInRange(env.EU_MAX_ZOOM, 11, 0, 22),
      prefetchMaxTiles: intInRange(env.EU_PREFETCH_MAX_TILES, 200_000, 0, 1_000_000),
      prefetchRate: positiveNumber('EU_PREFETCH_RATE', env.EU_PREFETCH_RATE, 20),
    },
    horizons: { url: env.HORIZONS_URL?.trim() || 'https://ssd.jpl.nasa.gov/api/horizons.api' },
    danuri: { shadowcamPdsUrl: (env.SHADOWCAM_PDS_URL?.trim() || 'https://pds.shadowcam.im-ldi.com').replace(/\/$/, '') },
    usno: { url: (env.USNO_API_URL?.trim() || 'https://aa.usno.navy.mil/api').replace(/\/$/, '') },
    cityLabels: {
      // Version complète (≈ 19 Mo) : seule à fournir les noms dans les écritures locales (NAME_JA, NAME_AR…).
      // La variante « _simple » ne contient que les noms latins : ne pas l'utiliser ici.
      sourceUrl: env.CITY_LABELS_SOURCE_URL?.trim()
        || 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_10m_populated_places.geojson',
    },
    borders: {
      sourceUrl: env.BORDERS_SOURCE_URL?.trim() || 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json',
      label: env.BORDERS_SOURCE_URL?.trim() ? 'TopoJSON personnalisé' : 'Natural Earth 1:50m · world-atlas 2.0.2',
    },
    p2p: {
      maxPeers: intInRange(env.P2P_MAX_PEERS, 8, 2, 16),
      maxRooms: intInRange(env.P2P_MAX_ROOMS, 1000, 1, 100_000),
      iceServers: iceServers(env),
    },
    donations: {
      paypalDonateEnvironment,
      paypalHostedButtonId,
      paypalBusiness,
    },
  };
}

/**
 * Serveurs ICE donnés aux navigateurs. Sans TURN, deux pairs derrière des NAT symétriques ne peuvent pas se joindre ;
 * un TURN est donc recommandé en production (`P2P_TURN_URL`, `P2P_TURN_USERNAME`, `P2P_TURN_CREDENTIAL`).
 */
function iceServers(env: NodeJS.ProcessEnv): IceServerConfig[] {
  const stun = (env.P2P_STUN_URLS?.trim() || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const servers: IceServerConfig[] = stun.length ? [{ urls: stun }] : [];
  const turn = env.P2P_TURN_URL?.trim();
  if (turn) {
    servers.push({
      urls: turn,
      username: env.P2P_TURN_USERNAME?.trim() || undefined,
      credential: env.P2P_TURN_CREDENTIAL?.trim() || undefined,
    });
  }
  return servers;
}

function intInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Emprise géographique « ouest,sud,est,nord » (degrés) : validée pour éviter un préchargement aberrent. */
function parseBbox(
  raw: string | undefined,
  fallback: [number, number, number, number],
): [number, number, number, number] {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parts = raw.split(',').map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`Variable d'environnement EU_BBOX invalide : « ${raw} » (4 nombres attendus : ouest,sud,est,nord)`);
  }
  const [w, s, e, n] = parts as [number, number, number, number];
  if (!(w < e && s < n)) {
    throw new Error(`Variable d'environnement EU_BBOX incohérente : « ${raw} » (ouest < est et sud < nord attendus)`);
  }
  return [w, s, e, n];
}
