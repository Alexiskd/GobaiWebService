// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les deux fonctions testées.
import { FLIGHT_MAX_MS, FLIGHT_MIN_MS, FLIGHT_START_DISTANCE, flightDistance, flightPlan } from './zoomFlight';

// Test : le plan du zoom d'arrivée.
test('zoom d’arrivée : part de haut, même depuis le sol, et dure selon l’écart d’altitude', () => {
  // But : 600 mètres au-dessus de la Terre.
  const goal = 1 + 600 / 6_371_000;
  // Plan depuis une vue très basse.
  const low = flightPlan(1.0005, goal);
  // Le départ est relevé à la distance minimale.
  assert.equal(low.from, FLIGHT_START_DISTANCE);
  // L'arrivée est le but.
  assert.equal(low.to, goal);
  // La durée est d'environ 2,5 secondes.
  assert.ok(low.ms > 2400 && low.ms < 2600, `≈ 2,5 s, reçu ${low.ms}`);
  // Vue lointaine : le départ est la distance actuelle.
  assert.equal(flightPlan(5000, goal).from, 5000, 'vue lointaine : départ de la distance actuelle');
  // Très grand écart : durée maximale.
  assert.equal(flightPlan(5000, goal).ms, FLIGHT_MAX_MS);
  // Petit écart : durée minimale.
  assert.equal(flightPlan(3, 2).ms, FLIGHT_MIN_MS);
  // But au sol : pas de plan.
  assert.equal(flightPlan(2, 1), null, 'but au sol ou dessous');
  // But plus haut que le départ : pas de plan.
  assert.equal(flightPlan(2, 3), null, 'but plus haut que le départ');
  // Distance illisible : pas de plan.
  assert.equal(flightPlan(NaN, goal), null);
// Fin du test.
});

// Test : la descente.
test('zoom d’arrivée : descente continue, douce aux deux bouts, altitude en échelle logarithmique', () => {
  // Un plan d'essai.
  const plan = flightPlan(2.6, 1.0001);
  // Au départ : la distance de départ.
  assert.equal(flightDistance(plan, 0), 2.6);
  // À la fin : le but.
  assert.equal(flightDistance(plan, plan.ms), 1.0001);
  // Après la fin : toujours le but.
  assert.equal(flightDistance(plan, plan.ms * 3), 1.0001);
  // Distance précédente.
  let prev = Infinity;
  // Quarante et un instants régulièrement répartis.
  for (let i = 0; i <= 40; i++) {
    // La distance à cet instant.
    const d = flightDistance(plan, (plan.ms * i) / 40);
    // Elle ne remonte jamais et ne passe pas sous le but.
    assert.ok(d <= prev && d >= 1.0001);
    // Mémorise la distance.
    prev = d;
  // Fin du parcours.
  }
  // À mi-parcours : la moyenne géométrique des altitudes (≈ 80 km), pas la moyenne arithmétique (≈ 5 000 km).
  // Altitude à mi-parcours.
  const mid = flightDistance(plan, plan.ms / 2) - 1;
  // C'est la moyenne géométrique des altitudes de départ et d'arrivée.
  assert.ok(Math.abs(mid - Math.sqrt(1.6 * 0.0001)) < 1e-9);
  // Départ en douceur : au premier dixième du temps, l'altitude a peu changé.
  // Au premier dixième du temps, la caméra a encore peu bougé.
  assert.ok(flightDistance(plan, plan.ms * 0.1) > 2.5);
// Fin du test.
});
