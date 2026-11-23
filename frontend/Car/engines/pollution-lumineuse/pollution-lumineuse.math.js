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
