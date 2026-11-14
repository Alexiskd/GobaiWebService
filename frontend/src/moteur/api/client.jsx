// Client HTTP minimal de l'API NestJS. Base : VITE_API_URL (ex. https://api.exemple.fr/api) sinon /api :
// en ligne, le site et l'API forment un seul service web (même origine) ; en développement, le proxy Vite relaie /api.
// Racine de l'API : VITE_API_URL, ou « /api », sans barre finale.
const ROOT = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
// L'exporte sous le nom API_ROOT.
export { ROOT as API_ROOT };
// Base des routes : la racine suivie de « /v1 ».
export const API_BASE = `${ROOT}/v1`;

/**
 * Adresses publiques de l'API, telles qu'un client extérieur les emploie.
 *
 * Elles ne suivent pas l'origine de la page : un acheteur qui lit la boutique depuis localhost doit voir
 * l'adresse du vrai service, pas la sienne. C'est ce qui s'écrit dans les exemples de code et dans les liens
 * de la boutique. VITE_PUBLIC_SITE_URL permet de les faire pointer ailleurs (préproduction, autre domaine).
 */
// Adresse publique du site, sans barre finale.
export const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://www.gobaispace.com').replace(/\/$/, '');
// Base publique de l'API : c'est l'adresse que portent les appels d'un client.
export const PUBLIC_API_BASE = `${PUBLIC_SITE_URL}/api/v1`;
// Documentation interactive de l'API (Swagger) : chaque route, ses paramètres et ses réponses.
export const PUBLIC_DOCS_URL = `${PUBLIC_SITE_URL}/api/docs`;

/** URL absolue d'un chemin renvoyé par l'API, même si l'API est sur un autre domaine. */
// Fonction resolveApiUrl.
export function resolveApiUrl(path) {
  // Chemin vide, non absolu, ou adresse sans protocole : rendu tel quel.
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  // Si la racine est une adresse complète, ajoute son origine devant le chemin ; sinon le chemin tel quel.
  return /^https?:\/\//.test(ROOT) ? new URL(ROOT).origin + path : path;
// Fin de resolveApiUrl.
}

/** Erreur renvoyée par l'API : porte le code HTTP et le message lisible du serveur. */
// Classe ApiError.
export class ApiError extends Error {
  // Constructeur : le code HTTP, le message et le chemin.
  constructor(status, message, path) {
    // Passe le message à Error.
    super(message);
    // Fixe le nom de l'erreur.
    this.name = 'ApiError';
    // Garde le code.
    this.status = status;
    // Garde le chemin.
    this.path = path;
  // Fin du constructeur.
  }
// Fin de la classe.
}

// Fonction get : un appel GET, avec un signal d'annulation et des paramètres.
export async function get(path, { signal, query } = {}) {
  // Paramètres mis en forme, sans ceux qui sont vides.
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null))}` : '';
  // Lance la requête, en demandant du JSON.
  return request(path, `${API_BASE}${path}${qs}`, { signal, headers: { Accept: 'application/json' } });
// Fin de get.
}

/** POST JSON : renvoie la réponse JSON, ou lève une ApiError avec le message du serveur. */
// Fonction post.
export function post(path, body, { signal } = {}) {
  // Lance la requête, avec
  return request(path, `${API_BASE}${path}`, {
    // la méthode POST,
    method: 'POST',
    // le signal d'annulation,
    signal,
    // les en-têtes JSON,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    // et le corps en JSON, s'il y en a un.
    body: body === undefined ? undefined : JSON.stringify(body),
  // Fin des réglages.
  });
// Fin de post.
}

// Fonction request : l'appel lui-même.
async function request(path, url, init) {
  // Réponse.
  let res;
  // Essaie
  try {
    // d'appeler l'adresse.
    res = await fetch(url, init);
  // En cas d'échec :
  } catch (e) {
    // annulation : relancée telle quelle ;
    if (e.name === 'AbortError') throw e;
    // sinon erreur « API injoignable », code 0.
    throw new ApiError(0, 'API injoignable', path);
  // Fin du cas.
  }
  // Réponse en erreur :
  if (!res.ok) {
    // Format d'erreur unique du backend : { statusCode, error, message, path, timestamp }
    // lit le corps JSON, ou null ;
    const body = await res.json().catch(() => null);
    // son message, joint par des virgules si c'est une liste ;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    // erreur avec le code et le message, ou « HTTP <code> ».
    throw new ApiError(res.status, message || `HTTP ${res.status}`, path);
  // Fin du cas.
  }
  // Renvoie le JSON.
  return res.json();
// Fin de request.
}
