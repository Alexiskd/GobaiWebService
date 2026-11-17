// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { FLOW_LEVEL_IDS, FLOW_TIME_SCALE, advect, flowRadius, normalizeWinds, randomPoint, sampleWind, speedColor, timeScale } from './flowMath';

// Grille d'essai : 4 colonnes de 90° à partir de −180°, 3 lignes de 40° à partir de −40°.
const grid = { width: 4, height: 3, lonStart: -180, lonStep: 90, latStart: -40, latStep: 40 };

// Test : la réponse.
test('vents : réponse mise en forme (niveaux complets seulement, axes, heure)', () => {
  // Réponse d'essai : un niveau complet, un incomplet, un indisponible ; un axe.
  const n = normalizeWinds({ validAt: '2026-11-15T15:00:00.000Z', grid, levels: [{ id: '250hPa', label: '250 hPa', altKm: 10.4, available: true, u: Array(12).fill(30), v: Array(12).fill(0), maxMs: 30 }, { id: '500hPa', available: true, u: [1], v: [1] }, { id: '10m', available: false, u: [], v: [] }], jets: [{ geometry: { coordinates: [[0, 40], [12, 42]] }, intensity: { value: 200 }, details: { hemisphere: 'nord' } }] });
  // Niveaux, axes, heure.
  assert.deepEqual([Object.keys(n.levels), n.jets.length, n.jets[0].maxKmh, n.validAt], [['250hPa'], 1, 200, Date.UTC(2026, 10, 15, 15)]);
  // Niveaux proposés.
  assert.deepEqual(FLOW_LEVEL_IDS, ['10m', '850hPa', '500hPa', '250hPa']);
// Fin du test.
});

// Test : l'interpolation.
test('vents : interpolation bilinéaire refermée en longitude et bornée en latitude', () => {
  // u = indice de colonne × 10, v = indice de ligne.
  const level = { u: Float32Array.from({ length: 12 }, (_, i) => (i % 4) * 10), v: Float32Array.from({ length: 12 }, (_, i) => Math.floor(i / 4)) };
  // Point de grille (−90°, 0°) : colonne 1, ligne 1.
  assert.deepEqual(sampleWind(grid, level, -90, 0), [10, 1]);
  // Entre la dernière colonne (90°) et la première (−180°, refermée) : moitié de 30 et 0.
  assert.deepEqual(sampleWind(grid, level, 135, 0).map((x) => Math.round(x * 10) / 10), [15, 1]);
  // Au-delà de la grille au nord : dernière ligne.
  assert.equal(sampleWind(grid, level, -90, 85)[1], 2);
// Fin du test.
});

// Test : le déplacement.
test('vents : déplacement sur la sphère, longitude refermée, points tirés dans la bande', () => {
  // 10 m/s vers l'est pendant 1 000 s à l'équateur : ≈ 0,09°.
  const [lo, la] = advect(0, 0, 10, 0, 1000);
  // Contrôles.
  assert.deepEqual([Math.round(lo * 1000) / 1000, la], [0.09, 0]);
  // Passage de l'antiméridien.
  assert.ok(advect(179.99, 0, 50, 0, 1000)[0] < -179);
  // Points au hasard : dans la bande ±80°.
  assert.ok(Array.from({ length: 200 }, () => randomPoint()).every(([a, b]) => Math.abs(a) <= 180 && Math.abs(b) <= 80));
  // Accélération : référence à 1,5 rayon, bornée à 10 % et 150 %.
  assert.deepEqual([timeScale(1.5), timeScale(0), timeScale(9)], [FLOW_TIME_SCALE, FLOW_TIME_SCALE * 0.1, FLOW_TIME_SCALE * 1.5]);
  // Couleurs : calme, au-delà du dernier palier ; rayon croissant avec l'altitude.
  assert.deepEqual([speedColor(0).map((v) => Math.round(v * 255)), speedColor(99).map((v) => Math.round(v * 255)), flowRadius(10.4) > flowRadius(0.01)], [[127, 179, 255], [255, 61, 200], true]);
// Fin du test.
});
