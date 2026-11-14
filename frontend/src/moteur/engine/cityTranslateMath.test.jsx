// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis cityTranslateMath (début de la liste).
import {
  // Les cinq fonctions testées : nettoyage, choix, comparaison, langue d'origine et textes à traduire.
  cleanTranslation, pickTranslations, sameText, sourceLanguage, translationTargets,
// Fin de la liste : le module cityTranslateMath.
} from './cityTranslateMath';

// Test : la langue d'origine d'une ville.
test('traduction : langue locale déduite de l’écriture puis du pays', () => {
  // Écriture japonaise : « ja ».
  assert.equal(sourceLanguage({ name: '東京', script: 'japanese' }), 'ja');
  // Écriture coréenne : « ko ».
  assert.equal(sourceLanguage({ name: '서울', script: 'korean' }), 'ko');
  // Écriture arabe : « ar ».
  assert.equal(sourceLanguage({ name: 'القاهرة', script: 'arabic' }), 'ar');
  // Écriture arabe en Iran : « fa ».
  assert.equal(sourceLanguage({ name: 'تهران', script: 'arabic', country: 'Iran' }), 'fa');
  // Écriture cyrillique en Ukraine : « uk ».
  assert.equal(sourceLanguage({ name: 'کیف', script: 'cyrillic', country: 'Ukraine' }), 'uk');
  // Écriture chinoise à Taïwan : « zh-TW ».
  assert.equal(sourceLanguage({ name: '台北', script: 'chinese', country: 'Taiwan' }), 'zh-TW');
  // Sans écriture indiquée : « en ».
  assert.equal(sourceLanguage({ name: 'Paris', country: 'France' }), 'en');
  // Ville absente : « en ».
  assert.equal(sourceLanguage(null), 'en');
// Fin du test.
});

// Test : la liste des textes à traduire.
test('traduction : seuls les textes sans version française sont demandés', () => {
  // Ville absente : liste vide.
  assert.deepEqual(translationTargets(null), []);
  // Vérifie une égalité (début).
  assert.deepEqual(
    // Tokyo, qui a déjà un nom français, un nom local et une région.
    translationTargets({ name: '東京', nameFr: 'Tokyo', native: '東京都', region: 'Eastern Asia', script: 'japanese' }),
    // Résultat attendu (début).
    [
      // Le nom local, depuis le japonais.
      { field: 'native', text: '東京都', source: 'ja' },
      // La région, depuis l'anglais.
      { field: 'region', text: 'Eastern Asia', source: 'en' },
    // Fin du résultat attendu.
    ],
  // Fin de la vérification.
  );
  // Sans nom français, le nom d'origine est traduit en plus du nom local.
  // Vérifie une égalité (début).
  assert.deepEqual(
    // Cologne, sans nom français.
    translationTargets({ name: 'Köln', native: 'Köln', country: 'Germany' }),
    // Résultat attendu (début).
    [
      // Le nom local, depuis l'anglais.
      { field: 'native', text: 'Köln', source: 'en' },
      // Le nom, depuis l'anglais.
      { field: 'name', text: 'Köln', source: 'en' },
    // Fin du résultat attendu.
    ],
  // Fin de la vérification.
  );
  // Paris avec une région faite d'espaces : seul le nom est demandé.
  assert.deepEqual(translationTargets({ name: 'Paris', region: '  ' }), [{ field: 'name', text: 'Paris', source: 'en' }]);
// Fin du test.
});

// Test : la comparaison de deux textes.
test('traduction : comparaison insensible aux accents, à la casse et à la ponctuation', () => {
  // « Köln » et « Koln » : identiques.
  assert.equal(sameText('Köln', 'Koln'), true);
  // « Saint-Étienne » et « saint etienne » : identiques.
  assert.equal(sameText('Saint-Étienne', 'saint etienne'), true);
  // « Paris » et « Pa r i s » : identiques.
  assert.equal(sameText('Paris', 'Pa r i s'), true);
  // Deux fois « Tokyo » : identiques.
  assert.equal(sameText('Tokyo', 'Tokyo'), true);
  // « Tokyo » et son nom japonais : différents.
  assert.equal(sameText('Tokyo', '東京都'), false);
  // Un texte vide : différents.
  assert.equal(sameText('', 'Tokyo'), false);
  // Deux textes absents : différents.
  assert.equal(sameText(null, null), false);
// Fin du test.
});

// Test : le nettoyage d'une réponse de MyMemory.
test('traduction : réponses MyMemory invalides ou inutiles écartées', () => {
  // Réponse absente : null.
  assert.equal(cleanTranslation(null, 'Tokyo'), null);
  // Quota épuisé : null.
  assert.equal(cleanTranslation({ quotaFinished: true }, 'Tokyo'), null);
  // Statut 403 : null.
  assert.equal(cleanTranslation({ responseStatus: 403, responseData: {} }, 'Tokyo'), null);
  // Sans texte traduit : null.
  assert.equal(cleanTranslation({ responseData: {} }, 'Tokyo'), null);
  // Message d'erreur à la place de la traduction : null.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'INVALID SOURCE LANGUAGE' } }, 'Tokyo'), null);
  // Traduction identique au texte d'origine : null.
  assert.equal(cleanTranslation({ responseData: { translatedText: '  Tokyo ' } }, 'Tokyo'), null);
  // Entité HTML décodée : « Asie de l'Est ».
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Asie de l&#39;Est' } }, 'Eastern Asia'), "Asie de l'Est");
  // Statut « 200 » en texte et espaces autour : « Cologne ».
  assert.equal(cleanTranslation({ responseStatus: '200', responseData: { translatedText: '  Cologne ' } }, 'Köln'), 'Cologne');
  // Réponses douteuses : lettres espacées, nom commun, texte resté dans l’écriture d’origine.
  // Lettres espacées : null.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Pa r i s' } }, 'Paris'), null);
  // « Le liège » pour Cork : null.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Le liège' } }, 'Cork'), null);
  // Texte resté en écriture arabe : null.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'تهرآن' } }, 'تهران'), null);
  // Code placé devant le texte d'origine : null.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'ES30 Comunidad de Madrid' } }, 'Comunidad de Madrid'), null);
  // « Cadix » pour Cadiz : gardé.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Cadix' } }, 'Cadiz'), 'Cadix');
  // « Pampelune » pour Pamplona : gardé.
  assert.equal(cleanTranslation({ responseData: { translatedText: 'Pampelune' } }, 'Pamplona'), 'Pampelune');
// Fin du test.
});

// Test : le choix des traductions à afficher.
test('traduction : seules les informations nouvelles restent affichées', () => {
  // Ville absente : null.
  assert.equal(pickTranslations(null, { native: 'Tokyo' }), null);
  // Résultats absents : null.
  assert.equal(pickTranslations({ name: 'Tokyo', nameFr: 'Tokyo' }, null), null);
  // Le nom local traduit répète le titre : rien à afficher.
  // Vérifie une égalité (début).
  assert.equal(pickTranslations(
    // Tokyo avec son nom français et sa région.
    { name: '東京', nameFr: 'Tokyo', region: 'Eastern Asia' },
    // Nom local traduit en « Tokyo », région inchangée.
    { native: 'Tokyo', region: 'Eastern Asia' },
  // Résultat attendu : null.
  ), null);
  // Vérifie une égalité (début).
  assert.deepEqual(
    // Tokyo, et une région traduite.
    pickTranslations({ name: '東京', nameFr: 'Tokyo', region: 'Eastern Asia' }, { region: 'Asie de l’Est' }),
    // Résultat attendu : la région traduite seule.
    { region: 'Asie de l’Est' },
  // Fin de la vérification.
  );
  // Vérifie une égalité (début).
  assert.deepEqual(
    // Tokyo avec son nom local, traduit en « Tokyo ».
    pickTranslations({ name: '東京', nameFr: 'Tokyo', native: '東京都' }, { native: 'Tokyo' }),
    // Résultat attendu : null.
    null,
  // Fin de la vérification.
  );
  // Vérifie une égalité (début).
  assert.deepEqual(
    // Munich sans nom français, et son nom traduit.
    pickTranslations({ name: 'München', native: 'München' }, { name: 'Munich' }),
    // Résultat attendu : le nom traduit.
    { name: 'Munich' },
  // Fin de la vérification.
  );
// Fin du test.
});
