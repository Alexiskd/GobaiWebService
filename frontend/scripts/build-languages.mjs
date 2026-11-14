#!/usr/bin/env node
/**
 * Génère public/data/languages.json : toutes les langues ISO 639-3, les langues parlées par pays et leurs écritures.
 *
 * Sources (à cloner puis passer en arguments) :
 *  - https://github.com/wooorm/iso-639-3 (MIT) : les ~7 900 codes ISO 639-3 (SIL), nom de référence, type
 *  - https://github.com/unicode-org/cldr-json (licence Unicode) : noms en français, autonymes,
 *    langues par pays (territoryInfo), écritures probables (likelySubtags, languageData), noms des écritures
 *
 * Usage : node scripts/build-languages.mjs <dossier iso-639-3> <dossier cldr-json/cldr-json>
 *
 * Format (tableaux compacts) :
 *  languages : [code3, code BCP 47 court, nom français, autonyme, type, écritures "Latn,Cyrl", macrolangue]
 *              type : l vivante, h historique, e éteinte, a ancienne, c construite
 *              macrolangue : code court de la macrolangue englobante (arb → ar, cmn → zh), sinon ""
 *  Écritures : l'écriture probable (likelySubtags) en tête, puis les écritures courantes de la langue ;
 *  les écritures rares (Deseret, Duployé…) ne sont gardées que si elles sont l'écriture principale d'une langue.
 *  countries : [code pays, nom français, [[code3, % de la population, officielle 0/1, écriture imposée ou ""], …]]
 *  scripts   : { Latn: [nom français, type] }
 */
// Importe la lecture et l'écriture de fichiers, le test d'existence et la création de dossiers, depuis Node.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
// Importe dirname, join et resolve, les outils de chemins de Node.
import { dirname, join, resolve } from 'node:path';
// Importe les conversions entre adresse de fichier et chemin.
import { fileURLToPath, pathToFileURL } from 'node:url';

// Les deux dossiers sources, arguments de la commande.
const [isoDir, cldrDir] = process.argv.slice(2);
// S'il en manque un (début).
if (!isoDir || !cldrDir) {
  // Affiche l'usage.
  console.error('Usage : node scripts/build-languages.mjs <iso-639-3> <cldr-json/cldr-json>');
  // Quitte avec le code d'erreur 1.
  process.exit(1);
// Fin de ce cas.
}

// Charge la table des codes ISO 639-3.
const { iso6393 } = await import(pathToFileURL(resolve(isoDir, 'iso6393.js')).href);
// json : lit un fichier JSON du dossier CLDR.
const json = (p) => JSON.parse(readFileSync(join(cldrDir, p), 'utf8'));
// names : les noms d'une catégorie dans une langue donnée (début).
const names = (locale, kind) => {
  // Chemin du fichier.
  const p = join(cldrDir, 'cldr-localenames-full/main', locale, `${kind}.json`);
  // Ses noms s'il existe, sinon un objet vide.
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).main[locale].localeDisplayNames[kind] : {};
// Fin de names.
};

// Écritures et régions probables de chaque langue.
const likely = json('cldr-core/supplemental/likelySubtags.json').supplemental.likelySubtags;
// Écritures courantes de chaque langue.
const languageData = json('cldr-core/supplemental/languageData.json').supplemental.languageData;
// Langues parlées par pays.
const territoryInfo = json('cldr-core/supplemental/territoryInfo.json').supplemental.territoryInfo;
// Alias des codes de langue.
const languageAlias = json('cldr-core/supplemental/aliases.json').supplemental.metadata.alias.languageAlias;
// macroOf : le code de la macrolangue d'une langue, ou une chaîne vide (début).
const macroOf = (code) => {
  // Alias du code.
  const a = languageAlias[code];
  // Son remplacement, si la raison est « macrolanguage ».
  return a?._reason === 'macrolanguage' ? a._replacement : '';
// Fin de macroOf.
};
// Noms des langues en français.
const frLanguages = names('fr', 'languages');
// Noms des pays en français.
const frTerritories = names('fr', 'territories');
// Noms des écritures en français.
const frScripts = names('fr', 'scripts');

// Type des principales écritures (ISO 15924).
// Type de chaque écriture (début).
const SCRIPT_TYPES = {
  // Alphabets : latin, cyrillique, grec, arménien, géorgien, mongol.
  Latn: 'alphabet', Cyrl: 'alphabet', Grek: 'alphabet', Armn: 'alphabet', Geor: 'alphabet', Mong: 'alphabet',
  // Alphabets : copte, gotique, runes, ogham, n'ko, adlam.
  Copt: 'alphabet', Goth: 'alphabet', Runr: 'alphabet', Ogam: 'alphabet', Nkoo: 'alphabet', Adlm: 'alphabet',
  // Alphabets : tifinagh, ol tchiki, bopomofo ; hangul en blocs syllabiques ; coréen avec logogrammes.
  Tfng: 'alphabet', Olck: 'alphabet', Bopo: 'alphabet', Hang: 'alphabet en blocs syllabiques', Kore: 'alphabet + logogrammes',
  // Abjads : arabe, hébreu, syriaque, samaritain, mandéen, hanifi ; thâna en abugida.
  Arab: 'abjad', Hebr: 'abjad', Syrc: 'abjad', Samr: 'abjad', Mand: 'abjad', Rohg: 'abjad', Thaa: 'abugida',
  // Abugidas : dévanagari, bengali, gourmoukhi, goudjarati, oriya, tamoul.
  Deva: 'abugida', Beng: 'abugida', Guru: 'abugida', Gujr: 'abugida', Orya: 'abugida', Taml: 'abugida',
  // Abugidas : télougou, kannada, malayalam, cinghalais, tibétain, birman.
  Telu: 'abugida', Knda: 'abugida', Mlym: 'abugida', Sinh: 'abugida', Tibt: 'abugida', Mymr: 'abugida',
  // Abugidas : khmer, lao, thaï, éthiopien, balinais, javanais.
  Khmr: 'abugida', Laoo: 'abugida', Thai: 'abugida', Ethi: 'abugida', Bali: 'abugida', Java: 'abugida',
  // Abugidas : soundanais, syllabaire autochtone canadien, lanna, nouveau taï lü, taï le, chakma, meitei.
  Sund: 'abugida', Cans: 'abugida', Lana: 'abugida', Talu: 'abugida', Tale: 'abugida', Cakm: 'abugida', Mtei: 'abugida',
  // Logographiques : han, han simplifié, han traditionnel.
  Hani: 'logographique', Hans: 'logographique (simplifié)', Hant: 'logographique (traditionnel)',
  // Japonais avec logogrammes ; syllabaires : hiragana, katakana, cherokee, vaï.
  Jpan: 'syllabaire + logogrammes', Hira: 'syllabaire', Kana: 'syllabaire', Cher: 'syllabaire', Vaii: 'syllabaire',
  // Syllabaire yi ; braille ; alphabets déséret et shavien.
  Yiii: 'syllabaire', Brai: 'braille', Dsrt: 'alphabet', Shaw: 'alphabet',
// Fin de la table.
};

// Code CLDR / BCP 47 → ISO 639-3 (les codes à 2 lettres passent par la table ISO 639-1).
// by1 : du code à 2 lettres vers le code à 3 lettres.
const by1 = new Map(iso6393.filter((l) => l.iso6391).map((l) => [l.iso6391, l.iso6393]));
// by3 : du code à 3 lettres vers la fiche de la langue.
const by3 = new Map(iso6393.map((l) => [l.iso6393, l]));
// to3 : le code à 3 lettres d'un code CLDR, ou null s'il est inconnu.
const to3 = (code) => (code.length === 2 ? by1.get(code) : by3.has(code) ? code : null);

// Lettre de chaque type de langue.
const TYPE = { living: 'l', historical: 'h', extinct: 'e', ancient: 'a', constructed: 'c' };
// primaryScript : l'écriture probable d'une langue, ou une chaîne vide.
const primaryScript = (short) => likely[short]?.split('-')[1] || '';
// Écritures principales d'au moins une langue : les autres (variantes historiques ou d'usage marginal) sont écartées.
// Écritures qui sont l'écriture probable d'au moins une langue.
const majorScripts = new Set(Object.values(likely).map((t) => t.split('-')[1]).filter(Boolean));
// scriptsOf : les écritures d'une langue (début).
const scriptsOf = (short) => {
  // Liste.
  const set = [];
  // add : ajoute une écriture connue, principale et pas déjà présente.
  const add = (s) => s && majorScripts.has(s) && !set.includes(s) && set.push(s);
  // L'écriture probable d'abord.
  add(primaryScript(short));
  // Puis les écritures courantes.
  (languageData[short]?._scripts || []).forEach(add);
  // Si la liste est vide (début).
  if (!set.length) {
    // Macrolangue.
    const macro = macroOf(short);
    // S'il y en a une : ses écritures.
    if (macro) return scriptsOf(macro);
  // Fin de ce cas.
  }
  // Renvoie la liste.
  return set;
// Fin de scriptsOf.
};

// Langues : à partir de la table ISO,
const languages = iso6393
  // sans les codes spéciaux,
  .filter((l) => l.type !== 'special')
  // une ligne par langue (début).
  .map((l) => {
    // Code court : celui à 2 lettres, sinon celui à 3 lettres.
    const short = l.iso6391 || l.iso6393;
    // Nom de la langue dans sa propre langue.
    const own = names(short, 'languages')[short] || '';
    // Renvoie (début)
    return [
      // le code à 3 lettres,
      l.iso6393,
      // le code court,
      short,
      // le nom français, sinon le nom de référence,
      frLanguages[short] || l.name,
      // l'autonyme,
      own,
      // la lettre du type, « l » par défaut,
      TYPE[l.type] || 'l',
      // les écritures, séparées par des virgules,
      scriptsOf(short).join(','),
      // et la macrolangue.
      macroOf(short),
    // Fin de la ligne.
    ];
  // Fin de la langue.
  })
  // Tri par nom français.
  .sort((a, b) => a[2].localeCompare(b[2], 'fr'));

// Codes des langues retenues.
const known = new Set(languages.map((l) => l[0]));
// Pays : à partir des langues par pays,
const countries = Object.entries(territoryInfo)
  // ceux qui ont un code à 2 lettres et un nom français,
  .filter(([cc]) => /^[A-Z]{2}$/.test(cc) && frTerritories[cc])
  // une ligne par pays (début).
  .map(([cc, info]) => {
    // Langues du pays :
    const langs = Object.entries(info.languagePopulation || {})
      // pour chacune (début),
      .map(([key, v]) => {
        // sépare la langue de l'écriture imposée,
        const [base, script = ''] = key.split('_');
        // trouve le code à 3 lettres,
        const code3 = to3(base);
        // écarte une langue inconnue,
        if (!code3 || !known.has(code3)) return null;
        // note si elle est officielle,
        const official = /official/.test(v._officialStatus || '') ? 1 : 0;
        // et renvoie le code, la part de la population, le statut et l'écriture.
        return [code3, Number(v._populationPercent) || 0, official, script];
      // Fin de la langue.
      })
      // Sans les langues écartées,
      .filter(Boolean)
      // officielles d'abord, puis par part de population décroissante.
      .sort((a, b) => b[2] - a[2] || b[1] - a[1]);
    // Renvoie le code du pays, son nom français et ses langues.
    return [cc, frTerritories[cc], langs];
  // Fin du pays.
  })
  // Sans les pays sans langue,
  .filter(([, , langs]) => langs.length)
  // triés par nom français.
  .sort((a, b) => a[1].localeCompare(b[1], 'fr'));

// Écritures utilisées.
const usedScripts = new Set();
// Celles des langues.
languages.forEach((l) => l[5] && l[5].split(',').forEach((s) => usedScripts.add(s)));
// Celles imposées dans un pays.
countries.forEach(([, , ls]) => ls.forEach((l) => l[3] && usedScripts.add(l[3])));
// Table des écritures.
const scripts = {};
// Pour chacune, par ordre alphabétique : son nom français et son type.
[...usedScripts].sort().forEach((s) => { scripts[s] = [frScripts[s] || s, SCRIPT_TYPES[s] || '']; });

// Chemin du fichier produit : public/data/languages.json.
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/languages.json');
// Données : la version, les sources, les langues, les pays et les écritures.
const data = { v: 1, sources: 'ISO 639-3 (SIL, via wooorm/iso-639-3) · Unicode CLDR', languages, countries, scripts };
// Crée le dossier s'il manque.
mkdirSync(dirname(out), { recursive: true });
// Écrit le fichier.
writeFileSync(out, JSON.stringify(data));
// Nombre de langues qui ont un autonyme.
const withNames = languages.filter((l) => l[3]).length;
// Affiche les totaux et le chemin.
console.log(`${languages.length} langues (${withNames} autonymes), ${countries.length} pays, ${Object.keys(scripts).length} écritures → ${out}`);
