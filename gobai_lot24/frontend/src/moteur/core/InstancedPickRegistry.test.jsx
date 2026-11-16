import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedPickRegistry } from './InstancedPickRegistry.js';

const makeBatch = (ids = []) => ({ mesh: {}, ids: [...ids], disposed: false });

test('résout instanceId vers un identifiant métier stable', () => {
  const registry = new InstancedPickRegistry();
  const batch = makeBatch(['io', 'europa']);
  registry.register(batch);
  assert.equal(registry.resolve({ object: batch.mesh, instanceId: 1 }), 'europa');
});

test('suit les changements d’index après compactage du batch', () => {
  const registry = new InstancedPickRegistry();
  const batch = makeBatch(['io', 'europa', 'ganymede']);
  registry.register(batch);
  batch.ids[1] = 'ganymede';
  batch.ids.pop();
  assert.equal(registry.resolve({ object: batch.mesh, instanceId: 1 }), 'ganymede');
  assert.equal(registry.resolve({ object: batch.mesh, instanceId: 2 }), null);
});

test('ignore les intersections sans instanceId ou hors batch', () => {
  const registry = new InstancedPickRegistry();
  const batch = makeBatch(['io']);
  registry.register(batch);
  assert.equal(registry.resolve({ object: batch.mesh }), null);
  assert.equal(registry.resolve({ object: {}, instanceId: 0 }), null);
  assert.equal(registry.resolve({ object: batch.mesh, instanceId: 4 }), null);
});

test('désenregistre proprement un batch', () => {
  const registry = new InstancedPickRegistry();
  const batch = makeBatch(['io']);
  const unregister = registry.register(batch);
  assert.equal(registry.getObjects().length, 1);
  assert.equal(unregister(), true);
  assert.equal(unregister(), false);
  assert.equal(registry.resolve({ object: batch.mesh, instanceId: 0 }), null);
});

test('refuse les batches invalides et les enregistrements en double', () => {
  const registry = new InstancedPickRegistry();
  assert.throws(() => registry.register({}), /valide/);
  const batch = makeBatch(['io']);
  registry.register(batch);
  assert.throws(() => registry.register(batch), /déjà enregistré/);
});
