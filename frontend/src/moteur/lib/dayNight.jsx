// Mode « jour » ou « nuit » de l'application, choisi par le bouton Jour / Nuit de la barre d'outils et gardé d'une
// visite à l'autre. Nuit (par défaut) : interface bleue et face des astres opposée au Soleil dans l'ombre.
// Jour : interface blanche et grise, astres éclairés sur toute leur surface.

// Clé du réglage dans le navigateur.
const KEY = 'gobai:jour-nuit';
// Valeur du mode nuit.
export const NIGHT = 'night';
// Valeur du mode jour.
export const DAY = 'day';

/** Ramène une valeur quelconque à 'day' ou 'night' (nuit par défaut). */
// Fonction normalizeMode : « day » si c'est le jour, sinon « night ».
export const normalizeMode = (value) => (value === DAY ? DAY : NIGHT);

// Fonction read : lit le mode gardé.
function read() {
  // Essaie
  try {
    // de le lire et de le ramener à une valeur valide.
    return normalizeMode(globalThis.localStorage?.getItem(KEY));
  // En cas d'échec :
  } catch {
    // la nuit.
    return NIGHT;
  // Fin du cas.
  }
// Fin de read.
}

// Mode courant.
let current = read();
// Fonctions à prévenir d'un changement.
const listeners = new Set();

// Fonction getDayNight : le mode courant.
export const getDayNight = () => current;

// Fonction setDayNight.
export function setDayNight(value) {
  // Mode demandé, ramené à une valeur valide.
  const next = normalizeMode(value);
  // Inchangé : rien.
  if (next === current) return;
  // Le garde.
  current = next;
  // L'écrit dans le navigateur ; un échec est ignoré.
  try { globalThis.localStorage?.setItem(KEY, current); } catch { /* stockage refusé : valable pour la session */ }
  // Prévient les abonnés.
  listeners.forEach((fn) => fn());
// Fin de setDayNight.
}

// Fonction toggleDayNight : passe de l'un à l'autre.
export const toggleDayNight = () => setDayNight(current === NIGHT ? DAY : NIGHT);

/** Abonnement (useSyncExternalStore) : le thème de l'interface et l'éclairage des astres lisent la même valeur. */
// Fonction subscribeDayNight.
export function subscribeDayNight(fn) {
  // Ajoute l'abonné.
  listeners.add(fn);
  // Renvoie la fonction qui le retire.
  return () => listeners.delete(fn);
// Fin de subscribeDayNight.
}
