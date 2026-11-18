// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ouvre l'import de ce qui est testé :
import {
  // les fonctions du module ;
  browserLanguage, countryLanguages, fallbackChain, fontUrl, fromTemplate, indexLanguages, isRtl, isSourceLanguage,
  // la suite des fonctions.
  languageEntry, looksUntranslated, mtCode, packBatches, parseResponse, searchLanguages, shouldTranslate, splitBatch, toTemplate,
// Fin de l'import.
} from './i18nMath';

// Extrait du format de public/data/languages.json.
// Données d'essai :
const DATA = {
  // neuf langues,
  languages: [
    // le français,
    ['fra', 'fr', 'français', 'français', 'l', 'Latn', ''],
    // l'anglais,
    ['eng', 'en', 'anglais', 'English', 'l', 'Latn', ''],
    // l'arabe,
    ['ara', 'ar', 'arabe', 'العربية', 'l', 'Arab', ''],
    // l'arabe standard, dont la macrolangue est l'arabe,
    ['arb', 'arb', 'Standard Arabic', '', 'l', 'Arab', 'ar'],
    // le chinois,
    ['zho', 'zh', 'chinois', '中文', 'l', 'Hans', ''],
    // le berbère, à deux écritures,
    ['ber', 'ber', 'Berber', '', 'l', 'Tfng,Latn', ''],
    // le latin, langue ancienne,
    ['lat', 'la', 'latin', '', 'a', 'Latn', ''],
    // un nahuatl,
    ['nhi', 'nhi', 'Zacatlán-Ahuacatlán-Tepetzintla Nahuatl', '', 'l', 'Latn', ''],
    // l'espagnol ;
    ['spa', 'es', 'espagnol', 'español', 'l', 'Latn', ''],
  // fin des langues ;
  ],
  // deux pays,
  countries: [
    // le Mexique et ses trois langues,
    ['MX', 'Mexique', [['spa', 92, 1, ''], ['nhi', 0.1, 0, ''], ['eng', 13, 0, '']]],
    // Taïwan et le chinois traditionnel ;
    ['TW', 'Taïwan', [['zho', 95, 1, 'Hant']]],
  // fin des pays.
  ],
// Fin des données.
};
// Index des langues.
const IDX = indexLanguages(DATA);
// Langues mises en forme.
const entries = DATA.languages.map(languageEntry);

// Premier test : les index.
test('référentiel : index par code ISO 639-3 et par code court', () => {
  // L'arabe standard a pour macrolangue « ar ».
  assert.equal(IDX.byCode3.get('arb').macro, 'ar');
  // Le berbère a deux écritures.
  assert.deepEqual(IDX.byShort.get('ber').scripts, ['Tfng', 'Latn']);
  // « en » mène à l'anglais.
  assert.equal(IDX.byShort.get('en').code3, 'eng');
// Fin du test.
});

// Deuxième test : la recherche.
test('recherche : début du nom avant le milieu, codes exacts, filtre par écriture', () => {
  // « ara » : l'arabe d'abord.
  assert.equal(searchLanguages(entries, 'ara').items[0].code3, 'ara');
  // « nhi » : le nahuatl, par son code.
  assert.equal(searchLanguages(entries, 'nhi').items[0].code3, 'nhi');
  // « espanol » : l'espagnol.
  assert.equal(searchLanguages(entries, 'espanol').items[0].code3, 'spa', 'accents ignorés, autonyme cherché');
  // Écriture arabe : les deux arabes.
  assert.deepEqual(searchLanguages(entries, '', { script: 'Arab' }).items.map((e) => e.code3).sort(), ['ara', 'arb']);
  // Limite de 3 : trois résultats.
  assert.equal(searchLanguages(entries, '', { limit: 3 }).items.length, 3);
  // Le total reste celui de toutes les langues.
  assert.equal(searchLanguages(entries, '', { limit: 3 }).total, entries.length);
// Fin du test.
});

// Troisième test : les langues d'un pays.
test('langues d’un pays : écriture imposée par le pays, statut officiel', () => {
  // Langues de Taïwan.
  const tw = countryLanguages(DATA.countries[1], IDX.byCode3);
  // L'écriture est celle du pays.
  assert.equal(tw[0].script, 'Hant');
  // Le statut est officiel.
  assert.equal(tw[0].official, true);
  // Sans pays : aucune langue.
  assert.equal(countryLanguages(null, IDX.byCode3).length, 0);
// Fin du test.
});

// Quatrième test : la langue du navigateur.
test('langue du navigateur : code, pays et écriture', () => {
  // « en-US » : anglais, États-Unis.
  assert.deepEqual(browserLanguage(['en-US', 'fr'], IDX), { code3: 'eng', country: 'US', script: '' });
  // « zh-Hant-TW » : chinois, Taïwan, écriture traditionnelle.
  assert.deepEqual(browserLanguage(['zh-Hant-TW'], IDX), { code3: 'zho', country: 'TW', script: 'Hant' });
  // Une langue inconnue est passée ; « es-419 » : espagnol, sans pays.
  assert.deepEqual(browserLanguage(['xx-YY', 'es-419', 'fr'], IDX), { code3: 'spa', country: '', script: '' });
  // Rien de connu : null.
  assert.equal(browserLanguage(['xx'], IDX), null);
// Fin du test.
});

// Cinquième test : les codes et la chaîne de repli.
test('codes de traduction et chaîne de repli', () => {
  // Chinois traditionnel : « zh-TW ».
  assert.equal(mtCode(IDX.byCode3.get('zho'), 'Hant'), 'zh-TW');
  // Chinois simplifié : « zh-CN ».
  assert.equal(mtCode(IDX.byCode3.get('zho'), 'Hans'), 'zh-CN');
  // Anglais : « en ».
  assert.equal(mtCode(IDX.byCode3.get('eng')), 'en');
  // Arabe standard : son code, puis la macrolangue arabe, puis l'anglais.
  // Arabe standard : son code, l'arabe, l'anglais.
  assert.deepEqual(fallbackChain(IDX.byCode3.get('arb'), 'Arab', [], IDX.byShort), ['arb', 'ar', 'en']);
  // Nahuatl au Mexique : sa langue, puis l'espagnol (officiel), puis l'anglais.
  // Langues du Mexique.
  const mx = countryLanguages(DATA.countries[0], IDX.byCode3);
  // Nahuatl au Mexique : son code, l'espagnol, l'anglais.
  assert.deepEqual(fallbackChain(IDX.byCode3.get('nhi'), 'Latn', mx, IDX.byShort), ['nhi', 'es', 'en']);
  // Anglais : lui seul.
  assert.deepEqual(fallbackChain(IDX.byCode3.get('eng'), 'Latn', [], IDX.byShort), ['en']);
  // « fr » et « fr-CA » sont la langue d'origine, pas « fy ».
  assert.ok(isSourceLanguage('fr') && isSourceLanguage('fr-CA') && !isSourceLanguage('fy'));
// Fin du test.
});

// Sixième test : les gabarits.
test('gabarits : nombres retirés puis restitués, espaces gardés', () => {
  // Gabarit d'un texte avec deux nombres.
  const t = toTemplate('  Terre · 1,000 UA du Soleil · lumière 8.3 min ');
  // Les nombres deviennent {0} et {1}.
  assert.equal(t.key, 'Terre · {0} UA du Soleil · lumière {1} min');
  // Les deux nombres sont gardés.
  assert.deepEqual(t.values, ['1,000', '8.3']);
  // Le texte traduit retrouve ses nombres et ses espaces.
  assert.equal(fromTemplate('Earth · {0} AU from the Sun · light {1} min', t.values, t.lead, t.trail), '  Earth · 1,000 AU from the Sun · light 8.3 min ');
  // Repère perdu : null.
  assert.equal(fromTemplate('Earth · AU', t.values), null, 'repère perdu : pas de texte faux');
  // Un nombre à espaces devient un seul repère.
  assert.equal(toTemplate('1 234 567 habitants').key, '{0} habitants');
  // Une fraction devient un seul repère.
  assert.equal(toTemplate('Vue 3/4').key, 'Vue {0}');
// Fin du test.
});

// Septième test : les textes à traduire.
test('textes à traduire : lettres requises, pas d’adresses ni de textes trop longs', () => {
  // Un mot : oui.
  assert.ok(shouldTranslate('Rechercher'));
  // Un repère et un signe : non.
  assert.ok(!shouldTranslate('{0} %'));
  // Un signe seul : non.
  assert.ok(!shouldTranslate('?'));
  // Une adresse web : non.
  assert.ok(!shouldTranslate('https://example.org/a'));
  // Un texte de 600 octets : non.
  assert.ok(!shouldTranslate('é'.repeat(300)), '600 octets : trop long pour MyMemory');
// Fin du test.
});

// Huitième test : les lots.
test('lots : moins de 450 octets, découpage vérifié', () => {
  // Soixante gabarits.
  const keys = Array.from({ length: 60 }, (_, i) => `Texte numéro ${'x'.repeat(i % 7)} de l’interface`);
  // Lots.
  const batches = packBatches(keys);
  // Aucun gabarit perdu.
  assert.equal(batches.flat().length, keys.length);
  // Chaque lot tient en 450 octets.
  batches.forEach((b) => assert.ok(new TextEncoder().encode(b.join('\n')).length <= 450));
  // Deux lignes : deux traductions.
  assert.deepEqual(splitBatch('Search\nSettings\n', 2), ['Search', 'Settings']);
  // Une seule ligne pour deux : null.
  assert.equal(splitBatch('Search Settings', 2), null);
  // Une ligne vide au milieu : null.
  assert.equal(splitBatch('Search\n\nSettings', 3), null);
// Fin du test.
});

// Neuvième test : les réponses de MyMemory.
test('réponses MyMemory : texte, langue non prise en charge, quota', () => {
  // Une traduction, entités décodées.
  assert.deepEqual(parseResponse({ responseStatus: 200, responseData: { translatedText: 'Earth&#39;s view' } }), { text: 'Earth\'s view' });
  // Langue invalide : erreur « language ».
  assert.deepEqual(parseResponse({ responseStatus: 403, responseData: { translatedText: '\'XX\' IS AN INVALID TARGET LANGUAGE . EXAMPLE: LANGPAIR=EN|IT USING 2 LETTER ISO OR RFC3066 LIKE ZH-CN. ALMOST ALL LANGUAGES SUPPORTED BUT SOME MAY HAVE NO CONTENT' } }), { error: 'language' });
  // Quota épuisé : erreur « quota ».
  assert.deepEqual(parseResponse({ responseStatus: 429, responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.' } }), { error: 'quota' });
  // Quota signalé : erreur « quota ».
  assert.deepEqual(parseResponse({ quotaFinished: true, responseStatus: 200, responseData: { translatedText: 'x' } }), { error: 'quota' });
  // Sans réponse : erreur « other ».
  assert.deepEqual(parseResponse(null), { error: 'other' });
  // Code 500 : erreur « other ».
  assert.deepEqual(parseResponse({ responseStatus: 500, responseData: { translatedText: '' } }), { error: 'other' });
// Fin du test.
});

// Dixième test : la langue non traduite.
test('langue non traduite détectée seulement après assez d’essais', () => {
  // Trois essais : pas assez.
  assert.ok(!looksUntranslated(3, 3));
  // Douze identiques sur douze : oui.
  assert.ok(looksUntranslated(12, 12));
  // Cinq sur vingt : non.
  assert.ok(!looksUntranslated(5, 20));
// Fin du test.
});

// Onzième test : l'écriture.
test('écriture : sens et police', () => {
  // Arabe, hébreu et persan : de droite à gauche.
  assert.ok(isRtl('Arab') && isRtl('Hebr') && isRtl('', 'fa'));
  // Latin et devanagari : de gauche à droite.
  assert.ok(!isRtl('Latn', 'en') && !isRtl('Deva', 'hi'));
  // La police de l'éthiopien est la bonne.
  assert.match(fontUrl('Ethi'), /family=Noto\+Sans\+Ethiopic/);
  // Le latin n'a pas de police à charger.
  assert.equal(fontUrl('Latn'), '');
// Fin du test.
});
