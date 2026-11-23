/**
 * Calculs de la caméra du globe CesiumJS, sur le modèle de la caméra three.js (mêmes commandes de la navball, du zoom
 * et du pilotage au téléphone). Fonctions pures, en degrés et en mètres.
 */

// Importe la conversion du glisser de la scène three.js (angle par pixel, raccourci de la vue 3/4).
import { dragRadPerPx, dragStep } from '../../Engine/AstreSolideEngine/InputEngine/touchMath.jsx';

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

/**
 * Point du repère terrestre de CesiumJS (ECEF : mètres, +Z vers le pôle Nord, +X vers la longitude 0) traduit dans le
 * repère des tuiles de la Terre de three.js (sphère de rayon 1, axe des pôles = +Y, longitude = atan2(−z, x)).
 * Avec `scale = 1`, traduit une direction (sans changer d'unité).
 */
// Déclare et exporte ecefToTilesLocal : x, y, z en ECEF et l'échelle (1 / rayon de la Terre en mètres par défaut).
export const ecefToTilesLocal = ({ x, y, z }, scale = 1 / EARTH_RADIUS_M) => [x * scale, z * scale, -y * scale];


/** Vitesse de rotation des flèches du clavier maintenues (rad/s), la même que dans la scène three.js. */
// Déclare et exporte la vitesse des flèches : 1,1 rad/s.
export const KEY_ROTATE_SPEED = 1.1;

/**
 * Glisser de (dx, dy) pixels traduit en déplacement sur la Terre, exactement comme dans la scène three.js : le sol
 * reste sous le doigt (angle par pixel d'après l'altitude, l'ouverture verticale et la hauteur de l'écran), et la vue
 * inclinée (3/4) agrandit le déplacement vertical. Renvoie { right, forward } en radians le long des axes de l'écran.
 */
// Déclare et exporte dragMove : le glisser et l'état de la caméra du globe (début).
export function dragMove(dx, dy, { altitudeM, fovyRad, viewportH, pitchDeg = -90 }) {
  // Angle par pixel : altitude en rayons terrestres, ouverture verticale en degrés, hauteur de l'écran.
  const radPerPx = dragRadPerPx(Math.max(0, altitudeM) / EARTH_RADIUS_M, (fovyRad * 180) / Math.PI, viewportH);
  // Inclinaison de la vue : 0 en regardant droit vers le sol (tangage −90°).
  const tilt = ((pitchDeg + 90) * Math.PI) / 180;
  // Même conversion que la scène three.js.
  return dragStep(dx, dy, radPerPx, tilt);
// Fin de dragMove.
}

/**
 * Flèches maintenues : déplacement de cette image le long des axes de l'écran (radians), d'autant plus fin qu'on est
 * près du sol (même facteur que la scène three.js : 0,9 × altitude / rayon, borné à 1), dt borné à 100 ms.
 */
// Déclare et exporte keyMove : les flèches enfoncées, le temps écoulé (ms) et l'altitude (m) (début).
export function keyMove(keys, dtMs, altitudeM) {
  // Finesse du pas selon la proximité du sol.
  const k = Math.max(1e-9, Math.min(1, (0.9 * Math.max(0, altitudeM)) / EARTH_RADIUS_M));
  // Pas de cette image.
  const step = Math.min(Math.max(0, dtMs), 100) * 0.001 * KEY_ROTATE_SPEED * k;
  // Droite moins gauche, haut moins bas.
  return { right: ((keys?.right ? 1 : 0) - (keys?.left ? 1 : 0)) * step, forward: ((keys?.up ? 1 : 0) - (keys?.down ? 1 : 0)) * step };
// Fin de keyMove.
}

/**
 * Rotation de la caméra autour du centre de la Terre qui la déplace de `right` et `forward` radians le long des axes de
 * l'écran posés sur le sol (comme moveOnSphere dans la scène three.js) : `up` = direction du cap sur le sol, `right`
 * = sa droite. `p` : position de la caméra (ECEF), `heading` : cap en radians (0 = nord, sens horaire).
 * Renvoie { axis, angle } pour `camera.rotate(axis, angle)` de CesiumJS (qui tourne de −angle autour de l'axe, sens
 * direct), ou null s'il n'y a rien à faire.
 */
// Déclare et exporte surfaceRotation : la position, le cap et le déplacement (début).
export function surfaceRotation(p, heading, right, forward) {
  // Angle total parcouru sur la sphère.
  const angle = Math.hypot(right, forward);
  // Rien : null.
  if (!(angle > 0)) return null;
  // Normale au sol sous la caméra (direction du centre vers la caméra).
  const r = Math.hypot(p.x, p.y, p.z) || 1, n = [p.x / r, p.y / r, p.z / r];
  // Tangente est : pôle (+Z) × normale, normalisée (au pôle exact : l'axe X).
  let e = [-n[1], n[0], 0]; const el = Math.hypot(e[0], e[1]); e = el > 1e-12 ? [e[0] / el, e[1] / el, 0] : [0, 1, 0];
  // Tangente nord : normale × est.
  const t = [n[1] * e[2] - n[2] * e[1], n[2] * e[0] - n[0] * e[2], n[0] * e[1] - n[1] * e[0]];
  // Haut de l'écran posé sur le sol (cap) et sa droite.
  const ch = Math.cos(heading), sh = Math.sin(heading);
  // Haut : nord tourné du cap vers l'est.
  const up = [0, 1, 2].map((i) => t[i] * ch + e[i] * sh);
  // Droite : est tourné du cap vers le sud.
  const rt = [0, 1, 2].map((i) => e[i] * ch - t[i] * sh);
  // Direction du déplacement sur le sol.
  const d = [0, 1, 2].map((i) => (rt[i] * right + up[i] * forward) / angle);
  // Axe de la rotation directe qui amène la normale vers d : normale × d.
  const axis = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
  // camera.rotate tourne de −angle : on lui passe −angle.
  return { axis, angle: -angle };
// Fin de surfaceRotation.
}
