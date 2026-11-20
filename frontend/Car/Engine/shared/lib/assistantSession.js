/**
 * Session de l'assistant : le fournisseur choisi (Claude ou Mistral) et la clé d'API de l'utilisateur.
 *
 * La clé est gardée UNIQUEMENT dans ce navigateur (localStorage) : jamais en base, jamais dans le dépôt. À chaque
 * requête, elle part au serveur de Gobai Space dans l'en-tête `X-Assistant-Key`, qui la relaie au fournisseur sans
 * l'enregistrer ni l'écrire dans ses journaux. « Se déconnecter » l'efface.
 *
 * Petit magasin observable (subscribe / getSession) : la barre d'outils et la fenêtre de l'assistant voient la même
 * session, et se mettent à jour ensemble à la connexion et à la déconnexion (dans les autres onglets aussi).
 */

/** Fournisseurs proposés, avec leurs pages (vérifiées dans leur documentation officielle). */
export const PROVIDERS = {
  claude: {
    id: 'claude',
    label: 'Claude',
    platform: 'Claude Platform',
    keysUrl: 'https://platform.claude.com/settings/keys',
    billingUrl: 'https://platform.claude.com/settings/billing',
    placeholder: 'sk-ant-…',
    logo: '/claude-logo.png',
    color: '#d97757',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    platform: 'Mistral (La Plateforme)',
    keysUrl: 'https://console.mistral.ai/api-keys',
    billingUrl: 'https://admin.mistral.ai/organization/billing',
    placeholder: 'Clé d’API Mistral',
    // Logo officiel à déposer dans frontend/public ; absent, une pastille « M » le remplace.
    logo: '/mistral-logo.png',
    color: '#fa520f',
  },
};

/** Clé du stockage local. Les anciennes clés (réglage « Clé Mistral » retiré) sont effacées au chargement. */
const STORAGE_KEY = 'gobai.assistant.session';
const LEGACY_KEYS = ['gobai.mistral.key', 'gobai.mistral.model'];

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Session lue dans le stockage, ou null si elle est absente ou illisible. */
function read() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s && PROVIDERS[s.provider] && typeof s.key === 'string' && s.key) return { provider: s.provider, key: s.key, model: typeof s.model === 'string' ? s.model : '' };
  } catch { /* stockage refusé ou contenu illisible : pas de session */ }
  return null;
}

// Nettoyage unique des anciennes clés : plus aucune clé ne doit traîner hors de la session.
try { for (const k of LEGACY_KEYS) storage()?.removeItem(k); } catch { /* stockage refusé */ }

let session = read();
// Session déjà vérifiée auprès du fournisseur depuis le chargement de la page. Une session reprise d'une visite
// précédente ne l'est pas : la fenêtre refait l'appel de test à sa première ouverture (clé révoquée, crédit épuisé).
let verified = null;
const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

/** La session en cours : { provider, key, model }, ou null (non connecté). Objet stable entre deux changements. */
export function getSession() { return session; }

/** Vrai si cette session a passé l'appel de test depuis le chargement de la page. */
export function isVerified(s = session) { return Boolean(s) && s === verified; }

/** Note que la session en cours vient de passer l'appel de test. */
export function markVerified() { verified = session; }

/** S'abonne aux changements ; renvoie la fonction de désabonnement. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Enregistre la session après une connexion réussie (clé vérifiée par le fournisseur). */
export function saveSession({ provider, key, model = '' }) {
  session = { provider, key: String(key).trim(), model };
  verified = session;
  try { storage()?.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* stockage refusé : valable pour cet onglet */ }
  emit();
}

/** Efface la clé et le fournisseur : retour à l'écran de connexion. */
export function clearSession() {
  session = null;
  verified = null;
  try { storage()?.removeItem(STORAGE_KEY); } catch { /* stockage refusé */ }
  emit();
}

// Connexion ou déconnexion faite dans un autre onglet : cet onglet suit.
globalThis.addEventListener?.('storage', (e) => {
  if (e.key !== STORAGE_KEY) return;
  session = read();
  emit();
});
