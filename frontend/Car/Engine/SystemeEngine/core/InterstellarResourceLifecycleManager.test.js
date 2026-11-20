import test from 'node:test';
import assert from 'node:assert/strict';
import { InterstellarResourceLifecycleManager } from './InterstellarResourceLifecycleManager.js';

test('UNLOADED annule les tâches et libère les ressources une seule fois', () => {
  let released = 0; let restored = 0; let aborted = 0;
  const manager = new InterstellarResourceLifecycleManager();
  manager.register('system:test', { release: () => released++, restore: () => restored++, abortController: { abort: () => aborted++ } });
  assert.equal(manager.update('system:test', 'UNLOADED'), true);
  assert.equal(manager.update('system:test', 'UNLOADED'), false);
  assert.deepEqual([released, restored, aborted], [1, 0, 1]);
  assert.deepEqual(manager.getStats(), { systems: 1, loaded: 0, unloaded: 1 });
});

test('ACTIVE et BACKGROUND restaurent les ressources après UNLOADED', () => {
  let released = 0; let restored = 0;
  const manager = new InterstellarResourceLifecycleManager();
  manager.register('system:test', { release: () => released++, restore: () => restored++ });
  manager.update('system:test', 'UNLOADED');
  manager.update('system:test', 'BACKGROUND');
  manager.update('system:test', 'UNLOADED');
  manager.update('system:test', 'ACTIVE');
  assert.deepEqual([released, restored], [2, 2]);
});

test('unregister libère et retire une ressource', () => {
  let released = 0; let aborted = 0;
  const manager = new InterstellarResourceLifecycleManager();
  manager.register('system:test', { release: () => released++, abortController: { abort: () => aborted++ } });
  assert.equal(manager.unregister('system:test'), true);
  assert.equal(manager.getState('system:test'), null);
  assert.deepEqual([released, aborted], [1, 1]);
});

test('rejette les transitions vers un état inconnu', () => {
  const manager = new InterstellarResourceLifecycleManager();
  manager.register('system:test');
  assert.throws(() => manager.update('system:test', 'SUSPENDED'), /État de chargement inconnu/);
});
