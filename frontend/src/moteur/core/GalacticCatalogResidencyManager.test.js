import test from 'node:test';
import assert from 'node:assert/strict';
import { GalacticCatalogResidencyManager } from './GalacticCatalogResidencyManager.js';

test('respecte le budget de secteurs et évince le secteur LRU non épinglé', () => {
  let time = 0;
  const evicted = [];
  const manager = new GalacticCatalogResidencyManager({ maxSectors: 2, now: () => ++time, onEvict: (entry) => evicted.push(entry) });
  manager.registerSector('a', ['1', '2']);
  manager.registerSector('b', ['3']);
  manager.touchSector('a');
  manager.registerSector('c', ['4']);
  assert.deepEqual(evicted.map((entry) => entry.key), ['b']);
  assert.equal(manager.getStats().sectors, 2);
});

test('ne supprime jamais un secteur épinglé même si le budget est dépassé', () => {
  const evicted = [];
  const manager = new GalacticCatalogResidencyManager({ maxSectors: 1, onEvict: (entry) => evicted.push(entry) });
  manager.setPinned(['visible']);
  manager.registerSector('visible', ['1', '2']);
  manager.registerSector('other', ['3']);
  assert.deepEqual(evicted.map((entry) => entry.key), ['other']);
  assert.equal(manager.getStats().sectors, 1);
  assert.equal(manager.getStats().pinnedSectors, 1);
});

test('applique les plafonds étoiles et mémoire estimée', () => {
  const evicted = [];
  const manager = new GalacticCatalogResidencyManager({ maxSectors: 10, maxStars: 3, maxEstimatedBytes: 1024, bytesPerStar: 384, onEvict: (entry) => evicted.push(entry) });
  manager.registerSector('old', ['1', '2']);
  manager.registerSector('new', ['3', '4']);
  assert.deepEqual(evicted.map((entry) => entry.key), ['old']);
  assert.ok(manager.getStats().estimatedBytes <= 1024);
});

test('supprime proprement les métadonnées et ignore les mutations après dispose', () => {
  const manager = new GalacticCatalogResidencyManager();
  manager.registerSector('a', ['1']);
  assert.equal(manager.removeSector('a'), true);
  manager.dispose();
  manager.registerSector('b', ['2']);
  assert.equal(manager.getStats().sectors, 0);
});


test('permet de modifier le budget à chaud et applique immédiatement les nouvelles limites', () => {
  const evicted = [];
  const manager = new GalacticCatalogResidencyManager({ maxSectors: 4, onEvict: (entry) => evicted.push(entry) });
  manager.registerSector('a', ['1']);
  manager.registerSector('b', ['2']);
  const stats = manager.setBudget({ maxSectors: 1 });
  assert.equal(stats.sectors, 1);
  assert.equal(stats.maxSectors, 1);
  assert.equal(evicted.length, 1);
});
