// Tests du lien de la vue du globe de près (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatViewHash, parseViewHash, setViewHash } from './astre-solide.view-link.js';

test('ancre de la vue : écrite puis relue', () => {
  const h = formatViewHash({ lat: 48.990001, lon: 2.09, altM: 2500.4, heading: 400, pitch: -35.2 });
  assert.equal(h, '#vue=48.99000,2.09000,2500,40,-35');
  assert.deepEqual(parseViewHash(h), { lat: 48.99, lon: 2.09, altM: 2500, heading: 40, pitch: -35 });
  assert.equal(formatViewHash({ lat: NaN, lon: 0, altM: 1 }), '');
});

test('ancre de la vue : cap et inclinaison facultatifs, valeurs invalides refusées', () => {
  assert.deepEqual(parseViewHash('vue=10,20,3000'), { lat: 10, lon: 20, altM: 3000, heading: 0, pitch: -90 });
  assert.equal(parseViewHash(''), null);
  assert.equal(parseViewHash('#autre=1'), null);
  assert.equal(parseViewHash('#vue=95,0,100'), null);
  assert.equal(parseViewHash('#vue=0,0,-5'), null);
  assert.equal(parseViewHash('#vue=0,0,100,0,20'), null);
  assert.equal(parseViewHash('#vue=a,b,c'), null);
});

test('ancre sans navigateur : rien', () => {
  assert.doesNotThrow(() => setViewHash('#vue=1,2,3'));
});
