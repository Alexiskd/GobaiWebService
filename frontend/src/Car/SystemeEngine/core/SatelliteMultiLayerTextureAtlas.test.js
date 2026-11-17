import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteMultiLayerTextureAtlasManager, SATELLITE_ATLAS_CHANNELS } from './SatelliteMultiLayerTextureAtlas.js';

function makeChannels(events) {
  return Object.fromEntries(SATELLITE_ATLAS_CHANNELS.map((name) => [name, {
    createPage: ({ index, channel }) => ({ texture: { index, channel, needsUpdate: false, dispose() { this.disposed = true; } } }),
    blit: (page, source, allocation, channel) => events.push({ channel, source, uv: Array.from(allocation.uv), allocation }),
  }]));
}

test('partage exactement le même rectangle UV entre couleur, altitude, normales et nuit', () => {
  const events = [];
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 128, gutter: 2, channels: makeChannels(events) });
  manager.enqueue({ id: 'earth', width: 64, height: 32, layers: { color: 'earth-color', elevation: 'earth-height', normal: 'earth-normal', night: 'earth-night' } });
  const [entry] = manager.processQueue(1);
  assert.equal(events.length, 4);
  for (const event of events) assert.deepEqual(event.uv, Array.from(entry.uv));
  assert.deepEqual(Object.keys(entry.textures).sort(), ['color', 'elevation', 'night', 'normal']);
  assert.ok(Object.values(entry.textures).every((texture) => texture.needsUpdate));
  manager.dispose();
});

test('autorise des couches optionnelles tout en gardant une allocation UV unique', () => {
  const events = [];
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 64, gutter: 2, channels: makeChannels(events) });
  manager.enqueue({ id: 'moon', width: 20, height: 20, layers: { color: 'moon-color', elevation: 'moon-height' } });
  const [entry] = manager.processQueue(1);
  assert.deepEqual([...entry.layers].sort(), ['color', 'elevation']);
  assert.equal(events.length, 2);
  assert.deepEqual(Array.from(manager.getRect('moon')), Array.from(entry.uv));
  manager.dispose();
});

test('priorise la file et respecte le budget de traitement', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 128, channels: makeChannels([]) });
  manager.enqueue({ id: 'mars', width: 8, height: 8, layers: { color: 'mars' }, priority: 1 });
  manager.enqueue({ id: 'earth', width: 8, height: 8, layers: { color: 'earth' }, priority: 9 });
  assert.deepEqual(manager.processQueue(1).map((entry) => entry.id), ['earth']);
  assert.equal(manager.getPendingCount(), 1);
  assert.deepEqual(manager.processQueue(1).map((entry) => entry.id), ['mars']);
  manager.dispose();
});

test('rejette les canaux mal configurés et les sources inconnues', () => {
  assert.throws(() => new SatelliteMultiLayerTextureAtlasManager({ channels: { color: {} } }), /createPage et blit/);
  const manager = new SatelliteMultiLayerTextureAtlasManager({ channels: makeChannels([]) });
  assert.throws(() => manager.enqueue({ id: 'x', width: 1, height: 1, layers: { specular: 'x' } }), /non configuré/);
  assert.throws(() => manager.enqueue({ id: 'x', width: 1, height: 1, layers: {} }), /Au moins une source/);
  manager.dispose();
});

test('libère toutes les textures des canaux à dispose', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 64, channels: makeChannels([]) });
  manager.enqueue({ id: 'earth', width: 8, height: 8, layers: { color: 'earth' } });
  manager.processQueue(1);
  const textures = Object.values(manager.get('earth').textures);
  manager.dispose();
  assert.ok(textures.every((texture) => texture.disposed));
  assert.throws(() => manager.processQueue(1), /libéré/);
});


test('compte les références et conserve la page tant que le gestionnaire vit', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 64, gutter: 2, channels: makeChannels([]) });
  manager.enqueue({ id: 'earth-tile', width: 16, height: 16, layers: { color: 'earth' } });
  manager.processQueue(1);
  assert.equal(manager.retain('earth-tile'), true);
  assert.equal(manager.retain('earth-tile'), true);
  assert.equal(manager.getMemoryStats().liveReferences, 2);
  assert.equal(manager.release('earth-tile'), true);
  assert.equal(manager.get('earth-tile') !== null, true);
  assert.equal(manager.getMemoryStats().liveReferences, 1);
  assert.equal(manager.release('earth-tile'), true);
  assert.equal(manager.get('earth-tile'), null);
  assert.equal(manager.getPageCount(), 1, 'la page n’est pas détruite ni réutilisée prématurément');
  const stats = manager.getMemoryStats();
  assert.equal(stats.liveEntries, 0);
  assert.equal(stats.estimatedGpuBytes, 64 * 64 * 4 * 4);
  manager.dispose();
});

test('refuse retain sur une entrée absente et expose des compteurs cohérents', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, channels: makeChannels([]) });
  assert.equal(manager.retain('missing'), false);
  assert.deepEqual(manager.getMemoryStats().pageReferences, {});
  manager.dispose();
});

test('évince une page inactive et détruit ses textures multi-couches', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, gutter: 2, maxPages: 2, channels: makeChannels([]) });
  manager.enqueue({ id: 'idle-a', width: 24, height: 24, layers: { color: 'a', night: 'a-night' } });
  manager.processQueue(1);
  const pageTextures = Object.values(manager.pages[0].layerPages).map((page) => page.texture);
  assert.deepEqual(manager.evictIdlePages(), [0]);
  assert.ok(pageTextures.every((texture) => texture.disposed));
  assert.equal(manager.get('idle-a'), null);
  assert.equal(manager.getPageCount(), 0);
  assert.equal(manager.getMemoryStats().estimatedGpuBytes, 0);
  manager.dispose();
});

test('ne détruit jamais une page encore retenue par une tuile', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, gutter: 2, maxPages: 1, channels: makeChannels([]) });
  manager.enqueue({ id: 'pinned', width: 24, height: 24, layers: { color: 'pinned' } });
  manager.processQueue(1);
  const texture = manager.get('pinned').textures.color;
  manager.retain('pinned');
  assert.deepEqual(manager.evictIdlePages(), []);
  assert.equal(texture.disposed, undefined);
  assert.equal(manager.get('pinned') !== null, true);
  manager.release('pinned');
  assert.deepEqual(manager.evictIdlePages(), [0]);
  assert.equal(texture.disposed, true);
  manager.dispose();
});

test('réutilise un index de page après éviction et maintient les statistiques', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, gutter: 2, maxPages: 1, channels: makeChannels([]) });
  manager.enqueue({ id: 'old', width: 24, height: 24, layers: { color: 'old' } });
  manager.processQueue(1);
  manager.evictIdlePages();
  manager.enqueue({ id: 'new', width: 24, height: 24, layers: { color: 'new' } });
  const [entry] = manager.processQueue(1);
  assert.equal(entry.pageIndex, 0);
  assert.equal(manager.getPageCount(), 1);
  assert.equal(manager.getMemoryStats().allocatedSlots, 1);
  manager.dispose();
});

test('évince automatiquement une page inactive lorsque le budget de pages est atteint', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, gutter: 2, maxPages: 1, channels: makeChannels([]) });
  manager.enqueue({ id: 'first', width: 24, height: 24, layers: { color: 'first' } });
  manager.processQueue(1);
  const oldTexture = manager.get('first').textures.color;
  manager.enqueue({ id: 'second', width: 24, height: 24, layers: { color: 'second' } });
  const [entry] = manager.processQueue(1);
  assert.equal(entry.id, 'second');
  assert.equal(oldTexture.disposed, true);
  assert.equal(manager.get('first'), null);
  assert.equal(manager.getPageCount(), 1);
  manager.dispose();
});

test('refuse un nombre de pages conservées invalide', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, channels: makeChannels([]) });
  assert.throws(() => manager.evictIdlePages({ keepPages: -1 }), /keepPages/);
  assert.throws(() => manager.evictIdlePages({ maxPagesToEvict: -1 }), /maxPagesToEvict/);
  manager.dispose();
});

test('annule une entrée en attente lorsque l’atlas ne peut pas l’allouer', () => {
  const manager = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, maxPages: 1, channels: makeChannels([]) });
  manager.enqueue({ id: 'pending', width: 8, height: 8, layers: { color: {} }, bodyId: 'earth' });
  assert.equal(manager.getPendingCount(), 1);
  assert.equal(manager.cancelQueued('pending'), true);
  assert.equal(manager.getPendingCount(), 0);
  manager.dispose();
});
