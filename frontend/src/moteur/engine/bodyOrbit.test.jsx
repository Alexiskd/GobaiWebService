// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions et les constantes testées.
import { orbitAlpha, orbitTimes, closeOrbitLoop, refreshMsFor, DEFAULT_SAMPLES } from './bodyOrbitMath';

// Durée d'un jour, en millisecondes.
const DAY = 86_400_000;

// Test : les instants du tracé, pour une période quelconque.
test('tracé d’orbite : une période complète centrée sur l’instant simulé', () => {
  // La période de Mars, en millisecondes.
  const period = 686.98 * DAY;
  // Les instants, centrés sur un instant donné.
  const t = orbitTimes(1_000_000_000_000, period, DEFAULT_SAMPLES);
  // Un point de plus que le nombre de segments.
  assert.equal(t.length, DEFAULT_SAMPLES + 1);
  // L'instant du milieu est l'instant donné : la ligne passe par l'astre.
  assert.equal(t[DEFAULT_SAMPLES / 2], 1_000_000_000_000, 'l’astre au milieu du tracé');
  // Du premier au dernier point : une période, à un millième de milliseconde près.
  assert.ok(Math.abs(t[DEFAULT_SAMPLES] - t[0] - period) < 1e-3, 'un tour complet');
// Fin du test.
});

// Test : l'intervalle de recalcul suit la période de l'astre.
test('tracé d’orbite : le recalcul suit la période de l’astre', () => {
  // La Lune : un mois sidéral découpé en 720 segments, soit environ 55 minutes.
  assert.ok(Math.abs(refreshMsFor(27.321661 * DAY) - 3_278_599) < 1000, 'environ 55 minutes pour la Lune');
  // Pluton : une période bien plus longue, donc un recalcul bien plus rare.
  assert.ok(refreshMsFor(248 * 365.25 * DAY) > 30 * DAY, 'plus d’un mois pour Pluton');
// Fin du test.
});

// Test : l'opacité du tracé.
test('tracé d’orbite : plus clair à l’astre, estompé à l’opposé', () => {
  // Plus forte à l'astre qu'à mi-parcours.
  assert.ok(orbitAlpha(0) > orbitAlpha(0.5));
  // Plus forte à mi-parcours qu'à l'opposé.
  assert.ok(orbitAlpha(0.5) > orbitAlpha(1));
  // La même dans le passé et dans l'avenir.
  assert.equal(orbitAlpha(-0.3), orbitAlpha(0.3), 'symétrique passé / avenir');
  // Jamais nulle.
  assert.ok(orbitAlpha(1) > 0, 'jamais invisible');
  // Les deux bouts du tracé ont la même opacité : pas de marche au raccord.
  assert.equal(orbitAlpha(-1), orbitAlpha(1), 'raccord sans marche');
// Fin du test.
});

// Test : la fermeture de la boucle du tracé.
test('tracé d’orbite : la boucle se ferme sans déplacer l’astre', () => {
  // Quatre segments, donc cinq points.
  const n = 4;
  // Un tracé dont le dernier point manque de rejoindre le premier de (1, 2, 4).
  const p = new Float32Array([
    // premier point ;
    1, 0, 0,
    // deuxième ;
    0, 1, 0,
    // troisième, au milieu : la position de l'astre ;
    -1, 0, 0,
    // quatrième ;
    0, -1, 0,
    // dernier, décalé par rapport au premier.
    0, -2, -4,
  ]);
  // Ferme la boucle.
  closeOrbitLoop(p, n);
  // Le dernier point rejoint exactement le premier.
  assert.ok(Math.abs(p[0] - p[3 * n]) < 1e-5, 'même x aux deux bouts');
  assert.ok(Math.abs(p[1] - p[3 * n + 1]) < 1e-5, 'même y aux deux bouts');
  assert.ok(Math.abs(p[2] - p[3 * n + 2]) < 1e-5, 'même z aux deux bouts');
  // Le point du milieu n'a pas bougé : la ligne passe toujours par l'astre.
  assert.deepEqual([p[6], p[7], p[8]], [-1, 0, 0], 'l’astre reste sur la ligne');
  // Le déplacement d'un bout vaut la moitié de l'écart, pas l'écart entier.
  assert.ok(Math.abs(p[2] - -2) < 1e-5, 'moitié de l’écart au premier point');
// Fin du test.
});

// Test : un tracé déjà fermé n'est pas modifié.
test('tracé d’orbite : un tracé déjà fermé reste inchangé', () => {
  // Deux segments, le dernier point confondu avec le premier.
  const p = new Float32Array([3, 2, 1, 0, 0, 0, 3, 2, 1]);
  // Ferme la boucle.
  closeOrbitLoop(p, 2);
  // Rien n'a bougé.
  assert.deepEqual(Array.from(p), [3, 2, 1, 0, 0, 0, 3, 2, 1]);
// Fin du test.
});
