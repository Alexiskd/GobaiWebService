// Tests des règles du passage three.js ↔ CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTER_KM, EXIT_KM, REARM_KM, RETURN_KM, altitudeKm, lonLatOf, rearm, shouldEnter, shouldExit } from './astre-solide.handoff.js';

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

// Importe les altitudes ramenées au rayon de l'astre.
import { scaledKm } from './astre-solide.handoff.js';

test('astres solides : mêmes seuils en rayons que pour la Terre', () => {
  // Lune (1 737,4 km) : entrée à 20 000 × 1 737,4 / 6 371 km.
  const moonEnter = scaledKm(20000, 1737.4);
  assert.ok(Math.abs(moonEnter - 5454.1) < 1);
  // Ciblée, armée, sous ce seuil : entrée.
  assert.equal(shouldEnter({ focused: true, altKm: moonEnter - 10, armed: true, radiusKm: 1737.4 }), true);
  // Au-dessus : pas d'entrée.
  assert.equal(shouldEnter({ focused: true, altKm: moonEnter + 10, armed: true, radiusKm: 1737.4 }), false);
  // Sortie et réarmement au même nombre de rayons.
  assert.equal(shouldExit(scaledKm(30000, 1737.4) + 1, 1737.4), true);
  assert.equal(rearm(false, scaledKm(24000, 1737.4) + 1, 1737.4), true);
  // Ancienne écriture (Terre) toujours valable.
  assert.equal(shouldEnter({ earthFocused: true, altKm: 19000, armed: true }), true);
});

// Importe le fondu du zoom.
import { FADE_KM, zoomFade } from './astre-solide.handoff.js';

test('fondu du zoom : plein au-dessus de FADE_KM, nul à ENTER_KM, ramené au rayon de l\'astre', () => {
  assert.equal(zoomFade(FADE_KM + 1000), 1);
  assert.equal(zoomFade(ENTER_KM), 0);
  assert.equal(zoomFade(ENTER_KM - 5000), 0);
  assert.equal(zoomFade((ENTER_KM + FADE_KM) / 2), 0.5);
  assert.ok(Math.abs(zoomFade(scaledKm((ENTER_KM + FADE_KM) / 2, 1737), 1737) - 0.5) < 1e-9);
  assert.equal(zoomFade(NaN), 1);
});
