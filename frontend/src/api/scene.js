import { get } from './client';

export const fetchBodies = (signal) => get('/bodies', { signal });
export const fetchRoads = (signal) => get('/roads', { signal });
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
/** Lien de don PayPal public, ou `{ enabled: false, url: null }` si non configuré. */
export const fetchDonationConfig = (signal) => get('/donations/config', { signal });

// Tout ce dont la scène a besoin, en parallèle. `cities` est la liste (items) dans l'ordre d'importance.
export async function fetchSceneData(signal) {
  const [bodies, cities] = await Promise.all([fetchBodies(signal), fetchCities(undefined, signal)]);
  return { bodies, cities: cities.items };
}
