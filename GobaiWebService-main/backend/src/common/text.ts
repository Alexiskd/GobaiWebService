/** Normalise un texte pour comparer sans tenir compte des accents ni de la casse. */
// Fonction normalize : reçoit un texte et renvoie sa version comparable.
export const normalize = (s: string): string =>
  // Décompose chaque lettre accentuée en lettre + accent (forme NFD), supprime les accents (caractères Unicode U+0300 à U+036F), puis met en minuscules.
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
