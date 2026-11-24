/**
 * Calculs purs de la couche de pollution lumineuse : position dans la mosaïque mondiale des lumières (Web Mercator,
 * comme l'atlas 2025) et part de nuit d'un point selon le Soleil. Les mêmes formules sont écrites dans le shader
 * (pollution-lumineuse.shader.js) ; elles sont testées ici.
 */

// Latitude maximale du Web Mercator (degrés).
export const MERCATOR_MAX_LAT = 85.0511287798;

/**
 * Coordonnées (u, v) dans la mosaïque Web Mercator d'une direction du repère des tuiles de la Terre (axe des pôles
 * = +Y, longitude = atan2(−z, x)) : u de 0 (−180°) à 1 (+180°), v de 0 (nord, haut de l'image) à 1 (sud).
 */
// Déclare et exporte mosaicUv : la direction [x, y, z] (début).
export function mosaicUv([x, y, z]) {
  // Longueur de la direction.
  const r = Math.hypot(x, y, z) || 1;
  // Longitude (radians).
  const lon = Math.atan2(-z, x);
  // Latitude bornée au Web Mercator (radians).
  const lat = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, (Math.asin(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI)) * (Math.PI / 180);
  // u : la longitude ramenée entre 0 et 1.
  const u = lon / (2 * Math.PI) + 0.5;
  // v : l'ordonnée Mercator ramenée entre 0 (nord) et 1 (sud).
  const v = 0.5 - Math.log(Math.tan(Math.PI / 4 + lat / 2)) / (2 * Math.PI);
  // Renvoie u et v.
  return { u, v };
// Fin de mosaicUv.
}

/**
 * Part de nuit d'un point (0 de jour, 1 de nuit), d'après le cosinus de l'angle entre la verticale du point et la
 * direction du Soleil : la transition suit le crépuscule (de +0,05 à −0,12, soit du coucher à la nuit noire).
 * Vue de nuit (`lightView`) : nuit partout.
 */
// Déclare et exporte nightAmount : le cosinus et la vue de nuit (début).
export function nightAmount(cosSun, lightView = 0) {
  // Vue de nuit : toute la Terre de nuit.
  if (lightView > 0.5) return 1;
  // Avancement entre le coucher (+0,05) et la nuit noire (−0,12), borné.
  const t = Math.max(0, Math.min(1, (0.05 - cosSun) / 0.17));
  // Courbe en S.
  return t * t * (3 - 2 * t);
// Fin de nightAmount.
}

// Lumière gardée sur la face de nuit (sol à peine visible, comme sur les photos de la Terre de nuit sans lune).
export const NIGHT_FLOOR = 0.04;
// Terminateur : dégradé de la lumière du sol entre ces deux cosinus de la hauteur du Soleil (−0,28 ≈ 16° sous
// l'horizon : fin du crépuscule ; +0,30 ≈ 17° au-dessus : plein jour).
export const TERMINATOR_LO = -0.28;
export const TERMINATOR_HI = 0.3;
// Atténuation du plein jour quand le Soleil descend (Soleil au zénith : 1 ; à l'horizon : 0,75).
export const DAY_DIM = 0.25;

/**
 * Lumière du jour reçue par le sol (0 nuit noire, 1 Soleil au zénith), d'après le cosinus de la hauteur du Soleil :
 * dégradé en S du crépuscule (16° sous l'horizon) au plein jour (17° au-dessus), sans cassure, et léger
 * assombrissement du jour quand le Soleil est bas. Terminateur large et doux, comme sur les photos prises de l'espace.
 */
// Déclare et exporte dayLight : le cosinus (début).
export function dayLight(cosSun) {
  // Avancement dans le terminateur, courbe en S.
  const t = Math.max(0, Math.min(1, (cosSun - TERMINATOR_LO) / (TERMINATOR_HI - TERMINATOR_LO))), s = t * t * (3 - 2 * t);
  // Atténuation du jour selon la hauteur du Soleil.
  return s * (1 - DAY_DIM + DAY_DIM * Math.max(0, Math.min(1, cosSun)));
// Fin de dayLight.
}

/**
 * Opacité de l'ombre posée sur le globe CesiumJS (0 de jour, 1 − NIGHT_FLOOR en nuit noire) ; vue de nuit : nuit
 * partout. Même formule dans le shader de l'ombre (pollution-lumineuse.shader.js).
 */
// Déclare et exporte shadowAlpha : le cosinus et la vue de nuit (début).
export function shadowAlpha(cosSun, lightView = 0) {
  // Lumière du sol (nulle en vue de nuit).
  const l = lightView > 0.5 ? 0 : dayLight(cosSun);
  // Ombre : ce qui manque de lumière, en gardant le plancher de nuit.
  return (1 - l) * (1 - NIGHT_FLOOR);
// Fin de shadowAlpha.
}
