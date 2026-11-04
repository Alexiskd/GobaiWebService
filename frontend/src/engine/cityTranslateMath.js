/**
 * Préparation des traductions de la fiche ville (moteur : MyMemory).
 * Fonctions pures, testées dans cityTranslateMath.test.mjs : choix des textes à traduire,
 * détection de la langue locale et validation des réponses du service.
 */

const SCRIPT_LANG = {
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh-CN',
  arabic: 'ar',
  hebrew: 'he',
  devanagari: 'hi',
  bengali: 'bn',
  greek: 'el',
  cyrillic: 'ru',
};

// Écritures partagées : le pays précise la langue (persan, ourdou, ukrainien, chinois traditionnel).
const COUNTRY_LANG = {
  Iran: 'fa',
  Afghanistan: 'fa',
  Pakistan: 'ur',
  Ukraine: 'uk',
  Taiwan: 'zh-TW',
  'Hong Kong': 'zh-TW',
  Macao: 'zh-TW',
};

/** Langue d'origine probable du nom local d'une ville (code MyMemory). */
export function sourceLanguage(city) {
  return COUNTRY_LANG[city?.country] || SCRIPT_LANG[city?.script] || 'en';
}

/** Textes de la fiche qui méritent une traduction : nom local, nom sans version française, région. */
export function translationTargets(city) {
  if (!city) return [];
  const targets = [];
  if (city.native) targets.push({ field: 'native', text: String(city.native).trim(), source: sourceLanguage(city) });
  if (city.name && !city.nameFr) targets.push({ field: 'name', text: String(city.name).trim(), source: 'en' });
  if (city.region) targets.push({ field: 'region', text: String(city.region).trim(), source: 'en' });
  return targets.filter((t) => t.text);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
    const key = name.toLowerCase();
    if (key[0] === '#') {
      const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[key] ?? whole;
  });
}

/** Deux textes identiques à la casse, aux accents, aux espaces et à la ponctuation près. */
export function sameText(a, b) {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  if (!x || !y) return false;
  if (x.localeCompare(y, undefined, { sensitivity: 'base' }) === 0) return true;
  // MyMemory renvoie parfois « Pa r i s » : on compare aussi sans aucun séparateur.
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  const nx = norm(x);
  return Boolean(nx) && nx === norm(y);
}

const NON_LATIN = /[\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u0980-\u09ff\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
// Petits mots admis dans un nom propre français (« Communauté de Madrid », « Asie de l’Est »).
const NAME_PARTICLES = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'en', 'et', 'sur', 'sous', 'au', 'aux',
  'van', 'von', 'zu', 'del', 'della', 'of', 'the', 'and', 'in', 'on', 'at',
]);

function isNameWord(word) {
  const bare = word.replace(/^[«"'([\]]+/, '').replace(/[»"'),.;:!?\]]+$/, '');
  if (!bare) return true;
  if (/[A-ZÀ-ÖØ-ÞŒÆ]/.test(bare[0])) return true;
  if (/^(d|l|j|m|n|s|t|c|qu)[’']/i.test(bare)) return true; // d’Ivoire, l’Haÿ
  return NAME_PARTICLES.has(bare.toLowerCase());
}

/** Un nom propre traduit garde ses majuscules ; « Cork → Le liège » est ainsi écarté. */
export function looksLikeName(text) {
  return String(text).split(/[\s·/]+/).filter(Boolean).every(isNameWord);
}

/** Réponse MyMemory → texte traduit utile, ou `null` (erreur, quota, texte identique, traduction douteuse). */
export function cleanTranslation(data, source) {
  if (!data || data.quotaFinished) return null;
  const status = Number(data.responseStatus);
  if (status && status !== 200) return null;
  const raw = data.responseData?.translatedText;
  if (typeof raw !== 'string') return null;
  const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (/INVALID SOURCE LANGUAGE|QUERY LENGTH LIMIT|MYMEMORY WARNING|PLEASE SELECT TWO DISTINCT/i.test(text)) return null;
  if (NON_LATIN.test(text)) return null;   // la fiche est en français : sortie latine attendue
  if (/\d/.test(text) && !/\d/.test(source)) return null; // préfixes de code renvoyés par la mémoire MyMemory
  if (sameText(text, source)) return null;
  if (!looksLikeName(text)) return null;
  return text;
}

/** Ne garde que les traductions qui apportent une information nouvelle par rapport à la fiche. */
export function pickTranslations(city, results) {
  if (!city || !results) return null;
  const title = city.nameFr || city.name || '';
  const name = results.name || results.native || '';
  const out = {};
  if (name && !sameText(name, title)) out.name = name;
  if (results.region && !sameText(results.region, city.region)) out.region = results.region;
  return Object.keys(out).length ? out : null;
}
