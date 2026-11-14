// Petit store externe : le moteur y écrit (≈10 fois/s), seuls les composants abonnés se re-rendent.
// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';

// Déclare et exporte createHudStore : reçoit l'état de départ.
export function createHudStore(initial) {
  // L'état courant.
  let state = initial;
  // L'ensemble des abonnés.
  const listeners = new Set();
  // Renvoie le magasin (début de l'objet).
  return {
    // get : lit l'état.
    get: () => state,
    // set : met l'état à jour.
    set(next) {
      // Fusionne les nouvelles valeurs dans une copie de l'état.
      state = { ...state, ...next };
      // Prévient chaque abonné.
      listeners.forEach((l) => l());
    // Fin de set.
    },
    // subscribe : ajoute un abonné.
    subscribe(l) {
      // L'enregistre.
      listeners.add(l);
      // Renvoie la fonction de désabonnement.
      return () => listeners.delete(l);
    // Fin de subscribe.
    },
  // Fin de l'objet.
  };
// Fin de createHudStore.
}

// Déclare et exporte le crochet useHud : le magasin et la fonction de sélection.
export function useHud(store, select) {
  // S'abonne au magasin (début de l'appel).
  return useSyncExternalStore(
    // La fonction d'abonnement.
    store.subscribe,
    // La valeur choisie, côté navigateur.
    () => select(store.get()),
    // La même valeur, pour le rendu côté serveur.
    () => select(store.get())
  // Fin de l'appel.
  );
// Fin de useHud.
}
