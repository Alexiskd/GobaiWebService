import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_KINDS, defaultHiddenBodies, defaultVisibility, isKindHidden, planetKind, shownByDefault } from './bodyKinds.jsx';

test('familles des astres', () => {
  for (const name of ['Mercure', 'Vénus', 'Terre', 'Mars']) assert.equal(planetKind({ name }), 'solid');
  for (const name of ['Jupiter', 'Saturne', 'Uranus', 'Neptune']) assert.equal(planetKind({ name }), 'gas');
  assert.equal(planetKind({ name: 'Pluton', dwarf: true }), 'dwarf');
  assert.deepEqual(BODY_KINDS.map((k) => k.id), ['solid', 'gas', 'dwarf', 'satellite']);
});

test('les familles peuvent toujours être masquées volontairement', () => {
  assert.equal(isKindHidden(new Set(['gas']), 'gas'), true);
  assert.equal(isKindHidden(new Set(['satellite']), 'solid', true), true);
  assert.equal(isKindHidden(new Set(['satellite']), 'solid'), false);
  assert.equal(isKindHidden(new Set(['solid', 'gas', 'dwarf', 'satellite']), null), false);
});

test('tous les astres du catalogue sont visibles par défaut, indépendamment des couches', () => {
  const d = defaultVisibility();
  assert.deepEqual(d.kinds, { solid: true, gas: true, dwarf: true, satellite: true });
  assert.deepEqual(d.hiddenBodies, []);
  for (const body of [{ index: 0 }, { index: 3 }, { index: 9 }, { index: 10, satellite: true }]) {
    assert.equal(shownByDefault(body), true);
  }
  assert.deepEqual(defaultHiddenBodies([{ index: 0 }, { index: 3 }, { index: 9 }], [], '/'), []);
});

test('les astres restent visibles même sans aucune couche cartographique', () => {
  assert.deepEqual(defaultHiddenBodies([
    { index: 0, name: 'Soleil' },
    { index: 1, name: 'Terre' },
    { index: 2, name: 'Pluton' },
    { index: 3, name: 'Io', satellite: true, parent: 1 },
  ], [], '/', []), []);
});
