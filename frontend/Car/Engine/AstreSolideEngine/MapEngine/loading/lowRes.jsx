// Basse résolution d'abord : pendant qu'une zone charge, la carte montre des tuiles moins volumineuses (un niveau
// plus grossier couvre la même zone avec bien moins de données) au lieu du fond sombre de l'astre.
// Deux moyens : les tout premiers niveaux de l'astre entier passent avant tout le reste, puis chaque tuile voulue
// fait charger d'abord son ancêtre trois niveaux plus haut (une image pour 64 tuiles fines).

// Importe le calcul de la clé d'une tuile.
import { tileKey } from '../mercator.jsx';

/** Écart de niveaux entre une tuile voulue et sa version basse résolution : 3 niveaux, soit 64 fois moins de données. */
// Écart de niveaux : 3.
export const LOW_RES_STEP = 3;
/** Niveaux de l'astre entier chargés avant tout le reste, comptés à partir du niveau minimal de la carte. */
// Nombre de niveaux au-dessus du minimal : 1.
export const COARSE_LEVELS = 1;
/** Priorité des tuiles basse résolution : avant toutes les tuiles visibles (plus petite priorité d'abord). */
// Priorité de base : moins un million.
export const LOW_RES_PRIORITY = -1e6;
/** Priorité des premiers niveaux de l'astre entier : avant les tuiles basse résolution. */
// Priorité de base : moins deux millions.
export const COARSE_PRIORITY = -2e6;

/** Vrai pour un niveau de l'astre entier à charger avant tout le reste. */
// Déclare et exporte isCoarseLevel : le niveau, le niveau minimal de la carte et le nombre de niveaux.
export function isCoarseLevel(z, minZoom = 0, levels = COARSE_LEVELS) {
  // Vrai jusqu'au niveau minimal plus le nombre de niveaux.
  return z <= Math.max(0, minZoom) + levels;
// Fin de isCoarseLevel.
}

/** Priorité d'une tuile des premiers niveaux : niveaux les plus grossiers d'abord. */
// Déclare et exporte coarsePriority : le niveau de la tuile.
export function coarsePriority(z) {
  // Priorité de base plus le niveau.
  return COARSE_PRIORITY + z;
// Fin de coarsePriority.
}

/**
 * Tuiles basse résolution à charger avant les tuiles voulues : l'ancêtre de chacune, `step` niveaux plus haut.
 * `wanted` est trié de la plus utile à la moins utile ; `floor` est le niveau le plus grossier accepté (les niveaux
 * en dessous sont déjà gardés pour l'astre entier) ; `covered(key)` est vrai quand une tuile est déjà affichable.
 * Une tuile voulue déjà affichable ne demande rien. Chaque ancêtre n'apparaît qu'une fois.
 * @returns {Array<{z, x, y, key, p}>} niveaux les plus grossiers d'abord, puis dans l'ordre d'utilité.
 */
// Déclare et exporte lowResTiles (début).
export function lowResTiles(wanted, { floor = 0, step = LOW_RES_STEP, covered = () => false } = {}) {
  // Ancêtres trouvés, par clé.
  const found = new Map();
  // Nombre de tuiles par côté d'un ancêtre.
  const n = 2 ** step;
  // Nombre de tuiles voulues, pour ranger les priorités entre 0 et 1.
  const total = wanted.length + 1;
  // Pour chaque tuile voulue, avec son rang (début).
  wanted.forEach((t, rank) => {
    // Niveau de l'ancêtre.
    const z = t.z - step;
    // Trop grossier : rien.
    if (z < floor || z < 0) return;
    // Tuile voulue déjà affichable : rien.
    if (covered(t.key ?? tileKey(t.z, t.x, t.y))) return;
    // Coordonnées de l'ancêtre.
    const x = Math.floor(t.x / n), y = Math.floor(t.y / n);
    // Sa clé.
    const key = tileKey(z, x, y);
    // Déjà trouvé (par une tuile plus utile) ou déjà affichable : rien.
    if (found.has(key) || covered(key)) return;
    // L'ajoute : niveau grossier d'abord, puis rang d'utilité.
    found.set(key, { z, x, y, key, p: LOW_RES_PRIORITY + z + rank / total });
  // Fin de la boucle.
  });
  // Renvoie la liste, plus petite priorité d'abord.
  return [...found.values()].sort((a, b) => a.p - b.p);
// Fin de lowResTiles.
}
