/**
 * Préparation des traductions de la fiche ville (moteur : MyMemory).
 * Fonctions pures, testées dans cityTranslateMath.test.mjs : choix des textes à traduire,
 * détection de la langue locale et validation des réponses du service.
 */

// Table qui associe une écriture à un code de langue (début).
const SCRIPT_LANG = {
  // Japonaise : ja.
  japanese: 'ja',
  // Coréenne : ko.
  korean: 'ko',
  // Chinoise : zh-CN.
  chinese: 'zh-CN',
  // Arabe : ar.
  arabic: 'ar',
  // Hébraïque : he.
  hebrew: 'he',
  // Devanagari : hi.
  devanagari: 'hi',
  // Bengalie : bn.
  bengali: 'bn',
  // Grecque : el.
  greek: 'el',
  // Cyrillique : ru.
  cyrillic: 'ru',
// Fin de la table.
};

// Écritures partagées : le pays précise la langue (persan, ourdou, ukrainien, chinois traditionnel).
// Table qui associe un pays à un code de langue (début).
const COUNTRY_LANG = {
  // Iran : fa.
  Iran: 'fa',
  // Afghanistan : fa.
  Afghanistan: 'fa',
  // Pakistan : ur.
  Pakistan: 'ur',
  // Ukraine : uk.
  Ukraine: 'uk',
  // Taïwan : zh-TW.
  Taiwan: 'zh-TW',
  // Hong Kong : zh-TW.
  'Hong Kong': 'zh-TW',
  // Macao : zh-TW.
  Macao: 'zh-TW',
// Fin de la table.
};

/** Langue d'origine probable du nom local d'une ville (code MyMemory). */
// Déclare et exporte sourceLanguage : la ville.
export function sourceLanguage(city) {
  // Renvoie la langue du pays, sinon celle de l'écriture, sinon « en ».
  return COUNTRY_LANG[city?.country] || SCRIPT_LANG[city?.script] || 'en';
// Fin de sourceLanguage.
}

/** Textes de la fiche qui méritent une traduction : nom local, nom sans version française, région. */
// Déclare et exporte translationTargets : la ville.
export function translationTargets(city) {
  // Sans ville : liste vide.
  if (!city) return [];
  // Liste des textes à traduire.
  const targets = [];
  // Le nom local, s'il existe, depuis la langue d'origine.
  if (city.native) targets.push({ field: 'native', text: String(city.native).trim(), source: sourceLanguage(city) });
  // Le nom, s'il n'a pas de version française, depuis l'anglais.
  if (city.name && !city.nameFr) targets.push({ field: 'name', text: String(city.name).trim(), source: 'en' });
  // La région, si elle existe, depuis l'anglais.
  if (city.region) targets.push({ field: 'region', text: String(city.region).trim(), source: 'en' });
  // Renvoie la liste sans les textes vides.
  return targets.filter((t) => t.text);
// Fin de translationTargets.
}

// Table des entités HTML nommées et de leur caractère.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// decodeEntities : remplace les entités HTML d'un texte (début).
function decodeEntities(value) {
  // Pour chaque entité, numérique ou nommée (début).
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name) => {
    // Son nom en minuscules.
    const key = name.toLowerCase();
    // Pour une entité numérique (début).
    if (key[0] === '#') {
      // Son code, lu en hexadécimal après « #x » ou en décimal après « # ».
      const code = key[1] === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      // Renvoie le caractère de ce code, ou l'entité telle quelle si le code est invalide.
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    // Fin du cas numérique.
    }
    // Entité nommée : son caractère dans la table, ou l'entité telle quelle.
    return ENTITIES[key] ?? whole;
  // Fin du remplacement.
  });
// Fin de decodeEntities.
}

/** Deux textes identiques à la casse, aux accents, aux espaces et à la ponctuation près. */
// Déclare et exporte sameText : les deux textes.
export function sameText(a, b) {
  // Premier texte, sans espaces autour ; une valeur absente devient un texte vide.
  const x = String(a ?? '').trim();
  // Second texte, traité de la même façon.
  const y = String(b ?? '').trim();
  // L'un des deux est vide : faux.
  if (!x || !y) return false;
  // Égaux sans tenir compte de la casse ni des accents : vrai.
  if (x.localeCompare(y, undefined, { sensitivity: 'base' }) === 0) return true;
  // MyMemory renvoie parfois « Pa r i s » : on compare aussi sans aucun séparateur.
  // norm : texte sans accents, en minuscules…
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    // … et réduit à ses lettres non accentuées et à ses chiffres.
    .replace(/[^a-z0-9]+/g, '');
  // Premier texte réduit.
  const nx = norm(x);
  // Vrai s'il n'est pas vide et s'il est égal au second texte réduit.
  return Boolean(nx) && nx === norm(y);
// Fin de sameText.
}

// Expression qui reconnaît un caractère grec, cyrillique, hébreu, arabe, devanagari, bengali, chinois, japonais ou coréen.
const NON_LATIN = /[\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u0980-\u09ff\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/;
// Petits mots admis dans un nom propre français (« Communauté de Madrid », « Asie de l’Est »).
// Ensemble des petits mots admis dans un nom propre (début).
const NAME_PARTICLES = new Set([
  // Articles et prépositions français.
  'de', 'du', 'des', 'le', 'la', 'les', 'en', 'et', 'sur', 'sous', 'au', 'aux',
  // Particules allemandes, néerlandaises, italiennes, espagnoles et anglaises.
  'van', 'von', 'zu', 'del', 'della', 'of', 'the', 'and', 'in', 'on', 'at',
// Fin de l'ensemble.
]);

// isNameWord : vrai quand un mot peut faire partie d'un nom propre (début).
function isNameWord(word) {
  // Le mot sans ponctuation au début ni à la fin.
  const bare = word.replace(/^[«"'([\]]+/, '').replace(/[»"'),.;:!?\]]+$/, '');
  // Rien que de la ponctuation : accepté.
  if (!bare) return true;
  // Commence par une majuscule : accepté.
  if (/[A-ZÀ-ÖØ-ÞŒÆ]/.test(bare[0])) return true;
  // Commence par une élision (d', l', qu'…) : accepté.
  if (/^(d|l|j|m|n|s|t|c|qu)[’']/i.test(bare)) return true; // d’Ivoire, l’Haÿ
  // Sinon, accepté seulement si c'est un des petits mots admis.
  return NAME_PARTICLES.has(bare.toLowerCase());
// Fin de isNameWord.
}

/** Un nom propre traduit garde ses majuscules ; « Cork → Le liège » est ainsi écarté. */
// Déclare et exporte looksLikeName : le texte.
export function looksLikeName(text) {
  // Vrai si tous les mots, séparés par des espaces, des points médians ou des barres obliques, peuvent faire partie d'un nom propre.
  return String(text).split(/[\s·/]+/).filter(Boolean).every(isNameWord);
// Fin de looksLikeName.
}

/** Réponse MyMemory → texte traduit utile, ou `null` (erreur, quota, texte identique, traduction douteuse). */
// Déclare et exporte cleanTranslation : la réponse de MyMemory et le texte d'origine.
export function cleanTranslation(data, source) {
  // Réponse absente ou quota épuisé : null.
  if (!data || data.quotaFinished) return null;
  // Statut de la réponse, converti en nombre.
  const status = Number(data.responseStatus);
  // Statut présent et différent de 200 : null.
  if (status && status !== 200) return null;
  // Texte traduit brut.
  const raw = data.responseData?.translatedText;
  // Ce n'est pas une chaîne : null.
  if (typeof raw !== 'string') return null;
  // Texte avec les entités décodées, les suites d'espaces réduites à un seul et sans espaces autour.
  const text = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  // Texte vide : null.
  if (!text) return null;
  // Message d'erreur de MyMemory à la place de la traduction : null.
  if (/INVALID SOURCE LANGUAGE|QUERY LENGTH LIMIT|MYMEMORY WARNING|PLEASE SELECT TWO DISTINCT/i.test(text)) return null;
  // Texte contenant un caractère non latin : null.
  if (NON_LATIN.test(text)) return null;   // la fiche est en français : sortie latine attendue
  // Texte contenant un chiffre alors que l'origine n'en a pas : null.
  if (/\d/.test(text) && !/\d/.test(source)) return null; // préfixes de code renvoyés par la mémoire MyMemory
  // Identique au texte d'origine : null.
  if (sameText(text, source)) return null;
  // Ne ressemble pas à un nom propre : null.
  if (!looksLikeName(text)) return null;
  // Renvoie le texte.
  return text;
// Fin de cleanTranslation.
}

/** Ne garde que les traductions qui apportent une information nouvelle par rapport à la fiche. */
// Déclare et exporte pickTranslations : la ville et les traductions obtenues.
export function pickTranslations(city, results) {
  // L'une des deux manque : null.
  if (!city || !results) return null;
  // Titre de la fiche : le nom français, sinon le nom.
  const title = city.nameFr || city.name || '';
  // Nom traduit : celui du nom, sinon celui du nom local.
  const name = results.name || results.native || '';
  // Résultat, vide au départ.
  const out = {};
  // Garde le nom traduit s'il existe et diffère du titre.
  if (name && !sameText(name, title)) out.name = name;
  // Garde la région traduite si elle existe et diffère de la région de la fiche.
  if (results.region && !sameText(results.region, city.region)) out.region = results.region;
  // Renvoie le résultat s'il contient quelque chose, sinon null.
  return Object.keys(out).length ? out : null;
// Fin de pickTranslations.
}
