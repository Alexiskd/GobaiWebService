import test from 'node:test';
import assert from 'node:assert/strict';
import { PerivolumeManager, LOAD_STATE } from './PerivolumeManager.js';
import { SystemRegistry } from './SystemRegistry.js';
import { SystemManager } from './SystemManager.js';
import { createGobaiPerivolumeAxioms } from './PerivolumeAxiomPolicy.js';
import { perivolumeCube, perivolumeBox, perivolumeSphere, perivolumeCylinder, verifyIsoperimetricInequality, containsPerivolumePoint } from './PerivolumeGeometry.js';

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

test('axiome système externe Soleil/Proxima : le partenaire est UNLOADED', () => {
  const ids = ['system:solar', 'system:proxima-centauri'];
  const manager = setup(ids, createGobaiPerivolumeAxioms(), { 'system:proxima-centauri': [20, 0, 0] });
  const result = manager.update([20, 0, 0]);
  assert.equal(result.find((item) => item.id === 'system:proxima-centauri').state, LOAD_STATE.ACTIVE);
  assert.equal(result.find((item) => item.id === 'system:solar').state, LOAD_STATE.UNLOADED);
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

test('les fonctions de surface respectent les formules de périvolume', () => {
  assert.equal(perivolumeCube(4), 96);
  assert.equal(perivolumeBox(2, 3, 4), 52);
  assert.ok(Math.abs(perivolumeSphere(5) - 100 * Math.PI) < 1e-10);
  assert.ok(Math.abs(perivolumeCylinder(3, 7) - 60 * Math.PI) < 1e-10);
  const r = 5; const volume = 4 / 3 * Math.PI * r ** 3;
  assert.equal(verifyIsoperimetricInequality(volume, perivolumeSphere(r)), true);
});

test('appartenance aux périvolumes cubique, boîte, sphère et cylindre', () => {
  assert.equal(containsPerivolumePoint([1, 1, 1], [0, 0, 0], { type: 'cube', side: 2 }), true);
  assert.equal(containsPerivolumePoint([2, 0, 0], [0, 0, 0], { type: 'box', length: 2, width: 2, height: 2 }), false);
  assert.equal(containsPerivolumePoint([0, 0, 0], [0, 0, 0], { type: 'sphere', radius: 1 }), true);
  assert.equal(containsPerivolumePoint([0.5, 1, 0], [0, 0, 0], { type: 'cylinder', radius: 1, height: 2 }), true);
});

test('axiome externe : entrer dans le périvolume du Soleil décharge Proxima', () => {
  const ids = ['system:solar', 'system:proxima-centauri'];
  const manager = setup(ids, createGobaiPerivolumeAxioms(), { 'system:proxima-centauri': [20, 0, 0] });
  const result = manager.update([0, 0, 0]);
  assert.equal(result.find((item) => item.id === 'system:solar').state, LOAD_STATE.ACTIVE);
  assert.equal(result.find((item) => item.id === 'system:proxima-centauri').state, LOAD_STATE.UNLOADED);
});
