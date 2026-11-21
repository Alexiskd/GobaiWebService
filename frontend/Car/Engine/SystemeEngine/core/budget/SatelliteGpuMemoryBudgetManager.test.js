import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteGpuMemoryBudgetManager } from './SatelliteGpuMemoryBudgetManager.js';

const resource = (id, bodyId, bytes, options = {}) => ({ id, bodyId, bytes, evict: options.evict || (() => true), ...options });

test('enregistre les ressources et calcule les budgets par astre', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 1000, defaultBodyBudgetBytes: 800 });
  assert.equal(manager.register(resource('earth-color', 'earth', 300)).accepted, true);
  assert.equal(manager.register(resource('moon-color', 'moon', 200)).accepted, true);
  const stats = manager.getStats();
  assert.equal(stats.usedBytes, 500);
  assert.equal(stats.byBody.earth.bytes, 300);
  assert.equal(stats.remainingBytes, 500);
});

test('évince la ressource LRU inactive avant une ressource active', () => {
  const evicted = [];
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 100, defaultBodyBudgetBytes: 100 });
  manager.setBodyState('earth', 'ACTIVE');
  manager.setBodyState('moon', 'BACKGROUND');
  manager.register(resource('earth', 'earth', 60, { evict: () => { evicted.push('earth'); return true; } }));
  manager.register(resource('moon', 'moon', 30, { evict: () => { evicted.push('moon'); return true; } }));
  const result = manager.register(resource('mars', 'mars', 20));
  assert.deepEqual(evicted, ['moon']);
  assert.equal(result.accepted, true);
  assert.equal(manager.getStats().usedBytes, 80);
});

test('respecte le budget global après plusieurs évictions', () => {
  const evicted = [];
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 100, defaultBodyBudgetBytes: 100 });
  manager.register(resource('a', 'a', 60, { evict: () => { evicted.push('a'); return true; } }));
  manager.register(resource('b', 'b', 30, { evict: () => { evicted.push('b'); return true; } }));
  const result = manager.register(resource('c', 'c', 50));
  assert.equal(result.accepted, true);
  assert.equal(manager.getStats().usedBytes, 80);
  assert.deepEqual(evicted, ['a']);
});

test('protège les ressources épinglées et refuse une nouvelle ressource si impossible', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 100, defaultBodyBudgetBytes: 100 });
  manager.register(resource('pinned', 'earth', 80, { pinned: true }));
  const result = manager.register(resource('new', 'earth', 30));
  assert.equal(result.accepted, false);
  assert.equal(manager.getStats().usedBytes, 80);
});

test('unpin applique immédiatement le budget du corps', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 1000, defaultBodyBudgetBytes: 1000 });
  manager.setBodyBudget('earth', 50);
  manager.register(resource('tile', 'earth', 80, { pinned: true }));
  assert.equal(manager.getStats().usedBytes, 80);
  manager.unpin('tile');
  assert.equal(manager.getStats().usedBytes, 0);
});

test('touch actualise le LRU et forget retire sans callback', () => {
  const calls = [];
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 100, defaultBodyBudgetBytes: 100 });
  manager.register(resource('a', 'earth', 40, { evict: () => { calls.push('a'); return true; } }));
  manager.register(resource('b', 'moon', 40, { evict: () => { calls.push('b'); return true; } }));
  manager.touch('a');
  manager.forget('b');
  manager.register(resource('c', 'mars', 70));
  assert.deepEqual(calls, ['a']);
});

test('garde une ressource si son callback refuse ou échoue', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 10, defaultBodyBudgetBytes: 10 });
  manager.register(resource('blocked', 'earth', 8, { evict: () => false }));
  const result = manager.register(resource('new', 'mars', 8));
  assert.equal(result.accepted, false);
  assert.equal(manager.getStats().resourceCount, 1);
});

test('valide les identifiants, états et budgets', () => {
  const manager = new SatelliteGpuMemoryBudgetManager();
  assert.throws(() => manager.setBodyState('earth', 'UNKNOWN'), /État/);
  assert.throws(() => manager.setGlobalBudget(-1), /positif/);
  assert.throws(() => manager.register({ id: 'x', bodyId: 'earth', bytes: 1 }), /callback/);
});

test('dispose peut demander la libération des ressources', () => {
  let calls = 0;
  const manager = new SatelliteGpuMemoryBudgetManager();
  manager.register(resource('a', 'earth', 10, { evict: () => { calls += 1; return true; } }));
  manager.dispose({ evictResources: true });
  assert.equal(calls, 1);
  assert.equal(manager.getStats().resourceCount, 0);
  assert.throws(() => manager.touch('a'), /libéré/);
});

test('synchronise les états issus de PerivolumeManager.evaluate', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 100, defaultBodyBudgetBytes: 100 });
  const synced = manager.syncPerivolumeDecisions([
    { id: 'earth', state: 'ACTIVE' },
    { id: 'moon', state: 'UNLOADED' },
  ]);
  assert.deepEqual(synced, ['earth', 'moon']);
  manager.register(resource('earth-page', 'earth', 40));
  manager.register(resource('moon-page', 'moon', 40));
  const result = manager.register(resource('mars-page', 'mars', 30));
  assert.equal(result.accepted, true);
  assert.equal(manager.getStats().usedBytes, 70);
  assert.equal(manager.getStats().resourceCount, 2);
  assert.throws(() => manager.syncPerivolumeDecisions([{ id: 'venus', state: 'INVALID' }]), /décision/);
});

test('traite UNLOADED avant BACKGROUND même si son poids numérique vaut zéro', () => {
  const evicted = [];
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 100, defaultBodyBudgetBytes: 100 });
  manager.setBodyState('background', 'BACKGROUND');
  manager.setBodyState('unloaded', 'UNLOADED');
  manager.register(resource('background-page', 'background', 40, { evict: () => { evicted.push('background'); return true; } }));
  manager.register(resource('unloaded-page', 'unloaded', 40, { evict: () => { evicted.push('unloaded'); return true; } }));
  manager.register(resource('new-page', 'new-body', 40));
  assert.deepEqual(evicted, ['unloaded']);
  assert.equal(manager.getStats().usedBytes, 80);
  manager.dispose();
});
