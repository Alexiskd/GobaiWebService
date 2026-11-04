const INDEX_URL = '/worldometer/index.json';
const countryFiles = new Map();
let indexPromise = null;

/** Clé de pays commune au cache Worldometer (`United States of America` → `united states of america`). */
export function countryKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function loadIndex() {
  if (!indexPromise) indexPromise = fetchJson(INDEX_URL);
  return indexPromise;
}

function loadCountry(file) {
  if (!countryFiles.has(file)) countryFiles.set(file, fetchJson(`/worldometer/${file}`));
  return countryFiles.get(file);
}

/** Extrait les statistiques d'une ville du fichier pays ; `null` si elle n'y figure pas. */
export function cityStatsFrom(data, name) {
  const item = data?.cities?.[name];
  if (!item || !(item.pop > 0)) return null;
  return {
    pop: item.pop,
    ...(item.areaKm2 > 0 ? { areaKm2: item.areaKm2 } : {}),
    ...(item.density > 0 ? { density: item.density } : {}),
    year: data.year ?? null,
    source: data.source || 'Worldometer',
    sourceUrl: data.sourceUrl || null,
  };
}

/** Statistiques Worldometer (estimation d'agglomération) pour une ville Natural Earth, ou `null`. */
export async function loadWorldCityStats(city) {
  if (!city?.country || !city?.name) return null;
  const index = await loadIndex();
  const file = index?.countries?.[countryKey(city.country)];
  if (!file) return null;
  const stats = cityStatsFrom(await loadCountry(file), city.name);
  if (!stats) return null;
  if (!stats.year) stats.year = index.year ?? null;
  return stats;
}
