import test from 'node:test';
import assert from 'node:assert/strict';
import { PerivolumeManager, LOAD_STATE } from './PerivolumeManager.js';
import { SystemRegistry } from '../core/system/SystemRegistry.js';
import { SystemManager } from '../core/system/SystemManager.js';
import { createGobaiPerivolumeAxioms } from './PerivolumeAxiomPolicy.js';

function setup(ids, axioms, centerOverrides = {}) {
  const registry = new SystemRegistry();
  const volumes = new PerivolumeManager({ hysteresis: 0 });
  for (const id of ids) {
    registry.register({ id });
    volumes.register({ id, center: centerOverrides[id] || [0, 0, 0], radius: 10, backgroundRadius: 30 });
  }
  return new SystemManager({ registry, perivolumeManager: volumes, axioms });
}

test('axiome système interne Terre/Soleil : le partenaire est limité à BACKGROUND', () => {
  const ids = ['system:earth', 'system:solar'];
  const manager = setup(ids, createGobaiPerivolumeAxioms());
  const result = manager.update([0, 0, 0]);
  assert.equal(result.find((item) => item.id === 'system:earth').state, LOAD_STATE.ACTIVE);
  assert.equal(result.find((item) => item.id === 'system:solar').state, LOAD_STATE.BACKGROUND);
  assert.equal(manager.getLoadProfile('system:solar').update, false);
});

test('axiome astres interne Terre/Lune : la Lune passe en BACKGROUND', () => {
  const ids = ['body:earth', 'body:moon'];
  const manager = setup(ids, createGobaiPerivolumeAxioms());
  const result = manager.update([0, 0, 0]);
  assert.equal(result.find((item) => item.id === 'body:earth').state, LOAD_STATE.ACTIVE);
  assert.equal(result.find((item) => item.id === 'body:moon').state, LOAD_STATE.BACKGROUND);
});

test('axiome astres externe Terre/Mercure : le partenaire est déchargé', () => {
  const ids = ['body:earth', 'body:mercury'];
  const manager = setup(ids, createGobaiPerivolumeAxioms());
  const result = manager.update([0, 0, 0]);
  assert.equal(result.find((item) => item.id === 'body:earth').state, LOAD_STATE.ACTIVE);
  assert.equal(result.find((item) => item.id === 'body:mercury').state, LOAD_STATE.UNLOADED);
});

test('les transitions reviennent à la géométrie naturelle lorsque la caméra quitte les volumes', () => {
  const ids = ['system:earth', 'system:solar'];
  const manager = setup(ids, createGobaiPerivolumeAxioms());
  manager.update([0, 0, 0]);
  const result = manager.update([500, 0, 0]);
  assert.equal(result.find((item) => item.id === 'system:solar').state, LOAD_STATE.UNLOADED);
  assert.equal(manager.getLoadProfile('system:solar').render, false);
});
