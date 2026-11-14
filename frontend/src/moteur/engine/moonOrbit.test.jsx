// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions et les constantes testées.
import { orbitAlpha, orbitTimes, SIDEREAL_MONTH_MS, ORBIT_SAMPLES } from './moonOrbitMath';

// Test : les instants du tracé de l'orbite.
test('orbite de la Lune : un mois sidéral centré sur l’instant simulé', () => {
  // Les instants, centrés sur un instant donné.
  const t = orbitTimes(1_000_000_000_000);
  // Un point de plus que le nombre d'échantillons.
  assert.equal(t.length, ORBIT_SAMPLES + 1);
  // L'instant du milieu est l'instant donné.
  assert.equal(t[ORBIT_SAMPLES / 2], 1_000_000_000_000, 'la Lune au milieu du tracé');
  // Du premier au dernier point : un mois sidéral, à un millième de milliseconde près.
  assert.ok(Math.abs(t[ORBIT_SAMPLES] - t[0] - SIDEREAL_MONTH_MS) < 1e-3, 'un tour complet');
// Fin du test.
});

// Test : l'opacité du tracé.
test('orbite de la Lune : plus claire à la Lune, estompée à l’opposé', () => {
  // Plus forte à la Lune qu'à mi-parcours.
  assert.ok(orbitAlpha(0) > orbitAlpha(0.5));
  // Plus forte à mi-parcours qu'à l'opposé.
  assert.ok(orbitAlpha(0.5) > orbitAlpha(1));
  // La même dans le passé et dans l'avenir.
  assert.equal(orbitAlpha(-0.3), orbitAlpha(0.3), 'symétrique passé / avenir');
  // Jamais nulle.
  assert.ok(orbitAlpha(1) > 0, 'jamais invisible');
// Fin du test.
});
