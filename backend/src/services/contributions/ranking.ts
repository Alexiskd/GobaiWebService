/**
 * Votes et classement des placements, à la manière de Reddit : chaque contributeur donne une voix pour ou contre
 * un placement, et la liste se trie par « populaire » (score pondéré par l'âge), « récent » ou « meilleur ».
 * Tout est pur : le stockage des voix est ailleurs (contributions.service.ts).
 */

/** Une voix : +1 pour un placement juste, -1 pour un placement faux. */
export type VoteDirection = 1 | -1 | 0;

/** Les deux compteurs d'un placement. */
export interface VoteCounts { up: number; down: number }

/** Origine des temps du classement « populaire » : le 1er janvier 2026, en secondes. */
export const HOT_EPOCH_SECONDS = Date.UTC(2026, 0, 1) / 1000;
/** Durée qui vaut une décade de score dans le classement « populaire » (12,5 h, comme Reddit). */
export const HOT_HALF_LIFE_SECONDS = 45_000;

/** Score net d'un placement : voix pour moins voix contre. */
export const netScore = ({ up, down }: VoteCounts): number => up - down;

/**
 * Score « populaire » : logarithme du score net, plus l'âge de la publication.
 * Les premières voix pèsent plus que les suivantes, et une publication récente remonte sans voix.
 */
export function hotScore(counts: VoteCounts, createdAt: Date | string | number): number {
  // Score net.
  const s = netScore(counts);
  // Ordre de grandeur du score, au moins 1 pour que le logarithme reste défini.
  const order = Math.log10(Math.max(Math.abs(s), 1));
  // Sens du score.
  const sign = s > 0 ? 1 : s < 0 ? -1 : 0;
  // Secondes depuis l'origine des temps.
  const seconds = new Date(createdAt).getTime() / 1000 - HOT_EPOCH_SECONDS;
  // Le score, arrondi à sept décimales.
  return Math.round((sign * order + seconds / HOT_HALF_LIFE_SECONDS) * 1e7) / 1e7;
}

/** État d'un placement, d'après les voix reçues. */
export type PlacementStatus = 'valide' | 'conteste' | 'attente';

/** Nombre de voix à partir duquel un placement cesse d'être « en attente ». */
export const STATUS_MIN_VOTES = 3;

/**
 * État d'un placement : « validé » quand il réunit au moins trois voix dont 70 % favorables,
 * « contesté » quand au moins trois voix le refusent majoritairement, « en attente » sinon.
 */
export function placementStatus(counts: VoteCounts): PlacementStatus {
  // Total des voix.
  const total = counts.up + counts.down;
  // Trop peu de voix pour trancher.
  if (total < STATUS_MIN_VOTES) return 'attente';
  // Part de voix favorables.
  const ratio = counts.up / total;
  // Nettement approuvé.
  if (ratio >= 0.7) return 'valide';
  // Nettement refusé.
  if (ratio <= 0.4) return 'conteste';
  // Partagé : en attente.
  return 'attente';
}

/** Modes de tri de la liste des contributions. */
export type SortMode = 'populaire' | 'recent' | 'meilleur';

/** Les modes de tri acceptés par la route. */
export const SORT_MODES: SortMode[] = ['populaire', 'recent', 'meilleur'];

/** Ce qu'il faut d'une contribution pour la trier. */
export interface Sortable { up: number; down: number; createdAt: Date | string | number }

/** Liste triée (copie), du plus en vue au moins en vue. */
export function sortContributions<T extends Sortable>(items: readonly T[], mode: SortMode): T[] {
  // Date d'une contribution, en millisecondes.
  const at = (i: T) => new Date(i.createdAt).getTime();
  // Copie triée selon le mode.
  return [...items].sort((a, b) => {
    // Le plus récent d'abord.
    if (mode === 'recent') return at(b) - at(a);
    // Le meilleur score net d'abord, la date tranchant les égalités.
    if (mode === 'meilleur') return netScore(b) - netScore(a) || at(b) - at(a);
    // Populaire : score pondéré par l'âge.
    return hotScore(b, b.createdAt) - hotScore(a, a.createdAt);
  // Fin de la comparaison.
  });
}
