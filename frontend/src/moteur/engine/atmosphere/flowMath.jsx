// Calcul des vents (sans three.js, donc testable seul) : niveaux proposés, lecture de la réponse du serveur, vent en un
// point par interpolation bilinéaire sur la grille, déplacement d'une particule sur la sphère, couleurs selon la
// vitesse, rayon de chaque niveau.

/** Niveaux proposés, du sol aux courants-jets. */
// Déclare et exporte les niveaux.
export const FLOW_LEVEL_IDS = ['10m', '850hPa', '500hPa', '250hPa'];
/** Libellés courts des niveaux. */
// Déclare et exporte les libellés.
export const FLOW_LEVEL_LABELS = { '10m': 'Sol', '850hPa': '1,5 km', '500hPa': '5,6 km', '250hPa': '10 km' };
/** Rayon de la Terre, m. */
// Déclare et exporte le rayon de la Terre.
export const EARTH_M = 6_371_000;
/**
 * Accélération du temps des particules, vue à 1,5 rayon terrestre d'altitude : une seconde à l'écran vaut 9 000 s de
 * vent (un jet de 50 m/s parcourt ≈ 4°). Elle suit l'altitude de la vue (voir timeScale) : la vitesse à l'écran reste
 * la même de près comme de loin.
 */
// Déclare et exporte l'accélération de référence.
export const FLOW_TIME_SCALE = 9_000;

/** Accélération à l'altitude de la vue `alt` (rayons terrestres) : proportionnelle, entre 10 % et 150 % de la référence. */
// Déclare et exporte timeScale : l'altitude de la vue.
export const timeScale = (alt) => FLOW_TIME_SCALE * Math.min(1.5, Math.max(0.1, (Number(alt) || 0) / 1.5));
/** Exagération de l'altitude des niveaux (10 km affichés à 80 km), pour séparer les couches en 3D. */
// Déclare et exporte l'exagération.
export const FLOW_ALT_EXAGGERATION = 8;
/** Latitude maximale des particules (la grille s'arrête à 80°). */
// Déclare et exporte la latitude maximale.
export const FLOW_MAX_LAT = 80;

/** Échelle des vitesses (m/s → couleur) : calme bleu pâle, puis cyan, vert, jaune, orange, rouge, magenta. */
// Déclare et exporte l'échelle des vitesses.
export const SPEED_SCALE = [[0, '#7fb3ff'], [5, '#62d2ff'], [10, '#5ce6b8'], [20, '#d8f25a'], [30, '#ffb03a'], [45, '#ff5a3c'], [60, '#ff3dc8']];

// hexRgb : « #rrggbb » → trois composantes de 0 à 1.
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
// Échelle en composantes.
const SCALE_RGB = SPEED_SCALE.map(([s, c]) => [s, hexRgb(c)]);

/** Couleur d'une vitesse (m/s) : interpolation linéaire entre les paliers de l'échelle. */
// Déclare et exporte speedColor : la vitesse.
export function speedColor(ms) {
  // Vitesse bornée à l'échelle.
  const s = Math.max(0, Number(ms) || 0);
  // Palier supérieur.
  const i = SCALE_RGB.findIndex(([v]) => v >= s);
  // Au-delà du dernier palier : sa couleur.
  if (i < 0) return SCALE_RGB[SCALE_RGB.length - 1][1];
  // Premier palier : sa couleur.
  if (i === 0) return SCALE_RGB[0][1];
  // Paliers encadrants et fraction.
  const [s0, c0] = SCALE_RGB[i - 1], [s1, c1] = SCALE_RGB[i], f = (s - s0) / (s1 - s0);
  // Couleur interpolée.
  return c0.map((v, k) => v + (c1[k] - v) * f);
// Fin de speedColor.
}

/** Rayon (en rayons terrestres) d'un niveau d'altitude `altKm`, au-dessus du radar et des aérosols. */
// Déclare et exporte flowRadius : l'altitude.
export const flowRadius = (altKm) => 1.0016 + ((Number(altKm) || 0) * FLOW_ALT_EXAGGERATION * 1000) / EARTH_M;

/**
 * Réponse /atmosphere/winds mise en forme : grille, niveaux disponibles { u, v (Float32Array), maxMs, altKm, label },
 * axes des courants-jets { points [[lon, lat]], maxKmh, hemisphere }, heure de validité (ms ou null).
 */
// Déclare et exporte normalizeWinds : la réponse.
export function normalizeWinds(data) {
  // Grille reçue.
  const g = data?.grid;
  // Grille lisible ?
  const grid = g && [g.width, g.height, g.lonStart, g.lonStep, g.latStart, g.latStep].every((v) => Number.isFinite(Number(v))) && g.width > 1 && g.height > 1 ? { width: +g.width, height: +g.height, lonStart: +g.lonStart, lonStep: +g.lonStep, latStart: +g.latStart, latStep: +g.latStep } : null;
  // Nombre de points.
  const n = grid ? grid.width * grid.height : 0;
  // Niveaux disponibles et complets.
  const levels = Object.fromEntries((Array.isArray(data?.levels) ? data.levels : []).filter((l) => grid && l?.available === true && Array.isArray(l.u) && Array.isArray(l.v) && l.u.length === n && l.v.length === n).map((l) => [l.id, { u: Float32Array.from(l.u, Number), v: Float32Array.from(l.v, Number), maxMs: Number(l.maxMs) || 0, altKm: Number(l.altKm) || 0, label: String(l.label ?? l.id) }]));
  // Axes lisibles.
  const jets = (Array.isArray(data?.jets) ? data.jets : []).map((e) => ({ points: (Array.isArray(e?.geometry?.coordinates) ? e.geometry.coordinates : []).map((p) => [Number(p?.[0]), Number(p?.[1])]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)), maxKmh: Number(e?.intensity?.value) || 0, hemisphere: e?.details?.hemisphere ?? null })).filter((j) => j.points.length >= 2);
  // Heure de validité.
  const t = Date.parse(data?.validAt);
  // Résultat.
  return { grid, levels, jets, validAt: Number.isFinite(t) ? t : null };
// Fin de normalizeWinds.
}

/**
 * Vent (u vers l'est, v vers le nord, m/s) en un point, par interpolation bilinéaire sur la grille ; la longitude est
 * refermée autour du globe, la latitude bornée à la grille.
 */
// Déclare et exporte sampleWind : la grille, le niveau, la longitude et la latitude.
export function sampleWind(grid, level, lon, lat) {
  // Position en colonnes, refermée.
  const fx = ((((lon - grid.lonStart) / grid.lonStep) % grid.width) + grid.width) % grid.width;
  // Position en lignes, bornée.
  const fy = Math.max(0, Math.min(grid.height - 1, (lat - grid.latStart) / grid.latStep));
  // Colonnes et lignes encadrantes.
  const x0 = Math.floor(fx), x1 = (x0 + 1) % grid.width, y0 = Math.floor(fy), y1 = Math.min(grid.height - 1, y0 + 1);
  // Fractions.
  const tx = fx - x0, ty = fy - y0;
  // Indices des quatre voisins.
  const a = y0 * grid.width + x0, b = y0 * grid.width + x1, c = y1 * grid.width + x0, d = y1 * grid.width + x1;
  // Interpolation d'un tableau.
  const lerp = (arr) => (arr[a] * (1 - tx) + arr[b] * tx) * (1 - ty) + (arr[c] * (1 - tx) + arr[d] * tx) * ty;
  // Vent.
  return [lerp(level.u), lerp(level.v)];
// Fin de sampleWind.
}

/** Déplace un point du vent (u, v en m/s) pendant `seconds` secondes : nouvelle [longitude, latitude]. */
// Déclare et exporte advect : longitude, latitude, vent et durée.
export function advect(lon, lat, u, v, seconds) {
  // Latitude en radians.
  const la = (lat * Math.PI) / 180;
  // Nouvelle latitude.
  const lat2 = lat + ((v * seconds) / EARTH_M) * (180 / Math.PI);
  // Nouvelle longitude (le cosinus est borné près des pôles), ramenée entre −180 et 180.
  const lon2 = lon + ((u * seconds) / (EARTH_M * Math.max(0.05, Math.cos(la)))) * (180 / Math.PI);
  // Point déplacé.
  return [((((lon2 + 180) % 360) + 360) % 360) - 180, lat2];
// Fin de advect.
}

/** Point tiré au hasard, uniformément sur la surface de la sphère entre ±80° de latitude (`rand` : générateur 0-1). */
// Déclare et exporte randomPoint : le générateur.
export function randomPoint(rand = Math.random) {
  // Sinus de la latitude maximale.
  const m = Math.sin((FLOW_MAX_LAT * Math.PI) / 180);
  // Latitude (uniforme en sinus : uniforme en surface) et longitude.
  return [rand() * 360 - 180, (Math.asin((2 * rand() - 1) * m) * 180) / Math.PI];
// Fin de randomPoint.
}
