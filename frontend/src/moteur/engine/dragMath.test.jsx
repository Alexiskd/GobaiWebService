// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la marge et la fonction testée.
import { DRAG_EDGE, clampPanelPosition } from './dragMath';

// Fenêtre d'essai.
const viewport = { width: 1280, height: 720 };
// Panneau d'essai.
const size = { width: 300, height: 400 };

// Test : une position visible.
test('panneau mobile : une position déjà visible ne bouge pas', () => {
  // Elle reste inchangée.
  assert.deepEqual(clampPanelPosition({ x: 200, y: 120 }, size, viewport), { x: 200, y: 120 });
// Fin du test.
});

// Test : une position hors de l'écran.
test('panneau mobile : une position sortie de l’écran est ramenée dans la fenêtre', () => {
  // Trop à gauche et trop bas (début) :
  assert.deepEqual(clampPanelPosition({ x: -50, y: 900 }, size, viewport), {
    // Ramenée à la marge de gauche.
    x: DRAG_EDGE,
    // Ramenée au bas de la fenêtre, marge comprise.
    y: viewport.height - size.height - DRAG_EDGE,
  // Fin de la vérification.
  });
  // Trop à droite et trop haut (début) :
  assert.deepEqual(clampPanelPosition({ x: 2000, y: -20 }, size, viewport), {
    // Ramenée à droite de la fenêtre, marge comprise.
    x: viewport.width - size.width - DRAG_EDGE,
    // Ramenée à la marge du haut.
    y: DRAG_EDGE,
  // Fin de la vérification.
  });
// Fin du test.
});

// Test : un panneau plus grand que la fenêtre.
test('panneau mobile : plus grand que la fenêtre, il reste collé au bord', () => {
  // Il est ramené (début) :
  assert.deepEqual(clampPanelPosition({ x: 100, y: 100 }, { width: 2000, height: 1200 }, viewport), {
    // À la marge de gauche.
    x: DRAG_EDGE,
    // À la marge du haut.
    y: DRAG_EDGE,
  // Fin de la vérification.
  });
// Fin du test.
});

// Test : des coordonnées absentes.
test('panneau mobile : des coordonnées absentes retombent sur la marge', () => {
  // Elles donnent la marge sur les deux axes.
  assert.deepEqual(clampPanelPosition({}, size, viewport), { x: DRAG_EDGE, y: DRAG_EDGE });
// Fin du test.
});
