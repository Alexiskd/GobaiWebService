// Coordonnées GPS à l'écran : rayons de la caméra par les coins de l'écran, intersection avec le globe, latitude /
// longitude du point touché, précision adaptée à l'échelle et barre d'échelle. Aucune dépendance (testable sans
// three.js). Calculs en double précision dans le repère de la scène, recentré sur l'astre suivi : au centimètre
// près même à quelques mètres du sol.

export const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

/** Coins de l'écran en coordonnées normalisées (-1 … 1), dans l'ordre d'affichage. */
export const SCREEN_CORNERS = [
  { id: 'nw', x: -1, y: 1, label: 'Haut gauche' },
  { id: 'ne', x: 1, y: 1, label: 'Haut droite' },
  { id: 'sw', x: -1, y: -1, label: 'Bas gauche' },
  { id: 'se', x: 1, y: -1, label: 'Bas droite' },
];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Direction (unitaire) du rayon qui passe par le point (ndcX, ndcY) de l'écran.
 * @param view { right, up, forward } axes de la caméra (unitaires), tanY = tan(fov vertical / 2), aspect = largeur / hauteur
 */
export function rayDirection({ right, up, forward, tanY, aspect }, ndcX, ndcY) {
  const sx = ndcX * tanY * aspect, sy = ndcY * tanY;
  const d = [0, 1, 2].map((i) => forward[i] + right[i] * sx + up[i] * sy);
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / len, d[1] / len, d[2] / len];
}

/**
 * Première intersection d'un rayon (origine o, direction unitaire d) avec une sphère (centre c, rayon r), ou null.
 * Forme stable (pas de soustraction de deux grands nombres voisins) : précise quand la caméra frôle la surface.
 */
export function raySphere(o, d, c, r) {
  const oc = [o[0] - c[0], o[1] - c[1], o[2] - c[2]];
  const b = dot(oc, d);
  const k = dot(oc, oc) - r * r; // > 0 : origine hors de la sphère
  const disc = b * b - k;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  if (k > 0) {
    if (b >= 0) return null; // la sphère est derrière la caméra
    return k / (-b + s);     // = -b - s, sans perte de précision
  }
  return -b + s;             // caméra sous la surface : sortie du rayon
}

/** Applique une matrice 4 × 4 (tableau de 16 nombres, colonnes comme three.js) à un point. */
export function applyMatrix(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/** [lon°, lat°] d'un point du repère de la Terre du moteur : (cos la cos lo, sin la, -cos la sin lo). */
export function toLonLat([x, y, z]) {
  const len = Math.hypot(x, y, z) || 1;
  return [Math.atan2(-z, x) / RAD, Math.asin(Math.max(-1, Math.min(1, y / len))) / RAD];
}

/**
 * Coordonnées des coins et du centre de l'écran, et échelle au centre.
 * @param o  { origin, right, up, forward, tanY, aspect, center, radius, toLocal, widthPx }
 *   center / radius : sphère du sol dans le repère de la scène ; toLocal : matrice scène → repère de la Terre
 *   widthPx : largeur de l'écran en pixels CSS ; radiusM : rayon réel (m) de la sphère unité
 *   points : coins visés (par défaut ceux de l'écran ; voir `insetCorners` pour une zone réduite)
 */
export function screenGeo({ origin, right, up, forward, tanY, aspect, center, radius, toLocal, widthPx, radiusM = EARTH_RADIUS_M, points = SCREEN_CORNERS }) {
  const view = { right, up, forward, tanY, aspect };
  const hit = (x, y) => {
    const d = rayDirection(view, x, y);
    const t = raySphere(origin, d, center, radius);
    if (t === null) return null;
    const p = [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t];
    return { p, local: applyMatrix(toLocal, p), t };
  };
  const geo = (h) => {
    if (!h) return null;
    const [lon, lat] = toLonLat(h.local);
    return { lat, lon };
  };
  const corners = points.map((c) => ({ id: c.id, ...(geo(hit(c.x, c.y)) || { lat: null, lon: null }) }));
  const mid = hit(0, 0);
  // Échelle : écart au sol entre le centre et un point décalé d'un pixel (en mètres par pixel CSS).
  let metersPerPixel = null;
  if (mid && widthPx > 0) {
    const step = 2 / widthPx;
    const side = hit(step, 0);
    if (side) {
      const dx = side.p[0] - mid.p[0], dy = side.p[1] - mid.p[1], dz = side.p[2] - mid.p[2];
      metersPerPixel = (Math.hypot(dx, dy, dz) / radius) * radiusM;
    }
  }
  return {
    corners,
    center: geo(mid),
    metersPerPixel,
    altitudeM: (Math.hypot(origin[0] - center[0], origin[1] - center[1], origin[2] - center[2]) / radius - 1) * radiusM,
  };
}

/**
 * Coins d'une zone de l'écran réduite de marges (px CSS), en coordonnées normalisées : sur mobile, le bas de l'écran
 * est couvert par la barre d'outils, et le coin utile est juste au-dessus.
 */
export function insetCorners({ top = 0, right = 0, bottom = 0, left = 0 } = {}, widthPx, heightPx) {
  const x0 = -1 + (2 * left) / widthPx, x1 = 1 - (2 * right) / widthPx;
  const y0 = 1 - (2 * top) / heightPx, y1 = -1 + (2 * bottom) / heightPx;
  return SCREEN_CORNERS.map((c) => ({ ...c, x: c.x < 0 ? x0 : x1, y: c.y > 0 ? y0 : y1 }));
}

/** Nombre de décimales des degrés : environ un pixel à l'écran (1° de latitude ≈ 111,32 km), de 0 à 7 (≈ 1 cm). */
export function gpsDecimals(metersPerPixel) {
  if (!(metersPerPixel > 0)) return 2;
  return Math.max(0, Math.min(7, Math.ceil(Math.log10(111_320 / metersPerPixel))));
}

export const formatLat = (lat, digits) => `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}`;
export const formatLon = (lon, digits) => `${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? 'E' : 'O'}`;
export const formatLatLon = (lat, lon, digits) => `${formatLat(lat, digits)}, ${formatLon(lon, digits)}`;

/** Distance lisible : « 85 cm », « 10 m », « 2,5 km ». */
export function formatDistance(m) {
  if (m < 1) return `${Math.round(m * 100)} cm`;
  if (m < 1000) return `${Number(m.toPrecision(3)).toLocaleString('fr-FR')} m`;
  return `${Number((m / 1000).toPrecision(3)).toLocaleString('fr-FR')} km`;
}

/**
 * Barre d'échelle : longueur ronde (1, 2 ou 5 × 10ⁿ m) dont le tracé fait entre `minPx` et `maxPx` pixels.
 * @returns { meters, px, label } ou null si l'échelle est inconnue
 */
export function niceScale(metersPerPixel, { minPx = 50, maxPx = 130 } = {}) {
  if (!(metersPerPixel > 0)) return null;
  const target = metersPerPixel * maxPx;
  const pow = 10 ** Math.floor(Math.log10(target));
  const meters = [5, 2, 1].map((k) => k * pow).find((m) => m / metersPerPixel >= minPx && m <= target) ?? pow;
  return { meters, px: meters / metersPerPixel, label: formatDistance(meters) };
}

/** Altitude d'un survol pour que la hauteur de l'écran couvre `meters` (champ vertical `fovDeg`). */
export const altitudeForView = (meters, fovDeg = 45) => meters / (2 * Math.tan((fovDeg * RAD) / 2));

// ------------------------------------------------------------------ Saisie de coordonnées

const NUM = String.raw`[-+]?\d+(?:[.,]\d+)?`;
const toNum = (s) => Number(String(s).replace(',', '.'));
const LAT_LETTER = /[NS]/i, LON_LETTER = /[EOW]/i;

function signed(value, letter) {
  if (!letter) return value;
  return /[SOW]/i.test(letter) ? -Math.abs(value) : Math.abs(value);
}

/**
 * Lit des coordonnées saisies : « 48.8584, 2.2945 », « 48,8584 ; 2,2945 », « 48.8584 N 2.2945 E »,
 * « 48°51'30"N 2°17'40"E », « -33.86 151.21 ». Ordre latitude puis longitude, sauf si les lettres disent l'inverse.
 * @returns {{ lat: number, lon: number } | null}
 */
export function parseLatLon(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  let parts = null;

  // Degrés, minutes, secondes.
  const dms = new RegExp(String.raw`(${NUM})\s*°\s*(?:(${NUM})\s*['′’]\s*)?(?:(${NUM})\s*(?:"|″|''|’’)\s*)?([NSEOW])?`, 'gi');
  const found = [...text.matchAll(dms)];
  if (found.length === 2) {
    parts = found.map((m) => {
      const deg = toNum(m[1]), min = m[2] ? toNum(m[2]) : 0, sec = m[3] ? toNum(m[3]) : 0;
      const abs = Math.abs(deg) + min / 60 + sec / 3600;
      return { value: deg < 0 ? -abs : abs, letter: m[4] || '' };
    });
  } else {
    // Décimaux : « ; » sépare toujours ; sinon virgule suivie d'un espace, espace seul, ou virgule entre deux points.
    let chunks = [];
    if (text.includes(';')) chunks = text.split(';');
    else if (/,\s/.test(text)) chunks = text.split(/,\s+/);
    else if (/\s/.test(text)) chunks = text.split(/\s+(?=[-+\d])/);
    else if ((text.match(/,/g) || []).length === 1 && text.includes('.')) chunks = text.split(',');
    if (chunks.length !== 2) return null;
    const one = new RegExp(String.raw`^\s*([NSEOW])?\s*(${NUM})\s*°?\s*([NSEOW])?\s*$`, 'i');
    parts = chunks.map((c) => {
      const m = c.match(one);
      return m ? { value: toNum(m[2]), letter: m[3] || m[1] || '' } : null;
    });
    if (parts.some((p) => !p)) return null;
  }

  let [a, b] = parts;
  if ((LON_LETTER.test(a.letter) && !LON_LETTER.test(b.letter)) || (LAT_LETTER.test(b.letter) && !LAT_LETTER.test(a.letter))) [a, b] = [b, a];
  const lat = signed(a.value, a.letter), lon = signed(b.value, b.letter);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}
