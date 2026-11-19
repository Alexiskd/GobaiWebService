/**
 * API de la boutique : catalogue des exports payants, page de paiement Stripe et jetons d'accès.
 *
 * Un achat se fait depuis un compte connecté : le jeton de session du compte (le même que pour les
 * contributions) accompagne la commande et la réclamation. Le serveur inscrit le compte chez Stripe, et lui
 * seul peut récupérer le jeton de ce paiement.
 *
 * Les jetons de licence ne sont pas stockés dans le navigateur : `fetchLicences` les redemande au serveur
 * après authentification du compte, tant que l'achat est valable.
 */
// Adresse de base de l'API et erreur commune.
import { API_BASE, ApiError } from './client';

// Requête vers l'API de la boutique ; `token` est le jeton de session du compte, quand il y en a un.
async function request(path, { method = 'GET', body, token } = {}) {
  // En-têtes.
  const headers = { Accept: 'application/json' };
  // Corps JSON.
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Jeton de session du compte.
  if (token && token !== 'cookie') headers.Authorization = `Bearer ${token}`;
  // Réponse.
  let res;
  // Essaie l'appel.
  try {
    // L'appel.
    res = await fetch(`${API_BASE}/store${path}`, { method, headers, credentials: 'include', cache: 'no-store', body: body === undefined ? undefined : JSON.stringify(body) });
  // Serveur injoignable.
  } catch {
    // Erreur commune.
    throw new ApiError(0, 'API injoignable', path);
  // Fin de l'essai.
  }
  // Réponse en échec : le message du serveur est repris tel quel.
  if (!res.ok) {
    // Corps d'erreur, s'il est lisible.
    const payload = await res.json().catch(() => null);
    // Le message.
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    // L'erreur.
    throw new ApiError(res.status, message || `HTTP ${res.status}`, path);
  // Fin du cas d'échec.
  }
  // Le corps.
  return res.json();
// Fin de request.
}

/** Le catalogue et l'état du paiement. Route libre : pas besoin d'être connecté pour voir les prix. */
export const fetchCatalogue = () => request('/catalogue');

/** Les astres exportables et ce que chacun a réellement à vendre (fond de carte, orbite). Route libre. */
export const fetchExportBodies = () => fetch(`${API_BASE}/export/bodies`, { headers: { Accept: 'application/json' } })
  // Le corps, ou une liste vide si la route répond mal : la boutique sait se passer de ce détail.
  .then((res) => (res.ok ? res.json() : { items: [] }))
  // Serveur injoignable : même repli.
  .catch(() => ({ items: [] }));

/**
 * Crée la page de paiement d'un article pour le compte connecté : renvoie { id, url, product, hours, cents }.
 * `hours` ne compte que pour un article loué à l'heure ; les autres l'ignorent.
 */
export const createOrder = (token, productId, hours = 1) => request('/orders', { method: 'POST', token, body: { productId, hours } });

/** Après paiement : récupère le jeton d'accès de la session de paiement, pour le compte connecté. */
export const claimLicence = (token, sessionId) => request(`/orders/${encodeURIComponent(sessionId)}/claim`, { method: 'POST', token });

/** Les achats du compte connecté, chacun avec un jeton frais : { items, persistent }. */
export const fetchLicences = (token) => request('/licences', { token });

// Lecture du retour de paiement ; les jetons ne sont jamais persistés côté navigateur.
export { hasPurchaseReturn, parsePurchaseReturn } from './purchaseReturn';

/** Appelle une route protégée avec un jeton d'export sans masquer les erreurs HTTP. */
export async function requestExport(path, licenceToken, { method = 'GET', query = {} } = {}) {
  const url = new URL(`${API_BASE}${path}`, globalThis.location?.origin || 'https://www.gobaispace.com');
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: { Accept: 'application/json, model/gltf-binary, image/jpeg', Authorization: `Bearer ${licenceToken}` },
    });
  } catch {
    throw new ApiError(0, 'API injoignable', path);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new ApiError(response.status, message || `HTTP ${response.status}`, path);
  }
  return response;
}

/** Vérifie le jeton et un droit avec la signature réellement vérifiée par le backend. */
export async function verifyExportAccess(licenceToken, scope) {
  const query = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  let response;
  try {
    response = await fetch(`${API_BASE}/export/access${query}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${licenceToken}` },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'API injoignable pendant la vérification du jeton.', '/export/access');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new ApiError(response.status, message || `HTTP ${response.status}`, '/export/access');
  }
  return payload;
}
