// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe l'unité astronomique en unités de scène, la position héliocentrique et le tracé d'orbite.
import { AU_UNITS, heliocentric, orbitPositions } from './planetOrbits';
// Importe le calcul de la tuile native en sur-zoom.
import { nativeTile } from './tiles/overzoom';

// Éléments de Mars (a, e, I, L, ϖ, Ω et leurs dérives par siècle), comme renvoyés par l'API.
// Les douze éléments orbitaux de Mars.
const MARS = [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343];

// Test : chaque point du tracé est une position de la planète.
test('orbitPositions : chaque point est la position de la planète pour la même anomalie excentrique', () => {
  // Nombre de points et date, en siècles depuis J2000.
  const n = 64, T = 0.27;
  // Le tracé de l'orbite.
  const pts = orbitPositions(MARS, T, n);
  // Trois coordonnées par point.
  assert.equal(pts.length, n * 3);
  // L'excentricité à cette date.
  const e = MARS[2] + MARS[3] * T;
  // Pour quelques points du tracé.
  for (const k of [0, 7, 16, 33, 63]) {
    // L'anomalie excentrique du point.
    const E = (k / n) * 2 * Math.PI;
    // L'anomalie moyenne correspondante, en degrés.
    const M = ((E - e * Math.sin(E)) * 180) / Math.PI; // équation de Kepler : anomalie moyenne du même point
    // La position de la planète pour cette anomalie.
    const p = heliocentric(MARS, T, M);
    // Les trois coordonnées concordent à 0,05 unité près.
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(pts[3 * k + i] - p[i] * AU_UNITS) < 0.05, `point ${k}, axe ${i}`);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : la finesse du tracé par défaut.
test('orbitPositions : 2048 points suivent l’ellipse à moins de deux millionièmes du demi-grand axe', () => {
  // Le tracé par défaut (2 048 points).
  const pts = orbitPositions(MARS, 0.27);
  // Le demi-grand axe, en unités de scène.
  const a = MARS[0] * AU_UNITS;
  // Flèche de la corde entre deux points voisins : milieu de la corde comparé au point de l'ellipse à mi-anomalie.
  // Un tracé deux fois plus fin, qui sert de référence.
  const fine = orbitPositions(MARS, 0.27, 4096);
  // Plus grande flèche rencontrée.
  let worst = 0;
  // Pour un segment sur 97.
  for (let k = 0; k < 2048; k += 97) {
    // Le point suivant, en boucle.
    const j = (k + 1) % 2048;
    // Le milieu de la corde.
    const mid = [0, 1, 2].map((i) => (pts[3 * k + i] + pts[3 * j + i]) / 2);
    // Le point de l'ellipse à mi-chemin.
    const on = [0, 1, 2].map((i) => fine[3 * (2 * k + 1) + i]);
    // Garde le plus grand écart entre les deux.
    worst = Math.max(worst, Math.hypot(mid[0] - on[0], mid[1] - on[1], mid[2] - on[2]));
  // Fin du parcours.
  }
  // La flèche reste sous deux millionièmes du demi-grand axe.
  assert.ok(worst / a < 2e-6, `flèche ${worst / a}`);
// Fin du test.
});

// Test : le sur-zoom profond.
test('sur-zoom profond : la tuile native et sa portion restent exactes 11 niveaux plus bas', () => {
  // Une tuile du niveau 16, pour une couche limitée au niveau 5.
  const { coord, rect } = nativeTile({ z: 16, x: 40000, y: 20000 }, 5);
  // La tuile native est l'ancêtre du niveau 5.
  assert.deepEqual(coord, { z: 5, x: Math.floor(40000 / 2048), y: Math.floor(20000 / 2048) });
  // La portion fait 1/2048 de la tuile.
  assert.equal(rect[2], 1 / 2048);
  // Elle reste à l'intérieur de la tuile.
  assert.ok(rect[0] >= 0 && rect[0] + rect[2] <= 1 && rect[1] >= 0 && rect[1] + rect[3] <= 1);
// Fin du test.
});
