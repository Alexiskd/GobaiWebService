// Client HTTP de l'API NestJS de Computing : les routes sont servies par `npm start` dans ce dossier,
// avec repli local sur les données embarquées quand l'API ne répond pas (mode frontend statique).
// Base d'origine de l'API : réglée à la construction par VITE_API_BASE (ex. https://gobai-api.onrender.com),
// vide par défaut pour garder le mode même origine du site statique. Ce n'est jamais un secret.
export const API_BASE = String(import.meta.env?.VITE_API_BASE ?? '').replace(/\/+$/, '');
export const API_ROOT = API_BASE;
export const PUBLIC_SITE_URL = '';
export const PUBLIC_API_BASE = API_BASE;
export const PUBLIC_DOCS_URL = '';

export function resolveApiUrl(path) {
  if (!path || typeof path !== 'string') return path;
  // Une adresse déjà absolue (http/https, protocole relatif) reste telle quelle.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  // Les chemins relatifs sont complétés par l'origine de l'API, quand elle est réglée.
  return API_BASE ? `${API_BASE}${path}` : path;
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
  if (p === '/tiles/earth-wind' || p === '/tiles/earth-clouds/cover') return { available: false };
  if (p === '/places') return { provider: 'local', items: [], attribution: 'Recherche distante désactivée' };
  if (p === '/lidar') return { available: false, items: [] };
  if (p === '/volcanoes' || p.startsWith('/atmosphere/')) return { available: false, items: [], features: [] };
  if (p === '/tiles/lidar-hd/cities') return { altitudeM: 0, items: [] };
  return { available: false, items: [] };
}

// GET appelle l'API NestJS (main.ts) ; sans API joignable, il renvoie les données locales de repli.
export async function get(path, { signal, query } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const url = `${API_BASE}${resolveApiUrl(path)}${queryString(query)}`;
  try {
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
    // Une page HTML (le repli SPA) n'est pas un contrat : on garde le repli local.
    const type = response.headers.get('content-type') || '';
    if (response.ok && type.includes('json')) return await response.json();
  } catch (error) {
    // Une interruption remonte ; une API injoignable bascule sur le repli.
    if (error?.name === 'AbortError') throw error;
  }
  return staticResponse(path);
}

// Les opérations serveur (écriture, paiement, assistant distant) restent désactivées côté client.
export async function post(path) {
  throw new ApiError(503, 'Fonction indisponible en mode statique', path);
}
