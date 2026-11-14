// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les types et la liste des lieux lunaires.
import { FEATURE_TYPES, MOON_FEATURES } from './moonFeatures';

// Expression qui reconnaît un caractère cyrillique.
const CYRILLIC = /[\u0400-\u04FF]/;

// Test : les lieux russes de la Lune.
test('Lune : tous les lieux russes portent leur nom cyrillique', () => {
  // Noms cyrilliques attendus (début).
  const expected = {
    // Luna 9.
    'Luna 9': 'Луна-9',
    // Luna 16.
    'Luna 16': 'Луна-16',
    // Luna 24.
    'Luna 24': 'Луна-24',
    // Lunokhod 1.
    'Lunokhod 1': 'Луноход-1',
    // La mer de Moscou.
    'Mer de Moscou': 'Море Москвы',
    // Tsiolkovski.
    Tsiolkovski: 'Циолковский',
    // Korolev.
    Korolev: 'Королёв',
  // Fin de la liste.
  };
  // Table des lieux par nom.
  const features = new Map(MOON_FEATURES.map((f) => [f.name, f]));
  // Pour chaque nom attendu.
  for (const [name, native] of Object.entries(expected)) {
    // Cherche le lieu.
    const f = features.get(name);
    // Il existe.
    assert.ok(f, `${name} manque parmi les lieux de la Lune`);
    // Son nom local est le bon.
    assert.equal(f.native, native);
    // Son écriture est le cyrillique.
    assert.equal(f.script, 'cyrillic');
  // Fin du parcours.
  }

  // Noms des lieux qui ont un nom local, triés.
  const localized = MOON_FEATURES.filter((f) => f.native).map((f) => f.name).sort();
  // Ce sont exactement les noms attendus.
  assert.deepEqual(localized, Object.keys(expected).sort());
  // Pour chaque lieu qui a un nom local.
  for (const f of MOON_FEATURES.filter((x) => x.native)) {
    // Ce nom contient du cyrillique.
    assert.match(f.native, CYRILLIC);
    // Ses coordonnées sont des nombres.
    assert.ok(Number.isFinite(f.lat) && Number.isFinite(f.lon), `${f.name} : coordonnées`);
    // Son type est connu.
    assert.ok(FEATURE_TYPES[f.type], `${f.name} : type inconnu`);
  // Fin du parcours.
  }
// Fin du test.
});
