// Fonction d'appel GET et résolution d'adresse.
import { get, resolveApiUrl } from './client';

/**
 * Tuiles : le serveur décrit les couches et donne un modèle d'URL {z}/{x}/{y} ; les images viennent du fournisseur.
 *   layers()                → { provider, fallback, tileSize, layers: [...] }
 *   layer(id)               → couche + urlTemplate + expiresAt + attribution
 *   attribution(id, bounds) → { copyright, provider } pour la zone visible
 *   lidarCities()           → { altitudeM, items: [{ name, region, lon, lat }] } villes du LiDAR HD
 *   earthPlan()             → table de priorité des sources de la Terre { version, relay, colorMatch, sources }
 */
// API des tuiles :
export const tilesApi = {
  // layers : la liste des couches.
  layers: (signal) => get('/tiles/layers', { signal }),
  // Les tuiles relayées par le backend renvoient un chemin relatif : on le rend absolu ici.
  // layer : une couche, par son identifiant ;
  layer: (id, signal) => get(`/tiles/layers/${encodeURIComponent(id)}`, { signal })
    // son modèle d'adresse est rendu absolu, comme celui des fonds marins quand la couche en a.
    .then((info) => ({ ...info, urlTemplate: resolveApiUrl(info.urlTemplate), ...(info.seafloor ? { seafloor: { ...info.seafloor, template: resolveApiUrl(info.seafloor.template) } } : {}) })),
  // attribution : la mention d'une couche pour une zone et un zoom,
  attribution: (id, { zoom, north, south, east, west }, signal) =>
    // demandée avec ces valeurs en paramètres.
    get(`/tiles/layers/${encodeURIComponent(id)}/attribution`, { signal, query: { zoom, north, south, east, west } }),
  // lidarCities : les villes de France où le LiDAR HD est proposé, et l'altitude d'arrivée conseillée.
  lidarCities: (signal) => get('/tiles/lidar-hd/cities', { signal }),
  // Table de priorité des sources de la Terre (gardée un jour par le navigateur, comme le serveur l'indique).
  earthPlan: (signal) => get('/tiles/earth/plan', { signal }),
// Fin de l'API.
};
