import test from 'node:test';
import assert from 'node:assert/strict';
import { GalacticSpatialIndex } from './GalacticSpatialIndex.js';
import { GalacticSectorStreamingManager } from './GalacticSectorStreamingManager.js';

const point = (x, y = 0, z = 0) => ({ x, y, z });

test('active les secteurs proches et ignore les systèmes hors rayon', () => {
  const index = new GalacticSpatialIndex({ sectorSizePc: 10 });
  index.upsert('near', point(4)); index.upsert('far', point(90));
  const manager = new GalacticSectorStreamingManager({ index, enterRadiusPc: 10, exitRadiusPc: 15 });
  const result = manager.update(point(0));
  assert.deepEqual(result.visibleIds, ['near']);
  assert.equal(result.activeSectors.length, 1);
  assert.deepEqual(result.entered, ['0:0:0']);
});

test('applique une hystérésis à la sortie du secteur', () => {
  const index = new GalacticSpatialIndex(); index.upsert('star', point(9));
  const manager = new GalacticSectorStreamingManager({ index, enterRadiusPc: 10, exitRadiusPc: 15 });
  manager.update(point(0));
  assert.equal(manager.isResident('star'), true);
  manager.update(point(-3)); // distance 12 : conserve la résidence
  assert.equal(manager.isResident('star'), true);
  const result = manager.update(point(-7)); // distance 16 : sortie
  assert.equal(manager.isResident('star'), false);
  assert.equal(result.exited.length, 1);
});

test('force le recalcul même si la caméra bouge peu et valide les entrées', () => {
  const index = new GalacticSpatialIndex(); index.upsert('star', point(1));
  const manager = new GalacticSectorStreamingManager({ index });
  manager.update(point(0));
  assert.throws(() => manager.update({ x: NaN, y: 0, z: 0 }), /Centre caméra/);
  assert.equal(manager.update(point(0), { force: true }).visibleIds[0], 'star');
});

test('dispose rend le gestionnaire inerte', () => {
  const index = new GalacticSpatialIndex(); index.upsert('star', point(1));
  const manager = new GalacticSectorStreamingManager({ index }); manager.update(point(0)); manager.dispose();
  assert.equal(manager.getStats().activeSectors, 0);
  assert.deepEqual(manager.update(point(0)).visibleIds, []);
});
