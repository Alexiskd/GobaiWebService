// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { CLOSE_DISTANCE, CLOSE_VELOCITY, FLICK_MIN, dragOffset, dragVelocity, shouldClose } from './sheetGesture';

// Premier test : le décalage de la feuille.
test('la feuille suit le doigt vers le bas et résiste vers le haut', () => {
  // Sans déplacement : 0.
  assert.equal(dragOffset(0), 0);
  // 120 pixels vers le bas : 120.
  assert.equal(dragOffset(120), 120);
  // 40 pixels vers le haut : 10.
  assert.equal(dragOffset(-40), -10);
  // Très haut : 24 au plus.
  assert.equal(dragOffset(-4000), -24); // jamais plus de 24 px au-dessus de sa place
  // Valeur non finie : 0.
  assert.equal(dragOffset(NaN), 0);
// Fin du test.
});

// Deuxième test : la vitesse.
test('vitesse du doigt en px/ms', () => {
  // 60 pixels en 100 ms vers le bas : 0,6.
  assert.equal(dragVelocity(100, 1000, 160, 1100), 0.6);
  // Vers le haut : −0,6.
  assert.equal(dragVelocity(100, 1000, 40, 1100), -0.6);
  // Même instant : 0.
  assert.equal(dragVelocity(100, 1000, 160, 1000), 0); // même instant : pas de mesure
  // Instants inversés : 0.
  assert.equal(dragVelocity(100, 1000, 160, 900), 0);
// Fin du test.
});

// Troisième test : la fermeture.
test('fermeture : tirage long ou balayage rapide vers le bas', () => {
  // À la distance de fermeture : oui.
  assert.equal(shouldClose(CLOSE_DISTANCE), true);
  // Un pixel de moins : non.
  assert.equal(shouldClose(CLOSE_DISTANCE - 1), false);
  // Balayage au seuil de tirage et de vitesse : oui.
  assert.equal(shouldClose(FLICK_MIN, CLOSE_VELOCITY), true);
  // Tirage trop court : non.
  assert.equal(shouldClose(FLICK_MIN - 1, 5), false); // simple appui, même brusque
  // Vitesse un peu trop faible : non.
  assert.equal(shouldClose(40, CLOSE_VELOCITY - 0.01), false);
  // Vers le haut : non.
  assert.equal(shouldClose(-200, -3), false); // tirée vers le haut : elle reste ouverte
  // Valeur non finie : non.
  assert.equal(shouldClose(NaN, 1), false);
// Fin du test.
});
