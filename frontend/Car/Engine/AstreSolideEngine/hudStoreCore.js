// Magasin du HUD, sans React (testable seul) : voir hudStore.jsx pour le crochet useHud.

/**
 * Vrai si deux valeurs publiées sont identiques en contenu : primitives égales, ou tableaux et objets simples de
 * même contenu (sur quelques niveaux). Sert à garder l'ancienne référence quand le moteur republie la même chose.
 */
export function sameValue(a, b, depth = 3) {
  if (Object.is(a, b)) return true;
  if (depth <= 0 || !a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i], b[i], depth - 1)) return false;
    return true;
  }
  if (Array.isArray(b) || Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.hasOwn(b, k) || !sameValue(a[k], b[k], depth - 1)) return false;
  return true;
}

/**
 * Magasin du HUD : le moteur y écrit (≈ 10 fois par seconde), seuls les composants abonnés se re-rendent.
 *
 * Une valeur republiée à l'identique (même texte, même objet de coordonnées recalculé avec les mêmes nombres) garde
 * son ancienne référence : les sélecteurs des composants renvoient alors la même valeur et React ne les redessine
 * pas. Si rien n'a changé, les abonnés ne sont même pas prévenus. Un objet republié sous la même référence compte
 * toujours comme changé (il a pu être modifié sur place).
 */
export function createHudStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(next) {
      let merged = null;
      for (const k of Object.keys(next)) {
        const prev = state[k];
        const value = next[k];
        if (prev === value ? (value === null || typeof value !== 'object') : sameValue(prev, value)) continue;
        (merged ||= { ...state })[k] = value;
      }
      if (!merged) return;
      state = merged;
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
