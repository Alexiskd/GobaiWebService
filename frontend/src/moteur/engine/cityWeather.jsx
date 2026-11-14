// Importe la mise au propre de la météo, la clé de cache et la mise en forme pour l'affichage.
import { normalizeCurrentWeather, weatherKey, weatherView } from './cityWeatherMath';

// Adresse de l'API de prévision d'Open-Meteo.
const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
// Champs demandés (début de la liste).
const FIELDS = [
  // Température, humidité, température ressentie et indicateur jour/nuit.
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
  // Précipitations, code météo, nébulosité, vitesse et direction du vent.
  'precipitation', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m',
// Fin de la liste, jointe par des virgules.
].join(',');
// Durée de fraîcheur d'une observation : dix minutes.
const FRESH_MS = 10 * 60 * 1000;   // une observation reste fraîche dix minutes
// Délai avant une nouvelle tentative après un échec : une minute.
const RETRY_MS = 60 * 1000;        // pas de nouvelle tentative immédiate après un échec
// Délai d'abandon d'une requête : huit secondes.
const TIMEOUT_MS = 8000;

// Cache en mémoire, par clé de position.
const cache = new Map(); // clé ≈ 1 km → { at, data } ou { at, promise }

// Déclare requestWeather : demande la météo d'une clé « latitude,longitude ».
async function requestWeather(key) {
  // Sépare la latitude et la longitude.
  const [lat, lon] = key.split(',');
  // Construit l'adresse de la requête.
  const url = `${ENDPOINT}?latitude=${lat}&longitude=${lon}&current=${FIELDS}`;
  // Crée un contrôleur d'annulation.
  const ctrl = new AbortController();
  // Annule la requête après le délai d'abandon.
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  // Début du bloc protégé.
  try {
    // Lance la requête, en demandant du JSON.
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    // Réponse en erreur : rien.
    if (!res.ok) return null;
    // Lit la réponse et la met au propre.
    const current = normalizeCurrentWeather(await res.json());
    // Si elle est exploitable : la mise en forme pour l'affichage, avec la source ; sinon rien.
    return current ? { ...weatherView(current), source: 'Open-Meteo' } : null;
  // En cas d'échec.
  } catch {
    // Rien.
    return null;
  // Dans tous les cas.
  } finally {
    // Annule le délai d'abandon.
    clearTimeout(timer);
  // Fin du bloc.
  }
// Fin de requestWeather.
}

/**
 * Météo actuelle d'une ville (Open-Meteo, appel direct depuis le navigateur).
 * Cache mémoire par cellule d'environ 1 km : la fiche répond instantanément au survol suivant.
 * `null` si le réseau ou l'API est indisponible — la fiche reste utilisable sans météo.
 */
// Déclare et exporte loadCityWeather : reçoit une ville.
export function loadCityWeather(city) {
  // La clé de cache de sa position.
  const key = weatherKey(city?.lat, city?.lon);
  // Sans position exploitable : rien.
  if (!key) return Promise.resolve(null);
  // L'entrée du cache, s'il y en a une.
  const hit = cache.get(key);
  // Requête déjà en cours : la même promesse.
  if (hit?.promise) return hit.promise;
  // Entrée encore valable (fraîche, ou échec récent) : sa valeur.
  if (hit && Date.now() - hit.at < (hit.data ? FRESH_MS : RETRY_MS)) return Promise.resolve(hit.data);
  // Sinon, lance la requête ; à la réponse (début).
  const promise = requestWeather(key).then((data) => {
    // Range la réponse dans le cache, avec sa date.
    cache.set(key, { at: Date.now(), data });
    // La renvoie.
    return data;
  // Fin du traitement de la réponse.
  });
  // Range tout de suite la promesse dans le cache.
  cache.set(key, { at: Date.now(), promise });
  // Renvoie la promesse.
  return promise;
// Fin de loadCityWeather.
}
