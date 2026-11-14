// Point bleu de la position de l'utilisateur : calculs sans three.js (testables seuls). Angles en degrés, écran en
// pixels CSS (x vers la droite, y vers le bas).

// Rayon minimal du halo de précision, en pixels.
export const ACCURACY_MIN_PX = 14;  // sous cette taille, le halo se confond avec le point : il est masqué
// Rayon maximal du halo de précision, en pixels.
export const ACCURACY_MAX_PX = 160; // au-delà, il couvrirait l'écran sans rien apprendre
// Rayon apparent de la Terre sous lequel le point est masqué, en pixels.
export const EARTH_MIN_PX = 30;     // Terre plus petite que ça à l'écran : le point est masqué

// norm360 : ramène un angle entre 0 et 360 degrés.
const norm360 = (deg) => ((deg % 360) + 360) % 360;

/**
 * Le point est-il du côté visible de la Terre ? `dot` = (direction du point) · (position de la caméra), sphère de
 * rayon 1 : il vaut 1 quand la caméra est à la hauteur de l'horizon du point, davantage au-dessus. La marge ne vaut
 * que quelques centimètres : le point reste affiché quand la caméra descend tout près du sol, juste au-dessus de lui.
 */
// aboveHorizon : vrai si le point est du côté visible de la Terre.
export const aboveHorizon = (dot) => dot > 1 + 1e-8;

/** Mètres par pixel CSS à la distance `distanceM` de la caméra (champ vertical `fovDeg`, hauteur d'écran `heightPx`). */
// Déclare et exporte metersPerPixel : la distance, l'angle de champ et la hauteur de l'écran.
export function metersPerPixel(distanceM, fovDeg, heightPx) {
  // Distance ou hauteur non positives : null.
  if (!(distanceM > 0) || !(heightPx > 0)) return null;
  // La hauteur vue à cette distance, divisée par la hauteur de l'écran.
  return (2 * distanceM * Math.tan((fovDeg * Math.PI) / 360)) / heightPx;
// Fin de metersPerPixel.
}

/** Rayon (px) du halo de précision, ou 0 quand il ne doit pas être dessiné. */
// Déclare et exporte accuracyRadiusPx : la précision en mètres et l'échelle en mètres par pixel.
export function accuracyRadiusPx(accuracyM, mpp) {
  // Valeurs non positives : pas de halo.
  if (!(accuracyM > 0) || !(mpp > 0)) return 0;
  // Rayon du halo, en pixels.
  const r = accuracyM / mpp;
  // Trop petit : pas de halo.
  if (r < ACCURACY_MIN_PX) return 0;
  // Arrondi et plafonné au maximum.
  return Math.min(ACCURACY_MAX_PX, Math.round(r));
// Fin de accuracyRadiusPx.
}

/** Rayon apparent (px) d'une sphère de rayon 1 vue à `distance` (même unité) de son centre. */
// Déclare et exporte apparentRadiusPx : la distance au centre, l'angle de champ et la hauteur de l'écran.
export function apparentRadiusPx(distance, fovDeg, heightPx) {
  // Caméra à la surface ou en dessous : rayon infini.
  if (!(distance > 1)) return Infinity; // caméra au ras du sol : la sphère remplit l'écran
  // Distance focale, en pixels.
  const focal = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  // Rayon apparent de la sphère de rayon 1.
  return focal / Math.sqrt(distance * distance - 1);
// Fin de apparentRadiusPx.
}

/** Direction du nord à l'écran, depuis le point (px, py) vers son voisin au nord (nx, ny) : 0 = haut, 90 = droite. */
// Déclare et exporte screenNorthDeg : le point et son voisin au nord, à l'écran.
export function screenNorthDeg(px, py, nx, ny) {
  // Écart entre les deux.
  const dx = nx - px, dy = ny - py;
  // Écart négligeable : 0.
  if (Math.hypot(dx, dy) < 1e-6) return 0;
  // Angle de cet écart, 0 vers le haut, 90 vers la droite.
  return norm360((Math.atan2(dx, -dy) * 180) / Math.PI);
// Fin de screenNorthDeg.
}

/** Rotation à donner au cône (dessiné pointe en haut) pour un cap `headingDeg` (0 = nord, 90 = est). */
// coneRotationDeg : la direction du nord à l'écran plus le cap, arrondie, entre 0 et 360.
export const coneRotationDeg = (northDeg, headingDeg) => Math.round(norm360(northDeg + headingDeg));

/**
 * Cap de l'appareil (0 = nord, 90 = est) lu dans un événement d'orientation, ou null s'il n'en donne pas.
 * iPhone : `webkitCompassHeading` ; Android : `alpha` d'un événement absolu (sens inverse des aiguilles).
 */
// Déclare et exporte compassHeading : un événement d'orientation et l'angle de rotation de l'écran.
export function compassHeading(event, screenAngle = 0) {
  // Le cap donné par l'iPhone, converti en nombre.
  const ios = Number(event?.webkitCompassHeading);
  // S'il existe : ce cap, corrigé de la rotation de l'écran.
  if (event?.webkitCompassHeading != null && Number.isFinite(ios)) return norm360(ios + screenAngle);
  // L'angle alpha, converti en nombre.
  const alpha = Number(event?.alpha);
  // Événement absolu avec un alpha : 360 moins alpha, corrigé de la rotation de l'écran.
  if (event?.absolute === true && event?.alpha != null && Number.isFinite(alpha)) return norm360(360 - alpha + screenAngle);
  // Sinon : pas de cap.
  return null;
// Fin de compassHeading.
}

/** Cap valide (0 … 360) ou null : le GPS renvoie NaN ou null à l'arrêt. */
// Déclare et exporte validHeading : reçoit une valeur de cap.
export function validHeading(value) {
  // La convertit en nombre.
  const h = Number(value);
  // Valeur présente et finie : ramenée entre 0 et 360 ; sinon null.
  return value != null && Number.isFinite(h) ? norm360(h) : null;
// Fin de validHeading.
}
