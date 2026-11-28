// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { DAY, NIGHT, modeForHour } from './dayNight.jsx';

// Test : le mode d'après l'heure.
test('mode automatique : jour de 7 h à 19 h, nuit sinon', () => {
  const at = (h) => new Date(2026, 10, 28, h, 30);
  assert.equal(modeForHour(at(6)), NIGHT); assert.equal(modeForHour(at(7)), DAY);
  assert.equal(modeForHour(at(13)), DAY); assert.equal(modeForHour(at(18)), DAY);
  assert.equal(modeForHour(at(19)), NIGHT); assert.equal(modeForHour(at(23)), NIGHT);
});
