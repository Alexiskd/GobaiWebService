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
  if (p === '/donations/config') return { enabled: false, currency: 'EUR', minAmount: 0.01 };
  if (p === '/places') return { provider: 'local', items: [], attribution: 'Recherche distante désactivée' };
  if (p === '/volcanoes') return { available: false, items: [], features: [] };
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

// Moins de requêtes vers le serveur : les lectures identiques en cours sont partagées (une seule requête réseau,
// quel que soit le nombre de composants qui la demandent), et une réponse réussie est resservie en mémoire, au
// plus GET_CACHE_MS, et jamais plus longtemps que ce que le serveur autorise (Cache-Control) : une route marquée
// no-store (états en direct, compteurs) n'est jamais resservie. Les erreurs ne sont jamais gardées.
const GET_CACHE_MS = 20_000;
// Nombre maximal de réponses gardées (les plus anciennes partent d'abord).
const GET_CACHE_MAX = 200;
// Descriptions de couches : leur modèle d'adresse porte un jeton qui expire ; leur mémoire est gérée par
// TileSource (expiration comprise). Ici, elles sont seulement partagées en cours de route, jamais resservies.
const NO_CACHE_PREFIXES = ['/tiles/layers/'];
// Réponses réussies récentes : clé (chemin + paramètres) → { until, value }.
const getCache = new Map();
// Lectures en cours : clé → promesse partagée.
const getInflight = new Map();

// Durée de mémoire permise par l'en-tête Cache-Control du serveur (ms), bornée par GET_CACHE_MS.
function allowedMs(cacheControl) {
  const cc = String(cacheControl || '').toLowerCase();
  if (/no-store|no-cache|private/.test(cc)) return 0;
  const m = /max-age=(\d+)/.exec(cc);
  return m ? Math.min(GET_CACHE_MS, Number(m[1]) * 1000) : GET_CACHE_MS;
}

// Une lecture réseau, sans signal d'annulation : elle sert tous les appelants qui l'attendent.
// Renvoie la valeur et la durée pendant laquelle elle peut être resservie.
async function rawGet(path, query) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}${queryString(query)}`, { headers: { Accept: 'application/json' } });
  } catch {
    // API injoignable : repli local.
    return { value: staticResponse(path), ttl: GET_CACHE_MS };
  }
  // Une page HTML (le repli SPA) ou une réponse vide n'est pas un contrat : repli local.
  if (!isApiAnswer(res)) return { value: staticResponse(path), ttl: GET_CACHE_MS };
  if (!res.ok) throw await apiError(res, path);
  return { value: await res.json(), ttl: allowedMs(res.headers.get('cache-control')) };
}

// Attend une promesse partagée, ou rejette en AbortError si le signal de cet appelant se déclenche avant ; la
// requête partagée continue pour les autres appelants (et remplit la mémoire pour les suivants).
function untilAborted(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

// GET appelle l'API ; sans API joignable, il renvoie les données locales de repli (le site reste utilisable seul).
// Une vraie erreur de l'API (JSON, code 4xx/5xx) remonte en ApiError : c'est une réponse, pas une absence.
export async function get(path, { signal, query } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const key = `${path}${queryString(query)}`;
  const cacheable = !NO_CACHE_PREFIXES.some((p) => path.startsWith(p));
  // Réponse récente : resservie sans requête (copie, comme ci-dessous).
  if (cacheable) {
    const hit = getCache.get(key);
    if (hit && Date.now() < hit.until) return copyOf(hit.value);
    if (hit) getCache.delete(key);
  }
  // Même lecture déjà en cours : partagée.
  let shared = getInflight.get(key);
  if (!shared) {
    shared = rawGet(path, query);
    getInflight.set(key, shared);
    shared.then(
      ({ value, ttl }) => {
        if (!cacheable || ttl <= 0) return;
        getCache.delete(key);
        getCache.set(key, { until: Date.now() + ttl, value });
        // Mémoire bornée : la plus ancienne part.
        if (getCache.size > GET_CACHE_MAX) getCache.delete(getCache.keys().next().value);
      },
      () => {},
    ).finally(() => { if (getInflight.get(key) === shared) getInflight.delete(key); });
  }
  // Chaque appelant reçoit sa propre copie : une réponse partagée modifiée par un composant ne change pas les autres.
  return untilAborted(shared, signal).then(({ value }) => copyOf(value));
}

// Copie profonde d'une réponse JSON.
const copyOf = (value) => (value && typeof value === 'object'
  ? (globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value)))
  : value);

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
