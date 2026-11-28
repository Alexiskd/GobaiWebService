// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { WHEEL_MAX_PX, ZOOM_DT_MAX_MS, ZOOM_LEAD_MAX, easeFactor, leadBound, wheelDeltaPx } from './zoomMath.jsx';

// Test : le lissage sans saut.
test('lissage : même part du chemin à 16 ms, borné après une pause', () => {
  // Image de 16 ms : 1 − e^(−16/96).
  assert.ok(Math.abs(easeFactor(16, 96) - (1 - Math.exp(-16 / 96))) < 1e-12);
  // Pause de 100 ms : comptée comme une image à 30 par seconde (plus de bond de 65 %).
  assert.equal(easeFactor(100, 96), easeFactor(ZOOM_DT_MAX_MS, 96));
  assert.ok(easeFactor(100, 96) < 0.31);
  // Temps négatif ou illisible : rien.
  assert.equal(easeFactor(-5, 96), 0); assert.equal(easeFactor(NaN, 96), 0);
  // Constante nulle : chemin fait d'un coup.
  assert.equal(easeFactor(16, 0), 1);
// Fin du test.
});

// Test : la visée tenue près de la caméra.
test('visée : au plus 6 fois plus loin ou plus près que la caméra', () => {
  // Dans la bande : inchangée.
  assert.equal(leadBound(2000, 1000), 2000);
  // Molette lancée : bornée à 6 fois.
  assert.equal(leadBound(1e9, 1000), 1000 * ZOOM_LEAD_MAX);
  assert.equal(leadBound(1, 1000), 1000 / ZOOM_LEAD_MAX);
  // Altitude actuelle inconnue : visée telle quelle.
  assert.equal(leadBound(42, 0), 42);
// Fin du test.
});

// Test : les molettes.
test('molette : pixels, lignes (Firefox) et pages ramenés en pixels, bornés', () => {
  // Pixels : tels quels.
  assert.equal(wheelDeltaPx({ deltaY: 53, deltaMode: 0 }), 53);
  // Lignes : × 16 (3 lignes = 48 px, au lieu de 3).
  assert.equal(wheelDeltaPx({ deltaY: 3, deltaMode: 1 }), 48);
  // Page : bornée.
  assert.equal(wheelDeltaPx({ deltaY: -1, deltaMode: 2 }, 900), -WHEEL_MAX_PX);
  // Événement illisible : 0.
  assert.equal(wheelDeltaPx({}), 0);
// Fin du test.
});
