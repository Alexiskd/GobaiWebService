// Avancement du chargement des tuiles d'un astre, pour le petit indicateur du HUD (TuilesLoader).
// Le moteur publie pour chaque astre le nombre d'images encore attendues ; ce nombre seul ne dit pas « où l'on en
// est ». On retient donc le plus grand nombre vu depuis le début du chargement (le pic) : l'avancement est la part
// du pic déjà arrivée. Pendant un préchargement, le moteur donne directement un décompte fait / total.

/** Délai (ms) avant d'afficher l'indicateur : un chargement plus court ne fait rien clignoter. */
// Délai d'apparition : 250 ms.
export const SHOW_DELAY_MS = 250;
/** Durée (ms) pendant laquelle l'indicateur plein reste visible avant de s'effacer. */
// Durée de maintien après la fin : 450 ms.
export const HIDE_DELAY_MS = 450;

/** État de départ : rien en cours. */
// État de repos : pas de chargement, pic nul, barre pleine.
export const IDLE = Object.freeze({ busy: false, peak: 0, percent: 100 });

/**
 * Fait avancer l'état d'après le dernier état des tuiles publié par le moteur (TileManager.snapshot).
 * Le pourcentage ne recule jamais pendant un même chargement, même si de nouvelles tuiles s'ajoutent à la file.
 */
// Déclare et exporte tileLoadStep : état précédent et état des tuiles de l'astre (début).
export function tileLoadStep(prev, snap) {
  // Sans fond affiché, ou en erreur : repos.
  if (!snap || !snap.layerId || snap.status === 'error' || snap.status === 'off') return IDLE;
  // Le préchargement publié par le moteur.
  const p = snap.preload;
  // Préchargement en cours : il a un total et n'est pas fini.
  const preloading = Boolean(p && p.total > 0 && p.done < p.total);
  // Nombre d'images attendues, jamais négatif.
  const loading = Math.max(0, snap.loading || 0);
  // Rien en cours : repos.
  if (!preloading && loading === 0) return IDLE;
  // Pic : le plus grand nombre d'images attendues depuis le début de ce chargement.
  const peak = Math.max(prev.busy ? prev.peak : 0, loading);
  // Avancement brut : le décompte du préchargement, sinon la part du pic déjà arrivée.
  const raw = preloading ? (100 * p.done) / p.total : peak > 0 ? (100 * (peak - loading)) / peak : 0;
  // Pourcentage entier, plafonné à 99 tant que ce n'est pas fini, et jamais en arrière.
  const percent = Math.max(prev.busy ? prev.percent : 0, Math.min(99, Math.floor(raw)));
  // Renvoie le nouvel état.
  return { busy: true, peak, percent };
// Fin de tileLoadStep.
}
