import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteMultiLayerTextureAtlasManager, SATELLITE_ATLAS_CHANNELS } from './SatelliteMultiLayerTextureAtlas.js';
import { SatelliteGpuMemoryBudgetManager } from './SatelliteGpuMemoryBudgetManager.js';
import { SatelliteAtlasGpuBudgetBridge } from './SatelliteAtlasGpuBudgetBridge.js';

function makeAtlas({ pageSize = 16, maxPages = 4 } = {}) {
  const channels = Object.fromEntries(SATELLITE_ATLAS_CHANNELS.map((name) => [name, {
    createPage: ({ index, channel }) => ({ texture: { index, channel, dispose() { this.disposed = true; } } }),
    blit() {},
  }]));
  return new SatelliteMultiLayerTextureAtlasManager({ pageSize, gutter: 1, maxPages, channels });
}

function addTile(atlas, id, bodyId, size = 12) {
  atlas.enqueue({ id, bodyId, width: size, height: size, layers: { color: { id } } });
  return atlas.processQueue(1)[0];
}

test('enregistre chaque page dans le budget et calcule les octets des quatre canaux', () => {
  const atlas = makeAtlas();
  const budget = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 1_000_000, defaultBodyBudgetBytes: 1_000_000 });
  const bridge = new SatelliteAtlasGpuBudgetBridge({ atlas, budgetManager: budget });
  addTile(atlas, 'earth-0', 'earth');
  const result = bridge.sync();
  assert.equal(result.registered.length, 1);
  assert.equal(budget.getStats().usedBytes, 16 * 16 * 4 * 4);
  assert.equal(budget.getStats().byBody.earth.resourceCount, 1);
  bridge.dispose(); atlas.dispose(); budget.dispose();
});

test('épingle une page référencée et empêche son éviction', () => {
  const atlas = makeAtlas({ pageSize: 16 });
  const budget = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 1_000_000, defaultBodyBudgetBytes: 1_000_000 });
  const bridge = new SatelliteAtlasGpuBudgetBridge({ atlas, budgetManager: budget });
  addTile(atlas, 'earth-0', 'earth');
  assert.equal(bridge.retainEntry('earth-0'), true);
  const info = atlas.getPageInfo(0);
  assert.equal(info.references, 1);
  assert.equal(budget.getStats().pinnedBytes, 16 * 16 * 4 * 4);
  assert.equal(atlas.evictPage(0), false);
  budget.setGlobalBudget(0);
  assert.equal(bridge.releaseEntry('earth-0'), true);
  assert.equal(atlas.getPageInfo(0), null, 'le budget peut évincer la page devenue inactive');
  assert.equal(budget.getStats().usedBytes, 0);
  bridge.dispose(); atlas.dispose(); budget.dispose();
});

test('évince une page inactive avant une page active lorsque le budget global est dépassé', () => {
  const atlas = makeAtlas({ pageSize: 16 });
  const pageBytes = 16 * 16 * 4 * 4;
  const budget = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: pageBytes, defaultBodyBudgetBytes: pageBytes });
  budget.setBodyState('earth', 'ACTIVE');
  budget.setBodyState('moon', 'UNLOADED');
  const bridge = new SatelliteAtlasGpuBudgetBridge({ atlas, budgetManager: budget });
  addTile(atlas, 'earth-tile', 'earth');
  bridge.sync();
  bridge.retainEntry('earth-tile');
  addTile(atlas, 'moon-tile', 'moon');
  const result = bridge.sync();
  assert.equal(result.withinBudget, true);
  assert.ok(atlas.get('earth-tile'));
  assert.equal(atlas.get('moon-tile'), null);
  assert.equal(atlas.getPageInfo(0).bodyId, 'earth');
  assert.equal(budget.getStats().usedBytes, pageBytes);
  bridge.releaseEntry('earth-tile');
  bridge.dispose(); atlas.dispose(); budget.dispose();
});

test('sépare les pages par astre afin de rendre les budgets attribuables', () => {
  const atlas = makeAtlas({ pageSize: 32 });
  addTile(atlas, 'earth-tile', 'earth', 8);
  addTile(atlas, 'moon-tile', 'moon', 8);
  assert.equal(atlas.getPageCount(), 2);
  assert.equal(atlas.getPageInfo(0).bodyId, 'earth');
  assert.equal(atlas.getPageInfo(1).bodyId, 'moon');
  atlas.dispose();
});

test('refuse de budgéter une page sans propriétaire astre', () => {
  const atlas = makeAtlas();
  const budget = new SatelliteGpuMemoryBudgetManager();
  const bridge = new SatelliteAtlasGpuBudgetBridge({ atlas, budgetManager: budget });
  addTile(atlas, 'unowned', null);
  assert.throws(() => bridge.sync(), /bodyId/);
  bridge.dispose(); atlas.dispose(); budget.dispose();
});
