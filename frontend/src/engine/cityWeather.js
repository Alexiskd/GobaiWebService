import { normalizeCurrentWeather, weatherKey, weatherView } from './cityWeatherMath';

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
  'precipitation', 'weather_code', 'cloud_cover', 'wind_speed_10m', 'wind_direction_10m',
].join(',');
const FRESH_MS = 10 * 60 * 1000;   // une observation reste fraîche dix minutes
const RETRY_MS = 60 * 1000;        // pas de nouvelle tentative immédiate après un échec
const TIMEOUT_MS = 8000;

const cache = new Map(); // clé ≈ 1 km → { at, data } ou { at, promise }

async function requestWeather(key) {
  const [lat, lon] = key.split(',');
  const url = `${ENDPOINT}?latitude=${lat}&longitude=${lon}&current=${FIELDS}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    const current = normalizeCurrentWeather(await res.json());
    return current ? { ...weatherView(current), source: 'Open-Meteo' } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Météo actuelle d'une ville (Open-Meteo, appel direct depuis le navigateur).
 * Cache mémoire par cellule d'environ 1 km : la fiche répond instantanément au survol suivant.
 * `null` si le réseau ou l'API est indisponible — la fiche reste utilisable sans météo.
 */
export function loadCityWeather(city) {
  const key = weatherKey(city?.lat, city?.lon);
  if (!key) return Promise.resolve(null);
  const hit = cache.get(key);
  if (hit?.promise) return hit.promise;
  if (hit && Date.now() - hit.at < (hit.data ? FRESH_MS : RETRY_MS)) return Promise.resolve(hit.data);
  const promise = requestWeather(key).then((data) => {
    cache.set(key, { at: Date.now(), data });
    return data;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}
