/**
 * Déconnexion des API externes, une par une (onglet « API »).
 * Deux niveaux s'additionnent :
 *  - cet appareil : la liste est gardée dans le navigateur (localStorage) ; les appels faits par le navigateur vers
 *    une API déconnectée ne partent plus (voir installFetchGuard et isUrlBlocked) ;
 *  - le serveur : la liste est tenue par l'API (/apis/blocked) ; elle coupe aussi les appels faits par le serveur,
 *    pour tous les visiteurs. Seul le détenteur de la clé d'administration peut la modifier.
 * Les fonctions du haut du fichier sont pures (testables sans navigateur) ; l'état et le réseau sont en bas.
 */

// Clé de stockage de la liste de cet appareil.
const KEY = 'gobai.apiBlocked';
// Clé de stockage de la clé d'administration : sessionStorage, elle disparaît à la fermeture de l'onglet.
const TOKEN_KEY = 'gobai.apiAdminToken';

/** Hôtes d'une API de la liste (apiList.js) : son champ `host` en contient un ou plusieurs, séparés par « , ». */
// hostsOfApi : découpe le champ host.
export const hostsOfApi = (api) => api.host.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

/** L'hôte est-il dans la liste, lui-même ou comme sous-domaine d'un hôte de la liste ? */
// hostBlocked : égalité ou suffixe « .hôte ».
export const hostBlocked = (host, blocked) => {
  // Hôte en minuscules.
  const h = String(host).toLowerCase();
  // Cherche dans la liste.
  for (const b of blocked) if (h === b || h.endsWith(`.${b}`)) return true;
  // Pas trouvé.
  return false;
// Fin de hostBlocked.
};

/** Hôte d'une adresse http(s) absolue ; null pour une adresse relative, blob:, data:… (jamais bloquées). */
// urlHost : lit l'hôte d'une adresse.
export function urlHost(url) {
  // Une adresse relative ne vise pas une API externe.
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
  // Essaie d'analyser l'adresse.
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
// Fin de urlHost.
}

/** Liste nettoyée : textes en minuscules, sans doublon ; tout le reste est ignoré. */
// cleanHosts : nettoie une liste lue dans le stockage ou reçue du serveur.
export function cleanHosts(list) {
  // Pas une liste : liste vide.
  if (!Array.isArray(list)) return [];
  // Garde les textes qui ressemblent à un nom d'hôte.
  return [...new Set(list.filter((h) => typeof h === 'string').map((h) => h.trim().toLowerCase()).filter((h) => /^[a-z0-9.-]+$/.test(h)))];
// Fin de cleanHosts.
}

/** Liste après ajout (on = true) ou retrait (on = false) des hôtes donnés. */
// toggleHosts : renvoie une nouvelle liste, sans modifier l'ancienne.
export function toggleHosts(list, hosts, on) {
  // Ensemble de départ.
  const set = new Set(list);
  // Ajoute ou retire chaque hôte.
  for (const h of hosts) { if (on) set.add(h); else set.delete(h); }
  // Renvoie la liste.
  return [...set];
// Fin de toggleHosts.
}

/**
 * État d'une API : 'on' (connectée), 'local' (déconnectée sur cet appareil), 'server' (déconnectée sur le serveur,
 * réversible avec la clé d'administration), 'permanent' (déconnectée par le réglage du serveur, non réversible ici).
 */
// apiState : l'état le plus fort l'emporte.
export function apiState(api, { local = [], server = [], permanent = [] } = {}) {
  // Hôtes de l'API.
  const hosts = hostsOfApi(api);
  // any : l'un des hôtes est-il dans la liste ?
  const any = (list) => hosts.some((h) => hostBlocked(h, list));
  // Réglage permanent du serveur.
  if (any(permanent)) return 'permanent';
  // Liste d'exécution du serveur.
  if (any(server)) return 'server';
  // Liste de cet appareil.
  if (any(local)) return 'local';
  // Sinon : connectée.
  return 'on';
// Fin de apiState.
}

/** Adresse visée par un appel à fetch : texte, objet URL ou objet Request. */
// fetchTarget : lit l'adresse du premier argument de fetch.
export function fetchTarget(input) {
  // Texte.
  if (typeof input === 'string') return input;
  // Objet URL ou Request.
  return input?.href ?? input?.url ?? '';
// Fin de fetchTarget.
}

/** Enveloppe une fonction fetch : un appel vers une API déconnectée reçoit une réponse 503, sans appel réseau. */
// guardFetch : `blocked(url)` dit si l'adresse est déconnectée.
export function guardFetch(inner, blocked) {
  // La fonction enveloppée.
  return (input, init) => {
    // Adresse déconnectée : réponse 503 fabriquée sur place (traitée par l'appelant comme une source indisponible).
    if (blocked(fetchTarget(input))) return Promise.resolve(new Response(null, { status: 503, statusText: 'API deconnectee' }));
    // Sinon : appel normal.
    return inner(input, init);
  // Fin de la fonction enveloppée.
  };
// Fin de guardFetch.
}

// ───────────────────────── État (navigateur) ─────────────────────────

// readLocal : lit la liste de cet appareil dans le stockage.
function readLocal() {
  // Essaie de lire et d'analyser.
  try { return cleanHosts(JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]')); } catch { return []; }
// Fin de readLocal.
}

// L'état courant : un nouvel objet à chaque changement (pour useSyncExternalStore).
let state = { local: readLocal(), server: [], permanent: [], editable: false, loaded: false };
// Les fonctions à prévenir à chaque changement.
const listeners = new Set();

// setState : remplace l'état et prévient les abonnés.
function setState(patch) {
  // Nouvel objet d'état.
  state = { ...state, ...patch };
  // Prévient chaque abonné.
  for (const fn of listeners) fn();
// Fin de setState.
}

/** Abonnement aux changements ; renvoie la fonction de désabonnement. */
// subscribe : pour useSyncExternalStore.
export function subscribe(fn) {
  // Ajoute l'abonné.
  listeners.add(fn);
  // Renvoie le désabonnement.
  return () => listeners.delete(fn);
// Fin de subscribe.
}

/** État courant : { local, server, permanent, editable, loaded }. */
// getApiBlockState : renvoie l'état.
export const getApiBlockState = () => state;

/** L'adresse vise-t-elle une API déconnectée, sur cet appareil ou sur le serveur ? */
// isUrlBlocked : utilisé par le garde de fetch et par le chargement des images.
export function isUrlBlocked(url) {
  // Hôte de l'adresse.
  const host = urlHost(url);
  // Pas d'hôte externe : jamais bloquée.
  if (!host) return false;
  // Bloquée si l'hôte est dans l'une des trois listes.
  return hostBlocked(host, state.local) || hostBlocked(host, state.server) || hostBlocked(host, state.permanent);
// Fin de isUrlBlocked.
}

/** Enveloppe le fetch du navigateur, une seule fois. À appeler au démarrage, avant l'application. */
// installFetchGuard : pose le garde.
export function installFetchGuard() {
  // Hors navigateur, ou déjà posé : rien à faire.
  if (typeof window === 'undefined' || window.fetch.__gobaiGuard) return;
  // Enveloppe le fetch d'origine.
  const guarded = guardFetch(window.fetch.bind(window), isUrlBlocked);
  // Marque le garde.
  guarded.__gobaiGuard = true;
  // Remplace le fetch de la page.
  window.fetch = guarded;
// Fin de installFetchGuard.
}

// apiBase : adresse de base de l'API du site (même règle que moteur/api/client).
const apiBase = () => `${(import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '')}/v1`;

// applyServer : range dans l'état la réponse du serveur.
function applyServer(body) {
  // Liste permanente.
  const permanent = cleanHosts(body?.permanent);
  // Met à jour l'état.
  setState({ server: cleanHosts(body?.runtime), permanent, editable: Boolean(body?.editable), loaded: true });
// Fin de applyServer.
}

/** Relit l'état du serveur. Sans réponse, l'état local reste seul en vigueur. */
// refreshServerBlocked : GET /apis/blocked.
export async function refreshServerBlocked(signal) {
  // Essaie de lire.
  try {
    // Demande l'état, sans cache.
    const res = await fetch(`${apiBase()}/apis/blocked`, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
    // Réponse correcte : la range.
    if (res.ok) applyServer(await res.json());
  // Serveur injoignable ou demande annulée : on garde l'état connu.
  } catch { /* rien */ }
// Fin de refreshServerBlocked.
}

/** Clé d'administration saisie dans cet onglet ('' si aucune). */
// getAdminToken : lit la clé.
export function getAdminToken() {
  // Essaie de lire le stockage de session.
  try { return globalThis.sessionStorage?.getItem(TOKEN_KEY) || ''; } catch { return ''; }
// Fin de getAdminToken.
}

/** Garde (ou efface, avec '') la clé d'administration pour la durée de l'onglet. */
// setAdminToken : écrit la clé.
export function setAdminToken(token) {
  // Essaie d'écrire.
  try {
    // Clé non vide : la garde ; vide : l'efface.
    if (token) globalThis.sessionStorage?.setItem(TOKEN_KEY, token); else globalThis.sessionStorage?.removeItem(TOKEN_KEY);
  // Stockage refusé : la clé ne vaut que pour cet appel.
  } catch { /* rien */ }
// Fin de setAdminToken.
}

/**
 * Déconnecte (blocked = true) ou reconnecte (false) une API.
 * Toujours sur cet appareil ; et sur le serveur si une clé d'administration est saisie.
 * Renvoie { server: 'ok' | 'skipped' | 'refused' | 'error', message? }.
 */
// setApiBlocked : applique le choix.
export async function setApiBlocked(api, blocked) {
  // Hôtes de l'API.
  const hosts = hostsOfApi(api);
  // Nouvelle liste de cet appareil.
  const local = toggleHosts(state.local, hosts, blocked);
  // La garde dans le navigateur.
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(local)); } catch { /* stockage refusé : valable jusqu'au rechargement */ }
  // L'applique aussitôt.
  setState({ local });
  // Clé d'administration.
  const token = getAdminToken();
  // Pas de clé, ou serveur non modifiable : le serveur n'est pas touché.
  if (!token || !state.editable) return { server: 'skipped' };
  // Essaie de modifier la liste du serveur.
  try {
    // Envoie la nouvelle liste d'exécution complète.
    const res = await fetch(`${apiBase()}/apis/blocked`, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ hosts: toggleHosts(state.server, hosts, blocked) }),
    });
    // Clé refusée.
    if (res.status === 403) return { server: 'refused', message: 'Clé d’administration refusée.' };
    // Autre échec.
    if (!res.ok) return { server: 'error', message: `Le serveur a répondu ${res.status}.` };
    // Succès : range le nouvel état.
    applyServer(await res.json());
    // Fait.
    return { server: 'ok' };
  // Serveur injoignable.
  } catch {
    // Signale l'échec.
    return { server: 'error', message: 'Serveur injoignable.' };
  // Fin de l'essai.
  }
// Fin de setApiBlocked.
}
