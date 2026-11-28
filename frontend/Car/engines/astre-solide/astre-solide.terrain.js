/**
 * Relief en volume du globe CesiumJS : celui de la Terre (altitudes AWS Terrain Tiles, format Terrarium, Web Mercator,
 * libres et sans clé, déjà la source de secours du relief de l'app) et celui des autres astres solides (Lune, Mars,
 * Mercure, Vénus : tuiles Terrarium servies par le relais du serveur, découpage géographique 2^(z+1) × 2^z de
 * l'astre — le même que le globe). Chaque point de la grille d'une tuile est lu dans la tuile Terrarium qui le
 * contient (au plus le niveau le plus fin de la source : plus fin, les tuiles de ce niveau sont réutilisées). La mer
 * de la Terre reste plate (altitudes négatives ramenées à 0) ; les autres astres ont un relief signé (les bassins
 * creusent sous la sphère de référence). Calculs purs testés ; le chargement des images est injecté.
 */

// Déclare et exporte l'adresse des tuiles d'altitude.
export const TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// Déclare et exporte le niveau le plus fin téléchargé (≈ 38 m par pixel à l'équateur).
export const TERRAIN_MAX_LEVEL = 12;
// Déclare et exporte la taille de la grille d'altitudes d'une tuile CesiumJS (points par côté).
export const HEIGHTMAP_SIZE = 65;
// Déclare et exporte le nombre de tuiles décodées gardées en mémoire (≈ 34 Mo de pixels au plus).
export const TERRAIN_CACHE = 128;

/** Plus grande latitude des tuiles Web Mercator (degrés) : au-delà, l'altitude du bord est reprise. */
// Déclare et exporte la latitude limite.
export const MERCATOR_MAX_LAT = 85.0511287798;
/** Nombre maximal de tuiles Terrarium lues pour une tuile du globe (sinon un niveau plus grossier est pris). */
// Déclare et exporte le nombre maximal de tuiles sources.
export const MAX_SOURCES = 4;

/** Pixel global (flottant) d'un point au niveau z (tuiles de 256 pixels, Web Mercator). */
// Déclare et exporte mercatorPixel : longitude, latitude (degrés) et niveau (début).
export function mercatorPixel(lon, lat, z) {
  // Nombre de pixels sur un tour.
  const n = 256 * 2 ** z;
  // Latitude bornée aux limites du Web Mercator, en radians.
  const phi = (Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat)) * Math.PI) / 180;
  // Pixel horizontal et vertical (nord en haut), bornés à la carte.
  return { x: Math.min(n - 1, Math.max(0, ((lon + 180) / 360) * n)), y: Math.min(n - 1, Math.max(0, ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n)) };
// Fin de mercatorPixel.
}

/**
 * Plan d'une tuile du globe (découpage géographique de CesiumJS : 2 × 1 tuiles au niveau 0) : les points de sa
 * grille (bords compris), le niveau Terrarium (celui dont les tuiles ont la même largeur, au plus 12, plus grossier si
 * plus de MAX_SOURCES tuiles seraient lues — près des pôles) et, pour chaque point, sa tuile source et son pixel.
 */
// Déclare et exporte tilePlan : x, y, niveau du globe et taille de la grille (début).
export function tilePlan(x, y, level, out = HEIGHTMAP_SIZE) {
  // Taille de la tuile (degrés), bord ouest et bord nord.
  const span = 180 / 2 ** level, west = -180 + x * span, north = 90 - y * span;
  // Niveau Terrarium de départ : même largeur de tuile, au plus le niveau le plus fin.
  for (let z = Math.min(TERRAIN_MAX_LEVEL, level + 1); z >= 0; z--) {
    // Pixels et tuiles des points.
    const pts = [], tiles = new Map();
    // Pour chaque point de la grille (début).
    for (let j = 0; j < out; j++) for (let i = 0; i < out; i++) {
      // Pixel global du point (un point du bord est et sud reste dans la tuile de l'intérieur).
      const p = mercatorPixel(west + (i / (out - 1)) * span, north - (j / (out - 1)) * span, z);
      // Pixel entier (pour la tuile), tuile et position dans la tuile, avec sa fraction (lecture bilinéaire).
      const ix = Math.min(Math.floor(p.x), 256 * 2 ** z - 1), iy = Math.min(Math.floor(p.y), 256 * 2 ** z - 1);
      // Clé de la tuile.
      const key = `${z}/${ix >> 8}/${iy >> 8}`;
      // Tuile notée.
      if (!tiles.has(key)) tiles.set(key, { z, x: ix >> 8, y: iy >> 8 });
      // Point noté : position flottante dans la tuile (0 … < 256).
      pts.push({ key, u: Math.min(p.x - (ix & ~255), 255.999), v: Math.min(p.y - (iy & ~255), 255.999) });
    // Fin des points.
    }
    // Assez peu de tuiles (ou le niveau 0) : ce plan.
    if (tiles.size <= MAX_SOURCES || z === 0) return { z, tiles: [...tiles.entries()], points: pts };
  // Fin des niveaux.
  }
  // Jamais atteint.
  return null;
// Fin de tilePlan.
}

/** Altitude (m) d'un pixel Terrarium ; la mer est ramenée à 0 (elle reste plate), sauf si le relief est signé. */
// Déclare et exporte terrariumAt : les pixels RGBA, leur côté, le pixel (u, v) dans une tuile de 256, et « signé » (début).
export function terrariumAt(rgba, size, u, v, signed = false) {
  // Position en pixels de l'image (tuiles de 256 ou de 512 pixels) : un point entier tombe pile sur son pixel.
  const fx = Math.min(size - 1, Math.max(0, (u * size) / 256)), fy = Math.min(size - 1, Math.max(0, (v * size) / 256));
  // Les quatre pixels voisins (bornés à la tuile) et les poids.
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1), ax = fx - x0, ay = fy - y0;
  // Altitude décodée d'un pixel (R × 256 + G + B / 256 − 32768).
  const at = (x, y) => { const k = (y * size + x) * 4; return rgba[k] * 256 + rgba[k + 1] + rgba[k + 2] / 256 - 32768; };
  // Lecture bilinéaire : le relief suit la pente au lieu de marches d'escalier quand le globe zoome plus fin que la
  // donnée (Lune au-delà du niveau 8, Vénus au-delà du 5…).
  const h = (at(x0, y0) * (1 - ax) + at(x1, y0) * ax) * (1 - ay) + (at(x0, y1) * (1 - ax) + at(x1, y1) * ax) * ay;
  // Renvoie l'altitude, ramenée à 0 sous la mer si le relief n'est pas signé (la mer de la Terre reste plate) ;
  // signé (Lune, Mars, Mercure, Vénus) : les bassins creusent sous la sphère de référence.
  return signed ? h : Math.max(0, h);
// Fin de terrariumAt.
}

/**
 * Plan d'une tuile du globe d'un astre autre que la Terre, en découpage géographique (2^(z+1) × 2^z tuiles au niveau z,
 * le même que celui des images et du relief de l'astre — comme sur la Terre, où le relief est aussi lu en grille
 * géographique). Les tuiles d'altitude de l'astre sont lues au niveau du globe, au plus maxZoom de sa source : au-delà,
 * la tuile de ce niveau est reprise (lue en bilinéaire).
 * @param {number} x colonne, {number} y ligne, {number} level niveau du globe, {object} o { maxZoom }, out taille de la grille
 */
// Déclare et exporte bodyTilePlan : la colonne, la ligne, le niveau, les bornes de la source et la taille (début).
export function bodyTilePlan(x, y, level, { maxZoom = 12 } = {}, out = HEIGHTMAP_SIZE) {
  // Taille de la tuile du globe (degrés), bord ouest et bord nord.
  const span = 180 / 2 ** level, west = -180 + x * span, north = 90 - y * span;
  // Niveau des tuiles sources : celui du globe (même découpage, le serveur sert les niveaux 0 à maxZoom), au plus
  // maxZoom. minZoom n'est plus imposé aux niveaux grossiers : il faisait lire 64 tuiles du niveau 3 pour une seule
  // tuile racine du globe (cache saturé, téléchargements en boucle, globe sans relief si une seule échouait).
  const z = Math.min(maxZoom, level);
  // Pixels et tuiles des points.
  const pts = [], tiles = new Map();
  // Nombre de pixels sur un tour au niveau source.
  const n = 256 * 2 ** z;
  // Pour chaque point de la grille (début).
  for (let j = 0; j < out; j++) for (let i = 0; i < out; i++) {
    // Longitude et latitude du point (un point du bord est et sud reste dans la tuile de l'intérieur).
    const lon = west + (i / (out - 1)) * span, lat = north - (j / (out - 1)) * span;
    // Pixel global du point, borné à la carte.
    const px = Math.min(n - 1, Math.max(0, ((lon + 180) / 360) * n));
    const py = Math.min(n - 1, Math.max(0, ((90 - lat) / 180) * n));
    // Pixel entier (pour la tuile), tuile et position dans la tuile, avec sa fraction (lecture bilinéaire).
    const ix = Math.min(Math.floor(px), n - 1), iy = Math.min(Math.floor(py), n - 1);
    // Clé de la tuile.
    const key = `${z}/${ix >> 8}/${iy >> 8}`;
    // Tuile notée.
    if (!tiles.has(key)) tiles.set(key, { z, x: ix >> 8, y: iy >> 8 });
    // Point noté : position flottante dans la tuile (0 … < 256).
    pts.push({ key, u: Math.min(px - (ix & ~255), 255.999), v: Math.min(py - (iy & ~255), 255.999) });
  // Fin des points.
  }
  // Renvoie le niveau source, ses tuiles et les points.
  return { z, tiles: [...tiles.entries()], points: pts };
// Fin de bodyTilePlan.
}

/**
 * Grille d'altitudes d'une tuile du globe à partir de son plan. Les tuiles sources sont attendues ensemble ; si l'une
 * échoue (réseau, serveur), une tuile fine est refusée — CesiumJS reprend alors le relief de sa tuile parente,
 * agrandi —, et une tuile racine (niveau 0, sans parente) est rendue plate là où la donnée manque, pour que le globe
 * s'affiche toujours. Avant : le moindre échec d'une tuile racine laissait le globe sans relief, voire troué.
 * @param {object} plan le plan (tilePlan ou bodyTilePlan)
 * @param {Function} get (tuile source) → promesse de { rgba, size }
 * @param {number} level niveau de la tuile du globe
 * @param {boolean} signed relief signé
 */
// Déclare et exporte heightsFor, asynchrone (début).
export async function heightsFor(plan, get, level, signed = false) {
  // Tuiles sources : réussies ou en échec, sans tout arrêter.
  const got = await Promise.allSettled(plan.tiles.map(([, t]) => get(t)));
  // Images décodées par clé (null si en échec).
  const imgs = new Map(plan.tiles.map(([key], i) => [key, got[i].status === 'fulfilled' ? got[i].value : null]));
  // Une tuile en échec sur une tuile fine : refusée (CesiumJS agrandit la parente).
  if (level > 0 && [...imgs.values()].some((img) => !img)) throw new Error('relief : tuile source indisponible');
  // Grille d'altitudes.
  const h = new Float32Array(plan.points.length);
  // Chaque point lu dans sa tuile (0 m si la tuile manque, au niveau 0 seulement).
  plan.points.forEach((p, i) => { const img = imgs.get(p.key); h[i] = img ? terrariumAt(img.rgba, img.size, p.u, p.v, signed) : 0; });
  // Renvoie la grille.
  return h;
// Fin de heightsFor.
}

/**
 * Fournisseur de relief CesiumJS d'un astre solide autre que la Terre (Lune, Mars, Mercure, Vénus) : tuiles Terrarium
 * servies par le relais du serveur (`/api/v1/tiles/relief/<astre>/{z}/{x}/{y}.png`, ou moon-relief pour la Lune),
 * dans le découpage géographique 2^(z+1) × 2^z de l'astre — le même découpage que le globe (GeographicTilingScheme).
 * `load` (adresse → { rgba, size }) peut être remplacé (tests). Les tuiles décodées sont gardées (64 au plus).
 * @param {object} Cesium la bibliothèque CesiumJS
 * @param {object} ellipsoid l'ellipsoïde de l'astre
 * @param {object} o { template, maxZoom, signed, credit }
 */
// Déclare et exporte createBodyTerrainProvider : CesiumJS, l'ellipsoïde, la source et le chargeur (début).
export function createBodyTerrainProvider(Cesium, ellipsoid, { template, maxZoom = 12, signed = false, credit = 'Relief : tuiles Terrarium du serveur (NASA Trek)' }, load = loadPixels) {
  // Tuiles décodées (promesses), de la plus ancienne à la plus récente.
  const cache = new Map();
  // tile : la tuile source décodée, gardée (début).
  const tile = (z, x, y) => {
    // Clé.
    const key = `${z}/${x}/${y}`;
    // Déjà demandée : la même promesse, remise en fin (la plus récente).
    let p = cache.get(key);
    // Trouvée : remise en fin.
    if (p) { cache.delete(key); cache.set(key, p); return p; }
    // Demandée : adresse remplie.
    p = load(template.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    // Un échec est oublié (nouvel essai plus tard).
    p.catch(() => cache.delete(key));
    // Gardée ; la plus ancienne part au-delà de la limite.
    cache.set(key, p); if (cache.size > TERRAIN_CACHE) cache.delete(cache.keys().next().value);
    // Renvoyée.
    return p;
  // Fin de tile.
  };
  // Fournisseur CesiumJS (début).
  return new Cesium.CustomHeightmapTerrainProvider({
    // Grille de 65 × 65 points, découpage géographique (2 × 1 tuiles au niveau 0), mention de la source.
    width: HEIGHTMAP_SIZE, height: HEIGHTMAP_SIZE, tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid }), credit,
    // Altitudes d'une tuile (début).
    callback: async (x, y, level) => {
      // Plan : tuiles sources et pixels des points.
      const plan = bodyTilePlan(x, y, level, { maxZoom });
      // Grille d'altitudes, lue dans les tuiles sources (voir heightsFor : une tuile en échec ne casse pas le globe).
      return heightsFor(plan, (t) => tile(t.z, t.x, t.y), level, signed);
    // Fin de la tuile.
    },
  // Fin du fournisseur.
  });
// Fin de createBodyTerrainProvider.
}

/** Pixels RGBA d'une image PNG téléchargée (navigateur : createImageBitmap + OffscreenCanvas ou canvas). */
// loadPixels, asynchrone : l'adresse (début).
async function loadPixels(url) {
  // Téléchargement.
  const res = await fetch(url);
  // Refus : erreur.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Image décodée.
  const bmp = await createImageBitmap(await res.blob());
  // Toile hors écran si possible, sinon une toile du document.
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  // Contexte 2D.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Image dessinée.
  ctx.drawImage(bmp, 0, 0); bmp.close?.();
  // Pixels et côté.
  return { rgba: ctx.getImageData(0, 0, bmp.width, bmp.height).data, size: bmp.width };
// Fin de loadPixels.
}

/**
 * Fournisseur de relief CesiumJS de la Terre. `load` (adresse → { rgba, size }) peut être remplacé (tests). `signed` :
 * fond des océans en relief (bathymétrie des tuiles AWS, GEBCO / ETOPO) au lieu d'une mer plate. Les tuiles
 * décodées sont gardées (64 au plus) : les tuiles plus fines que le niveau 12 réutilisent leur ancêtre.
 */
// Déclare et exporte createTerrainProvider : CesiumJS, l'ellipsoïde et le chargeur (début).
export function createTerrainProvider(Cesium, ellipsoid, load = loadPixels, { signed = false } = {}) {
  // Tuiles décodées (promesses), de la plus ancienne à la plus récente.
  const cache = new Map();
  // tile : la tuile source décodée, gardée (début).
  const tile = (z, x, y) => {
    // Clé.
    const key = `${z}/${x}/${y}`;
    // Déjà demandée : la même promesse, remise en fin (la plus récente).
    let p = cache.get(key);
    // Trouvée : remise en fin.
    if (p) { cache.delete(key); cache.set(key, p); return p; }
    // Demandée.
    p = load(TERRAIN_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    // Un échec est oublié (nouvel essai plus tard).
    p.catch(() => cache.delete(key));
    // Gardée ; la plus ancienne part au-delà de la limite.
    cache.set(key, p); if (cache.size > TERRAIN_CACHE) cache.delete(cache.keys().next().value);
    // Renvoyée.
    return p;
  // Fin de tile.
  };
  // Fournisseur CesiumJS (début).
  return new Cesium.CustomHeightmapTerrainProvider({
    // Grille de 65 × 65 points, découpage géographique (le globe entier, pôles compris), mention de la source.
    width: HEIGHTMAP_SIZE, height: HEIGHTMAP_SIZE, tilingScheme: new Cesium.GeographicTilingScheme({ ellipsoid }), credit: 'Relief : AWS Terrain Tiles (Mapzen, USGS, SRTM…)',
    // Altitudes d'une tuile (début).
    callback: async (x, y, level) => {
      // Plan : tuiles sources et pixels des points.
      const plan = tilePlan(x, y, level);
      // Grille d'altitudes, lue dans les tuiles sources (voir heightsFor : une tuile en échec ne casse pas le globe).
      return heightsFor(plan, (t) => tile(t.z, t.x, t.y), level, signed);
    // Fin de la tuile.
    },
  // Fin du fournisseur.
  });
// Fin de createTerrainProvider.
}
