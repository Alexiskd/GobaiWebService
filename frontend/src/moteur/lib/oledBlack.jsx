// Thème « noir pur » (Paramètres), gardé d'une visite à l'autre : en mode nuit, les panneaux passent du bleu nuit au
// noir. Sur un écran OLED (iPhone, la plupart des téléphones récents), un pixel noir est éteint : moins de batterie.

// Clé du réglage dans le navigateur.
const KEY = 'gobai:noir-pur';

// Valeur courante : désactivé au départ.
let current = false;
// Lit la valeur gardée ; un échec est ignoré.
try { current = globalThis.localStorage?.getItem(KEY) === '1'; } catch { /* stockage refusé : désactivé */ }
// Fonctions à prévenir d'un changement.
const listeners = new Set();

// Fonction getOledBlack : la valeur courante.
export const getOledBlack = () => current;

// Fonction setOledBlack.
export function setOledBlack(on) {
  // Garde la nouvelle valeur, en vrai ou faux.
  current = Boolean(on);
  // L'écrit dans le navigateur ; un échec est ignoré.
  try { globalThis.localStorage?.setItem(KEY, current ? '1' : '0'); } catch { /* stockage refusé : valable pour la session */ }
  // Prévient les abonnés.
  listeners.forEach((fn) => fn());
// Fin de setOledBlack.
}

// Fonction subscribeOledBlack.
export function subscribeOledBlack(fn) {
  // Ajoute l'abonné.
  listeners.add(fn);
  // Renvoie la fonction qui le retire.
  return () => listeners.delete(fn);
// Fin de subscribeOledBlack.
}
