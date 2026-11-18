// Coordonnées GPS à l'écran : rayons de la caméra par les coins de l'écran, intersection avec le globe, latitude /
// longitude du point touché, précision adaptée à l'échelle et barre d'échelle. Aucune dépendance (testable sans
// three.js). Calculs en double précision dans le repère de la scène, recentré sur l'astre suivi : au centimètre
// près même à quelques mètres du sol.

// Déclare et exporte le rayon de la Terre : 6 371 000 mètres.
export const EARTH_RADIUS_M = 6_371_000;
// RAD : le nombre de radians dans un degré.
const RAD = Math.PI / 180;

/** Coins de l'écran en coordonnées normalisées (-1 … 1), dans l'ordre d'affichage. */
// Déclare et exporte les quatre coins de l'écran (début).
export const SCREEN_CORNERS = [
  // Haut gauche : (−1, 1).
  { id: 'nw', x: -1, y: 1, label: 'Haut gauche' },
  // Haut droite : (1, 1).
  { id: 'ne', x: 1, y: 1, label: 'Haut droite' },
  // Bas gauche : (−1, −1).
  { id: 'sw', x: -1, y: -1, label: 'Bas gauche' },
  // Bas droite : (1, −1).
  { id: 'se', x: 1, y: -1, label: 'Bas droite' },
// Fin de la liste.
];

// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Direction (unitaire) du rayon qui passe par le point (ndcX, ndcY) de l'écran.
 * @param view { right, up, forward } axes de la caméra (unitaires), tanY = tan(fov vertical / 2), aspect = largeur / hauteur
 */
// Déclare et exporte rayDirection : la vue et un point de l'écran en coordonnées normalisées.
export function rayDirection({ right, up, forward, tanY, aspect }, ndcX, ndcY) {
  // Décalages horizontal et vertical du rayon, selon le champ et les proportions de l'écran.
  const sx = ndcX * tanY * aspect, sy = ndcY * tanY;
  // Direction : l'avant, plus la droite et le haut multipliés par ces décalages.
  const d = [0, 1, 2].map((i) => forward[i] + right[i] * sx + up[i] * sy);
  // Sa longueur, ou 1 si elle est nulle.
  const len = Math.hypot(d[0], d[1], d[2]) || 1;
  // Renvoie la direction unitaire.
  return [d[0] / len, d[1] / len, d[2] / len];
// Fin de rayDirection.
}

/**
 * Première intersection d'un rayon (origine o, direction unitaire d) avec une sphère (centre c, rayon r), ou null.
 * Forme stable (pas de soustraction de deux grands nombres voisins) : précise quand la caméra frôle la surface.
 */
// Déclare et exporte raySphere : l'origine et la direction du rayon, le centre et le rayon de la sphère.
export function raySphere(o, d, c, r) {
  // Vecteur du centre de la sphère vers l'origine du rayon.
  const oc = [o[0] - c[0], o[1] - c[1], o[2] - c[2]];
  // Sa projection sur la direction du rayon.
  const b = dot(oc, d);
  // Carré de sa longueur, moins le carré du rayon.
  const k = dot(oc, oc) - r * r; // > 0 : origine hors de la sphère
  // Discriminant de l'équation.
  const disc = b * b - k;
  // Négatif : le rayon ne touche pas la sphère.
  if (disc < 0) return null;
  // Racine du discriminant.
  const s = Math.sqrt(disc);
  // Origine hors de la sphère (début).
  if (k > 0) {
    // La sphère est derrière : null.
    if (b >= 0) return null; // la sphère est derrière la caméra
    // Distance jusqu'à l'entrée dans la sphère.
    return k / (-b + s);     // = -b - s, sans perte de précision
  // Fin de ce cas.
  }
  // Origine dans la sphère : distance jusqu'à la sortie.
  return -b + s;             // caméra sous la surface : sortie du rayon
// Fin de raySphere.
}

/** Applique une matrice 4 × 4 (tableau de 16 nombres, colonnes comme three.js) à un point. */
// Déclare et exporte applyMatrix : une matrice de 16 nombres et un point.
export function applyMatrix(m, [x, y, z]) {
  // Renvoie le point transformé (début).
  return [
    // Sa coordonnée x.
    m[0] * x + m[4] * y + m[8] * z + m[12],
    // Sa coordonnée y.
    m[1] * x + m[5] * y + m[9] * z + m[13],
    // Sa coordonnée z.
    m[2] * x + m[6] * y + m[10] * z + m[14],
  // Fin du point.
  ];
// Fin de applyMatrix.
}

/** [lon°, lat°] d'un point du repère de la Terre du moteur : (cos la cos lo, sin la, -cos la sin lo). */
// Déclare et exporte toLonLat : un point du repère de la Terre.
export function toLonLat([x, y, z]) {
  // Sa distance au centre, ou 1 si elle est nulle.
  const len = Math.hypot(x, y, z) || 1;
  // Renvoie la longitude et la latitude en degrés.
  return [Math.atan2(-z, x) / RAD, Math.asin(Math.max(-1, Math.min(1, y / len))) / RAD];
// Fin de toLonLat.
}

/**
 * Coordonnées des coins et du centre de l'écran, et échelle au centre.
 * @param o  { origin, right, up, forward, tanY, aspect, center, radius, toLocal, widthPx }
 *   center / radius : sphère du sol dans le repère de la scène ; toLocal : matrice scène → repère de la Terre
 *   widthPx : largeur de l'écran en pixels CSS ; radiusM : rayon réel (m) de la sphère unité
 *   points : coins visés (par défaut ceux de l'écran ; voir `insetCorners` pour une zone réduite)
 */
// Déclare et exporte screenGeo : la caméra, la sphère du sol, la matrice vers le repère de la Terre, la largeur de l'écran, le rayon réel et les points visés.
export function screenGeo({ origin, right, up, forward, tanY, aspect, center, radius, toLocal, widthPx, radiusM = EARTH_RADIUS_M, points = SCREEN_CORNERS }) {
  // Les axes et le champ de la caméra.
  const view = { right, up, forward, tanY, aspect };
  // hit : point du sol sous un point de l'écran (début).
  const hit = (x, y) => {
    // Direction du rayon.
    const d = rayDirection(view, x, y);
    // Distance jusqu'à la sphère.
    const t = raySphere(origin, d, center, radius);
    // Le rayon manque la sphère : null.
    if (t === null) return null;
    // Point touché, dans la scène.
    const p = [origin[0] + d[0] * t, origin[1] + d[1] * t, origin[2] + d[2] * t];
    // Renvoie ce point, le même dans le repère de la Terre, et la distance.
    return { p, local: applyMatrix(toLocal, p), t };
  // Fin de hit.
  };
  // geo : latitude et longitude d'un point touché (début).
  const geo = (h) => {
    // Aucun point : null.
    if (!h) return null;
    // Longitude et latitude du point.
    const [lon, lat] = toLonLat(h.local);
    // Les renvoie.
    return { lat, lon };
  // Fin de geo.
  };
  // Coordonnées de chaque coin visé ; latitude et longitude nulles (null) quand le coin ne touche pas le sol.
  const corners = points.map((c) => ({ id: c.id, ...(geo(hit(c.x, c.y)) || { lat: null, lon: null }) }));
  // Point touché au centre de l'écran.
  const mid = hit(0, 0);
  // Échelle : écart au sol entre le centre et un point décalé d'un pixel (en mètres par pixel CSS).
  // Mètres par pixel : inconnus au départ.
  let metersPerPixel = null;
  // Avec un centre touché et une largeur d'écran (début).
  if (mid && widthPx > 0) {
    // Largeur d'un pixel en coordonnées normalisées.
    const step = 2 / widthPx;
    // Point touché un pixel à droite du centre.
    const side = hit(step, 0);
    // S'il touche le sol (début).
    if (side) {
      // Écart entre les deux points.
      const dx = side.p[0] - mid.p[0], dy = side.p[1] - mid.p[1], dz = side.p[2] - mid.p[2];
      // Cet écart, converti en mètres.
      metersPerPixel = (Math.hypot(dx, dy, dz) / radius) * radiusM;
    // Fin de ce cas.
    }
  // Fin du calcul de l'échelle.
  }
  // Renvoie le résultat (début).
  return {
    // Les coins.
    corners,
    // Le centre.
    center: geo(mid),
    // L'échelle.
    metersPerPixel,
    // L'altitude de la caméra en mètres.
    altitudeM: (Math.hypot(origin[0] - center[0], origin[1] - center[1], origin[2] - center[2]) / radius - 1) * radiusM,
  // Fin du résultat.
  };
// Fin de screenGeo.
}

/**
 * Coins d'une zone de l'écran réduite de marges (px CSS), en coordonnées normalisées : sur mobile, le bas de l'écran
 * est couvert par la barre d'outils, et le coin utile est juste au-dessus.
 */
// Déclare et exporte insetCorners : les quatre marges en pixels, la largeur et la hauteur de l'écran.
export function insetCorners({ top = 0, right = 0, bottom = 0, left = 0 } = {}, widthPx, heightPx) {
  // Bords gauche et droit de la zone, en coordonnées normalisées.
  const x0 = -1 + (2 * left) / widthPx, x1 = 1 - (2 * right) / widthPx;
  // Bords haut et bas de la zone.
  const y0 = 1 - (2 * top) / heightPx, y1 = -1 + (2 * bottom) / heightPx;
  // Renvoie les quatre coins ramenés sur ces bords.
  return SCREEN_CORNERS.map((c) => ({ ...c, x: c.x < 0 ? x0 : x1, y: c.y > 0 ? y0 : y1 }));
// Fin de insetCorners.
}

/** Nombre de décimales des degrés : environ un pixel à l'écran (1° de latitude ≈ 111,32 km), de 0 à 7 (≈ 1 cm). */
// Déclare et exporte gpsDecimals : l'échelle en mètres par pixel.
export function gpsDecimals(metersPerPixel) {
  // Échelle inconnue : 2 décimales.
  if (!(metersPerPixel > 0)) return 2;
  // Renvoie le nombre de décimales pour lequel un pas vaut environ un pixel, entre 0 et 7.
  return Math.max(0, Math.min(7, Math.ceil(Math.log10(111_320 / metersPerPixel))));
// Fin de gpsDecimals.
}

// Déclare et exporte formatLat : la valeur absolue avec le nombre de décimales voulu, suivie de N ou S.
export const formatLat = (lat, digits) => `${Math.abs(lat).toFixed(digits)}° ${lat >= 0 ? 'N' : 'S'}`;
// Déclare et exporte formatLon : de même, suivie de E ou O.
export const formatLon = (lon, digits) => `${Math.abs(lon).toFixed(digits)}° ${lon >= 0 ? 'E' : 'O'}`;
// Déclare et exporte formatLatLon : la latitude et la longitude séparées par une virgule.
export const formatLatLon = (lat, lon, digits) => `${formatLat(lat, digits)}, ${formatLon(lon, digits)}`;

/** Distance lisible : « 85 cm », « 10 m », « 2,5 km ». */
// Déclare et exporte formatDistance : une distance en mètres.
export function formatDistance(m) {
  // Sous un mètre : en centimètres.
  if (m < 1) return `${Math.round(m * 100)} cm`;
  // Sous un kilomètre : en mètres, avec trois chiffres significatifs.
  if (m < 1000) return `${Number(m.toPrecision(3)).toLocaleString('fr-FR')} m`;
  // Au-delà : en kilomètres, avec trois chiffres significatifs.
  return `${Number((m / 1000).toPrecision(3)).toLocaleString('fr-FR')} km`;
// Fin de formatDistance.
}

/**
 * Barre d'échelle : longueur ronde (1, 2 ou 5 × 10ⁿ m) dont le tracé fait entre `minPx` et `maxPx` pixels.
 * @returns { meters, px, label } ou null si l'échelle est inconnue
 */
// Déclare et exporte niceScale : l'échelle et les longueurs minimale et maximale de la barre (50 et 130 pixels par défaut).
export function niceScale(metersPerPixel, { minPx = 50, maxPx = 130 } = {}) {
  // Échelle inconnue : null.
  if (!(metersPerPixel > 0)) return null;
  // Plus grande distance que la barre peut représenter.
  const target = metersPerPixel * maxPx;
  // Puissance de dix juste en dessous.
  const pow = 10 ** Math.floor(Math.log10(target));
  // Longueur ronde : 5, 2 ou 1 fois cette puissance, la première qui tient entre les deux limites ; à défaut, la puissance elle-même.
  const meters = [5, 2, 1].map((k) => k * pow).find((m) => m / metersPerPixel >= minPx && m <= target) ?? pow;
  // Renvoie la distance, sa longueur en pixels et son libellé.
  return { meters, px: meters / metersPerPixel, label: formatDistance(meters) };
// Fin de niceScale.
}

/** Altitude d'un survol pour que la hauteur de l'écran couvre `meters` (champ vertical `fovDeg`). */
// Déclare et exporte altitudeForView : l'altitude d'où une hauteur donnée remplit l'écran, pour un champ de 45° par défaut.
export const altitudeForView = (meters, fovDeg = 45) => meters / (2 * Math.tan((fovDeg * RAD) / 2));

// ------------------------------------------------------------------ Saisie de coordonnées

// Motif d'un nombre : signe facultatif, chiffres, et décimales après un point ou une virgule.
const NUM = String.raw`[-+]?\d+(?:[.,]\d+)?`;
// toNum : convertit un texte en nombre, la virgule devenant un point.
const toNum = (s) => Number(String(s).replace(',', '.'));
// Lettres de latitude (N, S) et de longitude (E, O, W).
const LAT_LETTER = /[NS]/i, LON_LETTER = /[EOW]/i;

// signed : donne son signe à une valeur d'après sa lettre (début).
function signed(value, letter) {
  // Sans lettre : la valeur telle quelle.
  if (!letter) return value;
  // S, O ou W : négative ; sinon positive.
  return /[SOW]/i.test(letter) ? -Math.abs(value) : Math.abs(value);
// Fin de signed.
}

/**
 * Lit des coordonnées saisies : « 48.8584, 2.2945 », « 48,8584 ; 2,2945 », « 48.8584 N 2.2945 E »,
 * « 48°51'30"N 2°17'40"E », « -33.86 151.21 ». Ordre latitude puis longitude, sauf si les lettres disent l'inverse.
 * @returns {{ lat: number, lon: number } | null}
 */
// Déclare et exporte parseLatLon : le texte saisi.
export function parseLatLon(input) {
  // Le texte, sans espaces autour.
  const text = String(input || '').trim();
  // Vide : null.
  if (!text) return null;
  // Les deux parties lues : aucune pour l'instant.
  let parts = null;

  // Degrés, minutes, secondes.
  // Motif d'une coordonnée en degrés, minutes et secondes, avec une lettre facultative.
  const dms = new RegExp(String.raw`(${NUM})\s*°\s*(?:(${NUM})\s*['′’]\s*)?(?:(${NUM})\s*(?:"|″|''|’’)\s*)?([NSEOW])?`, 'gi');
  // Toutes les coordonnées de cette forme trouvées dans le texte.
  const found = [...text.matchAll(dms)];
  // S'il y en a exactement deux (début).
  if (found.length === 2) {
    // Pour chacune (début).
    parts = found.map((m) => {
      // Degrés, minutes et secondes ; les deux dernières valent 0 si elles manquent.
      const deg = toNum(m[1]), min = m[2] ? toNum(m[2]) : 0, sec = m[3] ? toNum(m[3]) : 0;
      // Valeur absolue en degrés décimaux.
      const abs = Math.abs(deg) + min / 60 + sec / 3600;
      // Renvoie la valeur, avec le signe des degrés, et la lettre.
      return { value: deg < 0 ? -abs : abs, letter: m[4] || '' };
    // Fin du traitement d'une coordonnée.
    });
  // Sinon, forme décimale (début).
  } else {
    // Décimaux : « ; » sépare toujours ; sinon virgule suivie d'un espace, espace seul, ou virgule entre deux points.
    // Les deux morceaux du texte.
    let chunks = [];
    // Avec un point-virgule : coupe au point-virgule.
    if (text.includes(';')) chunks = text.split(';');
    // Avec une virgule suivie d'un espace : coupe à cet endroit.
    else if (/,\s/.test(text)) chunks = text.split(/,\s+/);
    // Avec un espace : coupe à l'espace qui précède un nombre.
    else if (/\s/.test(text)) chunks = text.split(/\s+(?=[-+\d])/);
    // Avec une seule virgule et un point : coupe à la virgule.
    else if ((text.match(/,/g) || []).length === 1 && text.includes('.')) chunks = text.split(',');
    // Pas exactement deux morceaux : null.
    if (chunks.length !== 2) return null;
    // Motif d'un morceau : un nombre, avec une lettre facultative avant ou après.
    const one = new RegExp(String.raw`^\s*([NSEOW])?\s*(${NUM})\s*°?\s*([NSEOW])?\s*$`, 'i');
    // Pour chaque morceau (début).
    parts = chunks.map((c) => {
      // Compare le morceau au motif.
      const m = c.match(one);
      // Renvoie la valeur et la lettre, ou null si le morceau ne correspond pas.
      return m ? { value: toNum(m[2]), letter: m[3] || m[1] || '' } : null;
    // Fin du traitement d'un morceau.
    });
    // Un morceau illisible : null.
    if (parts.some((p) => !p)) return null;
  // Fin du choix de la forme.
  }

  // Les deux parties.
  let [a, b] = parts;
  // Si la première porte une lettre de longitude, ou la seconde une lettre de latitude, sans que l'autre fasse de même : elles sont échangées.
  if ((LON_LETTER.test(a.letter) && !LON_LETTER.test(b.letter)) || (LAT_LETTER.test(b.letter) && !LAT_LETTER.test(a.letter))) [a, b] = [b, a];
  // Latitude et longitude signées.
  const lat = signed(a.value, a.letter), lon = signed(b.value, b.letter);
  // Valeur non numérique, latitude au-delà de 90° ou longitude au-delà de 180° : null.
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // Renvoie la latitude et la longitude.
  return { lat, lon };
// Fin de parseLatLon.
}
