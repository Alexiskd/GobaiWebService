import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBackdropMeshScale } from './backdropMeshScale.js';

function meshScale(x, y, z) {
  return { scale: { x, y, z, multiplyScalar(k) { this.x *= k; this.y *= k; this.z *= k; } } };
}

test('le fond ajuste le mesh sans modifier sa géométrie partagée', () => {
  const mesh = meshScale(100, 90, 100);
  assert.equal(applyBackdropMeshScale(mesh, 0.9, 1), true);
  assert.deepEqual([mesh.scale.x, mesh.scale.y, mesh.scale.z], [90, 81, 90]);
  assert.equal(applyBackdropMeshScale(mesh, 1, 0.9), true);
  assert.ok(Math.abs(mesh.scale.x - 100) < 1e-10);
  assert.ok(Math.abs(mesh.scale.y - 90) < 1e-10, 'l’aplatissement initial reste conservé');
});

test('un facteur inchangé ne touche pas au mesh et les valeurs invalides sont refusées', () => {
  const mesh = meshScale(1, 1, 1);
  assert.equal(applyBackdropMeshScale(mesh, 1, 1), false);
  assert.deepEqual([mesh.scale.x, mesh.scale.y, mesh.scale.z], [1, 1, 1]);
  assert.throws(() => applyBackdropMeshScale(mesh, 0, 1), RangeError);
  assert.throws(() => applyBackdropMeshScale({}, 1, 1), TypeError);
});
