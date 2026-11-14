// Paris en 3D : calculs purs (testés dans paris3dMath.test.jsx), sans three.js ni navigateur.
//
// Même source que le TP iTowns de l'IGN (github.com/IGNF/TP_iTowns) : les bâtiments de la BD TOPO® v3, servis en
// GeoJSON par le service WFS de la Géoplateforme (couche BDTOPO_V3:batiment), avec leur hauteur. Chaque bâtiment est
// extrudé de son emprise au sol jusqu'à sa hauteur, puis allégé (contours simplifiés, petits bâtiments écartés). Paris est
// découpée selon les tuiles de la carte (niveau 16, ≈ 400 m) ; seuls les carreaux dans le champ de la caméra sont chargés.

// Importe lonLatToXYZ, la conversion d'une longitude et d'une latitude en point de la sphère unité, depuis mercator.
import { lonLatToXYZ } from './tiles/mercator';
// Importe EARTH_RADIUS_M, le rayon de la Terre en mètres, depuis gps.
import { EARTH_RADIUS_M } from './gps';

/** Emprise de Paris (degrés) : la ville entière, bois de Boulogne et de Vincennes compris. */
// Déclare et exporte l'emprise de Paris : ouest, sud, est, nord.
export const PARIS_BOUNDS = { west: 2.224, south: 48.815, east: 2.47, north: 48.903 };
/**
 * Niveau des carreaux : le découpage est celui des tuiles de la carte (Web Mercator, comme les images de la Terre),
 * au niveau 16, soit des carreaux d'environ 400 m de côté à Paris. Un carreau de bâtiments couvre exactement une tuile
 * de la carte de ce niveau.
 */
// Déclare et exporte le niveau des carreaux : 16.
export const TILE_Z = 16;
/** Altitude de la caméra (m) sous laquelle les bâtiments sont chargés et dessinés : 4 km. */
// Déclare et exporte l'altitude d'affichage : 4 000 m.
export const SHOW_ALTITUDE_M = 4000;
/** Hauteur par défaut d'un bâtiment sans hauteur ni nombre d'étages (m). */
// Déclare et exporte la hauteur par défaut : 6 m.
export const DEFAULT_HEIGHT_M = 6;
/** Hauteur d'un étage (m), quand seule l'information du nombre d'étages existe. */
// Déclare et exporte la hauteur d'un étage : 3 m.
export const FLOOR_M = 3;
/** Nombre maximal de bâtiments demandés par carreau (un carreau dense du centre en compte environ 1 500). */
// Déclare et exporte la limite de bâtiments par requête : 5 000.
export const WFS_COUNT = 5000;
/** Allègement : tolérance de simplification des contours (m), au-delà de laquelle un point est gardé. */
// Déclare et exporte la tolérance de simplification : 1 m.
export const SIMPLIFY_M = 1;
/** Allègement : emprise au sol minimale d'un bâtiment, et d'une cour intérieure (m²) ; plus petit, il est écarté. */
// Déclare et exporte l'emprise minimale : 25 m².
export const MIN_AREA_M2 = 25;
/** Adresse du service WFS de la Géoplateforme de l'IGN. */
// Déclare et exporte l'adresse du service WFS.
export const WFS_URL = 'https://data.geopf.fr/wfs/ows';
/** Couche des bâtiments de la BD TOPO v3. */
// Déclare et exporte le nom de la couche des bâtiments.
export const WFS_LAYER = 'BDTOPO_V3:batiment';

// Mètres par degré de latitude.
const M_PER_DEG = (Math.PI * EARTH_RADIUS_M) / 180;

/** Colonne et ligne (fractionnaires) d'un point dans les tuiles Web Mercator du niveau z. */
// Déclare et exporte mercatorXY : la longitude, la latitude et le niveau.
export function mercatorXY(lon, lat, z = TILE_Z) {
  // Nombre de tuiles par côté.
  const n = 2 ** z;
  // Latitude en radians, bornée à celle de la projection.
  const la = Math.max(-85.05112878, Math.min(85.05112878, lat)) * (Math.PI / 180);
  // Colonne et ligne.
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n };
// Fin de mercatorXY.
}

/** Tuile du niveau 16 qui contient un point. */
// Déclare et exporte tileIndexAt : la longitude et la latitude.
export function tileIndexAt(lon, lat) {
  // Position fractionnaire.
  const { x, y } = mercatorXY(lon, lat);
  // Arrondie vers le bas.
  return { x: Math.floor(x), y: Math.floor(y) };
// Fin de tileIndexAt.
}

/** Emprise d'une tuile du niveau 16 (degrés), avec son centre. */
// Déclare et exporte tileBounds : la colonne et la ligne.
export function tileBounds(x, y, z = TILE_Z) {
  // Nombre de tuiles par côté.
  const n = 2 ** z;
  // Latitude du bord nord d'une ligne.
  const latOf = (row) => Math.atan(Math.sinh(Math.PI * (1 - (2 * row) / n))) * (180 / Math.PI);
  // Les quatre bords.
  const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180, north = latOf(y), south = latOf(y + 1);
  // Renvoie les bords et le centre.
  return { west, east, north, south, lon: (west + east) / 2, lat: (north + south) / 2 };
// Fin de tileBounds.
}

/** Tuiles qui couvrent Paris : colonnes x0 à x1, lignes y0 à y1 (le nord a la plus petite ligne). */
// Déclare et exporte la grille de Paris (début).
export const GRID = (() => {
  // Coin nord-ouest et coin sud-est.
  const nw = tileIndexAt(PARIS_BOUNDS.west, PARIS_BOUNDS.north), se = tileIndexAt(PARIS_BOUNDS.east, PARIS_BOUNDS.south);
  // Renvoie les bornes.
  return { x0: nw.x, x1: se.x, y0: nw.y, y1: se.y };
// Fin de la grille.
})();

/** Distance au sol approchée (m) entre deux points proches. */
// Déclare et exporte groundDistance : deux longitudes et deux latitudes.
export function groundDistance(lon1, lat1, lon2, lat2) {
  // Écart est-ouest, en mètres, à la latitude moyenne.
  const dx = (lon2 - lon1) * M_PER_DEG * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  // Écart nord-sud, en mètres.
  const dy = (lat2 - lat1) * M_PER_DEG;
  // Renvoie la distance.
  return Math.hypot(dx, dy);
// Fin de groundDistance.
}

/**
 * Portée (m) autour du point survolé dans laquelle on cherche les carreaux du champ de la caméra : assez loin pour
 * une vue 3/4 vers l'horizon, bornée entre 800 m et 4 km.
 */
// Déclare et exporte viewRange : l'altitude de la caméra en mètres.
export const viewRange = (altitudeM) => Math.min(4000, Math.max(800, altitudeM * 6));

/**
 * Tuiles de Paris à moins de `radiusM` du point (lon, lat), du plus proche au plus lointain. Rien si le point est loin
 * de Paris. Le choix final (seulement celles du champ de la caméra) est fait par le moteur.
 */
// Déclare et exporte tilesAround : le point et le rayon.
export function tilesAround(lon, lat, radiusM) {
  // Tuile du point.
  const c = tileIndexAt(lon, lat);
  // Côté d'une tuile en mètres à cette latitude.
  const side = (360 / 2 ** TILE_Z) * M_PER_DEG * Math.cos(lat * (Math.PI / 180));
  // Nombre de tuiles à parcourir de chaque côté.
  const n = Math.ceil(radiusM / side) + 1;
  // Tuiles retenues.
  const out = [];
  // Pour chaque ligne voisine, dans la grille de Paris (début).
  for (let y = Math.max(GRID.y0, c.y - n); y <= Math.min(GRID.y1, c.y + n); y++) {
    // Pour chaque colonne voisine, dans la grille de Paris (début).
    for (let x = Math.max(GRID.x0, c.x - n); x <= Math.min(GRID.x1, c.x + n); x++) {
      // Emprise de la tuile.
      const b = tileBounds(x, y);
      // Point de la tuile le plus proche du point survolé.
      const px = Math.min(Math.max(lon, b.west), b.east), py = Math.min(Math.max(lat, b.south), b.north);
      // Distance à la tuile.
      const d = groundDistance(lon, lat, px, py);
      // Assez proche : retenue, avec sa clé et sa distance.
      if (d <= radiusM) out.push({ x, y, key: `${TILE_Z}/${x}/${y}`, d });
    // Fin des colonnes.
    }
  // Fin des lignes.
  }
  // Trie de la plus proche à la plus lointaine.
  return out.sort((a, b) => a.d - b.d);
// Fin de tilesAround.
}

/**
 * Coins d'une tuile sur la sphère unité de la Terre, au sol et à `topM` mètres : huit points [x, y, z] qui
 * enveloppent les bâtiments de la tuile (pour le test du champ de la caméra).
 */
// Déclare et exporte tileCorners : l'emprise et la hauteur du haut.
export function tileCorners({ west, east, north, south }, topM = 120) {
  // Points renvoyés.
  const out = [];
  // Au sol, puis en haut.
  for (const r of [1, 1 + topM / EARTH_RADIUS_M]) {
    // Les quatre coins à ce rayon.
    for (const [lo, la] of [[west, south], [east, south], [east, north], [west, north]]) out.push(lonLatToXYZ(lo, la, r));
  // Fin des rayons.
  }
  // Renvoie les points.
  return out;
// Fin de tileCorners.
}

/**
 * Adresse WFS 2.0 des bâtiments d'une emprise, en GeoJSON et en degrés (EPSG:4326). L'emprise est donnée dans
 * l'ordre de l'EPSG:4326 (latitude d'abord), avec son nom complet pour que le serveur ne se trompe pas d'axe.
 */
// Déclare et exporte wfsUrl : l'emprise et le nombre maximal de bâtiments.
export function wfsUrl({ west, south, east, north }, count = WFS_COUNT) {
  // Paramètres de la requête.
  const q = new URLSearchParams({
    // Service, version et requête.
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature',
    // Couche, format et système de coordonnées.
    TYPENAMES: WFS_LAYER, OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326',
    // Emprise, latitude d'abord, et nombre maximal.
    BBOX: `${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326`, COUNT: String(count),
  // Fin des paramètres.
  });
  // Renvoie l'adresse complète.
  return `${WFS_URL}?${q}`;
// Fin de wfsUrl.
}

/** Nombre fini et positif, sinon null. */
// num : convertit une valeur en nombre positif, ou null.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/**
 * Hauteur d'un bâtiment (m) d'après ses attributs BD TOPO : `hauteur`, sinon le nombre d'étages, sinon l'écart
 * entre le toit et le sol, sinon 6 m. Bornée entre 2 m et 330 m (la tour Eiffel).
 */
// Déclare et exporte buildingHeight : les attributs du bâtiment.
export function buildingHeight(p = {}) {
  // La hauteur mesurée, si elle existe.
  let h = num(p.hauteur);
  // Sinon : le nombre d'étages fois 3 m.
  if (h === null && num(p.nombre_d_etages) !== null) h = p.nombre_d_etages * FLOOR_M;
  // Sinon : du sol le plus bas au toit le plus haut.
  if (h === null && num(p.altitude_maximale_toit) !== null && num(p.altitude_minimale_sol) !== null) h = num(p.altitude_maximale_toit - p.altitude_minimale_sol);
  // Bornée entre 2 et 330 m, 6 m par défaut.
  return Math.min(330, Math.max(2, h ?? DEFAULT_HEIGHT_M));
// Fin de buildingHeight.
}

/** Altitude du sol d'un bâtiment (m), ou null si elle n'est pas donnée. */
// Déclare et exporte groundAltitude : les attributs du bâtiment.
export function groundAltitude(p = {}) {
  // L'altitude minimale du sol, sinon la maximale, sinon null.
  const a = p.altitude_minimale_sol ?? p.altitude_maximale_sol;
  // Renvoie un nombre fini, sinon null.
  return typeof a === 'number' && Number.isFinite(a) ? a : null;
// Fin de groundAltitude.
}

/** Médiane d'une liste de nombres, ou `fallback` si elle est vide. */
// Déclare et exporte median : la liste et la valeur par défaut.
export function median(values, fallback = 0) {
  // Liste vide : la valeur par défaut.
  if (!values.length) return fallback;
  // Copie triée.
  const s = [...values].sort((a, b) => a - b);
  // Valeur du milieu.
  return s[Math.floor(s.length / 2)];
// Fin de median.
}

/**
 * Repère local d'un carreau sur la sphère unité de la Terre : origine au centre du carreau, à l'altitude `altM`, et
 * vecteurs (par mètre, en rayons) de ses axes X (est), Y (nord) et Z (haut). Sur 450 m, l'écart avec la courbure de
 * la Terre reste sous 2 cm.
 */
// Déclare et exporte tileFrame : le centre du carreau et son altitude.
export function tileFrame(lon, lat, altM = 0) {
  // Rayon de l'origine, en rayons terrestres.
  const r = 1 + altM / EARTH_RADIUS_M;
  // Origine.
  const origin = lonLatToXYZ(lon, lat, r);
  // Écart utilisé pour mesurer les axes : 1e-3 degré.
  const D = 1e-3;
  // Mètres par degré de longitude à cette latitude.
  const mLon = M_PER_DEG * Math.cos(lat * (Math.PI / 180));
  // Axe est : différence de deux points, divisée par sa longueur en mètres.
  const a = lonLatToXYZ(lon + D, lat, r), b = lonLatToXYZ(lon - D, lat, r);
  // Axe est, par mètre.
  const ex = a.map((v, i) => (v - b[i]) / (2 * D * mLon));
  // Axe nord : même calcul en latitude.
  const c = lonLatToXYZ(lon, lat + D, r), d = lonLatToXYZ(lon, lat - D, r);
  // Axe nord, par mètre.
  const ey = c.map((v, i) => (v - d[i]) / (2 * D * M_PER_DEG));
  // Axe haut : la verticale du lieu, par mètre.
  const ez = lonLatToXYZ(lon, lat, 1 / EARTH_RADIUS_M);
  // Renvoie le repère.
  return { origin, ex, ey, ez };
// Fin de tileFrame.
}

/** Aire signée d'un contour [[x, y], …] : positive dans le sens inverse des aiguilles d'une montre. */
// Déclare et exporte ringArea : le contour.
export function ringArea(ring) {
  // Somme du produit en croix.
  let s = 0;
  // Pour chaque côté du contour (début).
  for (let i = 0, n = ring.length; i < n; i++) {
    // Le point et le suivant.
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % n];
    // Ajoute le produit en croix.
    s += x1 * y2 - x2 * y1;
  // Fin de la boucle.
  }
  // Renvoie la moitié.
  return s / 2;
// Fin de ringArea.
}

/**
 * Contour d'un polygone GeoJSON → points en mètres dans le repère du carreau, sans point de fermeture répété.
 * L'ordre des axes est vérifié sur le premier point : si le serveur a rendu (latitude, longitude), on les inverse.
 */
// Déclare et exporte projectRing : le contour, le centre du carreau et l'indicateur d'inversion des axes.
export function projectRing(coords, lon0, lat0, swap = false) {
  // Mètres par degré de longitude au centre du carreau.
  const mLon = M_PER_DEG * Math.cos(lat0 * (Math.PI / 180));
  // Points projetés.
  const out = [];
  // Pour chaque coordonnée (début).
  for (const c of coords) {
    // Longitude et latitude, dans le bon ordre (la troisième valeur, l'altitude, est ignorée).
    const lon = swap ? c[1] : c[0], lat = swap ? c[0] : c[1];
    // Point en mètres.
    const p = [(lon - lon0) * mLon, (lat - lat0) * M_PER_DEG];
    // Ajouté s'il diffère du précédent de plus d'1 cm.
    if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 0.01) out.push(p);
  // Fin de la boucle.
  }
  // Retire le point de fermeture, identique au premier.
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.01) out.pop();
  // Renvoie les points.
  return out;
// Fin de projectRing.
}

/** Distance (m) d'un point au segment [a, b]. */
// segDist : le point et les deux extrémités du segment.
function segDist([px, py], [ax, ay], [bx, by]) {
  // Vecteur du segment et sa longueur au carré.
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  // Position du projeté sur le segment, bornée entre 0 et 1.
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  // Distance au projeté.
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
// Fin de segDist.
}

/**
 * Simplifie un contour fermé (Douglas-Peucker) : seuls les points à plus de `tol` mètres du tracé simplifié sont
 * gardés, toujours au moins trois. Les murs d'un immeuble haussmannien passent de dizaines de points à quelques-uns.
 */
// Déclare et exporte simplifyRing : le contour et la tolérance.
export function simplifyRing(ring, tol = SIMPLIFY_M) {
  // Trois points ou moins : rien à simplifier.
  if (ring.length <= 3 || tol <= 0) return ring;
  // Point le plus éloigné du premier : le contour fermé est coupé en deux chaînes entre ces deux points.
  let far = 0, best = -1;
  // Le cherche.
  for (let i = 1; i < ring.length; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > best) { best = d; far = i; } }
  // Points gardés.
  const keep = new Uint8Array(ring.length);
  // Les deux extrémités sont gardées.
  keep[0] = 1; keep[far] = 1;
  // dp : simplifie la chaîne de i à j (indices dans le contour, j pouvant valoir la longueur pour revenir au début).
  const dp = (i, j) => {
    // Point le plus éloigné du segment.
    let idx = -1, max = tol;
    // Le cherche entre les deux bouts.
    for (let k = i + 1; k < j; k++) { const d = segDist(ring[k], ring[i], ring[j % ring.length]); if (d > max) { max = d; idx = k; } }
    // Au-delà de la tolérance : gardé, et les deux moitiés sont simplifiées.
    if (idx >= 0) { keep[idx] = 1; dp(i, idx); dp(idx, j); }
  // Fin de dp.
  };
  // Première chaîne, puis la seconde (qui revient au premier point).
  dp(0, far); dp(far, ring.length);
  // Points gardés.
  const out = ring.filter((_, i) => keep[i]);
  // Toujours au moins trois points : sinon le contour d'origine.
  return out.length >= 3 ? out : ring;
// Fin de simplifyRing.
}

/**
 * Faut-il inverser les axes ? Vrai si le premier point lu (longitude, latitude) est plus loin du centre du carreau
 * que lu à l'envers : un serveur WFS en EPSG:4326 peut rendre la latitude en premier.
 */
// Déclare et exporte needsSwap : les entités, et le centre du carreau.
export function needsSwap(features, lon0, lat0) {
  // Pour chaque entité (début).
  for (const f of features) {
    // Premier point de sa géométrie, quelle que soit la profondeur.
    let c = f?.geometry?.coordinates;
    // Descend jusqu'à un point.
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
    // Pas de point : entité suivante.
    if (!Array.isArray(c) || c.length < 2) continue;
    // Distance lu dans l'ordre, et lu à l'envers.
    const direct = Math.abs(c[0] - lon0) + Math.abs(c[1] - lat0), swapped = Math.abs(c[1] - lon0) + Math.abs(c[0] - lat0);
    // Inversé si c'est plus proche à l'envers.
    return swapped < direct;
  // Fin de la boucle.
  }
  // Aucun point : pas d'inversion.
  return false;
// Fin de needsSwap.
}

/** Polygones d'une géométrie GeoJSON (Polygon ou MultiPolygon) : liste de listes de contours. */
// Déclare et exporte polygonsOf : la géométrie.
export function polygonsOf(geometry) {
  // Un polygone : une liste qui le contient.
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  // Plusieurs polygones : la liste telle quelle.
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  // Autre type : rien.
  return [];
// Fin de polygonsOf.
}

/** Teinte d'un bâtiment, tirée de son identifiant : pierre de Paris, du beige clair au gris chaud. */
// Déclare et exporte buildingColor : l'identifiant.
export function buildingColor(id = '') {
  // Empreinte de l'identifiant.
  let h = 2166136261;
  // Pour chaque caractère : mélange (FNV-1a).
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  // Valeur entre 0 et 1.
  const t = ((h >>> 0) % 1000) / 1000;
  // Couleur entre un beige clair et un gris chaud.
  return [0.86 - 0.1 * t, 0.83 - 0.1 * t, 0.76 - 0.07 * t];
// Fin de buildingColor.
}

/**
 * Extrusion des bâtiments d'un carreau, en un seul maillage. Repère du carreau, en mètres : X est, Y nord, Z haut,
 * Z = 0 au sol. Pour chaque sommet : position, normale, couleur et `lift`, l'altitude du sol du bâtiment au-dessus du
 * sol du carreau (utilisée seulement avec le relief en volume).
 * `triangulate(contour, trous)` renvoie les triangles du toit en indices (THREE.ShapeUtils.triangulateShape).
 * @returns {{ positions: Float32Array, normals: Float32Array, colors: Float32Array, lifts: Float32Array, count: number, buildings: number, groundM: number }}
 */
// Déclare et exporte extrudeBuildings : les entités GeoJSON, le centre du carreau et la fonction de triangulation.
export function extrudeBuildings(features, lon0, lat0, triangulate, { simplifyM = SIMPLIFY_M, minAreaM2 = MIN_AREA_M2 } = {}) {
  // Axes inversés par le serveur ?
  const swap = needsSwap(features, lon0, lat0);
  // Altitude du sol du carreau : médiane de celle des bâtiments.
  const groundM = median(features.map((f) => groundAltitude(f?.properties)).filter((a) => a !== null), 0);
  // Tableaux de sortie, agrandis au fur et à mesure.
  const pos = [], nor = [], col = [], lif = [];
  // Nombre de bâtiments extrudés.
  let buildings = 0;
  // vert : ajoute un sommet (position, normale, couleur et soulèvement).
  const vert = (x, y, z, nx, ny, nz, c, l) => { pos.push(x, y, z); nor.push(nx, ny, nz); col.push(c[0], c[1], c[2]); lif.push(l); };
  // Pour chaque bâtiment (début).
  for (const f of features) {
    // Ses attributs.
    const p = f?.properties || {};
    // Sa hauteur.
    const h = buildingHeight(p);
    // Soulèvement de son sol par rapport à celui du carreau.
    const g = groundAltitude(p);
    // Écart, nul sans altitude connue.
    const lift = g === null ? 0 : g - groundM;
    // Sa couleur, tirée de son identifiant.
    const c = buildingColor(String(p.cleabs ?? f?.id ?? buildings));
    // Couleur du toit : un peu plus sombre et grise.
    const roofC = [c[0] * 0.78, c[1] * 0.78, c[2] * 0.8];
    // Au moins un polygone extrudé pour ce bâtiment ?
    let any = false;
    // Pour chaque polygone du bâtiment (début).
    for (const poly of polygonsOf(f?.geometry)) {
      // Contours projetés en mètres et simplifiés.
      const projected = poly.map((r) => simplifyRing(projectRing(r, lon0, lat0, swap), simplifyM));
      // Contour extérieur : sans lui (moins de trois points) ou trop petit, le polygone est écarté.
      if (!projected.length || projected[0].length < 3 || Math.abs(ringArea(projected[0])) < minAreaM2) continue;
      // Contour extérieur, puis les cours intérieures assez grandes.
      const rings = [projected[0], ...projected.slice(1).filter((r) => r.length >= 3 && Math.abs(ringArea(r)) >= minAreaM2)];
      // Contour extérieur dans le sens inverse des aiguilles d'une montre, trous dans le sens des aiguilles :
      // la normale (dy, −dx) de chaque côté pointe alors vers l'extérieur du bâtiment.
      // Oriente chaque contour.
      rings.forEach((r, i) => { const a = ringArea(r); if ((i === 0 && a < 0) || (i > 0 && a > 0)) r.reverse(); });
      // Pour chaque contour : les murs (début).
      for (const r of rings) {
        // Pour chaque côté (début).
        for (let i = 0; i < r.length; i++) {
          // Ses deux extrémités.
          const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length];
          // Sa longueur.
          const len = Math.hypot(x2 - x1, y2 - y1);
          // Côté nul : suivant.
          if (len < 1e-6) continue;
          // Normale extérieure.
          const nx = (y2 - y1) / len, ny = -(x2 - x1) / len;
          // Deux triangles : bas-gauche, bas-droit, haut-droit…
          vert(x1, y1, 0, nx, ny, 0, c, lift); vert(x2, y2, 0, nx, ny, 0, c, lift); vert(x2, y2, h, nx, ny, 0, c, lift);
          // … puis bas-gauche, haut-droit, haut-gauche.
          vert(x1, y1, 0, nx, ny, 0, c, lift); vert(x2, y2, h, nx, ny, 0, c, lift); vert(x1, y1, h, nx, ny, 0, c, lift);
        // Fin des côtés.
        }
      // Fin des murs.
      }
      // Toit : triangulation du contour extérieur et de ses trous.
      // Points du contour et des trous, au format attendu (objets x, y).
      const shape = rings[0].map(([x, y]) => ({ x, y })), holes = rings.slice(1).map((r) => r.map(([x, y]) => ({ x, y })));
      // Tous les points, dans l'ordre de la triangulation.
      const all = [...shape, ...holes.flat()];
      // Pour chaque triangle (début).
      for (const tri of triangulate(shape, holes)) {
        // Ses trois sommets.
        const [a, b, d] = tri.map((k) => all[k]);
        // Orientation : produit en croix, positif si le triangle tourne dans le sens inverse des aiguilles.
        const ccw = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x) >= 0;
        // Triangle tourné vers le haut.
        for (const q of ccw ? [a, b, d] : [a, d, b]) vert(q.x, q.y, h, 0, 0, 1, roofC, lift);
      // Fin des triangles.
      }
      // Ce bâtiment a au moins un polygone.
      any = true;
    // Fin des polygones.
    }
    // Compte le bâtiment.
    if (any) buildings++;
  // Fin des bâtiments.
  }
  // Renvoie les tableaux typés, le nombre de sommets, de bâtiments, et l'altitude du sol.
  return { positions: new Float32Array(pos), normals: new Float32Array(nor), colors: new Float32Array(col), lifts: new Float32Array(lif), count: pos.length / 3, buildings, groundM };
// Fin de extrudeBuildings.
}
