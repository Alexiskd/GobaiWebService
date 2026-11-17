// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les quatre fonctions testées.
import { DRAG_MAX_RAD_PER_PX, PINCH_MAX, PINCH_MIN, dragRadPerPx, dragStep, pinchFactor, stalePointers } from './touchMath';

// Rayon de la Terre, en mètres.
const EARTH_M = 6_371_000;

// Test : l'angle par pixel du glisser.
test('glisser : le sol reste sous le doigt près du sol, vitesse bornée de loin', () => {
  // À 1 km d'altitude, écran de 800 px, champ de 45° : l'écran couvre ≈ 828 m de haut, soit ≈ 1,04 m par pixel.
  // À 1 km d'altitude, champ de 45°, écran de 800 px.
  const perPx = dragRadPerPx(1000 / EARTH_M, 45, 800);
  // Un pixel couvre environ 1,04 mètre.
  assert.ok(Math.abs(perPx * EARTH_M - 1.0355) < 0.001, `mètres par pixel : ${perPx * EARTH_M}`);
  // Deux fois plus haut : deux fois plus de sol par pixel.
  // Deux fois plus haut : deux fois plus par pixel.
  assert.ok(Math.abs(dragRadPerPx(2000 / EARTH_M, 45, 800) / perPx - 2) < 1e-9);
  // De très loin (astre petit à l'écran), la vitesse est bornée : l'astre ne s'emballe pas.
  // De très loin : la vitesse maximale.
  assert.equal(dragRadPerPx(100, 45, 800), DRAG_MAX_RAD_PER_PX);
  // Globe entier à l'écran : encore sous la vitesse maximale.
  assert.ok(dragRadPerPx(2.4, 45, 800) < DRAG_MAX_RAD_PER_PX, 'globe entier à l’écran : encore exact');
  // Écran de hauteur nulle : 0.
  assert.equal(dragRadPerPx(0.001, 45, 0), 0);
  // Au ras du sol : jamais nul.
  assert.ok(dragRadPerPx(0, 45, 800) > 0, 'jamais nul au ras du sol');
// Fin du test.
});

// Test : le déplacement de la caméra.
test('glisser : la caméra part à l’opposé du doigt, et plus loin vers le haut en vue inclinée', () => {
  // Vue à plat.
  const flat = dragStep(10, 20, 0.001);
  // À l'opposé du doigt horizontalement, proportionnel verticalement.
  assert.ok(Math.abs(flat.right + 0.01) < 1e-12 && Math.abs(flat.forward - 0.02) < 1e-12);
  // Vue inclinée de 60°.
  const tilted = dragStep(10, 20, 0.001, Math.PI / 3); // 60° : le sol est vu deux fois plus court
  // Même déplacement horizontal.
  assert.ok(Math.abs(tilted.right + 0.01) < 1e-12);
  // Déplacement vertical doublé.
  assert.ok(Math.abs(tilted.forward - 0.04) < 1e-9);
  // Près de l'horizon : borné.
  assert.ok(dragStep(0, 20, 0.001, 1.5).forward <= 0.02 / 0.35 + 1e-12, 'borné près de l’horizon');
// Fin du test.
});

// Test : le pincement.
test('pincement : l’altitude suit l’écartement, sans saut', () => {
  // Doigts écartés de 10 % : la caméra se rapproche d'autant.
  assert.ok(Math.abs(pinchFactor(100, 110) - 100 / 110) < 1e-12);
  // Doigts resserrés : la caméra s'éloigne.
  assert.ok(Math.abs(pinchFactor(110, 100) - 1.1) < 1e-12);
  // Très grand écartement : facteur minimal.
  assert.equal(pinchFactor(100, 400), PINCH_MIN);
  // Très grand resserrement : facteur maximal.
  assert.equal(pinchFactor(400, 100), PINCH_MAX);
  // Écartement précédent nul : sans effet.
  assert.equal(pinchFactor(0, 100), 1);
  // Nouvel écartement nul : sans effet.
  assert.equal(pinchFactor(100, 0), 1);
// Fin du test.
});

// Test : les doigts fantômes.
test('doigts fantômes : oubliés quand un nouveau premier doigt arrive', () => {
  // Trois pointeurs en mémoire : deux doigts et une souris.
  const pointers = { 7: { type: 'touch' }, 8: { type: 'touch' }, 1: { type: 'mouse' } };
  // Nouveau premier doigt : les deux anciens doigts sont oubliés.
  assert.deepEqual(stalePointers(pointers, { pointerId: 9, pointerType: 'touch', isPrimary: true }), ['7', '8']);
  // Second doigt d'un pincement : rien n'est oublié.
  assert.deepEqual(stalePointers(pointers, { pointerId: 9, pointerType: 'touch', isPrimary: false }), [], 'second doigt d’un pincement');
  // Le premier doigt lui-même n'est pas oublié.
  assert.deepEqual(stalePointers(pointers, { pointerId: 7, pointerType: 'touch', isPrimary: true }), ['8']);
  // Aucun pointeur en mémoire : rien à oublier.
  assert.deepEqual(stalePointers({}, { pointerId: 1, pointerType: 'mouse', isPrimary: true }), []);
// Fin du test.
});
