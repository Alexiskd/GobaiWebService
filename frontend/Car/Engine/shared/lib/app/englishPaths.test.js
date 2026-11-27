// Outils de test de Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Fonctions testées.
import { englishPathOf, frenchSlugFromPath, isEnglishPath } from './englishPaths.js';

// Reconnaît la version anglaise.
test('reconnaît les adresses anglaises', () => {
  assert.equal(isEnglishPath('/en'), true);
  assert.equal(isEnglishPath('/en/moon'), true);
  assert.equal(isEnglishPath('/EN/Moon/'), true);
  assert.equal(isEnglishPath('/energie'), false);
  assert.equal(isEnglishPath('/mars'), false);
});

// Traduit l'adresse anglaise en française.
test('donne l’adresse française de la page affichée', () => {
  assert.equal(frenchSlugFromPath('/en/earth'), 'terre');
  assert.equal(frenchSlugFromPath('/en/Moon/'), 'lune');
  assert.equal(frenchSlugFromPath('/en/gallery'), 'galerie');
  assert.equal(frenchSlugFromPath('/en'), '');
  assert.equal(frenchSlugFromPath('/en/inconnu'), '');
  assert.equal(frenchSlugFromPath('/mars'), 'mars');
});

// Et l'inverse.
test('donne l’adresse anglaise d’une page française', () => {
  assert.equal(englishPathOf('/terre'), '/en/earth');
  assert.equal(englishPathOf('/faire-un-don'), '/en/donate');
  assert.equal(englishPathOf('/donnees'), '/en/gallery');
  assert.equal(englishPathOf('/'), '/en');
});
