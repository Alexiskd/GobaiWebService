import test from 'node:test';
import assert from 'node:assert/strict';
import { InterstellarLODManager } from './InterstellarLODManager.js';

function system(coreId, x, semiMajorAxisAu = 10) {
  return { coreId, group: { position: { x, y: 0, z: 0 }, visible: true }, model: { localScene: { units: { auToSceneUnits: 1 }, planets: [{ orbit: { semiMajorAxisAu } }] } } };
}

test('LOD sélectionne les détails selon la taille apparente', () => {
  const manager = new InterstellarLODManager({ maxPlanetSystems: 8, maxDetailedSystems: 2 });
  const result = manager.evaluate([system('near', 10), system('far', 10000)], { cameraPosition: { x: 0, y: 0, z: 0 }, viewportHeight: 1000, fovDeg: 50 });
  assert.equal(result.byId.get('near'), 'DETAILED');
  assert.equal(result.byId.get('far'), 'STAR');
});

test('le budget limite les systèmes détaillés et privilégie le système focalisé', () => {
  const manager = new InterstellarLODManager({ maxPlanetSystems: 2, maxDetailedSystems: 1 });
  const result = manager.evaluate([system('a', 20), system('b', 21), system('c', 22)], { cameraPosition: { x: 0, y: 0, z: 0 }, viewportHeight: 1200, focusedId: 'c' });
  assert.equal(result.byId.get('c'), 'DETAILED');
  assert.equal(result.stats.detailed, 1);
  assert.equal(result.stats.planets, 1);
  assert.equal(result.stats.starsOnly, 1);
});

test('les objets cachés par le périvolume ne consomment pas le budget LOD', () => {
  const manager = new InterstellarLODManager({ maxPlanetSystems: 1, maxDetailedSystems: 1 });
  const hidden = system('hidden', 1); hidden.group.visible = false;
  const result = manager.evaluate([hidden, system('visible', 2)], { cameraPosition: { x: 0, y: 0, z: 0 }, viewportHeight: 1000 });
  assert.equal(result.byId.get('visible'), 'DETAILED');
  assert.equal(result.byId.get('hidden'), 'STAR');
});

test('validation des budgets et des entrées', () => {
  assert.throws(() => new InterstellarLODManager({ maxPlanetSystems: 1, maxDetailedSystems: 2 }), /dépasser/);
  const manager = new InterstellarLODManager();
  assert.throws(() => manager.evaluate([], { cameraPosition: { x: 0, y: 0, z: 0 }, viewportHeight: 0 }), /Viewport/);
});
