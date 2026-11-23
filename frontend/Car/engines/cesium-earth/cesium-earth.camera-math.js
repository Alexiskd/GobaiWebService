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
// Tangage de la vue 3/4 automatique.
export const TILT_PITCH_DEG = -45;

/** Borne un tangage (degrés) entre le regard vertical et 30° sous l'horizon. */
// Déclare et exporte clampPitch : le tangage.
export const clampPitch = (p) => Math.max(PITCH_MIN_DEG, Math.min(PITCH_MAX_DEG, p));

/** Tangage de départ : vue 3/4 si elle est active, sinon regard vertical. */
// Déclare et exporte pitchForTilt : la vue 3/4 active ou non.
export const pitchForTilt = (tiltOn) => (tiltOn ? TILT_PITCH_DEG : PITCH_MIN_DEG);

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
