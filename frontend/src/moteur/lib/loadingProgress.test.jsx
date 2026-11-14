// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { STEP_RANGE, VIDEO_MAX_RATE, advanceProgress, finishRate, videoRate } from './loadingProgress';

// Fonction run : fait avancer la barre pendant un nombre de secondes, à 60 images par seconde.
const run = (p, step, seconds, rate) => {
  // Une avancée par image.
  for (let t = 0; t < seconds * 60; t++) p = advanceProgress(p, step, 1 / 60, rate);
  // Renvoie la valeur finale.
  return p;
// Fin de run.
};

// Premier test : la barre ne recule pas et reste dans sa tranche.
test('chargement : la barre ne recule jamais et ne dépasse pas la tranche de l’étape', () => {
  // Barre à zéro.
  let p = 0;
  // 6 000 images :
  for (let i = 0; i < 6000; i++) {
    // une avancée ;
    const next = advanceProgress(p, 'api', 1 / 60);
    // jamais en arrière ;
    assert.ok(next >= p);
    // garde la valeur.
    p = next;
  // Fin de la boucle.
  }
  // Elle ne dépasse pas la fin de la tranche.
  assert.ok(p <= STEP_RANGE.api[1]);
  // Elle s'en approche à moins de 1 %.
  assert.ok(p > STEP_RANGE.api[1] - 0.01);
// Fin du test.
});

// Deuxième test : le rattrapage.
test('chargement : une étape finie tôt fait rattraper le début de la tranche suivante', () => {
  // Deux secondes dans l'étape du moteur, en partant de 5 %.
  const p = run(0.05, 'engine', 2);
  // Au-delà du début de la tranche.
  assert.ok(p > STEP_RANGE.engine[0]);
  // En deçà de sa fin.
  assert.ok(p < STEP_RANGE.engine[1]);
// Fin du test.
});

// Troisième test : la fin et l'erreur.
test('chargement : l’étape finale mène à 1 exactement, une erreur fige la barre', () => {
  // L'étape finale mène à 1.
  assert.equal(run(0.9, 'done', 2, finishRate(0.9)), 1);
  // Une erreur fige la barre.
  assert.equal(advanceProgress(0.3, 'error', 5), 0.3);
// Fin du test.
});

// Quatrième test : la durée de la fin.
test('chargement : une fois l’app prête, la barre finit en un temps fixe, où qu’elle en soit', () => {
  // Quelle que soit la valeur, la fin prend 1,5 s.
  for (const p of [0.1, 0.5, 0.92]) assert.ok(Math.abs((1 - p) / finishRate(p) - 1.5) < 1e-9);
// Fin du test.
});

// Cinquième test : la vitesse de la vidéo.
test('chargement : la vidéo attend quand elle est à jour et accélère avec son retard', () => {
  // À jour : pause.
  assert.equal(videoRate(0), 0);
  // En avance : pause.
  assert.equal(videoRate(-1), 0);
  // Une demi-seconde de retard : vitesse 2.
  assert.equal(videoRate(0.5), 2);
  // Bornée par le maximum demandé.
  assert.equal(videoRate(100, 4), 4);
  // Bornée par le maximum par défaut.
  assert.equal(videoRate(100), VIDEO_MAX_RATE);
  // Un petit retard au-delà du seuil : la vidéo avance.
  assert.ok(videoRate(0.05) > 0);
// Fin du test.
});
