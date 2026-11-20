// Client HTTP de l'API NestJS (dossier backend/ du dépôt) pour le frontend statique Car.
// Base : VITE_API_URL (ex. https://api.exemple.fr/api) sinon « /api » : en ligne, le site et l'API forment un seul
// service web (même origine) ; en développement, le proxy Vite relaie /api vers le backend.
// Sans API joignable (site publié seul, en Static Site), les lectures replient sur les contrats embarqués plus bas.
// Racine de l'API, sans barre finale. Ce n'est jamais un secret.
const ROOT = String(import.meta.env?.VITE_API_URL || '/api').replace(/\/+$/, '');
// L'exporte sous le nom API_ROOT.
export { ROOT as API_ROOT };
// Base des routes : la racine suivie de « /v1 ».
export const API_BASE = `${ROOT}/v1`;
// Adresse publique du site, sans barre finale : celle qu'un client extérieur emploie (boutique, exemples de code).
export const PUBLIC_SITE_URL = String(import.meta.env?.VITE_PUBLIC_SITE_URL || 'https://www.gobaispace.com').replace(/\/+$/, '');
// Base publique de l'API.
export const PUBLIC_API_BASE = `${PUBLIC_SITE_URL}/api/v1`;
// Documentation interactive de l'API (Swagger).
export const PUBLIC_DOCS_URL = `${PUBLIC_SITE_URL}/api/docs`;

/** URL absolue d'un chemin renvoyé par l'API (« /api/v1/… »), même si l'API est sur un autre domaine. */
export function resolveApiUrl(path) {
  // Entrée vide ou non textuelle, chemin non absolu, adresse sans protocole : rendue telle quelle.
  if (!path || typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  // Si la racine est une adresse complète, ajoute son origine devant le chemin ; sinon le chemin tel quel.
  return /^https?:\/\//.test(ROOT) ? new URL(ROOT).origin + path : path;
}

export class ApiError extends Error {
  constructor(status, message, path) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

// Sérialise une requête en paramètres d'adresse ; les valeurs non définies sont omises.
function queryString(query) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null) continue;
    qs.set(key, String(value));
  // Fin des paramètres.
  }
  const text = qs.toString();
  return text ? `?${text}` : '';
}

// Réponses locales minimales conservant les contrats de l'API NestJS, embarquées pour le frontend statique.
function staticResponse(path) {
  const p = String(path || '').split('?')[0];
  if (p === '/assistant/config') return { enabled: false, model: null };
  if (p === '/tiles/layers') return { provider: 'static', fallback: true, tileSize: 256, layers: [] };
  if (p.startsWith('/tiles/layers/')) return { id: p.split('/').pop(), available: false, urlTemplate: null };
  if (p === '/tiles/satellites/status') return { items: [], satellites: [] };
  if (p.includes('/tiles/satellites/') && p.endsWith('/layers')) return { layers: [], items: [] };
  if (p === '/ephemeris/moon') return { source: 'local', points: [] };
  if (p === '/ephemeris/satellites') return { source: 'local', satellites: [] };
  if (p === '/ephemeris/moon/phases') return { source: 'local', items: [] };
  if (p === '/tiles/moon-blend/status') return { database: false, variants: [] };
  // Test de disponibilité des astres : sans serveur, rien n'est déclaré prêt (la Lune et le Soleil restent toujours là).
  if (p === '/tiles/bodies/availability') return { planets: [], satellites: [] };
  if (p === '/borders') return { source: 'local', attribution: 'Données géographiques embarquées', count: 0, lines: [], coastlines: [] };
  if (p === '/places/labels') return { attribution: 'Catalogue statique', count: 0, items: [] };
  if (p === '/pointclouds') return { available: false, items: [] };
  if (p === '/sun/regions') return { source: 'simulation locale', regions: [], flares: [] };
  if (p === '/sun/activity') return { source: 'simulation locale', flares: [] };
  if (p === '/donations/config') return { enabled: false, currency: 'EUR', minAmount: 1 };
  if (p === '/places') return { provider: 'local', items: [], attribution: 'Recherche distante désactivée' };
  if (p === '/lidar') return { available: false, items: [] };
  if (p === '/volcanoes') return { available: false, items: [], features: [] };
  if (p === '/tiles/lidar-hd/cities') return { altitudeM: 0, items: [] };
  return { available: false, items: [] };
}

// Lit le message d'erreur de l'API : une liste (validation) est jointe en une phrase.
async function apiError(res, path) {
  const body = await res.json().catch(() => null);
  const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  return new ApiError(res.status, message || `HTTP ${res.status}`, path);
}

// Vrai si la réponse vient bien de l'API (du JSON) et non du repli SPA d'un site statique (une page HTML).
const isApiAnswer = (res) => (res.headers.get('content-type') || '').includes('json');

// GET appelle l'API ; sans API joignable, il renvoie les données locales de repli (le site reste utilisable seul).
// Une vraie erreur de l'API (JSON, code 4xx/5xx) remonte en ApiError : c'est une réponse, pas une absence.
export async function get(path, { signal, query } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  let res;
  try {
    res = await fetch(`${API_BASE}${path}${queryString(query)}`, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    // Une interruption remonte ; une API injoignable bascule sur le repli.
    if (error?.name === 'AbortError') throw error;
    return staticResponse(path);
  }
  // Une page HTML (le repli SPA) ou une réponse vide n'est pas un contrat : repli local.
  if (!isApiAnswer(res)) return staticResponse(path);
  if (!res.ok) throw await apiError(res, path);
  return res.json();
}

// POST appelle l'API (paiement Stripe, assistant, écritures). Sans API joignable : erreur 503, rien n'est simulé.
export async function post(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(503, 'API injoignable : fonction indisponible sans serveur', path);
  }
  if (!res.ok) throw isApiAnswer(res) ? await apiError(res, path) : new ApiError(503, 'API injoignable : fonction indisponible sans serveur', path);
  return res.json();
}
