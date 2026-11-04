import test from 'node:test';
import assert from 'node:assert/strict';
import { DRAG_EDGE, clampPanelPosition } from './dragMath.js';

const viewport = { width: 1280, height: 720 };
const size = { width: 300, height: 400 };

test('panneau mobile : une position déjà visible ne bouge pas', () => {
  assert.deepEqual(clampPanelPosition({ x: 200, y: 120 }, size, viewport), { x: 200, y: 120 });
});

test('panneau mobile : une position sortie de l’écran est ramenée dans la fenêtre', () => {
  assert.deepEqual(clampPanelPosition({ x: -50, y: 900 }, size, viewport), {
    x: DRAG_EDGE,
    y: viewport.height - size.height - DRAG_EDGE,
  });
  assert.deepEqual(clampPanelPosition({ x: 2000, y: -20 }, size, viewport), {
    x: viewport.width - size.width - DRAG_EDGE,
    y: DRAG_EDGE,
  });
});

test('panneau mobile : plus grand que la fenêtre, il reste collé au bord', () => {
  assert.deepEqual(clampPanelPosition({ x: 100, y: 100 }, { width: 2000, height: 1200 }, viewport), {
    x: DRAG_EDGE,
    y: DRAG_EDGE,
  });
});

test('panneau mobile : des coordonnées absentes retombent sur la marge', () => {
  assert.deepEqual(clampPanelPosition({}, size, viewport), { x: DRAG_EDGE, y: DRAG_EDGE });
});
