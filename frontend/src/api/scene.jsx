import { get, post } from './client';

export const fetchBodies = (signal) => get('/bodies', { signal });
export const fetchRoads = (signal) => get('/roads', { signal });
/** Nuages LAS/LAZ disponibles, leur en-tête géospatial et une URL Potree si le jeu a été converti. */
export const fetchPointClouds = (signal) => get('/pointclouds', { signal });
/** Métadonnées du LiDAR EPT 2018 de la Métropole de Lyon. */
export const fetchLyonPointCloud = (signal) => get('/pointclouds/lyon', { signal });
/** Configuration ICE publique pour la signalisation WebRTC des contributions. */
export const fetchContributionP2PConfig = (signal) => get('/contributions/p2p-config', { signal });
/** Recherche mondiale de lieux (Uber Maps, via le backend) : { provider, items: [{ name, context, lon, lat }], attribution }. */
export const searchPlaces = (q, signal) => get('/places', { signal, query: { q, limit: 8 } });
/** Noms des villes du monde (Natural Earth, triés par population) : { attribution, count, items: [{ name, native?, script?, country, lon, lat, pop, capital }] }.
 *  v=2 : change la clé de cache pour que les navigateurs ayant gardé l'ancien format (sans `native`) le renouvellent. */
export const fetchCityLabels = (signal) => get('/places/labels', { signal, query: { v: 2 } });
/** Position exacte de la Lune (JPL Horizons) : { source, frame, unit, stepMinutes, points: [{ t, x, y, z }] }. */
export const fetchMoonEphemeris = (signal) => get('/ephemeris/moon', { signal });
/** Sondes en orbite lunaire (JPL Horizons) : { source, items: [{ id, name, agency, status, error?, points }] }. */
/** Prochaines phases de la Lune (USNO) : { source, items: [{ phase, utc }] }. */
export const fetchMoonPhases = (signal) => get('/ephemeris/moon/phases', { signal });
/** Danuri : mosaïques ShadowCam des pôles { source, items: [{ id, name, pole, lat, lon, season, localTime }] }. */
export const fetchShadowCam = (signal) => get('/danuri/shadowcam', { signal });
export const fetchShadowCamMeta = (id, res, signal) => get(`/danuri/shadowcam/${encodeURIComponent(id)}/${res}/meta`, { signal });
export const fetchMoonOrbiters = (signal) => get('/ephemeris/moon/orbiters', { signal });
/** Frontières et littoraux : { source, attribution, count, lines, coastlines } (polylignes [lon, lat, …]). */
export const fetchBorders = (signal) => get('/borders', { signal });
/** Réponse paginée { total, items } ; sans paramètre, toutes les villes. */
export const fetchCities = (params, signal) => get('/cities', { signal, query: params });
/** État des dons du mois : { enabled, clientId, currency, monthlyLimit, raised, remaining, resetsAt, minAmount }. */
export const fetchDonationConfig = (signal) => get('/donations/config', { signal });
/** Crée une commande PayPal pour `amount` euros : { id }. Refusée (409) au-delà du reste du mois. */
export const createDonationOrder = (amount) => post('/donations/orders', { amount });
/** Encaisse un don approuvé dans PayPal : { status, amount, raised, remaining }. */
export const captureDonation = (orderId) => post(`/donations/orders/${encodeURIComponent(orderId)}/capture`);

// Tout ce dont la scène a besoin, en parallèle. `cities` est la liste (items) dans l'ordre d'importance.
export async function fetchSceneData(signal) {
  const [bodies, cities] = await Promise.all([fetchBodies(signal), fetchCities(undefined, signal)]);
  return { bodies, cities: cities.items };
}
