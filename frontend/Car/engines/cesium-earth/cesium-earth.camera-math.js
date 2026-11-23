/**
 * Calculs de la caméra du globe CesiumJS, sur le modèle de la caméra three.js (mêmes commandes de la navball, du zoom
 * et du pilotage au téléphone). Fonctions pures, en degrés et en mètres.
 */

// Rayon moyen de la Terre, en mètres.
export const EARTH_RADIUS_M = 6371000;
// Altitude minimale de la caméra du globe : 10 m.
export const MIN_ALTITUDE_M = 10;
// Tangage : regard vertical (−90°) jusqu'à 30° sous l'horizon (−30°), comme l'inclinaison maximale de three.js.
export const PITCH_MIN_DEG = -90;
// Tangage le plus proche de l'horizon.
export const PITCH_MAX_DEG = -30;
// Vue 3/4 automatique, comme three.js (CameraEngine/cameraTilt.jsx) : l'inclinaison commence à 1,32 rayon du centre,
// elle est complète à 1,045 rayon, et vaut alors 1,05 radian (≈ 60°) depuis la verticale.
export const TILT_START_RATIO = 1.32;
// Distance au centre (en rayons) de l'inclinaison complète.
export const TILT_FULL_RATIO = 1.045;
// Inclinaison maximale depuis la verticale, en degrés.
export const TILT_MAX_DEG = (1.05 * 180) / Math.PI;
// Constante de temps du mouvement (ms) : l'inclinaison s'installe en douceur, comme dans three.js.
export const TILT_RESPONSE_MS = 700;

/** Borne un tangage (degrés) entre le regard vertical et 30° sous l'horizon. */
// Déclare et exporte clampPitch : le tangage.
export const clampPitch = (p) => Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, p));

/** 0 loin du sol, 1 près du sol (courbe en S), d'après l'altitude (m) : même rampe que three.js. */
// Déclare et exporte tiltEngagement : l'altitude en mètres.
export function tiltEngagement(altitudeM) {
  // Distance au centre, en rayons.
  const ratio = 1 + altitudeM / EARTH_RADIUS_M;
  // Avancement entre le début (0) et l'inclinaison complète (1), borné.
  const x = Math.max(0, Math.min(1, (TILT_START_RATIO - ratio) / (TILT_START_RATIO - TILT_FULL_RATIO)));
  // Courbe en S.
  return x * x * (3 - 2 * x);
// Fin de tiltEngagement.
}

/** Tangage voulu (degrés) : vue 3/4 automatique selon l'altitude si elle est active, sinon regard vertical. */
// Déclare et exporte pitchForTilt : la vue 3/4 active ou non, l'altitude (m).
export const pitchForTilt = (tiltOn, altitudeM) => (tiltOn ? clampPitch(PITCH_MIN_DEG + TILT_MAX_DEG * tiltEngagement(altitudeM)) : PITCH_MIN_DEG);

/** Lissage exponentiel indépendant de la cadence (dt et tau en ms), comme approachTilt de three.js. */
// Déclare et exporte approachPitch : tangage actuel, voulu, temps écoulé.
export const approachPitch = (current, target, dtMs, tauMs = TILT_RESPONSE_MS) => current + (target - current) * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));

/**
 * Zoom three.js (facteur sur l'altitude : < 1 rapproche, > 1 éloigne) traduit en distance à parcourir (m) le long du
 * regard : positive = rapprocher. Jamais sous l'altitude minimale.
 */
// Déclare et exporte zoomStep : l'altitude (m) et le facteur.
export function zoomStep(altitudeM, f) {
  // Altitude visée, jamais sous le plancher.
  const next = Math.max(MIN_ALTITUDE_M, altitudeM * f);
  // Distance à parcourir : de l'altitude actuelle à l'altitude visée.
  return altitudeM - next;
// Fin de zoomStep.
}

/**
 * Déplacement three.js le long des axes de l'écran (radians, pas d'autant plus fin qu'on est près du sol : facteur
 * 0,9 × altitude / rayon) traduit en angles de rotation autour du centre de la Terre (radians).
 */
// Déclare et exporte moveAngles : les pas à droite et en avant, l'altitude (m).
export function moveAngles(right, forward, altitudeM) {
  // Finesse du pas : comme surfaceRatio × 0,9 dans three.js, bornée à 1.
  const k = Math.max(1e-9, Math.min(1, (0.9 * altitudeM) / EARTH_RADIUS_M));
  // Angles de rotation.
  return { right: right * k, forward: forward * k };
// Fin de moveAngles.
}

/** Cap normalisé entre 0 et 360°. */
// Déclare et exporte wrapHeading : le cap en degrés.
export const wrapHeading = (h) => ((h % 360) + 360) % 360;
