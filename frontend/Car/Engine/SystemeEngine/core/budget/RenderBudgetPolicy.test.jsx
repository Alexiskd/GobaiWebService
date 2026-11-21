import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderBudgetPolicy } from './RenderBudgetPolicy.js';

test('réduit le budget après plusieurs échantillons trop lents', () => {
  const policy = new RenderBudgetPolicy({ downgradeSamples: 2 });
  assert.equal(policy.update({ cpuMs: 30 }).maxTiledBodies, 3);
  assert.equal(policy.update({ cpuMs: 30 }).maxTiledBodies, 2);
  assert.equal(policy.update({ cpuMs: 30 }).maxTiledBodies, 2);
  assert.equal(policy.update({ cpuMs: 30 }).maxTiledBodies, 1);
});

test('remonte progressivement après une période de marge', () => {
  const policy = new RenderBudgetPolicy({ downgradeSamples: 1, upgradeSamples: 2 });
  policy.update({ cpuMs: 30 });
  assert.equal(policy.snapshot().maxTiledBodies, 2);
  policy.update({ cpuMs: 8 });
  assert.equal(policy.snapshot().maxTiledBodies, 2);
  policy.update({ cpuMs: 8 });
  assert.equal(policy.snapshot().maxTiledBodies, 3);
});

test('prend en compte la mesure GPU quand elle est disponible', () => {
  const policy = new RenderBudgetPolicy({ downgradeSamples: 1 });
  assert.equal(policy.update({ cpuMs: 8, gpuMs: 28 }).maxTiledBodies, 2);
});

test('ignore les mesures absentes et respecte les bornes', () => {
  const policy = new RenderBudgetPolicy({ downgradeSamples: 1 });
  assert.equal(policy.update({}).maxTiledBodies, 3);
  policy.update({ cpuMs: 100 });
  policy.update({ cpuMs: 100 });
  policy.update({ cpuMs: 100 });
  assert.equal(policy.snapshot().maxTiledBodies, 1);
  assert.throws(() => new RenderBudgetPolicy({ minTiledBodies: 4 }), RangeError);
});
