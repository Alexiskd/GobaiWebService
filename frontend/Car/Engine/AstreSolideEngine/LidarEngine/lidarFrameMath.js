// Visionneuse LiDAR HD de l'IGN en cadre : les coordonnées de la caméra de Gobai traduites dans les paramètres de
// l'adresse de la visionneuse (px, py, pz en ECEF WGS84 ; qx, qy, qz, qw en quaternion). Fonctions pures, sans
// three.js, testables seules (voir lidarFrameMath.test.jsx).

// Le demi-grand axe de l'ellipsoïde WGS84 (m).
// Demi-grand axe : 6 378 137 mètres.
export const WGS84_A = 6_378_137;
// Le carré de l'excentricité de l'ellipsoïde WGS84.
// Carré de la première excentricité.
export const WGS84_E2 = 6.69437999014e-3;

// L'adresse de la visionneuse LiDAR HD de l'IGN.
// Racine de l'adresse de la visionneuse.
export const LIDAR_VIEWER_URL = 'https://visionneuse-lidarhd.ign.fr/';
// La position GPS ancrée par l'adresse de référence : la caméra de l'URL d'origine, en degrés WGS84.
// Position de référence : Paris (48,878536° N, 2,303039° E).
export const LIDAR_FRAME_LOCATION = { lat: 48.878536, lon: 2.303039 };
// L'altitude de la caméra (m) sous laquelle le cadre s'ouvre : 0,22 km, comme demandé.
// Altitude d'ouverture du cadre : 220 mètres.
export const LIDAR_FRAME_ALT_M = 220;
// La distance au sol (m) autour de la position de référence sous laquelle le cadre s'ouvre.
// Rayon d'ouverture du cadre : 5 kilomètres.
export const LIDAR_FRAME_RADIUS_M = 5000;
// Le temps minimal (ms) entre deux rechargements de l'iframe : la visionneuse ne se pilote pas en continu,
// la recharger à chaque image la ferait clignoter sans fin.
// Délai minimal entre deux rechargements : 2,5 secondes.
export const LIDAR_FRAME_RELOAD_MS = 2500;

// quatMul : produit de Hamilton de deux quaternions [x, y, z, w] ; « a puis b » s'écrit quatMul(b, a).
// Déclare et exporte quatMul : les deux quaternions.
export function quatMul(a, b) {
  // Les composantes du premier quaternion.
  const [ax, ay, az, aw] = a;
  // Les composantes du second quaternion.
  const [bx, by, bz, bw] = b;
  // Renvoie le produit, dans l'ordre [x, y, z, w].
  return [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz];
// Fin de quatMul.
}

// La rotation du repère de la Terre du moteur vers l'ECEF : la Terre de Gobai porte sa latitude sur +Y et sa
// longitude vers −Z (voir InputEngine/gps.jsx, toLonLat), l'ECEF porte la latitude sur +Z. Le changement de base
// (x, y, z) → (x, −z, y) est un quart de tour autour de +X : quaternion (√2/2, 0, 0, √2/2).
// Quaternion de base : quart de tour autour de +X.
export const EARTH_TO_ECEF_Q = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];

// cameraEcefQuat : l'orientation de la caméra (repère de la Terre du moteur, convention three.js : regard vers
// −Z, haut vers +Y) traduite dans le repère ECEF de la visionneuse, même convention de caméra supposée.
// Déclare et exporte cameraEcefQuat : le quaternion dans le repère de la Terre.
export function cameraEcefQuat(q) {
  // La rotation de base appliquée après : le quaternion local devient ECEF.
  return quatMul(EARTH_TO_ECEF_Q, q);
// Fin de cameraEcefQuat.
}

// toEcef : la position géodésique WGS84 (degrés, altitude en mètres) en cartésiennes ECEF [x, y, z] en mètres.
// Déclare et exporte toEcef : latitude, longitude et altitude.
export function toEcef(latDeg, lonDeg, hM) {
  // Latitude et longitude en radians.
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
  // La grande normale de l'ellipsoïde au point.
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(lat) * Math.sin(lat));
  // Renvoie les coordonnées cartésiennes.
  return [(n + hM) * Math.cos(lat) * Math.cos(lon),
    (n + hM) * Math.cos(lat) * Math.sin(lon),
    (n * (1 - WGS84_E2) + hM) * Math.sin(lat)];
// Fin de toEcef.
}

// distM : la distance au sol (m) entre deux points [lat, lon] en degrés, orthodromie sur la sphère.
// Déclare et exporte distM : les deux points.
export function distM([lat1, lon1], [lat2, lon2]) {
  // Les quatre angles en radians.
  const la1 = lat1 * Math.PI / 180, la2 = lat2 * Math.PI / 180;
  // La moitié des différences de latitude et de longitude.
  const dla = (lat2 - lat1) * Math.PI / 360, dlo = (lon2 - lon1) * Math.PI / 360;
  // Le carré de la demi-corde.
  const k = Math.sin(dla) * Math.sin(dla) + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo) * Math.sin(dlo);
  // L'angle au centre, replié dans [0, π] par sécurité numérique.
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(k)));
  // Renvoie la distance, sur la sphère de 6 371 km.
  return c * 6_371_000;
// Fin de distM.
}

// shouldShowFrame : le cadre doit-il s'ouvrir ? Sous 0,22 km d'altitude et près de la position de référence.
// Déclare et exporte shouldShowFrame : latitude, longitude (degrés) et altitude (m) de la caméra.
export function shouldShowFrame({ lat, lon, altM }) {
  // Coordonnées finies seulement : ces cas restent fermés.
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altM)) return false;
  // Trop haut : fermé.
  if (altM >= LIDAR_FRAME_ALT_M) return false;
  // Trop loin de la position de référence : fermé.
  return distM([lat, lon], [LIDAR_FRAME_LOCATION.lat, LIDAR_FRAME_LOCATION.lon]) <= LIDAR_FRAME_RADIUS_M;
// Fin de shouldShowFrame.
}

// quatAngle : l'angle de rotation (radians) entre deux quaternions, double de l'arc entre leurs vecteurs.
// Déclare et exporte quatAngle : les deux quaternions.
export function quatAngle(a, b) {
  // Le cosinus de demi-angle, valeur absolue (une rotation et son inverse donnent le même écart).
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  // Renvoie l'angle replié dans [0, π].
  return 2 * Math.acos(Math.max(-1, Math.min(1, d)));
// Fin de quatAngle.
}

// cameraMoved : la caméra a-t-elle assez bougé pour justifier un rechargement de la visionneuse ?
// 25 m au sol ou d'altitude, 3° d'orientation.
// Déclare et exporte cameraMoved : les états { lat, lon, altM, q } avant et après.
export function cameraMoved(prev, next) {
  // Rien à comparer au premier état.
  if (!prev) return true;
  // Déplacement au sol ou en altitude.
  const movedM = Math.max(distM([prev.lat, prev.lon], [next.lat, next.lon]), Math.abs(prev.altM - next.altM));
  // Renvoie vrai dès qu'un seuil est franchi.
  return movedM >= 25 || quatAngle(prev.q, next.q) >= 3 * Math.PI / 180;
// Fin de cameraMoved.
}

// lidarFrameUrl : l'adresse de la visionneuse pour un état de caméra, aux arrondis de son format.
// Déclare et exporte lidarFrameUrl : latitude, longitude, altitude (m) et quaternion ECEF.
export function lidarFrameUrl({ lat, lon, altM, q }) {
  // La position ECEF de la caméra, au millimètre près.
  const [x, y, z] = toEcef(lat, lon, Math.max(0, altM));
  // Renvoie l'adresse complète, position au centimètre près et quaternion au millionième.
  return LIDAR_VIEWER_URL
    + `?px=${x.toFixed(2)}&py=${y.toFixed(2)}&pz=${z.toFixed(2)}`
    + `&qx=${q[0].toFixed(6)}&qy=${q[1].toFixed(6)}&qz=${q[2].toFixed(6)}&qw=${q[3].toFixed(6)}`;
// Fin de lidarFrameUrl.
}
