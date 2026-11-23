// Tests du curseur du temps (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clampOffsetHours, formatOffset } from './astre-solide.time.js';

test('décalage borné à ±12 h, pas de 15 min', () => {
  assert.equal(clampOffsetHours(30), 12);
  assert.equal(clampOffsetHours(-30), -12);
  assert.equal(clampOffsetHours(1.1), 1);
  assert.equal(clampOffsetHours(1.2), 1.25);
  assert.equal(clampOffsetHours(NaN), 0);
  assert.ok(Object.is(clampOffsetHours(-0.01), 0));
});

test('texte du décalage', () => {
  assert.equal(formatOffset(0), 'maintenant');
  assert.equal(formatOffset(3), '+3 h');
  assert.equal(formatOffset(-1.75), '−1 h 45');
  assert.equal(formatOffset(0.25), '+15 min');
});
