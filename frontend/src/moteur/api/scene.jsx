// Fonctions d'appel GET et POST, et base des routes.
import { get, post, API_BASE } from './client';
// Modèles 3D des astres, satellites sphériques, et inscription des satellites dans le moteur.
import { BODY_MODELS, SPHERICAL_SATELLITE_IDS, registerSatelliteBodies } from '../engine/tiledBodies';

// fetchBodies : les astres.
export const fetchBodies = (signal) => get('/bodies', { signal });
// fetchBodyListing : le listing d'affichage des astres (planètes, naines comprises, et leurs satellites naturels).
export const fetchBodyListing = (signal) => get('/bodies/listing', { signal });
/** Nuages LAS/LAZ disponibles, leur en-tête géospatial et une URL Potree si le jeu a été converti. */
// fetchPointClouds : les nuages de points.
export const fetchPointClouds = (signal) => get('/pointclouds', { signal });
/** Dalles LiDAR en vrais points 3D : { storage, items: [manifeste + nodeUrl] } (voir engine/lidarPoints.jsx). */
// fetchLidarTiles : les dalles LiDAR.
export const fetchLidarTiles = (signal) => get('/lidar', { signal });
/** Recherche mondiale de lieux (Photon, via le backend) : { provider, items: [{ name, context, lon, lat }], attribution }. */
// searchPlaces : la recherche de lieux, 8 résultats au plus.
export const searchPlaces = (q, signal) => get('/places', { signal, query: { q, limit: 8 } });
/** Noms des villes du monde (Natural Earth, triés par population) : { attribution, count, items: [{ name, native?, script?, country, lon, lat, pop, capital }] }.
 *  v=2 : change la clé de cache pour que les navigateurs ayant gardé l'ancien format (sans `native`) le renouvellent. */
// fetchCityLabels : les noms des villes (version 2 du format).
export const fetchCityLabels = (signal) => get('/places/labels', { signal, query: { v: 2 } });
/** Position exacte de la Lune (JPL Horizons) : { source, frame, unit, stepMinutes, points: [{ t, x, y, z }] }. */
// fetchMoonEphemeris : les positions de la Lune.
export const fetchMoonEphemeris = (signal) => get('/ephemeris/moon', { signal });
/** Satellites sphériques (Jupiter à Pluton) : tables JPL Horizons planète → satellite. */
// fetchSatelliteEphemeris : les positions des satellites.
export const fetchSatelliteEphemeris = (signal) => get('/ephemeris/satellites', { signal });
/** Prochaines phases de la Lune (USNO) : { source, items: [{ phase, utc }] }. */
// fetchMoonPhases : les prochaines phases de la Lune.
export const fetchMoonPhases = (signal) => get('/ephemeris/moon/phases', { signal });
/** Configuration des dons : { enabled, environment, currency, minAmount }. */
// fetchDonationConfig : la configuration des dons.
export const fetchDonationConfig = (signal) => get('/donations/config', { signal });
/** Crée la page de paiement Stripe pour amount euros : { id, url }. */
// createDonationOrder : crée un don d'un montant donné.
export const createDonationOrder = (amount) => post('/donations/orders', { amount });
/** Au retour de Stripe, confirme que le don est payé : { status, amount }. */
// captureDonation : confirme un don payé.
export const captureDonation = (orderId) => post(`/donations/orders/${encodeURIComponent(orderId)}/capture`);
/** Le donateur a quitté la page de paiement : elle est fermée côté Stripe. */
// cancelDonation : abandonne un don.
export const cancelDonation = (orderId) => post(`/donations/orders/${encodeURIComponent(orderId)}/cancel`);
/** Assistant de la fenêtre « Claude » : { enabled, model } ; enabled = clé de l'API configurée sur le serveur. */
// fetchAssistantConfig : la configuration de l'assistant.
export const fetchAssistantConfig = (signal) => get('/assistant/config', { signal });
/** Envoie la conversation [{ role: 'user' | 'assistant', content }] : { reply }. */
// askAssistant : envoie la conversation et l'inventaire des éléments actionnables de l'écran à l'assistant.
export const askAssistant = (messages, elements, signal) => post('/assistant/messages', { messages, elements }, { signal });
/** Frontières et littoraux : { source, attribution, count, lines, coastlines } (polylignes [lon, lat, …]). */
// fetchBorders : les frontières et les littoraux.
export const fetchBorders = (signal) => get('/borders', { signal });
/** Réponse paginée { total, items } ; sans paramètre, toutes les villes. */
// fetchCities : les villes.
export const fetchCities = (params, signal) => get('/cities', { signal, query: params });


/** Vents réels du moment (Open-Meteo) : grille { width, height, latStart, latStep, lonStart, lonStep, u[], v[] } en m/s. */
// fetchEarthWind : les vents du moment.
export const fetchEarthWind = (signal) => get('/tiles/earth-wind', { signal });
/** Couverture nuageuse du moment (Open-Meteo, sans clé) : { width, height, cover (base64), validAt, mean, source }. */
// fetchEarthCloudCover : la couverture nuageuse du moment.
export const fetchEarthCloudCover = (signal) => get('/tiles/earth-clouds/cover', { signal });
/** Adresse d'une tuile des nuages vus par satellite (Xweather, relayée par l'API). */
// earthCloudTileUrl : l'adresse d'une tuile de nuages.
export const earthCloudTileUrl = (z, x, y) => `${API_BASE}/tiles/earth-clouds/xweather/${z}/${x}/${y}`;

/** Satellites dont la carte NASA Trek est prête : [{ id, name, trek, source, label }]. */
// fetchSatelliteStatus : l'état des cartes des satellites.
export const fetchSatelliteStatus = (signal) => get('/tiles/satellites/status', { signal });

/** Toutes les couches NASA Trek d'un satellite ou d'une géante gazeuse (fond principal en premier). */
// fetchSatelliteLayers : les couches d'un astre.
export const fetchSatelliteLayers = (body, signal) => get(`/tiles/satellites/${encodeURIComponent(body)}/layers`, { signal });

/**
 * Test avant affichage (serveur) : pour chaque planète et satellite, carte NASA Trek (API Trek).
 * Les orbites sont toutes calculées par Kepler côté serveur. { planets: [{ id, trek, ready }], satellites: [...] }.
 */
// fetchBodyAvailability : le test de chaque astre avant affichage.
export const fetchBodyAvailability = (signal) => get('/tiles/bodies/availability', { signal });

/** Test avant affichage (client) : vrai seulement si l'astre a une carte NASA Trek. */
// isBodyReady : vrai si l'astre a une carte NASA Trek.
export const isBodyReady = (row) => Boolean(row && row.trek === true);

/**
 * Satellites ajoutés au moteur : ceux qui passent le test (carte NASA Trek). Si le test est injoignable, aucun
 * satellite n'est ajouté (la Lune, elle, reste toujours là).
 * Exceptions, toujours ajoutées même sans carte Trek :
 *  - un satellite qui a un modèle 3D officiel (Phobos, Deimos : voir BODY_MODELS), son modèle tient lieu de surface ;
 *  - les satellites reconnus sphériques par observation (SPHERICAL_SATELLITE_IDS : Io… Charon), en sphère unie
 *    tant qu'ils n'ont pas de carte.
 */
// Fonction readySatellites ; par défaut : les modèles 3D connus et les satellites sphériques.
export function readySatellites(satellites = [], availability = [], models = BODY_MODELS, always = SPHERICAL_SATELLITE_IDS) {
  // Identifiants des satellites qui passent le test.
  const ready = new Set(availability.filter(isBodyReady).map((s) => s.id));
  // Garde ceux qui passent le test, ont un modèle 3D ou sont toujours ajoutés.
  return satellites.filter((s) => ready.has(s.id) || Boolean(models[s.id]) || always.has(s.id));
// Fin de readySatellites.
}

// Tout ce dont la scène a besoin, en parallèle. `cities` est la liste (items) dans l'ordre d'importance.
// Fonction fetchSceneData.
export async function fetchSceneData(signal) {
  // Demande en même temps
  const [bodies, cities, availability] = await Promise.all([
    // les astres,
    fetchBodies(signal),
    // les villes,
    fetchCities(undefined, signal),
    // et le test des astres ; s'il échoue (hors annulation), des listes vides.
    fetchBodyAvailability(signal).catch((e) => { if (e.name === 'AbortError') throw e; return { planets: [], satellites: [] }; }),
  // Fin des demandes.
  ]);
  // Satellites retenus.
  const satellites = readySatellites(bodies.satellites, availability.satellites);
  // Les inscrit dans le moteur.
  registerSatelliteBodies(satellites);
  // Renvoie
  return {
    // les astres, avec les satellites retenus ;
    bodies: { ...bodies, satellites },
    // les villes ;
    cities: cities.items,
    // Satellites et planètes qui passent le test : leurs cartes Trek sont posées automatiquement (useTileBases).
    // l'état des satellites et des planètes.
    satelliteStatus: [...(availability.satellites || []), ...(availability.planets || [])],
  // Fin de l'objet.
  };
// Fin de fetchSceneData.
}
/** Activité solaire (NOAA SWPC) : { source, kp, sunspots, solarWind, flares: [{ cls, begin, peak }] }. */
// fetchSolarActivity : l'activité solaire.
export const fetchSolarActivity = (signal) => get('/sun/activity', { signal });
/** Régions actives du Soleil (NOAA SWPC) et éruptions localisées (NASA DONKI) :
 *  { source, generatedAt, frame, regions: [{ number, lat, lon, area, spots, probability, … }], flares: [{ cls, peak, lat, lon, region }] }.
 *  Positions héliographiques de Stonyhurst, en degrés : latitude positive au nord, longitude positive à l'ouest. */
// fetchSolarRegions : les régions actives et les éruptions localisées.
export const fetchSolarRegions = (signal) => get('/sun/regions', { signal });
/** Volcans en éruption dans le monde (NASA EONET) : { source, generatedAt, volcanoes: [{ id, name, lon, lat, date, link }] }. */
// fetchVolcanoes : les volcans en éruption.
export const fetchVolcanoes = (signal) => get('/volcanoes', { signal });

