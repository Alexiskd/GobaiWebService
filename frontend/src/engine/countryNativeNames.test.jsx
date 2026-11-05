import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_NATIVE_LABELS, nativeCountryLabel } from './countryNativeNames';
import { COUNTRY_LABEL_POINTS } from './countryLabelPoints';

const anchorNames = new Set(COUNTRY_LABEL_POINTS.map((p) => p.name));
const SCRIPTS = new Set([
  'arabic', 'bengali', 'chinese', 'cyrillic', 'devanagari', 'ethiopic', 'georgian',
  'greek', 'hebrew', 'japanese', 'khmer', 'korean', 'lao', 'myanmar', 'sinhala',
  'thaana', 'thai', 'tibetan',
]);

test('chaque nom local a un point d’ancrage et une typographie connue', () => {
  for (const [name, label] of Object.entries(COUNTRY_NATIVE_LABELS)) {
    assert.ok(anchorNames.has(name), `point d’ancrage manquant : ${name}`);
    assert.ok(label.text.trim().length > 0, `texte vide : ${name}`);
    assert.ok(label.lang, `langue manquante : ${name}`);
    assert.ok(SCRIPTS.has(label.script), `écriture inconnue : ${name} (${label.script})`);
  }
});

test('les pays latins gardent le nom français', () => {
  assert.equal(nativeCountryLabel('France'), null);
  assert.equal(nativeCountryLabel('Brésil'), null);
  assert.deepEqual(nativeCountryLabel('Chine'), { text: '中国', lang: 'zh-Hans', script: 'chinese' });
  assert.equal(nativeCountryLabel('Pays imaginaire'), null);
});
