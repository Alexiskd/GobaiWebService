// Mode « économie d'énergie » (Paramètres), gardé d'une visite à l'autre : le moteur 3D passe à 20 images par seconde
// et à la densité de pixels 1 (voir SolarEngine.setPowerSaving), sur téléphone comme sur ordinateur.

// Clé du réglage dans le navigateur.
const KEY = 'gobai:economie-energie';

// Valeur courante : désactivé au départ.
let current = false;
// Lit la valeur gardée ; un échec est ignoré.
try { current = globalThis.localStorage?.getItem(KEY) === '1'; } catch { /* stockage refusé : désactivé */ }
// Fonctions à prévenir d'un changement.
const listeners = new Set();

// Fonction getPowerSaving : la valeur courante.
export const getPowerSaving = () => current;

// Fonction setPowerSaving.
export function setPowerSaving(on) {
  // Garde la nouvelle valeur, en vrai ou faux.
  current = Boolean(on);
  // L'écrit dans le navigateur ; un échec est ignoré.
  try { globalThis.localStorage?.setItem(KEY, current ? '1' : '0'); } catch { /* stockage refusé : valable pour la session */ }
  // Prévient les abonnés.
  listeners.forEach((fn) => fn());
// Fin de setPowerSaving.
}

// Fonction subscribePowerSaving.
export function subscribePowerSaving(fn) {
  // Ajoute l'abonné.
  listeners.add(fn);
  // Renvoie la fonction qui le retire.
  return () => listeners.delete(fn);
// Fin de subscribePowerSaving.
}
