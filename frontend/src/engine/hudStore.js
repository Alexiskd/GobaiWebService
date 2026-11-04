// Petit store externe : le moteur y écrit (≈10 fois/s), seuls les composants abonnés se re-rendent.
import { useSyncExternalStore } from 'react';

export function createHudStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(next) {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useHud(store, select) {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get())
  );
}
