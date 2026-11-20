import test from 'node:test';
import assert from 'node:assert/strict';
import { SystemRegistry } from './SystemRegistry.js';
import { PerivolumeManager, LOAD_STATE } from '../PerivolumeEngine/PerivolumeManager.js';
import { SystemManager } from './SystemManager.js';
import { ResourceManager } from './ResourceManager.js';

test('SystemRegistry enregistre, met à jour et supprime un système', () => {
  const registry = new SystemRegistry();
  registry.register({ id: 'earth', name: 'Earth' });
  assert.equal(registry.get('earth').name, 'Earth');
  registry.upsert({ id: 'earth', radiusKm: 6371 });
  assert.equal(registry.get('earth').radiusKm, 6371);
  assert.throws(() => registry.register({ id: 'earth' }), /déjà enregistré/);
  assert.equal(registry.remove('earth'), true);
});

test('PerivolumeManager applique ACTIVE, BACKGROUND, UNLOADED et hystérésis', () => {
  const manager = new PerivolumeManager({ hysteresis: 0.1 });
  manager.register({ id: 'earth', center: [0, 0, 0], radius: 10, backgroundRadius: 30 });
  assert.equal(manager.evaluate([5, 0, 0])[0].state, LOAD_STATE.ACTIVE);
  assert.equal(manager.evaluate([10.5, 0, 0])[0].state, LOAD_STATE.ACTIVE);
  assert.equal(manager.evaluate([20, 0, 0])[0].state, LOAD_STATE.BACKGROUND);
  assert.equal(manager.evaluate([40, 0, 0])[0].state, LOAD_STATE.UNLOADED);
});

test('SystemManager notifie uniquement les transitions et expose un profil de chargement', () => {
  const registry = new SystemRegistry();
  registry.register({ id: 'mars', name: 'Mars' });
  const volumes = new PerivolumeManager();
  volumes.register({ id: 'mars', radius: 5, backgroundRadius: 15 });
  const transitions = [];
  const manager = new SystemManager({ registry, perivolumeManager: volumes, onTransition: (event) => transitions.push(event) });
  manager.update([0, 0, 0]);
  manager.update([1, 0, 0]);
  assert.equal(transitions.length, 1);
  assert.equal(manager.getLoadProfile('mars').priority, 100);
  manager.update([100, 0, 0]);
  assert.equal(manager.getLoadProfile('mars').render, false);
});

test('ResourceManager libère une ressource seulement après le dernier utilisateur', () => {
  let disposed = 0;
  const resource = { dispose() { disposed += 1; } };
  const manager = new ResourceManager();
  manager.acquire('shared-texture', resource);
  manager.acquire('shared-texture', resource);
  manager.release('shared-texture');
  assert.equal(disposed, 0);
  assert.equal(manager.getRefCount('shared-texture'), 1);
  manager.release('shared-texture');
  assert.equal(disposed, 1);
  assert.equal(manager.has('shared-texture'), false);
});


test('PerivolumeManager actualise le centre d’un astre mobile sans perdre son état', () => {
  const manager = new PerivolumeManager();
  manager.register({ id: 'mars', center: [0, 0, 0], radius: 2, backgroundRadius: 6 });
  assert.equal(manager.evaluate([0, 0, 0])[0].state, LOAD_STATE.ACTIVE);
  assert.equal(manager.updateCenter('mars', [100, 0, 0]), true);
  assert.equal(manager.get('mars').center[0], 100);
  assert.equal(manager.evaluate([100, 0, 0])[0].state, LOAD_STATE.ACTIVE);
  assert.equal(manager.updateCenter('unknown', [0, 0, 0]), false);
  assert.throws(() => manager.updateCenter('mars', [NaN, 0, 0]), /Centre invalide/);
});
