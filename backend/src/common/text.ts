/** Normalise un texte pour comparer sans tenir compte des accents ni de la casse. */
export const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
