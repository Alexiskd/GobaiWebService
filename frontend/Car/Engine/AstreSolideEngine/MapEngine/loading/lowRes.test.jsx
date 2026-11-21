// Tests de la basse résolution d'abord : premiers niveaux de l'astre entier et ancêtres des tuiles voulues.
import test from 'node:test';
import assert from 'node:assert/strict';
import { COARSE_PRIORITY, LOW_RES_PRIORITY, coarsePriority, isCoarseLevel, lowResTiles } from './lowRes.jsx';

test('les premiers niveaux de l\'astre partent du niveau minimal de la carte', () => {
  assert.equal(isCoarseLevel(0), true);
  assert.equal(isCoarseLevel(1), true);
  assert.equal(isCoarseLevel(2), false);
  assert.equal(isCoarseLevel(3, 2), true);
  assert.equal(isCoarseLevel(4, 2), false);
});

test('les premiers niveaux passent avant la basse résolution, elle-même avant les tuiles visibles', () => {
  assert.ok(coarsePriority(0) < coarsePriority(1));
  assert.ok(coarsePriority(22) < LOW_RES_PRIORITY);
  assert.equal(coarsePriority(0), COARSE_PRIORITY);
  const [low] = lowResTiles([{ z: 12, x: 2048, y: 1362 }]);
  assert.ok(low.p < 0 && low.p >= LOW_RES_PRIORITY);
});

test('chaque tuile voulue demande son ancêtre trois niveaux plus haut, une seule fois', () => {
  const wanted = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) wanted.push({ z: 10, x: 512 + x, y: 256 + y });
  wanted.push({ z: 10, x: 520, y: 256 });
  const low = lowResTiles(wanted);
  assert.deepEqual(low.map((t) => t.key), ['7/64/32', '7/65/32']);
  assert.deepEqual({ z: low[0].z, x: low[0].x, y: low[0].y }, { z: 7, x: 64, y: 32 });
});

test('les niveaux grossiers passent d\'abord, puis l\'ordre d\'utilité', () => {
  const low = lowResTiles([{ z: 12, x: 0, y: 0 }, { z: 9, x: 0, y: 0 }, { z: 12, x: 4000, y: 4000 }]);
  assert.deepEqual(low.map((t) => t.key), ['6/0/0', '9/0/0', '9/500/500']);
});

test('rien sous le niveau plancher, ni pour une tuile déjà affichable', () => {
  assert.deepEqual(lowResTiles([{ z: 5, x: 3, y: 3 }], { floor: 3 }), []);
  assert.equal(lowResTiles([{ z: 6, x: 8, y: 8 }], { floor: 3 }).length, 1);
  assert.deepEqual(lowResTiles([{ z: 2, x: 1, y: 1 }]), []);
  assert.deepEqual(lowResTiles([{ z: 10, x: 8, y: 8, key: '10/8/8' }], { covered: (k) => k === '10/8/8' }), []);
  assert.deepEqual(lowResTiles([{ z: 10, x: 8, y: 8 }], { covered: (k) => k === '7/1/1' }), []);
});
