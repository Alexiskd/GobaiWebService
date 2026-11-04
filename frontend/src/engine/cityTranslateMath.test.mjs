import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTranslation, pickTranslations, sameText, sourceLanguage, translationTargets,
} from './cityTranslateMath.js';

test('traduction : langue locale déduite de l’écriture puis du pays', () => {
  assert.equal(sourceLanguage({ name: '東京', script: 'japanese' }), 'ja');
  assert.equal(sourceLanguage({ name: '서울', script: 'korean' }), 'ko');
  assert.equal(sourceLanguage({ name: 'القاهرة', script: 'arabic' }), 'ar');
  assert.equal(sourceLanguage({ name: 'تهران', script: 'arabic', country: 'Iran' }), 'fa');
  assert.equal(sourceLanguage({ name: 'کیف', script: 'cyrillic', country: 'Ukraine' }), 'uk');
  assert.equal(sourceLanguage({ name: '台北', script: 'chinese', country: 'Taiwan' }), 'zh-TW');
  assert.equal(sourceLanguage({ name: 'Paris', country: 'France' }), 'en');
  assert.equal(sourceLanguage(null), 'en');
});

test('traduction : seuls les textes sans version française sont demandés', () => {
  assert.deepEqual(translationTargets(null), []);
  assert.deepEqual(
    translationTargets({ name: '東京', nameFr: 'Tokyo', native: '東京都', region: 'Eastern Asia', script: 'japanese' }),
    [
      { field: 'native', text: '東京都', source: 'ja' },
      { field: 'region', text: 'Eastern Asia', source: 'en' },
    ],
  );
  // Sans nom français, le nom d'origine est traduit en plus du nom local.
  assert.deepEqual(
    translationTargets({ name: 'Köln', native: 'Köln', country: 'Germany' }),
    [
      { field: 'native', text: 'Köln', source: 'en' },
      { field: 'name', text: 'Köln', source: 'en' },
    ],
  );
  assert.deepEqual(translationTargets({ name: 'Paris', region: '  ' }), [{ field: 'name', text: 'Paris', source: 'en' }]);
});

test('traduction : comparaison insensible aux accents, à la casse et à la ponctuation', () => {
  assert.equal(sameText('Köln', 'Koln'), true);
  assert.equal(sameText('Saint-Étienne', 'saint etienne'), true);
  assert.equal(sameText('Paris', 'Pa r i s'), true);
  assert.equal(sameText('Tokyo', 'Tokyo'), true);
  assert.equal(sameText('Tokyo', '東京都'), false);
  assert.equal(sameText('', 'Tokyo'), false);
  assert.equal(sameText(null, null), false);
});

test('traduction : réponses MyMemory invalides ou inutiles écartées', () => {
  assert.equal(cleanTranslation(null, 'Tokyo'), null);
  assert.equal(cleanTranslation({ quotaFinished: true }, 'Tokyo'), null);
  assert.equal(cleanTranslation({ responseStatus: 403, responseData: {} }, 'Tokyo'), null);
  assert.equal(cleanTranslation({ responseData: {} }, 'Tokyo'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: 'INVALID SOURCE LANGUAGE' } }, 'Tokyo'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: '  Tokyo ' } }, 'Tokyo'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Asie de l&#39;Est' } }, 'Eastern Asia'), "Asie de l'Est");
  assert.equal(cleanTranslation({ responseStatus: '200', responseData: { translatedText: '  Cologne ' } }, 'Köln'), 'Cologne');
  // Réponses douteuses : lettres espacées, nom commun, texte resté dans l’écriture d’origine.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Pa r i s' } }, 'Paris'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Le liège' } }, 'Cork'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: 'تهرآن' } }, 'تهران'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: 'ES30 Comunidad de Madrid' } }, 'Comunidad de Madrid'), null);
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Cadix' } }, 'Cadiz'), 'Cadix');
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Pampelune' } }, 'Pamplona'), 'Pampelune');
});

test('traduction : seules les informations nouvelles restent affichées', () => {
  assert.equal(pickTranslations(null, { native: 'Tokyo' }), null);
  assert.equal(pickTranslations({ name: 'Tokyo', nameFr: 'Tokyo' }, null), null);
  // Le nom local traduit répète le titre : rien à afficher.
  assert.equal(pickTranslations(
    { name: '東京', nameFr: 'Tokyo', region: 'Eastern Asia' },
    { native: 'Tokyo', region: 'Eastern Asia' },
  ), null);
  assert.deepEqual(
    pickTranslations({ name: '東京', nameFr: 'Tokyo', region: 'Eastern Asia' }, { region: 'Asie de l’Est' }),
    { region: 'Asie de l’Est' },
  );
  assert.deepEqual(
    pickTranslations({ name: '東京', nameFr: 'Tokyo', native: '東京都' }, { native: 'Tokyo' }),
    null,
  );
  assert.deepEqual(
    pickTranslations({ name: 'München', native: 'München' }, { name: 'Munich' }),
    { name: 'Munich' },
  );
});
