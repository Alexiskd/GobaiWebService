// Vue 3/4 automatique : à l'approche du sol, la caméra s'incline progressivement vers l'horizon en gardant le lieu
// survolé au centre de l'écran. Fonctions pures, sans three.js (testées par cameraTilt.test.mjs).

/** Altitude (en rayons de l'astre) où l'inclinaison commence, puis où elle est complète. */
// Déclare et exporte l'altitude où l'inclinaison commence : 1,32 rayon.
export const TILT_START_RATIO = 1.32;
// Déclare et exporte l'altitude où elle est complète : 1,045 rayon.
export const TILT_FULL_RATIO = 1.045;
/** Inclinaison maximale depuis la verticale (≈ 60°) : vue 3/4 aérienne, horizon doucement courbé. */
// Déclare et exporte l'inclinaison maximale : 1,05 radian.
export const TILT_MAX_ANGLE = 1.05;
/** Constante de temps du mouvement (ms) : l'inclinaison s'installe en douceur, sans à-coup. */
// Déclare et exporte la constante de temps de l'inclinaison : 700 ms.
export const TILT_RESPONSE_MS = 700;
/** Constante de temps du recalage de la boussole (ms) : rotation douce vers le nord. */
// Déclare et exporte la constante de temps du recalage de la boussole : 550 ms.
export const HEADING_RESPONSE_MS = 550;

// smoothstep : courbe en S entre 0 et 1, à pente nulle aux deux bouts.
const smoothstep = (x) => x * x * (3 - 2 * x);
// TAU : un tour complet, 2π.
const TAU = Math.PI * 2;

/** 0 loin du sol, 1 près du sol, avec une rampe continue (smoothstep) sur toute la plage de zoom. */
// Déclare et exporte tiltEngagement : la distance au centre, en rayons de l'astre.
export function tiltEngagement(distRatio) {
  // Avancement entre l'altitude de début (0) et l'altitude d'inclinaison complète (1).
  const x = (TILT_START_RATIO - distRatio) / (TILT_START_RATIO - TILT_FULL_RATIO);
  // Le borne entre 0 et 1, puis applique la courbe en S.
  return smoothstep(Math.max(0, Math.min(1, x)));
// Fin de tiltEngagement.
}

/** Lissage exponentiel indépendant de la cadence (dt et tau en ms). */
// Déclare et exporte approachTilt : valeur actuelle, valeur visée, temps écoulé et constante de temps.
export function approachTilt(current, target, dtMs, tauMs = TILT_RESPONSE_MS) {
  // Avance vers la cible de la fraction 1 − e^(−dt/tau) de l'écart ; un temps négatif compte pour 0.
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));
// Fin de approachTilt.
}

/** Lissage d'un angle par le plus court chemin (passage ±π sans tour complet). */
// Déclare et exporte approachAngle : angle actuel, angle visé, temps écoulé et constante de temps.
export function approachAngle(current, target, dtMs, tauMs = HEADING_RESPONSE_MS) {
  // Écart entre les deux angles, ramené entre −π et π.
  const delta = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  // Avance de la fraction 1 − e^(−dt/tau) de cet écart.
  return current + delta * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));
// Fin de approachAngle.
}

/**
 * Pose 3/4 autour du point de surface (el, az).
 * La caméra reste exactement à `dist` du centre de l'astre (le zoom et l'altitude affichée ne changent pas) et se
 * décale tangentiellement vers le SUD en regardant vers le nord, ce qui fait apparaître la courbure du globe. `aim`
 * reçoit le point de surface visé : il reste au centre de l'image pendant toute la transition. `up` reçoit le « haut »
 * de l'image, toujours perpendiculaire à la visée : tangente nord à plat (nord en haut), puis il bascule
 * continûment vers la normale locale en s'inclinant (horizon en haut, sol en bas).
 *
 * Pourquoi le sud : à plat, le haut de l'image est le nord. Si la caméra reculait vers le nord (regard vers le sud),
 * l'horizon apparaîtrait en bas ; il faudrait alors une rotation de 180° de l'image quelque part entre la vue à plat et
 * la vue 3/4 — c'était l'inversion brutale de la caméra au dézoom. En reculant vers le sud, le nord reste en haut
 * à toutes les inclinaisons : aucune singularité, aucun retournement, à toutes les latitudes (pôles compris).
 *
 * `heading` fait pivoter la scène autour de la verticale locale (0 = nord en haut, π/2 = est en haut) : c'est le cap
 * de la boussole, pour recaler la caméra sur le nord géographique.
 * @param {{ radius:number, dist:number, el:number, az:number, angle:number, heading?:number, pos:any, aim:any, up:any }} p
 */
// Déclare et exporte tiltPose : rayon, distance, élévation et azimut du point, angle d'inclinaison, cap, et les trois vecteurs à remplir.
export function tiltPose({ radius, dist, el, az, angle, heading = 0, pos, aim, up }) {
  // Cosinus et sinus de l'élévation du point.
  const ce = Math.cos(el), se = Math.sin(el);
  // Sinus et cosinus de son azimut.
  const sa = Math.sin(az), ca = Math.cos(az);
  // Normale locale, tangente nord et tangente est (unitaires, sans singularité aux pôles).
  // Normale locale au point.
  const nx = ce * sa, ny = se, nz = ce * ca;
  // Tangente nord.
  const tx = -se * sa, ty = ce, tz = -se * ca;
  // Tangente est (sa composante verticale est nulle).
  const ex = ca, ez = -sa;
  // Cap : direction horizontale visée, combinaison linéaire des tangentes nord et est.
  // Cosinus et sinus du cap.
  const ch = Math.cos(heading), sh = Math.sin(heading);
  // Direction horizontale du cap.
  const hx = tx * ch + ex * sh, hy = ty * ch, hz = tz * ch + ez * sh;
  // Cosinus et sinus de l'angle d'inclinaison.
  const c = Math.cos(angle), s = Math.sin(angle);
  // Distance caméra → point visé pour que |caméra| reste égale à `dist` :
  // l² + 2·r·cos(angle)·l + r² − dist² = 0.
  // Distance entre la caméra et le point visé, solution positive de l'équation ; la racine est protégée contre un nombre négatif.
  const l = Math.sqrt(Math.max(0, dist * dist - radius * radius * s * s)) - radius * c;
  // Recul à l'opposé du cap (vers le sud quand on regarde le nord) : la visée pointe vers le cap et le sol.
  // Position de la caméra (début).
  pos.set(
    // Composante x : le point de surface, plus l fois (c·normale − s·cap).
    radius * nx + l * (c * nx - s * hx),
    // Composante y, de la même façon.
    radius * ny + l * (c * ny - s * hy),
    // Composante z, de la même façon.
    radius * nz + l * (c * nz - s * hz),
  // Fin de la position.
  );
  // Point visé : le point de surface.
  aim.set(radius * nx, radius * ny, radius * nz);
  // Haut de l'image = s·n + c·cap : unitaire et exactement perpendiculaire à la visée (−c·n + s·cap) pour tout
  // angle, donc jamais aligné avec elle (pas de basculement de lookAt), et indépendant de l'hémisphère.
  // Haut de l'image : s·normale + c·cap.
  up.set(s * nx + c * hx, s * ny + c * hy, s * nz + c * hz);
// Fin de tiltPose.
}
