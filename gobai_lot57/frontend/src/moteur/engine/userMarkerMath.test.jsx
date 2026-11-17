// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis userMarkerMath (début de la liste).
import {
  // La constante et les fonctions testées ; fin de la liste : le module userMarkerMath.
  ACCURACY_MAX_PX, accuracyRadiusPx, apparentRadiusPx, compassHeading, coneRotationDeg, metersPerPixel, screenNorthDeg, validHeading, aboveHorizon } from './userMarkerMath';

// near : vérifie que deux nombres sont égaux à eps près (1e-6 par défaut), avec les deux valeurs dans le message d'échec.
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// Test : le nombre de mètres par pixel.
test('mètres par pixel : proportionnel à la distance', () => {
  // À 1000 m, avec un champ de 90° et un écran de 1000 pixels de haut : 2 mètres par pixel.
  near(metersPerPixel(1000, 90, 1000), 2); // tan(45°) = 1 → 2 000 m sur 1 000 px
  // Distance doublée (2000 m) : 4 mètres par pixel.
  near(metersPerPixel(2000, 90, 1000), 4);
  // Distance nulle : null.
  assert.equal(metersPerPixel(0, 45, 800), null);
  // Hauteur d'écran nulle : null.
  assert.equal(metersPerPixel(100, 45, 0), null);
// Fin du test.
});

// Test : le rayon du halo de précision, en pixels.
test('halo de précision : masqué quand il est trop petit, plafonné quand il est trop grand', () => {
  // Précision de 10 m à 2 m par pixel : 0, le halo est masqué.
  assert.equal(accuracyRadiusPx(10, 2), 0); // 5 px : confondu avec le point
  // Précision de 100 m à 2 m par pixel : 50 pixels.
  assert.equal(accuracyRadiusPx(100, 2), 50);
  // Précision d'un million de mètres : le rayon maximal.
  assert.equal(accuracyRadiusPx(1e6, 2), ACCURACY_MAX_PX);
  // Précision inconnue : 0.
  assert.equal(accuracyRadiusPx(undefined, 2), 0);
  // Échelle inconnue : 0.
  assert.equal(accuracyRadiusPx(50, null), 0);
// Fin du test.
});

// Test : le rayon apparent de la Terre, en pixels.
test('rayon apparent de la Terre : grand de près, petit de loin', () => {
  // Distance 1 : infini.
  assert.equal(apparentRadiusPx(1, 45, 800), Infinity);
  // Distance 3 : plus de 300 pixels.
  assert.ok(apparentRadiusPx(3, 45, 800) > 300);
  // Distance 100 : moins de 30 pixels.
  assert.ok(apparentRadiusPx(100, 45, 800) < 30);
// Fin du test.
});

// Test : la direction du nord à l'écran et la rotation du cône.
test('nord à l’écran et rotation du cône', () => {
  // Second point au-dessus du premier : 0°.
  assert.equal(screenNorthDeg(100, 100, 100, 50), 0); // nord en haut
  // Second point à droite : 90°.
  assert.equal(screenNorthDeg(100, 100, 150, 100), 90); // nord à droite
  // Second point en dessous : 180°.
  assert.equal(screenNorthDeg(100, 100, 100, 150), 180);
  // Second point à gauche : 270°.
  assert.equal(screenNorthDeg(100, 100, 50, 100), 270);
  // Deux points confondus : 0°.
  assert.equal(screenNorthDeg(5, 5, 5, 5), 0);
  // Nord à 0° et cap à 90° : rotation de 90°.
  assert.equal(coneRotationDeg(0, 90), 90); // nord en haut, cap à l'est : cône vers la droite
  // Nord à 270° et cap à 180° : rotation de 90°.
  assert.equal(coneRotationDeg(270, 180), 90);
// Fin du test.
});

// Test : le cap lu dans un événement de boussole.
test('cap de la boussole : iPhone, Android absolu, sinon rien', () => {
  // webkitCompassHeading de 45 : cap de 45°.
  assert.equal(compassHeading({ webkitCompassHeading: 45 }), 45);
  // webkitCompassHeading de 350 avec un angle d'écran de 90 : cap de 80°.
  assert.equal(compassHeading({ webkitCompassHeading: 350 }, 90), 80);
  // Événement absolu avec alpha de 90 : cap de 270°.
  assert.equal(compassHeading({ absolute: true, alpha: 90 }), 270);
  // Événement non absolu : null.
  assert.equal(compassHeading({ absolute: false, alpha: 90 }), null); // alpha relatif : pas un cap
  // Événement vide : null.
  assert.equal(compassHeading({}), null);
  // Événement absent : null.
  assert.equal(compassHeading(null), null);
// Fin du test.
});

// Test : la validation du cap donné par le GPS.
test('cap du GPS : NaN ou null à l’arrêt', () => {
  // NaN : null.
  assert.equal(validHeading(NaN), null);
  // null : null.
  assert.equal(validHeading(null), null);
  // 370 : ramené à 10.
  assert.equal(validHeading(370), 10);
  // 0 : 0.
  assert.equal(validHeading(0), 0);
// Fin du test.
});

// Test : la visibilité du point selon la position de la caméra.
test('point visible : dès que la caméra est au-dessus de son horizon, même tout près du sol', () => {
  // Rayon de la Terre en mètres.
  const R = 6_371_000;
  // Valeur 1 + 600 / R : visible.
  assert.equal(aboveHorizon(1 + 600 / R), true, 'à 600 m à la verticale du point (arrivée de « Ma position »)');
  // Valeur 1 + 5 / R : visible.
  assert.equal(aboveHorizon(1 + 5 / R), true, 'à 5 m du sol');
  // Valeur 1 : non visible.
  assert.equal(aboveHorizon(1), false, 'à la hauteur de l’horizon');
  // Valeur 0,4 : non visible.
  assert.equal(aboveHorizon(0.4), false, 'face cachée');
  // Valeur −2 : non visible.
  assert.equal(aboveHorizon(-2), false);
// Fin du test.
});
