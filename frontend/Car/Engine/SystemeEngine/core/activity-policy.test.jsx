import test from 'node:test';
import assert from 'node:assert/strict';
import { CoreActivityPolicy } from './CoreActivityPolicy.js';
import { LOAD_STATE } from '../PerivolumeEngine/PerivolumeManager.js';

test('CoreActivityPolicy: actif mis à jour à chaque image', () => {
  const policy = new CoreActivityPolicy({ backgroundEvery: 4 });
  for (let i = 0; i < 8; i += 1) {
    policy.beginFrame();
    assert.equal(policy.shouldUpdateTiles({ state: LOAD_STATE.ACTIVE }), true);
  }
});

test('CoreActivityPolicy: arrière-plan mis à jour selon une cadence bornée', () => {
  const policy = new CoreActivityPolicy({ backgroundEvery: 4 });
  const frames = [];
  for (let i = 1; i <= 8; i += 1) {
    policy.beginFrame();
    if (policy.shouldUpdateTiles({ state: LOAD_STATE.BACKGROUND })) frames.push(i);
  }
  assert.deepEqual(frames, [4, 8]);
});

test('CoreActivityPolicy: déchargé suspend les mises à jour, focus prioritaire', () => {
  const policy = new CoreActivityPolicy();
  policy.beginFrame();
  assert.equal(policy.shouldUpdateTiles({ state: LOAD_STATE.UNLOADED }), false);
  assert.equal(policy.shouldUpdateTiles({ state: LOAD_STATE.UNLOADED, focused: true }), true);
});

test('CoreActivityPolicy: cadence invalide rejetée', () => {
  assert.throws(() => new CoreActivityPolicy({ backgroundEvery: 0 }), RangeError);
});
