/**
 * Calculs purs du tracé d'une orbite, pour n'importe quel astre : planète, planète naine ou satellite naturel.
 * Aucun appel à three.js ici, donc tout est testable sans navigateur (voir bodyOrbit.test.jsx).
 *
 * Le tracé est une fenêtre d'une période orbitale complète centrée sur l'instant simulé : une moitié de période
 * passée, une moitié à venir. La ligne passe donc exactement par l'astre, au milieu du tracé, et suit la
 * précession de l'orbite au lieu d'être figée au chargement de la page.
 *
 * Fermeture de la boucle : après une période moyenne, un astre ne revient jamais exactement au même point
 * (périodes anomalistique et draconitique différentes, perturbations des autres astres). Les deux bouts du tracé
 * manquent donc de se rejoindre — d'environ un rayon terrestre pour la Lune — et la ligne montre une cassure.
 * closeOrbitLoop répartit cet écart tout le long du tracé : nul au milieu (l'astre reste sur la ligne), la moitié
 * de l'écart à chaque bout, de sorte que le premier et le dernier point se confondent exactement.
 */

/** Nombre de segments par défaut d'un tracé : un point tous les 0,5°. */
// Déclare et exporte DEFAULT_SAMPLES : le nombre de segments d'un tracé.
export const DEFAULT_SAMPLES = 720;
/** Opacité du tracé au niveau de l'astre. */
// Déclare et exporte DEFAULT_ALPHA_NEAR : l'opacité la plus forte, à l'astre.
export const DEFAULT_ALPHA_NEAR = 0.95;
/** Opacité du tracé à l'opposé de l'astre : toute l'orbite reste visible, l'astre marque le point le plus clair. */
// Déclare et exporte DEFAULT_ALPHA_FAR : l'opacité la plus faible, à l'opposé de l'astre.
export const DEFAULT_ALPHA_FAR = 0.55;

/** Millisecondes dans un jour. */
// Déclare et exporte DAY_MS : la durée d'un jour, en millisecondes.
export const DAY_MS = 86_400_000;

/**
 * Intervalle de recalcul du tracé, en millisecondes simulées : la durée d'un segment du tracé.
 * Le tracé est donc refait dès que l'astre a avancé d'un segment, quelle que soit sa période
 * (≈ 55 minutes pour la Lune, ≈ 4 mois pour Pluton).
 */
// Déclare et exporte refreshMsFor : reçoit la période orbitale et le nombre de segments.
export function refreshMsFor(periodMs, samples = DEFAULT_SAMPLES) {
  // La durée d'un segment.
  return periodMs / samples;
// Fin de refreshMsFor.
}

/**
 * Opacité d'un point du tracé selon sa position dans la fenêtre : u = -1 (½ période passée) … 0 (l'astre) … 1
 * (½ période à venir). Fonction pure, testée par bodyOrbit.test.jsx.
 */
// Déclare et exporte orbitAlpha : la position u dans la fenêtre, puis les deux opacités extrêmes.
export function orbitAlpha(u, near = DEFAULT_ALPHA_NEAR, far = DEFAULT_ALPHA_FAR) {
  // Distance à l'astre, de 0 à 1.
  const a = Math.min(1, Math.abs(u));
  // Opacité : maximale à l'astre, décroissante jusqu'à l'opposé.
  return far + (near - far) * Math.pow(1 - a, 1.6);
// Fin de orbitAlpha.
}

/**
 * Instants (ms) des points du tracé : une période complète centrée sur `centerMs`.
 * @returns {Float64Array} n + 1 instants, du plus ancien au plus récent
 */
// Déclare et exporte orbitTimes : l'instant central, la période orbitale et le nombre de segments.
export function orbitTimes(centerMs, periodMs, n = DEFAULT_SAMPLES) {
  // Tableau de n + 1 instants.
  const out = new Float64Array(n + 1);
  // Les répartit régulièrement sur une période, centrée sur l'instant donné.
  for (let k = 0; k <= n; k++) out[k] = centerMs + (k / n - 0.5) * periodMs;
  // Renvoie le tableau.
  return out;
// Fin de orbitTimes.
}

/**
 * Ferme la boucle d'un tracé : l'écart entre le premier et le dernier point est réparti linéairement et
 * symétriquement le long du tracé, pour que les deux bouts se rejoignent exactement sans déplacer le milieu.
 *
 * Correction appliquée au point k : (k / n − 0,5) × (premier point − dernier point).
 *  - au premier point (k = 0) et au dernier (k = n), elle vaut ±½ écart : les deux arrivent au même milieu ;
 *  - au milieu du tracé (k = n / 2), elle est nulle : la ligne passe toujours exactement par l'astre ;
 *  - le plus grand déplacement vaut donc la moitié de l'écart, au lieu d'une cassure de l'écart entier.
 *
 * @param {Float32Array} p  positions du tracé, trois nombres par point, modifiées sur place
 * @returns {Float32Array} le même tableau, boucle fermée
 */
// Déclare et exporte closeOrbitLoop : les positions du tracé et son nombre de segments.
export function closeOrbitLoop(p, n = p.length / 3 - 1) {
  // Moins de deux points : rien à fermer.
  if (n < 1) return p;
  // Indice du premier nombre du dernier point.
  const last = 3 * n;
  // Écart entre le premier et le dernier point, coordonnée par coordonnée.
  const dx = p[0] - p[last], dy = p[1] - p[last + 1], dz = p[2] - p[last + 2];
  // Pour chaque point du tracé (début).
  for (let k = 0; k <= n; k++) {
    // Part de l'écart appliquée ici : −½ au premier point, 0 au milieu, +½ au dernier.
    const f = k / n - 0.5;
    // Déplace le point de cette part de l'écart.
    p[3 * k] += f * dx; p[3 * k + 1] += f * dy; p[3 * k + 2] += f * dz;
  // Fin de la boucle.
  }
  // Renvoie le tracé fermé.
  return p;
// Fin de closeOrbitLoop.
}
