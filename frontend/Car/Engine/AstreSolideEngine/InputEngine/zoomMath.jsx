// Calculs du zoom fluide et stable, communs à la scène three.js (engine.jsx) et au globe CesiumJS
// (engines/astre-solide/astre-solide.camera.js). Fonctions pures, testées dans zoomMath.test.jsx.
//
// Trois causes d'à-coups corrigées :
//  1. Saut de la première image : après un moment sans dessin (repos à 20 images par seconde, globe CesiumJS qui ne
//     redessine qu'au besoin), le temps écoulé de la première image du zoom valait jusqu'à 100 ms, et la caméra faisait
//     d'un coup 65 % du chemin. Le temps pris en compte par le lissage est désormais borné à ZOOM_DT_MAX_MS.
//  2. Visée qui s'emballe : chaque cran de molette multipliait la visée, sans lien avec la caméra ; une molette lancée
//     vite visait des milliers de km plus loin, puis la caméra « tombait » ou continuait longtemps après le geste.
//     La visée reste désormais au plus à ZOOM_LEAD_MAX fois l'altitude où se trouve la caméra (leadBound).
//  3. Molettes différentes : Firefox compte en lignes (deltaMode 1, ±3 par cran), certaines souris en pages ; le zoom y
//     était presque nul ou brutal. Les écarts sont ramenés en pixels (wheelDeltaPx).

/** Temps maximal (ms) pris en compte par image pour le lissage du zoom : une image à 30 images par seconde. */
// Déclare et exporte le temps maximal par image.
export const ZOOM_DT_MAX_MS = 34;

/** Avance maximale de la visée sur la caméra : la visée reste entre altitude ÷ 6 et altitude × 6. */
// Déclare et exporte l'avance maximale.
export const ZOOM_LEAD_MAX = 6;

/** Écart maximal de molette pris par événement (pixels), dans un sens comme dans l'autre. */
// Déclare et exporte l'écart maximal.
export const WHEEL_MAX_PX = 120;

/** Hauteur d'une ligne de molette (pixels), pour deltaMode 1 (Firefox). */
// Déclare et exporte la hauteur d'une ligne.
export const WHEEL_LINE_PX = 16;

/**
 * Part du chemin parcourue en une image par un rapprochement lissé de constante de temps tauMs :
 * 1 − e^(−dt/τ), avec dt borné entre 0 et ZOOM_DT_MAX_MS (pas de saut après une pause).
 */
// Déclare et exporte easeFactor : le temps écoulé et la constante de temps (ms).
export function easeFactor(dtMs, tauMs) {
  // Temps borné.
  const dt = Math.min(Math.max(0, Number(dtMs) || 0), ZOOM_DT_MAX_MS);
  // Constante illisible : chemin fait d'un coup.
  if (!(tauMs > 0)) return 1;
  // Part du chemin.
  return 1 - Math.exp(-dt / tauMs);
// Fin de easeFactor.
}

/**
 * Altitude visée tenue près de l'altitude actuelle : entre actuelle ÷ max et actuelle × max.
 * Altitude actuelle illisible ou nulle : la visée telle quelle.
 */
// Déclare et exporte leadBound : l'altitude visée, l'altitude actuelle et l'avance maximale.
export function leadBound(goal, current, max = ZOOM_LEAD_MAX) {
  // Altitude actuelle illisible : pas de borne.
  if (!(current > 0) || !(max > 1)) return goal;
  // Visée bornée autour de l'altitude actuelle.
  return Math.min(current * max, Math.max(current / max, goal));
// Fin de leadBound.
}

/**
 * Écart vertical d'un événement de molette, en pixels, borné à ±WHEEL_MAX_PX.
 * deltaMode : 0 pixels, 1 lignes, 2 pages (pageHeight pixels).
 */
// Déclare et exporte wheelDeltaPx : l'événement et la hauteur d'une page.
export function wheelDeltaPx(e, pageHeight = 800) {
  // Écart brut.
  const raw = Number(e?.deltaY) || 0;
  // Converti en pixels selon l'unité.
  const px = e?.deltaMode === 1 ? raw * WHEEL_LINE_PX : e?.deltaMode === 2 ? raw * pageHeight : raw;
  // Borné.
  return Math.max(-WHEEL_MAX_PX, Math.min(WHEEL_MAX_PX, px));
// Fin de wheelDeltaPx.
}
