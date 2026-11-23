// Tests des règles du passage three.js ↔ CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTER_KM, EXIT_KM, REARM_KM, RETURN_KM, altitudeKm, lonLatOf, rearm, shouldEnter, shouldExit } from './cesium-earth.handoff.js';

test('altitude : distance au centre en rayons', () => {
  assert.equal(altitudeKm(2, 1), 6371);
  assert.ok(Math.abs(altitudeKm(1.5, 0.5) - 12742) < 1e-9);
});

test('entrée seulement sur la Terre ciblée, armée, sous le seuil', () => {
  assert.equal(shouldEnter({ earthFocused: true, altKm: ENTER_KM - 1, armed: true }), true);
  assert.equal(shouldEnter({ earthFocused: false, altKm: 100, armed: true }), false);
  assert.equal(shouldEnter({ earthFocused: true, altKm: 100, armed: false }), false);
  assert.equal(shouldEnter({ earthFocused: true, altKm: ENTER_KM + 1, armed: true }), false);
});

test('sortie au-dessus du seuil, retour sans aller-retour en boucle', () => {
  assert.equal(shouldExit(EXIT_KM + 1), true);
  assert.equal(shouldExit(EXIT_KM - 1), false);
  assert.ok(RETURN_KM > EXIT_KM && REARM_KM > ENTER_KM && RETURN_KM > REARM_KM);
  assert.equal(rearm(false, RETURN_KM), true);
  assert.equal(rearm(false, ENTER_KM), false);
});

test('longitude et latitude du repère des tuiles (axe des pôles = +Y, −Z vers l\'est)', () => {
  const o = lonLatOf([1, 0, 0]); assert.equal(Math.abs(o.lon), 0); assert.equal(o.lat, 0);
  assert.equal(lonLatOf([0, 0, -1]).lon, 90);
  assert.equal(lonLatOf([0, 2, 0]).lat, 90);
});
