// Fonction d'appel GET et résolution d'adresse.
import { get, resolveApiUrl } from './client';

/**
 * Tuiles : le serveur décrit les couches et donne un modèle d'URL {z}/{x}/{y} ; les images viennent du fournisseur.
 *   layers()                → { provider, fallback, tileSize, layers: [...] }
 *   layer(id)               → couche + urlTemplate + expiresAt + attribution
 *   attribution(id, bounds) → { copyright, provider } pour la zone visible
 *   lidarCities()           → { altitudeM, items: [{ name, region, lon, lat }] } villes du LiDAR HD
 */
// API des tuiles :
export const tilesApi = {
  // layers : la liste des couches.
  layers: (signal) => get('/tiles/layers', { signal }),
  // Les tuiles relayées par le backend renvoient un chemin relatif : on le rend absolu ici.
  // layer : une couche, par son identifiant ;
  layer: (id, signal) => get(`/tiles/layers/${encodeURIComponent(id)}`, { signal })
    // son modèle d'adresse est rendu absolu.
    .then((info) => ({ ...info, urlTemplate: resolveApiUrl(info.urlTemplate) })),
  // attribution : la mention d'une couche pour une zone et un zoom,
  attribution: (id, { zoom, north, south, east, west }, signal) =>
    // demandée avec ces valeurs en paramètres.
    get(`/tiles/layers/${encodeURIComponent(id)}/attribution`, { signal, query: { zoom, north, south, east, west } }),
  // lidarCities : les villes de France où le LiDAR HD est proposé, et l'altitude d'arrivée conseillée.
  lidarCities: (signal) => get('/tiles/lidar-hd/cities', { signal }),
// Fin de l'API.
};
