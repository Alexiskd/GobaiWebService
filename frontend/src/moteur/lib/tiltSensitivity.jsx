// Sensibilité du pilotage au téléphone (en penchant l'appareil), réglée dans Paramètres ou à côté de la navball
// et gardée d'une visite à l'autre. Deux réglages indépendants : avancer / reculer (zoom) et droite / gauche
// (déplacement). 1 = réglage d'origine ; 2 = il suffit de pencher deux fois moins.

// Sensibilité minimale : 0,25.
export const SENSITIVITY_MIN = 0.25;
// Sensibilité maximale : 3.
export const SENSITIVITY_MAX = 3;
// Pas du réglage : 0,25.
export const SENSITIVITY_STEP = 0.25;
// Sensibilité par défaut : 1.
export const SENSITIVITY_DEFAULT = 1;

/** Ramène une valeur quelconque dans la plage autorisée (valeur par défaut si elle n'est pas un nombre). */
// Fonction clampSensitivity.
export function clampSensitivity(value) {
  // Convertit en nombre.
  const n = Number(value);
  // Pas un nombre fini : la valeur par défaut.
  if (!Number.isFinite(n)) return SENSITIVITY_DEFAULT;
  // Garde la valeur entre le minimum et le maximum.
  return Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, n));
// Fin de clampSensitivity.
}

/** Un réglage gardé dans le navigateur, avec abonnement (useSyncExternalStore). */
// Fonction createSetting : un réglage gardé sous une clé.
function createSetting(key) {
  // Valeur courante : celle par défaut.
  let current = SENSITIVITY_DEFAULT;
  // Essaie
  try {
    // de lire la valeur gardée ;
    const raw = globalThis.localStorage?.getItem(key);
    // s'il y en a une, la garde, ramenée dans la plage.
    if (raw != null) current = clampSensitivity(raw);
  // Un échec est ignoré.
  } catch { /* stockage refusé : valeur par défaut */ }
  // Fonctions à prévenir d'un changement.
  const listeners = new Set();
  // Renvoie
  return {
    // get : la valeur courante ;
    get: () => current,
    // set : change la valeur :
    set(value) {
      // la garde, ramenée dans la plage ;
      current = clampSensitivity(value);
      // l'écrit dans le navigateur ; un échec est ignoré ;
      try { globalThis.localStorage?.setItem(key, String(current)); } catch { /* stockage refusé : valable pour la session */ }
      // prévient les abonnés.
      listeners.forEach((fn) => fn());
    // Fin de set.
    },
    // subscribe : abonne une fonction :
    subscribe(fn) {
      // l'ajoute ;
      listeners.add(fn);
      // renvoie la fonction qui la retire.
      return () => listeners.delete(fn);
    // Fin de subscribe.
    },
  // Fin de l'objet.
  };
// Fin de createSetting.
}

// Droite / gauche (déplacement, bouton 🚀). Clé d'origine conservée : le réglage déjà fait reste valable.
// Réglage droite / gauche.
const pan = createSetting('gobai:sensibilite-telephone');
// Avancer / reculer (zoom, boutons ⬆️ et 🚀).
// Réglage avancer / reculer.
const zoom = createSetting('gobai:sensibilite-avance-recul');

// Lecture du réglage droite / gauche.
export const getTiltSensitivity = pan.get;
// Son changement.
export const setTiltSensitivity = pan.set;
// Son abonnement.
export const subscribeTiltSensitivity = pan.subscribe;

// Lecture du réglage avancer / reculer.
export const getTiltZoomSensitivity = zoom.get;
// Son changement.
export const setTiltZoomSensitivity = zoom.set;
// Son abonnement.
export const subscribeTiltZoomSensitivity = zoom.subscribe;
