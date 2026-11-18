// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la table des noms locaux et la fonction testée.
import { COUNTRY_NATIVE_LABELS, nativeCountryLabel } from './countryNativeNames';
// Importe les points d'ancrage des noms de pays.
import { COUNTRY_LABEL_POINTS } from './countryLabelPoints';

// Ensemble des noms de pays qui ont un point d'ancrage.
const anchorNames = new Set(COUNTRY_LABEL_POINTS.map((p) => p.name));
// Écritures connues (début).
const SCRIPTS = new Set([
  // Arabe, bengali, chinois, cyrillique, devanagari, éthiopien et géorgien.
  'arabic', 'bengali', 'chinese', 'cyrillic', 'devanagari', 'ethiopic', 'georgian',
  // Grec, hébreu, japonais, khmer, coréen, lao, birman et cingalais.
  'greek', 'hebrew', 'japanese', 'khmer', 'korean', 'lao', 'myanmar', 'sinhala',
  // Thâna, thaï et tibétain.
  'thaana', 'thai', 'tibetan',
// Fin de la liste.
]);

// Test : chaque nom local est complet.
test('chaque nom local a un point d’ancrage et une typographie connue', () => {
  // Parcourt les noms locaux.
  for (const [name, label] of Object.entries(COUNTRY_NATIVE_LABELS)) {
    // Le pays a un point d'ancrage.
    assert.ok(anchorNames.has(name), `point d’ancrage manquant : ${name}`);
    // Le texte n'est pas vide.
    assert.ok(label.text.trim().length > 0, `texte vide : ${name}`);
    // La langue est indiquée.
    assert.ok(label.lang, `langue manquante : ${name}`);
    // L'écriture est connue.
    assert.ok(SCRIPTS.has(label.script), `écriture inconnue : ${name} (${label.script})`);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : les pays à alphabet latin.
test('les pays latins gardent le nom français', () => {
  // La France : pas de nom local.
  assert.equal(nativeCountryLabel('France'), null);
  // Le Brésil : pas de nom local.
  assert.equal(nativeCountryLabel('Brésil'), null);
  // La Chine : son nom en chinois simplifié.
  assert.deepEqual(nativeCountryLabel('Chine'), { text: '中国', lang: 'zh-Hans', script: 'chinese' });
  // Un pays inconnu : rien.
  assert.equal(nativeCountryLabel('Pays imaginaire'), null);
// Fin du test.
});
