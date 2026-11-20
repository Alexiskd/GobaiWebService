import test from 'node:test';
import assert from 'node:assert/strict';
import { TileMemoryPolicy } from './TileMemoryPolicy.js';
import { LOAD_STATE } from '../PerivolumeEngine/PerivolumeManager.js';

test('profil actif restaure les capacités nominales', () => {
  const policy = new TileMemoryPolicy();
  assert.deepEqual(policy.profile(LOAD_STATE.ACTIVE, { gpuBase: 260, ramBase: 400, wantedCount: 20 }), { gpuCapacity: 260, ramCapacity: 400, preserveWanted: true });
});
test('profil arrière-plan réduit les caches sans passer sous le budget de la vue', () => {
  const policy = new TileMemoryPolicy();
  const profile = policy.profile(LOAD_STATE.BACKGROUND, { gpuBase: 260, ramBase: 400, wantedCount: 100 });
  assert.equal(profile.gpuCapacity, 130); assert.equal(profile.ramCapacity, 100); assert.equal(profile.preserveWanted, true);
});
test('profil déchargé ne conserve que le budget de la vue et aucune RAM', () => {
  const policy = new TileMemoryPolicy();
  assert.deepEqual(policy.profile(LOAD_STATE.UNLOADED, { gpuBase: 260, ramBase: 400, wantedCount: 12 }), { gpuCapacity: 12, ramCapacity: 0, preserveWanted: true });
});
test('capacités invalides sont rejetées', () => {
  assert.throws(() => new TileMemoryPolicy({ backgroundGpuRatio: 2 }), RangeError);
  assert.throws(() => new TileMemoryPolicy({ minGpu: 0 }), RangeError);
});
