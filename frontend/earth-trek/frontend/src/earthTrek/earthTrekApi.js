// Client de l'API du Trek de la Terre (backend NestJS). Les clés des fournisseurs restent côté serveur.
import { resolveApiUrl } from '@/api';

async function getJson(path, signal) {
  const response = await fetch(resolveApiUrl(path), { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try { message = (await response.json()).message || message; } catch { /* corps non JSON */ }
    throw new Error(message);
  }
  return response.json();
}

export const earthTrekApi = {
  /** Fonds Esri, Mapbox et Maxar, avec leur disponibilité selon les clés configurées sur le serveur. */
  layers: (signal) => getJson('/api/v1/earth-trek/layers', signal).then((r) => r.items || []),
  /** Étapes du tour du monde. */
  stops: (signal) => getJson('/api/v1/earth-trek/stops', signal).then((r) => r.items || []),
  attribution: (layerId, signal) => getJson(`/api/v1/earth-trek/layers/${encodeURIComponent(layerId)}/attribution`, signal),
  /** URL d'une tuile (grille Web Mercator z/x/y), servie et mise en cache par le backend. */
  tileUrl: (layerId, z, x, y) => resolveApiUrl(`/api/v1/earth-trek/tiles/${encodeURIComponent(layerId)}/${z}/${x}/${y}`),
};
