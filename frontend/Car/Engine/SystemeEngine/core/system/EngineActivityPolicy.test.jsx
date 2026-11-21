import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineActivityPolicy } from './EngineActivityPolicy.js';
import { LOAD_STATE } from '../../PerivolumeEngine/PerivolumeManager.js';

test('moteur actif et moteur ciblé mis à jour à chaque image', () => {
  const policy = new EngineActivityPolicy();
  policy.beginFrame();
  assert.equal(policy.shouldUpdate('lidar', { state: LOAD_STATE.ACTIVE }), true);
  assert.equal(policy.shouldUpdate('lidar', { state: LOAD_STATE.UNLOADED, focused: true }), true);
});

test('moteur en arrière-plan suit sa cadence propre', () => {
  const policy = new EngineActivityPolicy();
  assert.equal(policy.getCadence('lidar'), 3);
  assert.equal(policy.getCadence('atmosphere'), 4);
  assert.equal(policy.shouldUpdate('lidar', { state: LOAD_STATE.BACKGROUND }), false);
  policy.beginFrame(); policy.beginFrame(); policy.beginFrame();
  assert.equal(policy.shouldUpdate('lidar', { state: LOAD_STATE.BACKGROUND }), true);
});

test('moteur déchargé est suspendu sans détruire ses ressources', () => {
  const policy = new EngineActivityPolicy();
  for (let i = 0; i < 10; i += 1) policy.beginFrame();
  assert.equal(policy.shouldUpdate('atmosphere', { state: LOAD_STATE.UNLOADED }), false);
});

test('profils invalides et moteurs inconnus sont refusés', () => {
  assert.throws(() => new EngineActivityPolicy({ profiles: { lidar: { backgroundEvery: 0 } } }), RangeError);
  assert.throws(() => new EngineActivityPolicy().shouldUpdate('unknown', { state: LOAD_STATE.BACKGROUND }), RangeError);
});
