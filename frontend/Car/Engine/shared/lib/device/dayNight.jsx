// Mode « jour » ou « nuit » de l'application : d'après l'heure locale tant que l'utilisateur n'a rien choisi, puis
// celui du bouton Ombre de la barre d'outils, gardé d'une visite à l'autre. Nuit (par défaut) : interface bleue et face des astres opposée au Soleil dans l'ombre.
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

/**
 * Mode d'après l'heure locale (refonte, moins d'interactions) : jour de 7 h à 19 h, nuit sinon. Sert tant que
 * l'utilisateur n'a pas choisi lui-même avec le bouton Ombre (son choix est alors gardé et l'emporte).
 * @param {Date} date l'instant (remplaçable dans les tests)
 */
// Déclare et exporte modeForHour : l'instant (début).
export function modeForHour(date = new Date()) {
  // Heure locale.
  const h = date.getHours();
  // Jour de 7 h à 19 h, nuit sinon.
  return h >= 7 && h < 19 ? DAY : NIGHT;
// Fin de modeForHour.
}

// Choix fait par l'utilisateur (bouton Ombre) : vrai si une valeur est gardée.
function chosen() {
  // Valeur gardée, s'il y en a une.
  try { return globalThis.localStorage?.getItem(KEY) != null; } catch { return false; }
// Fin de chosen.
}

// Fonction read : lit le mode gardé, sinon celui de l'heure locale.
function read() {
  // Essaie
  try {
    // Aucun choix gardé : le mode de l'heure locale.
    if (!chosen()) return modeForHour();
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

// Sans choix de l'utilisateur, le mode suit l'heure locale : vérifié toutes les 10 minutes (navigateur seulement).
if (typeof window !== 'undefined') setInterval(() => {
  // Choix gardé : il l'emporte, rien à faire.
  if (chosen()) return;
  // Mode de l'heure.
  const next = modeForHour();
  // Changé : appliqué sans être gardé (il reste automatique).
  if (next !== current) { current = next; listeners.forEach((fn) => fn()); }
}, 10 * 60 * 1000);

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
