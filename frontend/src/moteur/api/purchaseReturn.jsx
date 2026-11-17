/**
 * Lecture du retour de paiement Stripe. Les jetons de licence ne sont jamais persistés dans le navigateur :
 * ils sont redemandés au serveur après authentification du compte.
 */

/**
 * Nettoyage de compatibilité : supprime une éventuelle ancienne copie du JWT enregistrée
 * par les versions précédentes. Le jeton est ensuite uniquement conservé en mémoire.
 */
try {
  globalThis.localStorage?.removeItem('gobai.licences');
} catch {
  // Le stockage peut être indisponible ou interdit par le navigateur.
}

/** Identifiant d'une session de paiement, tel que Stripe l'écrit. */
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{8,250}$/;

/** Lit l'adresse au retour de Stripe : { kind: 'paid' | 'cancelled', id } ou null. */
export function parsePurchaseReturn(search = globalThis.location?.search || '') {
  const qs = new URLSearchParams(search);
  const achat = qs.get('achat');
  if (achat === 'ok') {
    const id = qs.get('session_id');
    return id && SESSION_ID.test(id) ? { kind: 'paid', id } : null;
  }
  if (achat === 'annule') return { kind: 'cancelled', id: null };
  return null;
}

/** Y a-t-il un retour de paiement dans l'adresse courante ? */
export const hasPurchaseReturn = () => parsePurchaseReturn() !== null;
