import test from 'node:test';
import assert from 'node:assert/strict';
import { countryLabelOpacity } from './countryLabelsMath';

test('noms de pays : visibles du globe lisible jusqu’aux noms de villes', () => {
  assert.equal(countryLabelOpacity(8), 0, 'trop loin');
  assert.equal(countryLabelOpacity(6), 0, 'début du fondu');
  assert.equal(countryLabelOpacity(5), 0.8);
  assert.equal(countryLabelOpacity(4), 1, 'globe lisible');
  assert.equal(countryLabelOpacity(2.4), 1, 'juste avant les villes');
  assert.ok(Math.abs(countryLabelOpacity(2) - 7 / 15) < 1e-12, 'fondu de sortie');
  assert.equal(countryLabelOpacity(1.65), 0, 'les villes prennent le relais');
  assert.equal(countryLabelOpacity(1.2), 0);
  assert.equal(countryLabelOpacity(0), 0);
});
