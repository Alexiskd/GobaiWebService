// Geste de la feuille d'actions du téléphone : on la tire vers le bas par sa poignée pour la refermer.
// Calculs purs (aucun accès au DOM), partagés par le composant et par ses tests.

/** Distance de tirage (px) au-delà de laquelle la feuille se referme au relâchement. */
// Distance de fermeture : 90 pixels.
export const CLOSE_DISTANCE = 90;
/** Vitesse vers le bas (px/ms) qui referme la feuille même après un tirage court (geste de balayage). */
// Vitesse de fermeture : 0,55 pixel par milliseconde.
export const CLOSE_VELOCITY = 0.55;
/** Tirage minimal (px) pour qu'un balayage rapide compte : en dessous, c'est un simple appui. */
// Tirage minimal d'un balayage : 12 pixels.
export const FLICK_MIN = 12;
/** Résistance quand on tire la feuille vers le haut : elle suit le doigt de moins en moins. */
// Résistance vers le haut : un quart du déplacement.
const RESISTANCE = 0.25;
// Montée maximale : 24 pixels.
const MAX_LIFT = 24;

/** Décalage vertical de la feuille (px) pour un doigt déplacé de `dy` px depuis l'appui. */
// Fonction dragOffset.
export function dragOffset(dy) {
  // Valeur non finie : 0.
  if (!Number.isFinite(dy)) return 0;
  // Vers le bas : la feuille suit le doigt.
  if (dy >= 0) return dy;
  // Vers le haut : un quart du déplacement, 24 pixels au plus.
  return -Math.min(MAX_LIFT, -dy * RESISTANCE);
// Fin de dragOffset.
}

/** Vitesse verticale (px/ms) entre deux positions du doigt ; 0 si les instants ne permettent pas de la mesurer. */
// Fonction dragVelocity.
export function dragVelocity(y0, t0, y1, t1) {
  // Durée entre les deux instants.
  const dt = t1 - t0;
  // Durée nulle, négative ou non finie : 0.
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  // Vitesse.
  const v = (y1 - y0) / dt;
  // La renvoie si elle est finie, sinon 0.
  return Number.isFinite(v) ? v : 0;
// Fin de dragVelocity.
}

/** Au relâchement : la feuille se referme-t-elle ? Tirage long, ou balayage rapide vers le bas. */
// Fonction shouldClose.
export function shouldClose(dy, velocity = 0) {
  // Pas de tirage vers le bas : non.
  if (!Number.isFinite(dy) || dy <= 0) return false;
  // Tirage long : oui.
  if (dy >= CLOSE_DISTANCE) return true;
  // Sinon : oui si le tirage et la vitesse suffisent.
  return dy >= FLICK_MIN && velocity >= CLOSE_VELOCITY;
// Fin de shouldClose.
}
