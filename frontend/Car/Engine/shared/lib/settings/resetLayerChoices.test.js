// Tests de la remise à zéro des anciens choix de calques.
import test from 'node:test';
import assert from 'node:assert/strict';
import { OLD_LAYER_KEYS, RESET_KEY, resetLayerChoices } from './resetLayerChoices.js';

// Faux stockage en mémoire.
const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };

test('anciens choix effacés une seule fois', () => {
  const s = memory({ 'gobai:relief-3d': '0', 'gobai:rues': '1', 'autre': 'x' });
  assert.equal(resetLayerChoices(s), true);
  assert.ok(OLD_LAYER_KEYS.every((k) => s.getItem(k) === null));
  assert.equal(s.getItem('autre'), 'x'); assert.equal(s.getItem(RESET_KEY), '1');
  // Deuxième fois : rien.
  s.setItem('gobai:relief-3d', '0');
  assert.equal(resetLayerChoices(s), false); assert.equal(s.getItem('gobai:relief-3d'), '0');
  // Sans stockage : rien.
  assert.equal(resetLayerChoices(null), false);
});
