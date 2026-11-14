// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// Dossier des fichiers de dépôts tiers importés dans le projet.
import { VENDOR_DIR } from './local-source';

/** Configuration de l'application, lue une seule fois au démarrage depuis l'environnement. */
// Forme de la configuration de l'application.
export interface AppConfig {
  // port : le port d'écoute du serveur.
  port: number;
  /** `true` = toutes les origines (développement). */
  // corsOrigins : les origines autorisées à appeler l'API, ou true pour toutes.
  corsOrigins: string[] | true;
  // throttle : la limite de débit, soit « limit » requêtes par fenêtre de « ttlMs » millisecondes.
  throttle: { ttlMs: number; limit: number };
  // tiles : les réglages des tuiles de carte.
  tiles: {
    // gibs : adresse de base de NASA GIBS (la Terre).
    gibs: { baseUrl: string };
    /** Tuiles de la Lune (NASA Moon Trek), indépendantes du fournisseur de la Terre. */
    // moon : adresse de base des tuiles de la Lune.
    moon: { baseUrl: string };
    /** Tuiles de Mars (NASA Mars Trek), indépendantes du fournisseur de la Terre. */
    // mars : adresse de base des tuiles de Mars.
    mars: { baseUrl: string };
    /** Cache disque des tuiles de la Lune et préchargement au démarrage (niveaux 0 à prefetchMaxZoom, -1 = aucun). */
    // moonCache : dossier du cache, niveau maximal préchargé, téléchargements simultanés.
    moonCache: { dir: string; prefetchMaxZoom: number; prefetchConcurrency: number };
    /** Couleurs naturelles de la Lune : image 2:1 équirectangulaire (JPEG, PNG, ou TIFF converti par le serveur). */
    // moonColorUrl : adresse de l'image des couleurs de la Lune.
    moonColorUrl: string;
    /** Largeur, en pixels, de la carte couleur servie : une source TIFF est convertie en JPEG à cette largeur. */
    // moonColorWidth : largeur de la carte couleur servie.
    moonColorWidth: number;
    /** Adresses de secours de cette texture, essayées dans l'ordre si `moonColorUrl` échoue. */
    // moonColorFallbackUrls : adresses de secours de cette image.
    moonColorFallbackUrls: string[];
    /** Modèle 3D de la Lune (glTF binaire) affiché en vue d'ensemble. */
    // moonModelUrl : adresse du modèle 3D de la Lune.
    moonModelUrl: string;
  // Fin de tiles.
  };
  /** Pays de World Atlas et frontières : fichier TopoJSON local ou adresse (objet `countries`), Natural Earth via world-atlas par défaut. */
  // borders : le fichier ou l'adresse du TopoJSON des pays, et le nom du jeu de données à afficher.
  borders: { sourceUrl: string; label: string };
  /** Noms des villes : GeoJSON de points, fichier local ou adresse (Natural Earth populated places par défaut). */
  // cityLabels : le fichier ou l'adresse des noms de villes.
  cityLabels: { sourceUrl: string };
  /** API JPL Horizons (position exacte de la Lune). */
  /** Clé api.nasa.gov (secret côté serveur ; DEMO_KEY si absente, très limitée en débit). */
  // nasa : la clé de api.nasa.gov.
  nasa: { apiKey: string };
  /** API de l'U.S. Naval Observatory (phases de la Lune). */
  // usno : l'adresse de l'API des phases de la Lune.
  usno: { url: string };
  /** Nuages de points LiDAR (COPC/LAS) servis en HTTP Range depuis ce répertoire. */
  /** Dons par carte bancaire via Stripe Checkout. */
  // donations : les dons (début).
  donations: {
    // stripe : la clé secrète Stripe, facultative.
    stripe: { secretKey?: string };
    // siteUrls : les sites vers lesquels le donateur peut revenir.
    siteUrls: string[];
    // currency : la devise.
    currency: string;
    // minAmountCents : le montant minimal, en centimes.
    minAmountCents: number;
  // Fin de donations.
  };
  // pointclouds : le dossier des nuages de points.
  pointclouds: { dir: string };
  /** Assistant de la fenêtre « Claude » (API Claude). Sans clé, l'assistant est fermé ; la clé reste côté serveur. */
  // assistant : la clé de l'API Claude (facultative), le modèle et la limite de réponses par jour.
  assistant: { anthropicApiKey?: string; model: string; dailyLimit: number };
// Fin de AppConfig.
}

// Fonction positiveNumber : lit un nombre strictement positif dans une variable d'environnement ; reçoit le nom de la variable, sa valeur brute et la valeur par défaut.
function positiveNumber(name: string, raw: string | undefined, fallback: number): number {
  // Variable absente ou vide : valeur par défaut.
  if (raw === undefined || raw === '') return fallback;
  // Convertit le texte en nombre.
  const n = Number(raw);
  // Si ce n'est pas un nombre fini, ou s'il est nul ou négatif :
  if (!Number.isFinite(n) || n <= 0) {
    // arrête le démarrage avec une erreur qui nomme la variable et montre la valeur reçue.
    throw new Error(`Variable d'environnement ${name} invalide : « ${raw} » (nombre positif attendu)`);
  // Fin de la vérification.
  }
  // Renvoie le nombre.
  return n;
// Fin de positiveNumber.
}

/** Lit et valide l'environnement. Échoue vite, avec un message clair, plutôt que de planter plus tard. */
// Fonction loadConfiguration : reçoit l'environnement (process.env par défaut, remplaçable dans les tests) et renvoie la configuration.
export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Clé secrète Stripe : STRIPE_SECRET_KEY, sans espaces ni guillemets autour ; undefined si elle est vide.
  let stripeSecretKey = env.STRIPE_SECRET_KEY?.trim().replace(/^["'`]+|["'`]+$/g, '').trim() || undefined;
  // Si elle n'a pas la forme d'une clé secrète (début).
  if (stripeSecretKey && !/^[sr]k_(test|live)_[A-Za-z0-9]+$/.test(stripeSecretKey)) {
    // Précision, si c'est la clé publique qui a été collée.
    const hint = stripeSecretKey.startsWith('pk_') ? ' (c’est la clé publique pk_… : il faut la clé secrète)' : '';
    // Avertit dans le journal : les dons restent fermés.
    console.warn(`STRIPE_SECRET_KEY invalide${hint} : clé secrète Stripe attendue (sk_test_… ou sk_live_…), sans rien autour. Les dons restent fermés.`);
    // La clé est ignorée.
    stripeSecretKey = undefined;
  // Fin de ce cas.
  }
  // Sites de retour des dons : DONATION_SITE_URLS, ou les deux sites de Gobai Space,
  const donationSiteUrls = (env.DONATION_SITE_URLS?.trim() || 'https://www.gobaispace.com,https://gobai-space.onrender.com')
    // coupés aux virgules, nettoyés de leurs espaces et de leur barre finale, sans morceau vide.
    .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
  // Liste vide, ou adresse mal formée (début).
  if (!donationSiteUrls.length || donationSiteUrls.some((u) => !/^https?:\/\/[^/]+$/.test(u))) {
    // Erreur de démarrage.
    throw new Error('Variable d’environnement DONATION_SITE_URLS invalide : adresses de site attendues (https://exemple.com), séparées par des virgules');
  // Fin de ce cas.
  }
  // CORS_ORIGIN coupée aux virgules, chaque origine nettoyée de ses espaces, les morceaux vides retirés ; undefined si la variable est absente.
  const cors = env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean);

  // Objet de configuration renvoyé :
  return {
    // port : PORT, ou 3001 par défaut.
    port: positiveNumber('PORT', env.PORT, 3001),
    // corsOrigins : la liste si elle contient au moins une origine, sinon true (toutes les origines).
    corsOrigins: cors && cors.length ? cors : true,
    // Limite de débit :
    throttle: {
      // fenêtre : THROTTLE_TTL_SECONDS (60 par défaut), convertie en millisecondes ;
      ttlMs: positiveNumber('THROTTLE_TTL_SECONDS', env.THROTTLE_TTL_SECONDS, 60) * 1000,
      // nombre de requêtes par fenêtre : THROTTLE_LIMIT (300 par défaut).
      limit: positiveNumber('THROTTLE_LIMIT', env.THROTTLE_LIMIT, 300),
    // Fin de la limite de débit.
    },
    // Réglages des tuiles :
    tiles: {
      // NASA GIBS :
      gibs: {
        // adresse de base : GIBS_BASE_URL ou l'adresse officielle, sans barre oblique finale.
        baseUrl: (env.GIBS_BASE_URL?.trim() || 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best').replace(/\/$/, ''),
      // Fin de gibs.
      },
      // Modèle 3D de la Lune : MOON_MODEL_URL, ou le modèle du NASA Scientific Visualization Studio.
      moonModelUrl: env.MOON_MODEL_URL?.trim() || 'https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb',
      // Couleurs de la Lune : MOON_COLOR_URL, ou la carte LROC 4096×2048 du même studio, pôles renseignés
      // (version 2019 du CGI Moon Kit, fichiers « lroc_color_poles » : les pôles y sont remplis, contrairement
      // à l'aperçu 2k servi avant). Elle est en TIFF, que le navigateur ne décode pas : le serveur la convertit
      // en JPEG une fois, puis la garde sur le disque (voir MoonColorService).
      moonColorUrl: env.MOON_COLOR_URL?.trim() || 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif',
      // Largeur de la carte couleur servie : MOON_COLOR_WIDTH, ou 4096 pixels. Le 4k tient en 33 Mo sur la carte
      // graphique (134 Mo en 8k) : c'est la plus grande taille qui reste sûre sur téléphone.
      moonColorWidth: Number(env.MOON_COLOR_WIDTH) || 4096,
      // Secours : même carte couleur dérivée des données NASA/LRO, importée de three.js r180 dans le projet
      // (fichier local, disponible même si svs.gsfc.nasa.gov est bloqué) ; 1024×512 au lieu de 4096×2048.
      // Une liste vide désactive le secours.
      // Adresses de secours des couleurs : si MOON_COLOR_FALLBACK_URLS n'est pas définie,
      moonColorFallbackUrls: env.MOON_COLOR_FALLBACK_URLS === undefined
        // le fichier local importé de three.js ;
        ? [join(VENDOR_DIR, 'three.js', 'moon_1024.jpg')]
        // sinon la liste donnée, coupée aux virgules, nettoyée, sans morceaux vides (une variable vide donne donc une liste vide : pas de secours).
        : env.MOON_COLOR_FALLBACK_URLS.split(',').map((s) => s.trim()).filter(Boolean),
      // Tuiles de la Lune :
      moon: {
        // adresse de base : MOON_TILES_BASE_URL ou NASA Moon Trek, sans barre finale.
        baseUrl: (env.MOON_TILES_BASE_URL?.trim() || 'https://trek.nasa.gov/tiles/Moon/EQ').replace(/\/$/, ''),
      // Fin de moon.
      },
      // Tuiles de Mars :
      mars: {
        // adresse de base : MARS_TILES_BASE_URL ou NASA Mars Trek, sans barre finale.
        baseUrl: (env.MARS_TILES_BASE_URL?.trim() || 'https://trek.nasa.gov/tiles/Mars/EQ').replace(/\/$/, ''),
      // Fin de mars.
      },
      // Cache disque des tuiles de la Lune :
      moonCache: {
        // dossier : MOON_TILE_CACHE_DIR, ou cache/moon-tiles ;
        dir: env.MOON_TILE_CACHE_DIR?.trim() || 'cache/moon-tiles',
        // niveau maximal préchargé : MOON_PREFETCH_MAX_ZOOM, 4 par défaut, borné entre −1 (aucun) et 10 ;
        prefetchMaxZoom: intInRange(env.MOON_PREFETCH_MAX_ZOOM, 4, -1, 10),
        // téléchargements simultanés : MOON_PREFETCH_CONCURRENCY, 4 par défaut, borné entre 1 et 16.
        prefetchConcurrency: intInRange(env.MOON_PREFETCH_CONCURRENCY, 4, 1, 16),
      // Fin de moonCache.
      },
    // Fin de tiles.
    },
    // Clé NASA : NASA_API_KEY, ou la clé de démonstration DEMO_KEY.
    nasa: { apiKey: env.NASA_API_KEY?.trim() || 'DEMO_KEY' },
    // Adresse de l'observatoire naval : USNO_API_URL ou l'adresse officielle, sans barre finale.
    usno: { url: (env.USNO_API_URL?.trim() || 'https://aa.usno.navy.mil/api').replace(/\/$/, '') },
    // Noms des villes :
    cityLabels: {
      // Version complète (≈ 19 Mo) : seule à fournir les noms dans les écritures locales (NAME_JA, NAME_AR…).
      // La variante « _simple » ne contient que les noms latins : ne pas l'utiliser ici.
      // Fichier importé de Natural Earth 5.1.2 dans le projet (lu sur le disque, plus téléchargé).
      // source : CITY_LABELS_SOURCE_URL si elle est définie,
      sourceUrl: env.CITY_LABELS_SOURCE_URL?.trim()
        // sinon le fichier Natural Earth importé dans le projet.
        || join(VENDOR_DIR, 'natural-earth', 'ne_10m_populated_places.geojson'),
    // Fin de cityLabels.
    },
    // Pays et frontières :
    borders: {
      // Fichier World Atlas importé dans le projet (lu sur le disque, plus téléchargé).
      // source : BORDERS_SOURCE_URL si elle est définie, sinon le fichier World Atlas importé dans le projet ;
      sourceUrl: env.BORDERS_SOURCE_URL?.trim() || join(VENDOR_DIR, 'world-atlas', 'countries-50m.json'),
      // nom affiché : « TopoJSON personnalisé » avec une source personnalisée, sinon le nom du jeu de données par défaut.
      label: env.BORDERS_SOURCE_URL?.trim() ? 'TopoJSON personnalisé' : 'Natural Earth 1:50m · world-atlas 2.0.2',
    // Fin de borders.
    },
    // Dons (début).
    donations: {
      // stripe : la clé secrète.
      stripe: { secretKey: stripeSecretKey },
      // siteUrls : les sites de retour.
      siteUrls: donationSiteUrls,
      // currency : l'euro.
      currency: 'EUR',
      // minAmountCents : 100 centimes.
      minAmountCents: 100,
    // Fin des dons.
    },
    // Dossier des nuages de points : POINTCLOUD_DIR, ou « pointclouds ».
    pointclouds: { dir: env.POINTCLOUD_DIR?.trim() || 'pointclouds' },
    // Assistant :
    assistant: {
      // Clé collée avec des guillemets ou des espaces : on la nettoie.
      // clé de l'API Claude : espaces retirés, guillemets et apostrophes du début et de la fin retirés, espaces retirés de nouveau ; undefined si rien ne reste ;
      anthropicApiKey: env.ANTHROPIC_API_KEY?.trim().replace(/^["'`]+|["'`]+$/g, '').trim() || undefined,
      // Modèle le plus performant par défaut : il lit l'inventaire du DOM et choisit lui-même l'élément sur lequel
      // agir, ce qu'un petit modèle fait moins bien. Il coûte aussi nettement plus par message : la limite
      // journalière ci-dessous est le garde-fou, et ASSISTANT_MODEL permet de redescendre à tout moment.
      // modèle : ASSISTANT_MODEL, ou claude-opus-5-5 ;
      model: env.ASSISTANT_MODEL?.trim() || 'claude-opus-5-5',
      // limite par jour : ASSISTANT_DAILY_LIMIT, 1 000 par défaut.
      dailyLimit: positiveNumber('ASSISTANT_DAILY_LIMIT', env.ASSISTANT_DAILY_LIMIT, 1000),
    // Fin de assistant.
    },
  // Fin de l'objet de configuration.
  };
// Fin de loadConfiguration.
}

// Fonction intInRange : lit un entier dans une variable d'environnement et le ramène entre deux bornes.
function intInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  // Lit un entier en base 10 dans le texte nettoyé (chaîne vide si la variable est absente, ce qui donne NaN).
  const n = Number.parseInt(raw?.trim() ?? '', 10);
  // Si un entier a été lu, le borne entre min et max ; sinon renvoie la valeur par défaut.
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
// Fin de intInRange.
}
