import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE_TYPES, MOON_FEATURES } from './moonFeatures';

const CYRILLIC = /[\u0400-\u04FF]/;

test('Lune : tous les lieux russes portent leur nom cyrillique', () => {
  const expected = {
    'Luna 9': 'Луна-9',
    'Luna 16': 'Луна-16',
    'Luna 24': 'Луна-24',
    'Lunokhod 1': 'Луноход-1',
    'Mer de Moscou': 'Море Москвы',
    Tsiolkovski: 'Циолковский',
    Korolev: 'Королёв',
  };
  const features = new Map(MOON_FEATURES.map((f) => [f.name, f]));
  for (const [name, native] of Object.entries(expected)) {
    const f = features.get(name);
    assert.ok(f, `${name} manque parmi les lieux de la Lune`);
    assert.equal(f.native, native);
    assert.equal(f.script, 'cyrillic');
  }

  const localized = MOON_FEATURES.filter((f) => f.native).map((f) => f.name).sort();
  assert.deepEqual(localized, Object.keys(expected).sort());
  for (const f of MOON_FEATURES.filter((x) => x.native)) {
    assert.match(f.native, CYRILLIC);
    assert.ok(Number.isFinite(f.lat) && Number.isFinite(f.lon), `${f.name} : coordonnées`);
    assert.ok(FEATURE_TYPES[f.type], `${f.name} : type inconnu`);
  }
});
