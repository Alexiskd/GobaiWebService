// Pilotage de la caméra en penchant le téléphone (boutons ⬆️ et 🚀 de la navball, nord verrouillé en haut).
// Inclinaison : 0 = téléphone à plat, 90 = dressé. Les angles sont lus par rapport à la tenue de départ.

/**
 * Inclinaison du téléphone (degrés) le long du haut de l'écran : 0 = à plat écran vers le ciel, 90 = dressé à la
 * verticale. `beta` (bascule avant/arrière) en portrait, `gamma` (bascule gauche/droite) en paysage, selon
 * `screenAngle`. Renvoie null si l'événement ne porte pas d'angles.
 */
// Déclare et exporte devicePitchDeg : l'événement d'orientation et l'angle de l'écran (0 par défaut).
export function devicePitchDeg(event, screenAngle = 0) {
  // Les angles beta et gamma de l'événement, ou rien s'il est absent.
  const { beta, gamma } = event || {};
  // Si l'un des deux n'est pas un nombre fini : null.
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  // Angle de l'écran arrondi au quart de tour et ramené entre 0 et 359 ; un angle invalide compte pour 0.
  const angle = (((Math.round((Number.isFinite(screenAngle) ? screenAngle : 0) / 90) * 90) % 360) + 360) % 360;
  // Écran tourné de 90° : l'opposé de gamma.
  if (angle === 90) return -gamma;
  // Écran tourné de 270° : gamma.
  if (angle === 270) return gamma;
  // Écran tourné de 180° : l'opposé de beta.
  if (angle === 180) return -beta;
  // Écran droit : beta.
  return beta;
// Fin de devicePitchDeg.
}

/**
 * Bascule latérale du téléphone (degrés), positive quand le côté droit de l'écran descend : `gamma` en portrait,
 * `beta` en paysage, selon `screenAngle`. Renvoie null si l'événement ne porte pas d'angles.
 */
// Déclare et exporte deviceRollDeg : l'événement d'orientation et l'angle de l'écran (0 par défaut).
export function deviceRollDeg(event, screenAngle = 0) {
  // Les angles beta et gamma de l'événement, ou rien s'il est absent.
  const { beta, gamma } = event || {};
  // Si l'un des deux n'est pas un nombre fini : null.
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  // Angle de l'écran arrondi au quart de tour et ramené entre 0 et 359 ; un angle invalide compte pour 0.
  const angle = (((Math.round((Number.isFinite(screenAngle) ? screenAngle : 0) / 90) * 90) % 360) + 360) % 360;
  // Écran tourné de 90° : beta.
  if (angle === 90) return beta;
  // Écran tourné de 270° : l'opposé de beta.
  if (angle === 270) return -beta;
  // Écran tourné de 180° : l'opposé de gamma.
  if (angle === 180) return -gamma;
  // Écran droit : gamma.
  return gamma;
// Fin de deviceRollDeg.
}

/** Déplacement latéral au gyroscope : vitesse angulaire maximale autour de l'astre (radians par seconde, vue de loin). */
// Déclare et exporte la vitesse maximale du déplacement latéral : 1,6 radian par seconde.
export const PAN_MAX_RAD_PER_S = 1.6;

/**
 * Vitesse de déplacement horizontal (radians par seconde, signée) quand le téléphone est penché de `deltaDeg` sur
 * le côté par rapport à sa tenue de départ : vers la droite = positif (la vue part à droite), vers la gauche = négatif.
 * Même zone morte et même progressivité que le zoom. `sensitivity` (réglage de l'utilisateur) multiplie l'angle lu :
 * à 2, il suffit de pencher deux fois moins.
 */
// Déclare et exporte tiltPanRate : l'écart d'inclinaison en degrés et la sensibilité (1 par défaut).
export function tiltPanRate(deltaDeg, sensitivity = 1) {
  // Multiplie l'écart par la sensibilité.
  deltaDeg *= sensitivity;
  // Part de l'écart qui dépasse la zone morte.
  const lean = Math.abs(deltaDeg) - ZOOM_DEAD_DEG;
  // Dans la zone morte : vitesse nulle.
  if (!(lean > 0)) return 0;
  // Renvoie la vitesse, du signe de l'écart : elle croît jusqu'au plein régime, puis reste à son maximum.
  return Math.sign(deltaDeg) * Math.min(1, lean / (ZOOM_FULL_DEG - ZOOM_DEAD_DEG)) * PAN_MAX_RAD_PER_S;
// Fin de tiltPanRate.
}

/** Zoom au gyroscope : zone morte autour de la tenue de départ, plein régime à ZOOM_FULL_DEG, vitesse maximale par seconde. */
// Déclare et exporte la zone morte : 3 degrés.
export const ZOOM_DEAD_DEG = 3;
// Déclare et exporte l'inclinaison de plein régime : 18 degrés.
export const ZOOM_FULL_DEG = 18;
// Déclare et exporte le facteur de zoom maximal par seconde : 4.
export const ZOOM_MAX_PER_S = 4;

/**
 * Facteur de zoom à appliquer pendant `dtSec` quand le téléphone est penché de `deltaDeg` par rapport à sa tenue de
 * départ : vers l'avant (haut de l'écran qui s'abaisse, delta < 0) rapproche (< 1), vers l'arrière éloigne (> 1).
 * Plus on penche, plus ça va vite ; 1 dans la zone morte, pour tenir le téléphone sans que la vue bouge.
 * `sensitivity` (réglage de l'utilisateur) multiplie l'angle lu.
 */
// Déclare et exporte tiltZoomFactor : l'écart d'inclinaison, la durée en secondes et la sensibilité (1 par défaut).
export function tiltZoomFactor(deltaDeg, dtSec, sensitivity = 1) {
  // Multiplie l'écart par la sensibilité.
  deltaDeg *= sensitivity;
  // Part de l'écart qui dépasse la zone morte.
  const lean = Math.abs(deltaDeg) - ZOOM_DEAD_DEG;
  // Dans la zone morte, ou sans durée positive : facteur 1.
  if (!(lean > 0) || !(dtSec > 0)) return 1;
  // Régime entre 0 et 1.
  const rate = Math.min(1, lean / (ZOOM_FULL_DEG - ZOOM_DEAD_DEG));
  // Renvoie 4 puissance (signe de l'écart × régime × durée) : inférieur à 1 pour un écart négatif, supérieur à 1 pour un écart positif.
  return Math.pow(ZOOM_MAX_PER_S, Math.sign(deltaDeg) * rate * dtSec);
// Fin de tiltZoomFactor.
}

/** Lissage simple d'une valeur (inclinaison) : `prev` null pour démarrer. */
// Déclare et exporte smoothValue : la valeur précédente, la nouvelle et le coefficient (0,25 par défaut).
export function smoothValue(prev, value, k = 0.25) {
  // Sans valeur précédente : la nouvelle ; sinon un pas du quart de l'écart vers la nouvelle.
  return prev == null ? value : prev + (value - prev) * k;
// Fin de smoothValue.
}

/**
 * Déplace le point survolé le long des axes de l'écran : `right` radians vers la droite, `forward` radians vers le
 * haut de l'écran (le nord, quand il est verrouillé en haut). `az`, `el` : longitude et latitude du point survolé
 * dans la scène ; `heading` : cap de la caméra (0 = nord de la scène en haut, π/2 = est en haut).
 * Renvoie { az, el } ; `az` reste continu (pas de saut de ±2π) et `el` s'arrête juste avant les pôles de la scène.
 */
// Déclare et exporte moveOnSphere : la vue (az, el, cap), les déplacements vers la droite et vers le haut, et la latitude limite (1,5 radian par défaut).
export function moveOnSphere({ az, el, heading = 0 }, right = 0, forward = 0, elMax = 1.5) {
  // Sinus et cosinus de az et de el.
  const sa = Math.sin(az), ca = Math.cos(az), se = Math.sin(el), ce = Math.cos(el);
  // Normale au point survolé.
  const n = [ce * sa, se, ce * ca];        // normale au point survolé
  // Tangente nord.
  const t = [-se * sa, ce, -se * ca];      // tangente nord
  // Tangente est.
  const e = [ca, 0, -sa];                  // tangente est
  // Cosinus et sinus du cap.
  const ch = Math.cos(heading), sh = Math.sin(heading);
  // Direction du haut de l'écran : mélange des tangentes nord et est selon le cap.
  const up = [t[0] * ch + e[0] * sh, t[1] * ch + e[1] * sh, t[2] * ch + e[2] * sh]; // haut de l'écran
  // Direction de la droite de l'écran : produit vectoriel du haut et de la normale.
  const rt = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]]; // droite = haut × normale
  // Nouveau point : la normale, décalée vers la droite et vers le haut.
  const v = [0, 1, 2].map((i) => n[i] + rt[i] * right + up[i] * forward);
  // Sa longueur, ou 1 si elle est nulle.
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  // Nouvelle latitude : l'arc sinus de la composante verticale, bornée à la latitude limite.
  const nextEl = Math.max(-elMax, Math.min(elMax, Math.asin(Math.max(-1, Math.min(1, v[1] / len)))));
  // Nouvelle longitude visée.
  const target = Math.atan2(v[0], v[2]);
  // Un tour complet.
  const TAU = 2 * Math.PI;
  // Écart avec la longitude actuelle, ramené entre −π et π.
  const delta = ((target - az + Math.PI) % TAU + TAU) % TAU - Math.PI;
  // Renvoie la longitude, avancée de cet écart, et la nouvelle latitude.
  return { az: az + delta, el: nextEl };
// Fin de moveOnSphere.
}

/**
 * Passage par un pôle de la scène sans blocage. La vue est décrite par { az, el, heading } ; quand `el` dépasse ±π/2,
 * on réécrit la même vue de l'autre côté du pôle : az + π, el replié, cap + π. Les trois changements se compensent
 * exactement (même point survolé, même haut de l'écran) : rien ne saute à l'image.
 * Renvoie { az, el, heading, crossed } ; `crossed` vrai si le pôle a été franchi.
 */
// Déclare et exporte crossPole : la vue (az, el, cap).
export function crossPole({ az, el, heading = 0 }) {
  // Un quart de tour.
  const H = Math.PI / 2;
  // Au-delà du pôle nord : az + π, el replié en π − el, cap + π, et pôle franchi.
  if (el > H) return { az: az + Math.PI, el: Math.PI - el, heading: heading + Math.PI, crossed: true };
  // Au-delà du pôle sud : az + π, el replié en −π − el, cap + π, et pôle franchi.
  if (el < -H) return { az: az + Math.PI, el: -Math.PI - el, heading: heading + Math.PI, crossed: true };
  // Sinon : la vue inchangée, pôle non franchi.
  return { az, el, heading, crossed: false };
// Fin de crossPole.
}

/**
 * Sens des flèches du clavier selon le cap : +1 quand le nord de la scène est vers le haut de l'écran, −1 quand il
 * est vers le bas (après le passage d'un pôle). « Haut » continue ainsi tout droit par-dessus le pôle, et « droite »
 * reste la droite de l'écran.
 */
// Déclare et exporte arrowSign : 1 si le cosinus du cap est positif ou nul, sinon −1.
export const arrowSign = (heading = 0) => (Math.cos(heading) >= 0 ? 1 : -1);
