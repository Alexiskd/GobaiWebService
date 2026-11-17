// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les deux fonctions testées.
import { RING_INNER, RING_OUTER, TAU_MAX, buildRingProfile, ringTau } from './saturnRingsMath';

// Rayon de Saturne, en kilomètres.
const R_KM = 60268;
// at : épaisseur optique des anneaux à une distance donnée en kilomètres.
const at = (km) => ringTau(km / R_KM);
// mean : épaisseur optique moyenne entre deux distances (début).
const mean = (from, to) => {
  // Somme.
  let sum = 0;
  // Nombre de mesures.
  let n = 0;
  // Une mesure tous les 50 km.
  for (let km = from; km < to; km += 50) { sum += at(km); n++; }
  // Renvoie la moyenne.
  return sum / n;
// Fin de mean.
};

// Test : les limites des anneaux.
test('anneaux de Saturne : rien entre la planète et l’anneau D, ni au-delà de l’anneau F', () => {
  // Rien à 62 000 km.
  assert.equal(at(62000), 0);
  // Rien à 145 000 km.
  assert.equal(at(145000), 0);
  // Les limites sont entre 1 et 2,4 rayons.
  assert.ok(RING_INNER > 1 && RING_OUTER < 2.4);
// Fin du test.
});

// Test : la densité des anneaux.
test('anneaux de Saturne : B est le plus dense, puis A, puis C ; la division de Cassini est ténue mais pas vide', () => {
  // Moyenne de l'anneau C.
  const c = mean(76000, 91000);
  // Moyenne de l'anneau B.
  const b = mean(93000, 117000);
  // Moyenne de la division de Cassini.
  const cassini = mean(118200, 122000);
  // Moyenne de l'anneau A.
  const a = mean(123000, 133000);
  // B est plus dense que A, lui-même plus dense que C.
  assert.ok(b > a && a > c, `${b} ${a} ${c}`);
  // La division de Cassini n'est pas vide, mais bien moins dense que A.
  assert.ok(cassini > 0 && cassini < a / 3, String(cassini));
// Fin du test.
});

// Test : les lacunes.
test('anneaux de Saturne : les lacunes d’Encke, de Keeler et de Huygens sont vides', () => {
  // La lacune d'Encke est vide.
  assert.equal(at(133589), 0);
  // La lacune de Keeler est vide.
  assert.equal(at(136505), 0);
  // La lacune de Huygens est vide.
  assert.equal(at(117680), 0);
  // À côté de la lacune d'Encke, l'anneau est dense.
  assert.ok(at(133000) > 0.3);
// Fin du test.
});

// Test : le profil du shader.
test('anneaux de Saturne : le profil du shader couvre tout le disque et garde la trace d’Encke', () => {
  // Nombre de points du profil.
  const n = 2048;
  // Le profil.
  const data = buildRingProfile(n);
  // Quatre valeurs par point.
  assert.equal(data.length, n * 4);
  // texel : rang du point pour une distance en kilomètres.
  const texel = (km) => Math.floor(((km / R_KM - RING_INNER) / (RING_OUTER - RING_INNER)) * n);
  // tau : épaisseur optique relue dans le profil.
  const tau = (i) => TAU_MAX * (data[i * 4 + 3] / 255) ** 2;
  // L'anneau B est épais.
  assert.ok(tau(texel(110000)) > 2);
  // La lacune d'Encke reste visible.
  assert.ok(tau(texel(133589)) < tau(texel(131000)) / 3);
  // L'anneau D est presque invisible.
  assert.ok(tau(texel(70000)) < 0.05); // anneau D : presque invisible
// Fin du test.
});
