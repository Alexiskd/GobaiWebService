// Petit store externe : le moteur y écrit (≈10 fois/s), seuls les composants abonnés se re-rendent.
// Importe useSyncExternalStore de React.
import { useSyncExternalStore } from 'react';

// Le magasin lui-même, sans React.
export { createHudStore, sameValue } from './hudStoreCore.js';

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
