// Retour de la page de paiement Stripe : `/?don=merci&session_id=cs_…` (payé) ou `/?don=annule` (abandon).
// L'adresse est lue une seule fois au chargement, puis nettoyée pour qu'un rechargement ne rejoue pas le retour.

// Clé de stockage de l'identifiant du don en cours.
const STORAGE_KEY = 'gobai.don.session';
// Forme d'un identifiant de session Stripe : « cs_test_ » ou « cs_live_ », puis 8 à 250 lettres ou chiffres.
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{8,250}$/;

/** Garde l'identifiant du don en cours pendant le passage chez Stripe (pour fermer la page de paiement en cas d'abandon). */
// Déclare et exporte rememberDonation (début).
export function rememberDonation(id) {
  // Garde l'identifiant dans le stockage de session ; un refus est ignoré.
  try { sessionStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible : la page de paiement expirera seule */ }
// Fin de rememberDonation.
}

// takeStored : reprend l'identifiant gardé et l'efface (début).
function takeStored() {
  // Essai (début).
  try {
    // Le lit.
    const id = sessionStorage.getItem(STORAGE_KEY);
    // L'efface.
    sessionStorage.removeItem(STORAGE_KEY);
    // Le renvoie s'il a la bonne forme, sinon null.
    return id && SESSION_ID.test(id) ? id : null;
  // Stockage indisponible (début).
  } catch {
    // null.
    return null;
  // Fin de l'essai.
  }
// Fin de takeStored.
}

/** Lit l'adresse : { kind: 'paid' | 'cancelled', id } ou null. */
// Déclare et exporte parseDonationReturn : lit les paramètres de l'adresse (début).
export function parseDonationReturn(search, stored = null) {
  // Les paramètres.
  const qs = new URLSearchParams(search);
  // Le paramètre « don ».
  const don = qs.get('don');
  // S'il vaut « merci » (début).
  if (don === 'merci') {
    // Identifiant de la session.
    const id = qs.get('session_id');
    // Don payé, si l'identifiant a la bonne forme ; sinon null.
    return id && SESSION_ID.test(id) ? { kind: 'paid', id } : null;
  // Fin de ce cas.
  }
  // S'il vaut « annule » : don abandonné, avec l'identifiant gardé.
  if (don === 'annule') return { kind: 'cancelled', id: stored };
  // Sinon : null.
  return null;
// Fin de parseDonationReturn.
}

// Retour en attente : pas encore lu.
let pending;

// read : lit l'adresse une seule fois (début).
function read() {
  // Déjà lue, ou hors navigateur : rien.
  if (pending !== undefined || typeof window === 'undefined') return;
  // Aucun retour, a priori.
  pending = null;
  // Paramètres de l'adresse.
  const qs = new URLSearchParams(window.location.search);
  // Sans paramètre « don » : rien.
  if (!qs.has('don')) return;
  // Retour lu, avec l'identifiant gardé.
  pending = parseDonationReturn(window.location.search, takeStored());
  // Retire « don » de l'adresse.
  qs.delete('don');
  // Retire « session_id ».
  qs.delete('session_id');
  // Paramètres restants.
  const rest = qs.toString();
  // Remplace l'adresse affichée par l'adresse nettoyée, sans recharger la page.
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
// Fin de read.
}

/** Vrai si la page vient d'être ouverte au retour de Stripe : la fenêtre de don doit s'ouvrir. */
// Déclare et exporte hasDonationReturn (début).
export function hasDonationReturn() {
  // Lit l'adresse.
  read();
  // Vrai s'il y a un retour en attente.
  return Boolean(pending);
// Fin de hasDonationReturn.
}

/** Renvoie le retour de Stripe une seule fois (null ensuite). */
// Déclare et exporte takeDonationReturn (début).
export function takeDonationReturn() {
  // Lit l'adresse.
  read();
  // Le retour en attente.
  const r = pending;
  // Il n'est rendu qu'une fois.
  pending = null;
  // Le renvoie.
  return r;
// Fin de takeDonationReturn.
}
