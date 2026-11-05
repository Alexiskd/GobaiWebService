import { cleanTranslation, pickTranslations, translationTargets } from './cityTranslateMath';

const ENDPOINT = 'https://api.mymemory.translated.net/get';
const TIMEOUT_MS = 8000;
const FRESH_MS = 24 * 60 * 60 * 1000; // une traduction ne change pas : gardée pour la session
const RETRY_MS = 10 * 60 * 1000;       // échec : pas de nouvelle tentative avant dix minutes

const cache = new Map();   // « langue|texte » → { at, text }
const pending = new Map(); // requêtes en cours, partagées entre villes voisines

async function request(text, source) {
  const langpair = `${source}|fr`;
  const url = `${ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    return cleanTranslation(await res.json(), text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function translateText(text, source) {
  const key = `${source}|${text}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (hit.text ? FRESH_MS : RETRY_MS)) return Promise.resolve(hit.text);
  if (pending.has(key)) return pending.get(key);
  const promise = request(text, source).then((translated) => {
    cache.set(key, { at: Date.now(), text: translated });
    pending.delete(key);
    return translated;
  });
  pending.set(key, promise);
  return promise;
}

/**
 * Traduction française du nom local et de la région d'une ville (MyMemory), pour sa fiche au survol seulement.
 * `null` quand la fiche n'a rien à traduire ou que le service est indisponible.
 */
export async function translateCity(city) {
  const targets = translationTargets(city);
  if (!targets.length) return null;
  const values = await Promise.all(targets.map((t) => translateText(t.text, t.source)));
  const results = {};
  targets.forEach((t, i) => {
    if (values[i]) results[t.field] = values[i];
  });
  const picked = pickTranslations(city, results);
  return picked ? { ...picked, engine: 'MyMemory' } : null;
}
