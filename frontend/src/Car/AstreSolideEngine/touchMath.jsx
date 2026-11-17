// Gestes sur la scène (doigt, souris) : conversions en déplacements de la caméra. Fonctions pures.

/** Vue lointaine : le glisser ne dépasse pas cette vitesse (rad par pixel), celle d'un globe que l'on fait tourner. */
// Vitesse maximale du glisser, en radians par pixel.
export const DRAG_MAX_RAD_PER_PX = 0.006;
/** Zoom d'un seul événement de pincement, borné : un doigt qui saute ne projette pas la caméra. */
// Facteur de zoom minimal d'un événement de pincement.
export const PINCH_MIN = 0.82;
// Facteur de zoom maximal d'un événement de pincement.
export const PINCH_MAX = 1.22;

// clamp : borne une valeur entre un minimum et un maximum.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Angle parcouru sur l'astre (radians) par pixel de glisser, pour que le sol reste sous le doigt : au centre de
 * l'écran, un pixel couvre 2·altitude·tan(champ/2)/hauteur mètres, soit cet angle une fois divisé par le rayon.
 * `surfaceRatio` : altitude de la caméra en rayons de l'astre ; `viewportH` : hauteur de l'écran en pixels CSS.
 */
// Déclare et exporte dragRadPerPx : l'altitude en rayons, l'angle de champ et la hauteur de l'écran.
export function dragRadPerPx(surfaceRatio, fovDeg, viewportH) {
  // Hauteur ou champ non positifs : 0.
  if (!(viewportH > 0) || !(fovDeg > 0)) return 0;
  // Angle exact couvert par un pixel au centre de l'écran (altitude jamais nulle).
  const exact = (2 * Math.max(surfaceRatio, 1e-9) * Math.tan((fovDeg * Math.PI) / 360)) / viewportH;
  // Plafonné à la vitesse maximale.
  return Math.min(exact, DRAG_MAX_RAD_PER_PX);
// Fin de dragRadPerPx.
}

/**
 * Déplacement de la caméra pour un glisser de (dx, dy) pixels : le sol suit le doigt, donc la caméra part à
 * l'opposé horizontalement. Vue inclinée (3/4) : le sol est vu en raccourci vers le haut de l'écran, le déplacement
 * vertical est agrandi d'autant (borné : près de l'horizon le raccourci tend vers l'infini).
 * Renvoie { right, forward } en radians, le long de la droite et du haut de l'écran.
 */
// Déclare et exporte dragStep : le glisser en pixels, l'angle par pixel et l'inclinaison de la vue.
export function dragStep(dx, dy, radPerPx, tilt = 0) {
  // Raccourci de la vue inclinée : le cosinus de l'inclinaison (bornée entre 0 et 90°), jamais sous 0,35.
  const foreshortening = Math.max(Math.cos(clamp(tilt, 0, Math.PI / 2)), 0.35);
  // Déplacement : opposé au doigt horizontalement, agrandi par le raccourci verticalement.
  return { right: -dx * radPerPx, forward: (dy * radPerPx) / foreshortening };
// Fin de dragStep.
}

/** Facteur de zoom d'un pincement : l'altitude suit l'écartement des doigts (écartés de 10 % → 10 % plus près). */
// Déclare et exporte pinchFactor : l'écartement précédent et le nouvel écartement des doigts.
export function pinchFactor(previousDistance, distance) {
  // Écartement nul ou illisible : facteur 1, sans effet.
  if (!(previousDistance > 0) || !(distance > 0)) return 1;
  // Le rapport des deux écartements, borné.
  return clamp(previousDistance / distance, PINCH_MIN, PINCH_MAX);
// Fin de pinchFactor.
}

/**
 * Doigts fantômes : un nouveau premier doigt (`isPrimary`) signifie qu'aucun autre contact du même type n'est en
 * cours ; ceux encore en mémoire ont perdu leur « pointerup » (geste système, doigt sorti de l'écran).
 * Renvoie les identifiants à oublier. `pointers` : id → { type }.
 */
// Déclare et exporte stalePointers : les pointeurs en mémoire et le nouveau pointeur.
export function stalePointers(pointers, { pointerId, pointerType, isPrimary }) {
  // Ce n'est pas un premier doigt : rien à oublier.
  if (!isPrimary) return [];
  // Tous les autres pointeurs du même type sont à oublier.
  return Object.keys(pointers).filter((id) => String(id) !== String(pointerId) && pointers[id].type === pointerType);
// Fin de stalePointers.
}
