// Vue 3/4 automatique : à l'approche du sol, la caméra s'incline progressivement vers l'horizon en gardant le lieu
// survolé au centre de l'écran. Fonctions pures, sans three.js (testées par cameraTilt.test.mjs).

/** Altitude (en rayons de l'astre) où l'inclinaison commence, puis où elle est complète. */
export const TILT_START_RATIO = 1.32;
export const TILT_FULL_RATIO = 1.045;
/** Inclinaison maximale depuis la verticale (≈ 60°) : vue 3/4 aérienne, horizon doucement courbé. */
export const TILT_MAX_ANGLE = 1.05;
/** Constante de temps du mouvement (ms) : l'inclinaison s'installe en douceur, sans à-coup. */
export const TILT_RESPONSE_MS = 700;
/** Constante de temps du recalage de la boussole (ms) : rotation douce vers le nord. */
export const HEADING_RESPONSE_MS = 550;

const smoothstep = (x) => x * x * (3 - 2 * x);
const TAU = Math.PI * 2;

/** 0 loin du sol, 1 près du sol, avec une rampe continue (smoothstep) sur toute la plage de zoom. */
export function tiltEngagement(distRatio) {
  const x = (TILT_START_RATIO - distRatio) / (TILT_START_RATIO - TILT_FULL_RATIO);
  return smoothstep(Math.max(0, Math.min(1, x)));
}

/** Lissage exponentiel indépendant de la cadence (dt et tau en ms). */
export function approachTilt(current, target, dtMs, tauMs = TILT_RESPONSE_MS) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));
}

/** Lissage d'un angle par le plus court chemin (passage ±π sans tour complet). */
export function approachAngle(current, target, dtMs, tauMs = HEADING_RESPONSE_MS) {
  const delta = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return current + delta * (1 - Math.exp(-Math.max(0, dtMs) / tauMs));
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
export function tiltPose({ radius, dist, el, az, angle, heading = 0, pos, aim, up }) {
  const ce = Math.cos(el), se = Math.sin(el);
  const sa = Math.sin(az), ca = Math.cos(az);
  // Normale locale, tangente nord et tangente est (unitaires, sans singularité aux pôles).
  const nx = ce * sa, ny = se, nz = ce * ca;
  const tx = -se * sa, ty = ce, tz = -se * ca;
  const ex = ca, ez = -sa;
  // Cap : direction horizontale visée, combinaison linéaire des tangentes nord et est.
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const hx = tx * ch + ex * sh, hy = ty * ch, hz = tz * ch + ez * sh;
  const c = Math.cos(angle), s = Math.sin(angle);
  // Distance caméra → point visé pour que |caméra| reste égale à `dist` :
  // l² + 2·r·cos(angle)·l + r² − dist² = 0.
  const l = Math.sqrt(Math.max(0, dist * dist - radius * radius * s * s)) - radius * c;
  // Recul à l'opposé du cap (vers le sud quand on regarde le nord) : la visée pointe vers le cap et le sol.
  pos.set(
    radius * nx + l * (c * nx - s * hx),
    radius * ny + l * (c * ny - s * hy),
    radius * nz + l * (c * nz - s * hz),
  );
  aim.set(radius * nx, radius * ny, radius * nz);
  // Haut de l'image = s·n + c·cap : unitaire et exactement perpendiculaire à la visée (−c·n + s·cap) pour tout
  // angle, donc jamais aligné avec elle (pas de basculement de lookAt), et indépendant de l'hémisphère.
  up.set(s * nx + c * hx, s * ny + c * hy, s * nz + c * hz);
}
