import test from 'node:test';
import assert from 'node:assert/strict';
import { SystemManager } from './SystemManager.js';
import { PerivolumeManager } from './PerivolumeManager.js';
import { SystemRegistry } from './SystemRegistry.js';

test('unregister retire aussi l’état effectif mémorisé d’un système', () => {
  const registry = new SystemRegistry();
  const perivolumes = new PerivolumeManager({ hysteresis: 0 });
  registry.register({ id: 'system:external:test', name: 'Test', kind: 'system' });
  perivolumes.register({ id: 'system:external:test', center: [0, 0, 0], radius: 10 });
  const manager = new SystemManager({ registry, perivolumeManager: perivolumes });
  manager.update([0, 0, 0]);
  assert.equal(manager.getLoadProfile('system:external:test').state, 'ACTIVE');
  manager.unregister('system:external:test');
  perivolumes.unregister('system:external:test');
  assert.equal(manager.getLoadProfile('system:external:test').state, 'UNLOADED');
});
