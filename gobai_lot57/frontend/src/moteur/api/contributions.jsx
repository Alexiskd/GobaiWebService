/**
 * API des contributions et des comptes.
 *
 * L'interface web utilise un cookie de session HttpOnly/Secure/SameSite=Lax : JavaScript ne peut ni le lire,
 * ni le copier dans localStorage. Les intégrations externes conservent la compatibilité Authorization: Bearer.
 */
import { API_BASE, ApiError } from './client';

const ACCOUNT_KEY = 'gobai.contribution.account';
const LEGACY_KEY = 'gobai.contribution';

/** Le navigateur ne conserve que le profil affichable, jamais le JWT. */
export function getSession() {
  try {
    globalThis.localStorage?.removeItem(LEGACY_KEY);
    const raw = globalThis.localStorage?.getItem(ACCOUNT_KEY);
    const value = raw ? JSON.parse(raw) : null;
    return value?.account?.name ? { account: value.account, persistent: value.persistent ?? null } : null;
  } catch {
    return null;
  }
}

/** Mémorise uniquement les informations publiques du compte ; le cookie demeure inaccessible à JavaScript. */
export function setSession(session) {
  try {
    if (session?.account?.name) {
      globalThis.localStorage?.setItem(ACCOUNT_KEY, JSON.stringify({
        account: session.account,
        persistent: session.persistent ?? null,
      }));
    } else {
      globalThis.localStorage?.removeItem(ACCOUNT_KEY);
    }
    globalThis.localStorage?.removeItem(LEGACY_KEY);
  } catch {
    // Le cookie HttpOnly continue de fonctionner même si le stockage de profil est indisponible.
  }
  return session?.account ? { account: session.account, persistent: session.persistent ?? null } : null;
}

/** Toutes les requêtes incluent le cookie même si le profil local n'est pas disponible. */
async function request(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Compatibilité Bearer pour les intégrations, mais jamais avec le marqueur de session web.
  if (token && token !== 'cookie') headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}/contributions${path}`, {
      method,
      headers,
      signal,
      credentials: 'include',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'API injoignable', path);
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new ApiError(res.status, message || `HTTP ${res.status}`, path);
  }
  return res.status === 204 ? null : res.json();
}

/** Inscription web : le serveur pose le cookie HttpOnly et ne renvoie aucun JWT dans le JSON. */
export const signupContributor = (name, password) =>
  request('/session/signup', { method: 'POST', body: { name, password } }).then(setSession);

/** Connexion web : session persistante sans jeton accessible au code JavaScript. */
export const loginContributor = (name, password) =>
  request('/session/login', { method: 'POST', body: { name, password } }).then(setSession);

/** Déconnexion serveur : révoque la version de session du compte et supprime le cookie. */
export async function logoutContributor() {
  try {
    await request('/session/logout', { method: 'POST', token: 'cookie' });
  } finally {
    setSession(null);
  }
}

/** Vérifie le cookie auprès du serveur ; renvoie le compte ou null. */
export const fetchMe = (_token, signal) =>
  request('/me', { token: 'cookie', signal }).catch(() => null);

/** Liste des placements : { items, persistent }. */
export const fetchContributions = (sort = 'populaire', token = 'cookie', signal) =>
  request(`?sort=${encodeURIComponent(sort)}`, { token, signal });

/** Publie un placement à partir du seul en-tête du LAS/LAZ. */
export const publishContribution = (token, { filename, title, note, header }) => request('', {
  method: 'POST',
  token,
  body: { filename, header, ...(title ? { title } : {}), ...(note ? { note } : {}) },
});

/** Vote sur un placement : +1 juste, -1 faux, 0 retire la voix. */
export const voteContribution = (token, id, value) =>
  request(`/${id}/vote`, { method: 'POST', token, body: { value } });

/** Retire un placement : réservé à son auteur. */
export const removeContribution = (token, id) =>
  request(`/${id}`, { method: 'DELETE', token });
