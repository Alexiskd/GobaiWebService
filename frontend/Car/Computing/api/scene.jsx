// Fonctions d'appel GET et POST.
import { get, post } from './client.jsx';
// Modèles 3D des astres, satellites sphériques, et inscription des satellites dans le moteur.
import { BODY_MODELS, SPHERICAL_SATELLITE_IDS, registerSatelliteBodies } from '../../Engine/AstreSolideEngine/BodyEngine/tiledBodies.jsx';
// Données scientifiques embarquées : le cœur du système solaire fonctionne sans API Gobai.
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '../../Engine/SystemeEngine/astronomy/data/bodies.data';

// fetchBodies : les astres.
export const fetchBodies = async () => ({ sun: SUN, moon: MOON, planets: PLANETS, satellites: ALL_SATELLITES });
// fetchBodyListing : le listing d'affichage des astres (planètes, naines comprises, et leurs satellites naturels).
export const fetchBodyListing = async () => ({ planets: PLANETS.map((p) => ({ ...p, aAu: p.elements[0], satellites: ALL_SATELLITES.filter((sat) => sat.parent === (p.name === 'Terre' ? 'earth' : p.name.toLowerCase())) })), counts: { planets: PLANETS.length, dwarfPlanets: PLANETS.filter((p) => p.dwarf).length, satellites: ALL_SATELLITES.length } });
/** Nuages LAS/LAZ disponibles, leur en-tête géospatial et une URL Potree si le jeu a été converti. */
// fetchPointClouds : les nuages de points.
export const fetchPointClouds = (signal) => get('/pointclouds', { signal });
/**
 * Dalles LiDAR HD de l'IGN autour d'un point, lues en direct par le serveur : { storage, available, items: [manifeste +
 * nodeUrl] } (voir engine/lidarPoints.jsx).
 */
// fetchLidarTiles : les dalles LiDAR autour de { lon, lat }, dans un rayon `r` en mètres, ou sur l'emprise `bbox`
// [ouest, sud, est, nord] (le champ de la caméra) ; les deux sont facultatifs.
export const fetchLidarTiles = (signal, { lon, lat, r, bbox }) => get('/lidar', { signal, query: {
  lon: lon.toFixed(5), lat: lat.toFixed(5), r: Number.isFinite(r) ? Math.round(r) : undefined,
  bbox: Array.isArray(bbox) && bbox.every(Number.isFinite) ? bbox.map((v) => v.toFixed(5)).join(',') : undefined,
} });
/** Recherche mondiale de lieux (moteur interne du backend) : { provider, items: [{ name, context, lon, lat }], attribution }. */
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
/** Frontières et littoraux : { source, attribution, count, lines, coastlines } (polylignes [lon, lat, …]). */
// fetchBorders : les frontières et les littoraux.
export const fetchBorders = (signal) => get('/borders', { signal });
/** Réponse paginée { total, items } ; sans paramètre, toutes les villes. */
// fetchCities : les villes.
export const fetchCities = (params, signal) => get('/cities', { signal, query: params });



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
  // Le noyau scientifique est embarqué : aucun serveur Gobai n'est requis pour ouvrir la scène 3D.
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const [bodies, cities, availability] = await Promise.all([
    fetchBodies(signal),
    // Une erreur de l'API sur les villes n'empêche pas la scène : liste vide.
    fetchCities(undefined, signal).catch((e) => { if (e.name === 'AbortError') throw e; return { total: 0, items: [] }; }),
    // Sans réponse du serveur (erreur de l'API), rien n'est déclaré prêt : la scène s'affiche quand même.
    fetchBodyAvailability(signal).catch((e) => { if (e.name === 'AbortError') throw e; return { planets: [], satellites: [] }; }),
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

