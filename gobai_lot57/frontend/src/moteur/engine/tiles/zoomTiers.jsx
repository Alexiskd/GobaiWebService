// Paliers de zoom de la Terre, lus dans la table du serveur (GET /api/v1/tiles/earth/plan, voir backend earth-plan.ts) :
// de la vue de l'espace jusqu'à la rue, chaque palier donne le niveau de tuile le plus fin, le nombre maximal de tuiles
// chargées (ordinateur, téléphone) et les détails affichés. Le palier suit la distance affichée en km. Rien n'est en
// dur ici : sans table, aucun palier ne s'applique. Fonctions pures, testées dans zoomTiers.test.jsx.

// Importe la clé d'une tuile et son parent, depuis mercator.
import { parentOf, tileKey } from './mercator';

/** Part du budget de tuiles gardée en mode économie d'énergie. */
// Déclare et exporte la part du budget en économie d'énergie : 60 %.
export const SAVING_SHARE = 0.6;

/** Budget minimal de tuiles, quel que soit l'appareil (un globe entier aux niveaux bas). */
// Déclare et exporte le budget minimal : 64 tuiles.
export const MIN_BUDGET = 64;

/** Niveaux d'ancêtres gardés pour chaque tuile voulue (repli affiché pendant le chargement). */
// Déclare et exporte le nombre de niveaux d'ancêtres gardés : 6.
export const KEEP_ANCESTORS = 6;

/** Paliers utilisables ? (liste non vide, chacun avec une distance ou null, un niveau et un budget) */
// Déclare et exporte validTiers : les paliers reçus.
export function validTiers(tiers) {
  // Vrai si c'est une liste non vide
  return Array.isArray(tiers) && tiers.length > 0
    // dont chaque palier a un identifiant, une distance (nombre ou null), un niveau et un budget par appareil.
    && tiers.every((t) => t && typeof t.id === 'string' && (t.maxKm === null || Number.isFinite(t.maxKm)) && Number.isFinite(t.maxZoom)
      // (le budget par appareil)
      && Number.isFinite(t.maxTiles?.desktop) && Number.isFinite(t.maxTiles?.phone));
// Fin de validTiers.
}

/**
 * Palier qui s'applique à une distance (altitude au-dessus du sol, km) : le premier, du plus proche au plus lointain,
 * dont la distance maximale n'est pas dépassée ; le dernier (sans limite) sinon. null sans paliers utilisables.
 */
// Déclare et exporte tierFor : les paliers et la distance en km.
export function tierFor(tiers, altitudeKm) {
  // Paliers inutilisables, ou distance illisible : aucun.
  if (!validTiers(tiers) || !Number.isFinite(altitudeKm)) return null;
  // Paliers rangés du plus proche au plus lointain (sans limite en dernier).
  const sorted = [...tiers].sort((a, b) => (a.maxKm ?? Infinity) - (b.maxKm ?? Infinity));
  // Le premier dont la distance n'est pas dépassée, sinon le dernier.
  return sorted.find((t) => t.maxKm === null || altitudeKm <= t.maxKm) ?? sorted[sorted.length - 1];
// Fin de tierFor.
}

/** Nombre maximal de tuiles chargées pour un palier, selon l'appareil et le mode économie d'énergie. */
// Déclare et exporte tileBudget : le palier, et l'appareil (tenu en main ?) et l'économie d'énergie.
export function tileBudget(tier, { handheld = false, saving = false } = {}) {
  // Sans palier : aucune limite.
  if (!tier) return Infinity;
  // Budget de l'appareil.
  const base = handheld ? tier.maxTiles.phone : tier.maxTiles.desktop;
  // Réduit en économie d'énergie, jamais sous le minimum.
  return Math.max(MIN_BUDGET, Math.round(base * (saving ? SAVING_SHARE : 1)));
// Fin de tileBudget.
}

/**
 * Tuiles voulues gardées dans le budget : les plus prioritaires (petite priorité = près du centre de l'écran, `p`,
 * sinon distance `d`). Les autres ne sont ni demandées ni gardées : leurs cellules affichent un niveau moins fin.
 */
// Déclare et exporte withinBudget : les tuiles voulues et le budget.
export function withinBudget(wanted, budget) {
  // Dans le budget : toutes.
  if (!(wanted.length > budget)) return wanted;
  // Sinon : copie rangée par priorité, coupée au budget.
  return [...wanted].sort((a, b) => (a.p ?? a.d ?? 0) - (b.p ?? b.d ?? 0)).slice(0, budget);
// Fin de withinBudget.
}

/** Clés à garder : chaque tuile voulue et ses ancêtres sur `depth` niveaux (repli affiché pendant le chargement). */
// Déclare et exporte keptKeys : les tuiles voulues et la profondeur.
export function keptKeys(wanted, depth = KEEP_ANCESTORS) {
  // Ensemble des clés.
  const keep = new Set();
  // Pour chaque tuile voulue (début).
  for (const t of wanted) {
    // Elle-même.
    let c = { z: t.z, x: t.x, y: t.y };
    // Puis ses ancêtres, jusqu'à la profondeur demandée ou au niveau 0.
    for (let d = 0; c && d <= depth; d++, c = parentOf(c)) keep.add(tileKey(c.z, c.x, c.y));
  // Fin de la boucle.
  }
  // Renvoie l'ensemble.
  return keep;
// Fin de keptKeys.
}

/** Clés à décharger : celles en mémoire graphique qui ne sont ni gardées (champ de la caméra) ni épinglées. */
// Déclare et exporte offFieldKeys : les clés en mémoire, les clés gardées et les clés épinglées.
export function offFieldKeys(loadedKeys, keep, pinned = new Set()) {
  // Les clés ni gardées ni épinglées.
  return loadedKeys.filter((k) => !keep.has(k) && !pinned.has(k));
// Fin de offFieldKeys.
}
