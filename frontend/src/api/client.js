// Client HTTP minimal de l'API NestJS. Base : VITE_API_URL (ex. https://api.exemple.fr/api) ou /api (proxy Vite).
const DEFAULT_PRODUCTION_API_URL = 'https://gobai-space.onrender.com/api';
const ROOT = (
  import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_URL : '/api')
).replace(/\/$/, '');
export { ROOT as API_ROOT };
export const API_BASE = `${ROOT}/v1`;

/** URL absolue d'un chemin renvoyé par l'API, même si l'API est sur un autre domaine. */
export function resolveApiUrl(path) {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return path;
  return /^https?:\/\//.test(ROOT) ? new URL(ROOT).origin + path : path;
}

/** Erreur renvoyée par l'API : porte le code HTTP et le message lisible du serveur. */
export class ApiError extends Error {
  constructor(status, message, path) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

export async function get(path, { signal, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null))}` : '';
  let res;
  try {
    res = await fetch(`${API_BASE}${path}${qs}`, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'API injoignable', path);
  }
  if (!res.ok) {
    // Format d'erreur unique du backend : { statusCode, error, message, path, timestamp }
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(res.status, message || `HTTP ${res.status}`, path);
  }
  return res.json();
}
