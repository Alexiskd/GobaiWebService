import { get, resolveApiUrl } from './client';

/**
 * Tuiles : le serveur décrit les couches et donne un modèle d'URL {z}/{x}/{y} ; les images viennent du fournisseur.
 *   layers()                → { provider, fallback, tileSize, layers: [...] }
 *   layer(id)               → couche + urlTemplate + expiresAt + attribution
 *   attribution(id, bounds) → { copyright, provider } pour la zone visible
 */
export const tilesApi = {
  layers: (signal) => get('/tiles/layers', { signal }),
  // Les tuiles relayées par le backend renvoient un chemin relatif : on le rend absolu ici.
  layer: (id, signal) => get(`/tiles/layers/${encodeURIComponent(id)}`, { signal })
    .then((info) => ({ ...info, urlTemplate: resolveApiUrl(info.urlTemplate) })),
  attribution: (id, { zoom, north, south, east, west }, signal) =>
    get(`/tiles/layers/${encodeURIComponent(id)}/attribution`, { signal, query: { zoom, north, south, east, west } }),
};
