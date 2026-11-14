/**
 * Traduction de l'interface : calculs purs (sans DOM ni réseau), testés dans i18nMath.test.jsx.
 *
 * L'interface est écrite en français. Les textes sont traduits à la volée par MyMemory ; les nombres sont
 * retirés avant l'envoi ({0}, {1}…) pour qu'un texte qui change à chaque image (« 1,000 UA du Soleil »)
 * ne soit traduit qu'une fois, puis recomposé localement.
 */

/** Langue d'origine de l'interface. */
// Langue d'origine : le français.
export const SOURCE_LANG = 'fr';
/** MyMemory : 500 octets maximum par requête, marge pour les séparateurs. */
// Taille maximale d'un envoi : 450 octets.
export const MAX_BATCH_BYTES = 450;

// Fonction utf8Bytes : le nombre d'octets d'un texte en UTF-8.
const utf8Bytes = (s) => new TextEncoder().encode(s).length;

// ------------------------------------------------------------- jeu de données

/** Ligne de public/data/languages.json → objet lisible. */
// Fonction languageEntry.
export function languageEntry(row) {
  // Ligne absente : null.
  if (!row) return null;
  // Les sept valeurs de la ligne.
  const [code3, short, name, autonym, type, scripts, macro] = row;
  // Renvoie l'objet ; les écritures deviennent une liste.
  return { code3, short, name, autonym, type, scripts: scripts ? scripts.split(',') : [], macro: macro || '' };
// Fin de languageEntry.
}

// Types de langues :
export const LANGUAGE_TYPES = {
  // vivante, historique, éteinte, ancienne, construite.
  l: 'vivante', h: 'historique', e: 'éteinte', a: 'ancienne', c: 'construite',
// Fin des types.
};

/** Index par code ISO 639-3 et par code court (ISO 639-1 quand il existe). */
// Fonction indexLanguages.
export function indexLanguages(data) {
  // Index par code à trois lettres.
  const byCode3 = new Map();
  // Index par code court.
  const byShort = new Map();
  // Pour chaque ligne :
  for (const row of data?.languages || []) {
    // la met en forme ;
    const e = languageEntry(row);
    // l'inscrit par code à trois lettres ;
    byCode3.set(e.code3, e);
    // l'inscrit par code court, si ce code est libre.
    if (!byShort.has(e.short)) byShort.set(e.short, e);
  // Fin de la boucle.
  }
  // Renvoie les deux index.
  return { byCode3, byShort };
// Fin de indexLanguages.
}

// Fonction fold : retire les accents et passe en minuscules.
const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Recherche : nom français, autonyme ou code. Les correspondances au début du nom passent en premier,
 * puis les langues vivantes. `script` filtre par écriture (code ISO 15924).
 */
// Fonction searchLanguages ; par défaut : toutes les écritures, 200 résultats.
export function searchLanguages(entries, query, { script = '', limit = 200 } = {}) {
  // Recherche, sans accents ni espaces aux bords.
  const q = fold(query.trim());
  // Langues notées.
  const scored = [];
  // Pour chaque langue :
  for (const e of entries) {
    // écriture demandée absente : suivante ;
    if (script && !e.scripts.includes(script)) continue;
    // note de départ ;
    let score = 0;
    // s'il y a une recherche :
    if (q) {
      // nom, sans accents ;
      const name = fold(e.name);
      // nom dans la langue elle-même ;
      const own = fold(e.autonym);
      // code exact : 4 ;
      if (e.code3 === q || e.short === q) score = 4;
      // début du nom : 3 ;
      else if (name.startsWith(q) || own.startsWith(q)) score = 3;
      // nom qui la contient : 2 ;
      else if (name.includes(q) || own.includes(q)) score = 2;
      // sinon : langue suivante.
      else continue;
    // Fin du cas.
    }
    // Langue vivante : un demi-point de plus.
    if (e.type === 'l') score += 0.5;
    // Nom dans la langue connu : un quart de point de plus.
    if (e.autonym) score += 0.25; // langues documentées dans CLDR (souvent les plus parlées)
    // Garde la note et la langue.
    scored.push([score, e]);
  // Fin de la boucle.
  }
  // Trie par note, puis par nom français.
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name, 'fr'));
  // Renvoie le total et les premières langues.
  return { total: scored.length, items: scored.slice(0, limit).map((s) => s[1]) };
// Fin de searchLanguages.
}

/** Langues d'un pays (ligne `countries`), avec la part de la population et le statut officiel. */
// Fonction countryLanguages.
export function countryLanguages(countryRow, byCode3) {
  // Pays absent : liste vide.
  if (!countryRow) return [];
  // Pour les langues du pays,
  return countryRow[2]
    // chacune avec son code, sa part, son statut et son écriture :
    .map(([code3, percent, official, script]) => {
      // la langue ;
      const e = byCode3.get(code3);
      // si elle est connue, la rend avec sa part, son statut officiel et son écriture.
      return e ? { ...e, percent, official: Boolean(official), script: script || e.scripts[0] || '' } : null;
    // Fin du traitement.
    })
    // Retire les langues inconnues.
    .filter(Boolean);
// Fin de countryLanguages.
}

// ------------------------------------------------------------- langue du navigateur

/**
 * Langue par défaut : la première langue du navigateur reconnue (« en-US » → anglais, pays US).
 * Renvoie { code3, country, script } ou null si aucune n'est reconnue.
 */
// Fonction browserLanguage.
export function browserLanguage(navigatorLanguages, { byShort, byCode3 }) {
  // Pour chaque langue du navigateur :
  for (const tag of navigatorLanguages || []) {
    // ses morceaux ;
    const parts = String(tag).split(/[-_]/);
    // la langue, en minuscules ;
    const base = parts[0].toLowerCase();
    // la cherche par code court, puis par code à trois lettres ;
    const e = byShort.get(base) || byCode3.get(base);
    // inconnue : suivante ;
    if (!e) continue;
    // les autres morceaux ;
    const rest = parts.slice(1);
    // l'écriture : un morceau de 4 lettres ;
    const script = rest.find((p) => /^[A-Za-z]{4}$/.test(p)) || '';
    // le pays : un morceau de 2 lettres ;
    const country = rest.find((p) => /^[A-Za-z]{2}$/.test(p)) || '';
    // renvoie
    return {
      // le code de la langue ;
      code3: e.code3,
      // le pays, en majuscules ;
      country: country.toUpperCase(),
      // l'écriture, avec une majuscule.
      script: script ? script[0].toUpperCase() + script.slice(1).toLowerCase() : '',
    // Fin de l'objet.
    };
  // Fin de la boucle.
  }
  // Aucune : null.
  return null;
// Fin de browserLanguage.
}

// ------------------------------------------------------------- codes de traduction

/** Code de langue envoyé à MyMemory pour une langue et une écriture. */
// Fonction mtCode.
export function mtCode(entry, script = '') {
  // Langue absente : texte vide.
  if (!entry) return '';
  // Chinois :
  if (entry.short === 'zh' || entry.macro === 'zh') {
    // traditionnel pour l'écriture Hant, simplifié sinon.
    return script === 'Hant' ? 'zh-TW' : 'zh-CN';
  // Fin du cas.
  }
  // Sinon : le code court.
  return entry.short;
// Fin de mtCode.
}

/**
 * Codes à essayer dans l'ordre quand la langue choisie n'est pas prise en charge :
 * la langue elle-même, sa macrolangue (arb → ar), les langues officielles du pays choisi, puis l'anglais.
 */
// Fonction fallbackChain.
export function fallbackChain(entry, script, countryLangs = [], byShort = new Map()) {
  // Codes à essayer.
  const out = [];
  // Fonction add : ajoute un code s'il existe et n'y est pas déjà.
  const add = (c) => c && !out.includes(c) && out.push(c);
  // La langue elle-même.
  add(mtCode(entry, script));
  // Sa macrolangue, si elle en a une.
  if (entry?.macro) add(mtCode(byShort.get(entry.macro) || { short: entry.macro }, script));
  // Les langues du pays,
  countryLangs
    // officielles et autres que la langue choisie,
    .filter((l) => l.official && l.code3 !== entry?.code3)
    // de la plus parlée à la moins parlée,
    .sort((a, b) => b.percent - a.percent)
    // ajoutées une à une.
    .forEach((l) => add(mtCode(l, l.script)));
  // L'anglais, en dernier.
  add('en');
  // Renvoie la liste.
  return out;
// Fin de fallbackChain.
}

/** Vrai si le code désigne la langue d'origine (aucune traduction). */
// Fonction isSourceLanguage : vrai pour « fr » ou un code qui commence par « fr- ».
export const isSourceLanguage = (code) => code === SOURCE_LANG || String(code).startsWith(`${SOURCE_LANG}-`);

// ------------------------------------------------------------- textes

// Forme d'un nombre : signe, chiffres, et séparateurs entre groupes de chiffres.
const NUMBER = /[-+−]?\d+(?:[\s  .,:/]\d+)*/g;

/**
 * Texte → gabarit sans nombres : « Terre · 1,000 UA » → { key: 'Terre · {0} UA', values: ['1,000'] }.
 * Les espaces de début et de fin sont gardés à part pour être restitués tels quels.
 */
// Fonction toTemplate.
export function toTemplate(text) {
  // Sépare les espaces de début, le texte et les espaces de fin.
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  // Nombres retirés.
  const values = [];
  // Texte aux espaces réduits, où chaque nombre devient {0}, {1}…
  const key = m[2].replace(/\s+/g, ' ').replace(NUMBER, (n) => `{${values.push(n) - 1}}`);
  // Renvoie les espaces, le gabarit et les nombres.
  return { lead: m[1], key, trail: m[3], values };
// Fin de toTemplate.
}

/** Gabarit traduit + nombres d'origine → texte. `null` si un repère {n} a disparu à la traduction. */
// Fonction fromTemplate.
export function fromTemplate(translated, values, lead = '', trail = '') {
  // Tout va bien, au départ.
  let ok = true;
  // Remet chaque nombre :
  const text = values.reduce((acc, v, i) => {
    // son repère ;
    const token = `{${i}}`;
    // repère disparu : échec ;
    if (!acc.includes(token)) { ok = false; return acc; }
    // sinon remplace le repère par le nombre.
    return acc.split(token).join(v);
  // En partant du texte traduit.
  }, translated);
  // Renvoie le texte avec ses espaces, ou null en cas d'échec.
  return ok ? lead + text + trail : null;
// Fin de fromTemplate.
}

/** Un gabarit vaut la peine d'être traduit : au moins deux lettres hors repères, pas une adresse, taille raisonnable. */
// Fonction shouldTranslate.
export function shouldTranslate(key) {
  // Gabarit vide : non.
  if (!key) return false;
  // Lettres du gabarit, hors repères.
  const letters = key.replace(/\{\d+\}/g, '').match(/\p{L}/gu);
  // Moins de deux lettres : non.
  if (!letters || letters.length < 2) return false;
  // Adresse web ou adresse de courriel : non.
  if (/^(https?:\/\/|www\.)\S+$/i.test(key) || /^\S+@\S+\.\S+$/.test(key)) return false;
  // Oui s'il tient dans un envoi.
  return utf8Bytes(key) <= MAX_BATCH_BYTES;
// Fin de shouldTranslate.
}

/** Regroupe des gabarits en lots d'au plus `maxBytes` octets (séparés par un saut de ligne). */
// Fonction packBatches.
export function packBatches(keys, maxBytes = MAX_BATCH_BYTES) {
  // Lots.
  const batches = [];
  // Lot en cours.
  let cur = [];
  // Sa taille.
  let size = 0;
  // Pour chaque gabarit :
  for (const k of keys) {
    // sa taille, saut de ligne compris ;
    const b = utf8Bytes(k) + 1;
    // si le lot en cours déborderait :
    if (cur.length && size + b > maxBytes) {
      // range le lot ;
      batches.push(cur);
      // commence un nouveau lot ;
      cur = [];
      // de taille nulle.
      size = 0;
    // Fin du cas.
    }
    // Ajoute le gabarit au lot.
    cur.push(k);
    // Ajoute sa taille.
    size += b;
  // Fin de la boucle.
  }
  // Range le dernier lot.
  if (cur.length) batches.push(cur);
  // Renvoie les lots.
  return batches;
// Fin de packBatches.
}

/** Texte traduit d'un lot → une traduction par gabarit, ou `null` si le découpage ne correspond plus. */
// Fonction splitBatch.
export function splitBatch(translated, count) {
  // Découpe par lignes, sans espaces aux bords.
  const parts = String(translated).split(/\r?\n/).map((s) => s.trim());
  // Retire les lignes vides de la fin en trop.
  while (parts.length > count && parts[parts.length - 1] === '') parts.pop();
  // Renvoie les morceaux si leur nombre est le bon et qu'aucun n'est vide, sinon null.
  return parts.length === count && parts.every(Boolean) ? parts : null;
// Fin de splitBatch.
}

// Fonction decodeEntities : remplace les entités HTML,
const decodeEntities = (s) => s
  // l'apostrophe,
  .replace(/&#39;|&apos;/g, '\'')
  // le guillemet,
  .replace(/&quot;/g, '"')
  // « < »,
  .replace(/&lt;/g, '<')
  // « > »,
  .replace(/&gt;/g, '>')
  // et « & ».
  .replace(/&amp;/g, '&');

/**
 * Réponse MyMemory → { text } ou { error } :
 *  'language' langue non prise en charge, 'quota' quota gratuit du jour épuisé, 'other' autre échec.
 */
// Fonction parseResponse.
export function parseResponse(data) {
  // Sans réponse : erreur « other ».
  if (!data) return { error: 'other' };
  // Texte traduit.
  const raw = String(data.responseData?.translatedText ?? '');
  // Détails de la réponse.
  const details = String(data.responseDetails ?? '');
  // Code de la réponse.
  const status = Number(data.responseStatus);
  // Les deux textes réunis.
  const all = `${raw} ${details}`;
  // Quota épuisé : erreur « quota ».
  if (data.quotaFinished || status === 429 || /YOU USED ALL AVAILABLE FREE TRANSLATIONS|QUOTA/i.test(all)) return { error: 'quota' };
  // Langue non prise en charge : erreur « language ».
  if (/INVALID TARGET LANGUAGE|IS AN INVALID|INVALID LANGUAGE PAIR|NOT SUPPORTED|PLEASE SELECT TWO DISTINCT/i.test(all)) return { error: 'language' };
  // Code autre que 200, texte vide ou avertissement : erreur « other ».
  if (status !== 200 || !raw || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(raw)) return { error: 'other' };
  // Renvoie le texte, entités décodées.
  return { text: decodeEntities(raw) };
// Fin de parseResponse.
}

/**
 * Langue probablement non traduite par le service : il renvoie le texte français à l'identique.
 * Décidé seulement après assez d'essais pour ne pas confondre avec des mots identiques (« Message », « Contact »).
 */
// Fonction looksUntranslated ; 12 essais au moins par défaut.
export function looksUntranslated(identical, total, minTotal = 12) {
  // Vrai si 85 % des textes reviennent identiques.
  return total >= minTotal && identical / total >= 0.85;
// Fin de looksUntranslated.
}

// ------------------------------------------------------------- écriture

// Écritures qui se lisent de droite à gauche.
const RTL_SCRIPTS = new Set(['Arab', 'Hebr', 'Syrc', 'Thaa', 'Nkoo', 'Adlm', 'Rohg', 'Mand', 'Samr']);
// Langues qui se lisent de droite à gauche.
const RTL_LANGS = new Set(['ar', 'fa', 'ur', 'ps', 'he', 'yi', 'dv', 'ug', 'ckb', 'sd', 'ks']);

/** Écriture de droite à gauche (arabe, hébreu…). */
// Fonction isRtl : vrai pour une de ces écritures ou de ces langues.
export const isRtl = (script, short = '') => RTL_SCRIPTS.has(script) || RTL_LANGS.has(short);

/** Police Noto (Google Fonts) chargée pour une écriture que l'appareil n'a pas forcément. */
// Police Noto de chaque écriture :
export const NOTO_FONTS = {
  // arabe, hébreu, devanagari, bengali ;
  Arab: 'Noto Sans Arabic', Hebr: 'Noto Sans Hebrew', Deva: 'Noto Sans Devanagari', Beng: 'Noto Sans Bengali',
  // gurmukhi, gujarati, oriya, tamoul ;
  Guru: 'Noto Sans Gurmukhi', Gujr: 'Noto Sans Gujarati', Orya: 'Noto Sans Oriya', Taml: 'Noto Sans Tamil',
  // télougou, kannada, malayalam, cingalais ;
  Telu: 'Noto Sans Telugu', Knda: 'Noto Sans Kannada', Mlym: 'Noto Sans Malayalam', Sinh: 'Noto Sans Sinhala',
  // thaï, lao, khmer, birman ;
  Thai: 'Noto Sans Thai', Laoo: 'Noto Sans Lao', Khmr: 'Noto Sans Khmer', Mymr: 'Noto Sans Myanmar',
  // éthiopien, géorgien, arménien, tibétain ;
  Ethi: 'Noto Sans Ethiopic', Geor: 'Noto Sans Georgian', Armn: 'Noto Sans Armenian', Tibt: 'Noto Serif Tibetan',
  // chinois simplifié et traditionnel, japonais, coréen ;
  Hans: 'Noto Sans SC', Hant: 'Noto Sans TC', Jpan: 'Noto Sans JP', Kore: 'Noto Sans KR', Hang: 'Noto Sans KR',
  // thâna, syriaque, n'ko, adlam ;
  Thaa: 'Noto Sans Thaana', Syrc: 'Noto Sans Syriac', Nkoo: 'Noto Sans NKo', Adlm: 'Noto Sans Adlam',
  // tifinagh, cherokee, syllabaire autochtone canadien ;
  Tfng: 'Noto Sans Tifinagh', Cher: 'Noto Sans Cherokee', Cans: 'Noto Sans Canadian Aboriginal',
  // mongol, yi, vaï, ol tchiki ;
  Mong: 'Noto Sans Mongolian', Yiii: 'Noto Sans Yi', Vaii: 'Noto Sans Vai', Olck: 'Noto Sans Ol Chiki',
  // javanais, balinais, soundanais.
  Java: 'Noto Sans Javanese', Bali: 'Noto Sans Balinese', Sund: 'Noto Sans Sundanese',
// Fin de la table.
};

/** Adresse Google Fonts d'une écriture, ou '' (latin, cyrillique, grec : polices système). */
// Fonction fontUrl.
export function fontUrl(script) {
  // Police de l'écriture.
  const family = NOTO_FONTS[script];
  // Son adresse chez Google Fonts, ou un texte vide.
  return family ? `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@400;600&display=swap` : '';
// Fin de fontUrl.
}
