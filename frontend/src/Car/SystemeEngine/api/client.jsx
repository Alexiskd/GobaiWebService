// Client réseau désactivé : Gobai Space fonctionne en mode frontend statique.
// Les données scientifiques principales sont embarquées dans Car/SystemeEngine/data.
export const API_ROOT = '';
export const API_BASE = '';
export const PUBLIC_SITE_URL = '';
export const PUBLIC_API_BASE = '';
export const PUBLIC_DOCS_URL = '';

export function resolveApiUrl(path) {
  if (!path || typeof path !== 'string') return path;
  // Les chemins locaux restent locaux ; aucune origine API n'est ajoutée.
  return path;
}

export class ApiError extends Error {
  constructor(status, message, path) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

// Réponses locales minimales conservant les contrats attendus par les hooks.
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

// GET ne déclenche plus de fetch : il renvoie exclusivement des données locales de repli.
export async function get(path, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return staticResponse(path);
}

// Les opérations serveur (écriture, paiement, assistant distant) sont désactivées en mode statique.
export async function post(path) {
  throw new ApiError(503, 'Fonction indisponible en mode statique', path);
}
