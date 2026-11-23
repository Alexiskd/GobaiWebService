/**
 * Favoris de vues du globe de près : la liste est gardée dans le navigateur (localStorage), sans compte. Chaque favori
 * est un nom, le chemin de l'astre (/terre, /lune…) et l'ancre de la vue (#vue=…). Fonctions pures, sauf la lecture
 * et l'écriture, qui reçoivent le stockage (et ne lèvent jamais d'erreur).
 */

// Déclare et exporte la clé du stockage.
export const FAVORITES_KEY = 'gobai.vues';
// Déclare et exporte le nombre maximal de favoris.
export const FAVORITES_MAX = 30;

/** Favori valide : nom, chemin « /astre » et ancre « #vue=… ». */
// Déclare isFavorite : l'objet.
const isFavorite = (f) => Boolean(f && typeof f.name === 'string' && /^\/[^/?#]*$/.test(f.path ?? '') && /^#vue=/.test(f.hash ?? ''));

/** Liste lue dans le stockage (vide si absente, illisible ou refusée). */
// Déclare et exporte readFavorites : le stockage (début).
export function readFavorites(storage = globalThis.localStorage) {
  // Début du bloc protégé : stockage absent, refusé ou contenu illisible.
  try {
    // Liste enregistrée.
    const list = JSON.parse(storage?.getItem(FAVORITES_KEY) ?? '[]');
    // Seulement les favoris valides, au plus le maximum.
    return Array.isArray(list) ? list.filter(isFavorite).slice(0, FAVORITES_MAX) : [];
  // Refus ou contenu illisible : liste vide.
  } catch { return []; }
// Fin de readFavorites.
}

/** Écrit la liste ; vrai si elle a été gardée. */
// Déclare et exporte writeFavorites : le stockage et la liste (début).
export function writeFavorites(storage = globalThis.localStorage, list = []) {
  // Début du bloc protégé : stockage plein ou refusé.
  try { storage?.setItem(FAVORITES_KEY, JSON.stringify(list)); return Boolean(storage); }
  // Refus : faux.
  catch { return false; }
// Fin de writeFavorites.
}

/** Ajoute un favori en tête (le même chemin et la même vue ne sont gardés qu'une fois), au plus FAVORITES_MAX. */
// Déclare et exporte addFavorite : la liste et le favori (début).
export function addFavorite(list, fav) {
  // Favori invalide : liste inchangée.
  if (!isFavorite(fav)) return list;
  // Nom raccourci, ou un nom par défaut.
  const item = { name: fav.name.trim().slice(0, 80) || 'Vue', path: fav.path, hash: fav.hash };
  // En tête, sans doublon, borné.
  return [item, ...list.filter((f) => f.path !== item.path || f.hash !== item.hash)].slice(0, FAVORITES_MAX);
// Fin de addFavorite.
}

/** Retire le favori à cette place. */
// Déclare et exporte removeFavorite : la liste et la place.
export const removeFavorite = (list, index) => list.filter((_, i) => i !== index);
