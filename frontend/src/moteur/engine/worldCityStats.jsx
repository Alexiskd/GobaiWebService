// Adresse de l'index des fichiers de statistiques.
const INDEX_URL = '/worldometer/index.json';
// Fichiers de pays déjà demandés.
const countryFiles = new Map();
// Promesse de l'index, créée à la première demande.
let indexPromise = null;

/** Clé de pays commune au cache Worldometer (`United States of America` → `united states of america`). */
// Déclare et exporte countryKey : reçoit un nom de pays.
export function countryKey(name) {
  // Le convertit en texte, vide s'il manque…
  return String(name ?? '')
    // … en minuscules…
    .toLowerCase()
    // … décompose les lettres accentuées…
    .normalize('NFD')
    // … retire les accents…
    .replace(/[\u0300-\u036f]/g, '')
    // … remplace l'esperluette par « and »…
    .replace(/&/g, ' and ')
    // … remplace toute suite d'autres caractères par une espace…
    .replace(/[^a-z0-9]+/g, ' ')
    // … et retire les espaces du début et de la fin.
    .trim();
// Fin de countryKey.
}

// Déclare fetchJson : charge un fichier JSON.
async function fetchJson(url) {
  // Début du bloc protégé.
  try {
    // Lance la requête, en demandant du JSON.
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    // Réponse correcte : son contenu ; sinon null.
    return res.ok ? await res.json() : null;
  // En cas d'échec.
  } catch {
    // Rien.
    return null;
  // Fin du bloc.
  }
// Fin de fetchJson.
}

// Déclare loadIndex : charge l'index une seule fois.
function loadIndex() {
  // Première demande : lance le chargement.
  if (!indexPromise) indexPromise = fetchJson(INDEX_URL);
  // Renvoie la promesse.
  return indexPromise;
// Fin de loadIndex.
}

// Déclare loadCountry : charge le fichier d'un pays une seule fois.
function loadCountry(file) {
  // Première demande de ce fichier : lance le chargement.
  if (!countryFiles.has(file)) countryFiles.set(file, fetchJson(`/worldometer/${file}`));
  // Renvoie la promesse.
  return countryFiles.get(file);
// Fin de loadCountry.
}

/** Extrait les statistiques d'une ville du fichier pays ; `null` si elle n'y figure pas. */
// Déclare et exporte cityStatsFrom : les données d'un pays et le nom d'une ville.
export function cityStatsFrom(data, name) {
  // La fiche de la ville.
  const item = data?.cities?.[name];
  // Absente ou sans population : null.
  if (!item || !(item.pop > 0)) return null;
  // Renvoie les statistiques (début de l'objet).
  return {
    // La population.
    pop: item.pop,
    // L'aire, si elle est connue.
    ...(item.areaKm2 > 0 ? { areaKm2: item.areaKm2 } : {}),
    // La densité, si elle est connue.
    ...(item.density > 0 ? { density: item.density } : {}),
    // L'année, null si elle manque.
    year: data.year ?? null,
    // La source, « Worldometer » à défaut.
    source: data.source || 'Worldometer',
    // L'adresse de la source, null si elle manque.
    sourceUrl: data.sourceUrl || null,
  // Fin de l'objet.
  };
// Fin de cityStatsFrom.
}

/** Statistiques Worldometer (estimation d'agglomération) pour une ville Natural Earth, ou `null`. */
// Déclare et exporte loadWorldCityStats : reçoit une ville.
export async function loadWorldCityStats(city) {
  // Sans pays ou sans nom : null.
  if (!city?.country || !city?.name) return null;
  // Charge l'index.
  const index = await loadIndex();
  // Le fichier du pays de la ville.
  const file = index?.countries?.[countryKey(city.country)];
  // Pays absent de l'index : null.
  if (!file) return null;
  // Charge le fichier et en extrait les statistiques de la ville.
  const stats = cityStatsFrom(await loadCountry(file), city.name);
  // Ville absente : null.
  if (!stats) return null;
  // Sans année dans le fichier : celle de l'index.
  if (!stats.year) stats.year = index.year ?? null;
  // Renvoie les statistiques.
  return stats;
// Fin de loadWorldCityStats.
}
