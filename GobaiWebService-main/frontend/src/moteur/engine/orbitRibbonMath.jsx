/**
 * Calculs purs du style des tracés d'orbite (voir orbitRibbon.jsx) : aucun appel à three.js, tout est testable sans
 * navigateur (voir orbitRibbon.test.jsx).
 *
 * Style « traînée » : le tracé est le plus clair juste derrière l'astre, là où il vient de passer, et s'éteint
 * doucement en remontant l'orbite ; devant l'astre, il reste à son opacité la plus faible. On lit ainsi d'un coup
 * d'œil le sens du mouvement, et l'astre est toujours au bout le plus lumineux de sa ligne.
 */

/** Réglages du style des tracés, en pixels CSS (multipliés par la densité de l'écran au rendu). */
export const ORBIT_STYLE = {
  // Épaisseur du trait d'une orbite.
  width: 1.3,
  // Épaisseur du trait de l'orbite de l'astre visé.
  focusWidth: 2.1,
  // Largeur du halo, de chaque côté du trait.
  glow: 3.5,
  // Intensité du halo, au bord du trait (0 à 1).
  glowStrength: 0.28,
  // Opacité juste derrière l'astre.
  near: 0.95,
  // Opacité la plus faible : devant l'astre et à l'opposé de sa traînée.
  far: 0.24,
  // Forme de l'extinction de la traînée : plus la valeur est grande, plus la traînée est courte.
  falloff: 2.2,
  // Opacité générale d'une orbite ordinaire.
  opacity: 0.75,
  // Opacité générale de l'orbite de l'astre visé.
  focusOpacity: 1,
  // Part de blanc mélangée à la couleur de l'astre : la ligne reste lisible sur le noir de l'espace.
  tint: 0.35,
// Fin des réglages.
};

/**
 * Opacité d'un point du tracé selon la part d'orbite qui le sépare de l'astre, en arrière : `d` = 0 juste derrière
 * l'astre, → 1 juste devant lui (après un tour complet en arrière).
 * @param {number} d  part d'orbite derrière l'astre, de 0 à 1
 * @returns {number} opacité, de `far` (devant) à `near` (juste derrière)
 */
// Déclare et exporte trailAlpha : la part d'orbite, et les réglages (début).
export function trailAlpha(d, near = ORBIT_STYLE.near, far = ORBIT_STYLE.far, falloff = ORBIT_STYLE.falloff) {
  // Part ramenée entre 0 et 1.
  const t = Math.min(1, Math.max(0, d));
  // Extinction progressive : pleine juste derrière l'astre, nulle devant lui.
  return far + (near - far) * Math.pow(1 - t, falloff);
// Fin de trailAlpha.
}

/**
 * Part décimale positive d'un nombre (−0,25 → 0,75) : la position sur un tour, quel que soit le nombre de tours.
 * @param {number} x
 * @returns {number} entre 0 (inclus) et 1 (exclu)
 */
// Déclare et exporte fract : un nombre (début).
export function fract(x) {
  // Ce qui dépasse l'entier inférieur.
  const f = x - Math.floor(x);
  // 1 exactement (arrondi) ramené à 0.
  return f >= 1 ? 0 : f;
// Fin de fract.
}

/**
 * Opacités d'une orbite fermée de `n` segments (n + 1 points, le dernier confondu avec le premier), l'astre au
 * point `head`. `dir` = +1 si l'astre parcourt les points par indices croissants, −1 sinon.
 * @param {Float32Array} out   n + 1 opacités, écrites sur place
 * @param {number}       head  indice du point de l'orbite le plus proche de l'astre
 * @param {number}       dir   sens du mouvement le long des indices (+1 ou −1)
 * @returns {Float32Array} le même tableau
 */
// Déclare et exporte loopTrailAlphas : le tableau, l'astre et son sens (début).
export function loopTrailAlphas(out, head, dir = 1) {
  // Nombre de segments.
  const n = out.length - 1;
  // Position de l'astre sur le tour.
  const h = head / n;
  // Pour chaque point (début).
  for (let k = 0; k <= n; k++) {
    // Part d'orbite entre l'astre et ce point, en arrière du mouvement.
    const d = fract(dir >= 0 ? h - k / n : k / n - h);
    // Opacité de ce point.
    out[k] = trailAlpha(d);
  // Fin de la boucle.
  }
  // Renvoie le tableau.
  return out;
// Fin de loopTrailAlphas.
}

/**
 * Opacités d'un tracé fait d'une période complète centrée sur l'astre (½ période passée, l'astre au milieu,
 * ½ période à venir), comme celui de BodyOrbit : la moitié passée est la traînée, la moitié à venir reste faible,
 * et les deux bouts, confondus, ont la même opacité.
 * @param {Float32Array} out  n + 1 opacités, écrites sur place
 * @returns {Float32Array} le même tableau
 */
// Déclare et exporte windowTrailAlphas : le tableau (début).
export function windowTrailAlphas(out) {
  // Nombre de segments.
  const n = out.length - 1;
  // Pour chaque point (début).
  for (let k = 0; k <= n; k++) {
    // Position dans la fenêtre : −1 (½ période passée), 0 (l'astre), +1 (½ période à venir).
    const s = (k / n) * 2 - 1;
    // Part d'orbite derrière l'astre : de 0 à ½ dans le passé, de 1 à ½ dans l'avenir.
    const d = s <= 0 ? -s / 2 : 1 - s / 2;
    // Opacité de ce point.
    out[k] = trailAlpha(d);
  // Fin de la boucle.
  }
  // Renvoie le tableau.
  return out;
// Fin de windowTrailAlphas.
}

/**
 * Indice du point d'un tracé le plus proche d'une position.
 * @param {Float32Array} p      positions, trois nombres par point
 * @param {number}       count  nombre de points à examiner
 * @returns {number} indice du point le plus proche
 */
// Déclare et exporte nearestPointIndex : les positions, leur nombre et la position cherchée (début).
export function nearestPointIndex(p, count, x, y, z) {
  // Meilleur indice et meilleure distance (au carré).
  let best = 0, bestD = Infinity;
  // Pour chaque point (début).
  for (let k = 0; k < count; k++) {
    // Écarts sur les trois axes.
    const dx = p[3 * k] - x, dy = p[3 * k + 1] - y, dz = p[3 * k + 2] - z;
    // Distance au carré.
    const d = dx * dx + dy * dy + dz * dz;
    // Plus proche : retenu.
    if (d < bestD) { bestD = d; best = k; }
  // Fin de la boucle.
  }
  // Renvoie le meilleur indice.
  return best;
// Fin de nearestPointIndex.
}

/**
 * Couleur d'un tracé : la couleur de l'astre éclaircie d'une part de blanc.
 * @param {string|number} color  couleur de l'astre (« #rrggbb » ou nombre 0xrrggbb)
 * @param {number}        tint   part de blanc, de 0 à 1
 * @returns {number} couleur 0xrrggbb
 */
// Déclare et exporte tintColor : la couleur et la part de blanc (début).
export function tintColor(color, tint = ORBIT_STYLE.tint) {
  // Couleur lue : nombre gardé tel quel, « #rrggbb » lu en hexadécimal (gris-bleu si absente).
  const read = typeof color === 'number' ? color : parseInt(String(color || '#8fa3d0').replace('#', ''), 16);
  // Illisible : gris-bleu par défaut (le noir, 0, reste du noir).
  const c = Number.isFinite(read) ? read : 0x8fa3d0;
  // Mélange d'une composante (0 à 255) avec le blanc.
  const mix = (v) => Math.round(v + (255 - v) * tint);
  // Les trois composantes éclaircies, recomposées.
  return (mix((c >> 16) & 255) << 16) | (mix((c >> 8) & 255) << 8) | mix(c & 255);
// Fin de tintColor.
}

/**
 * Couleur CSS translucide d'une couleur d'astre (halo des repères).
 * @param {string|number} color  couleur de l'astre
 * @param {number}        alpha  opacité, de 0 à 1
 * @returns {string} « rgba(r, g, b, a) »
 */
// Déclare et exporte rgbaOf : la couleur et l'opacité (début).
export function rgbaOf(color, alpha) {
  // Couleur en nombre, comme tintColor (sans blanc ajouté).
  const c = tintColor(color, 0);
  // Les trois composantes et l'opacité.
  return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
// Fin de rgbaOf.
}
