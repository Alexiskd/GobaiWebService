import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SatelliteAtlasPageAllocator,
  SatelliteTextureAtlasManager,
} from './SatelliteTextureAtlas.js';

test('alloue des rectangles UV distincts avec gutter et mise à l’échelle', () => {
  const allocator = new SatelliteAtlasPageAllocator({ pageSize: 64, gutter: 2 });
  const a = allocator.allocate('earth', 24, 16);
  const b = allocator.allocate('moon', 16, 16);
  assert.ok(a && b);
  assert.ok(a.uv[0] >= 0 && a.uv[1] >= 0);
  assert.ok(a.uv[0] + a.uv[2] <= 1);
  assert.ok(b.uv[0] >= 0 && b.uv[1] >= 0);
  assert.notDeepEqual(Array.from(a.uv), Array.from(b.uv));
  const scaled = allocator.allocate('large', 120, 80);
  assert.ok(scaled.scale < 1);
  assert.ok(scaled.width <= 60 && scaled.height <= 60);
});

test('rejette les identifiants invalides, doublons et dimensions incorrectes', () => {
  const allocator = new SatelliteAtlasPageAllocator({ pageSize: 64, gutter: 2 });
  assert.throws(() => allocator.allocate('', 10, 10), TypeError);
  allocator.allocate('earth', 10, 10);
  assert.throws(() => allocator.allocate('earth', 10, 10), Error);
  assert.throws(() => allocator.allocate('bad', 0, 10), RangeError);
});

test('traite la file par priorité, dans un budget de chargement borné', () => {
  const copied = [];
  const manager = new SatelliteTextureAtlasManager({
    pageSize: 64,
    gutter: 2,
    maxPages: 2,
    createPage: ({ index }) => ({ texture: { page: index, needsUpdate: false } }),
    blit: (page, source, allocation) => copied.push({ page, source, allocation }),
  });
  manager.enqueue({ id: 'moon', source: 'moon-image', width: 16, height: 16, priority: 1 });
  manager.enqueue({ id: 'earth', source: 'earth-image', width: 32, height: 32, priority: 10 });
  manager.enqueue({ id: 'mars', source: 'mars-image', width: 16, height: 16, priority: 5 });
  const first = manager.processQueue(1);
  assert.equal(first.length, 1);
  assert.equal(first[0].id, 'earth');
  assert.equal(manager.getPendingCount(), 2);
  const second = manager.processQueue(2);
  assert.deepEqual(second.map((entry) => entry.id), ['mars', 'moon']);
  assert.equal(copied.length, 3);
  assert.equal(manager.get('earth').texture.needsUpdate, true);
  manager.dispose();
});

test('respecte le plafond de pages et conserve les éléments non chargés en attente', () => {
  const manager = new SatelliteTextureAtlasManager({
    pageSize: 32,
    gutter: 2,
    maxPages: 1,
    createPage: () => ({ texture: { needsUpdate: false } }),
    blit: () => {},
  });
  manager.enqueue({ id: 'a', source: {}, width: 24, height: 24, priority: 2 });
  manager.enqueue({ id: 'b', source: {}, width: 24, height: 24, priority: 1 });
  assert.equal(manager.processQueue(2).length, 1);
  assert.equal(manager.getPendingCount(), 1);
  assert.equal(manager.getPageCount(), 1);
  manager.dispose();
});

test('release retire une entrée sans recycler prématurément son rectangle', () => {
  const manager = new SatelliteTextureAtlasManager({
    pageSize: 64,
    gutter: 2,
    createPage: () => ({ texture: { needsUpdate: false } }),
    blit: () => {},
  });
  manager.enqueue({ id: 'earth', source: {}, width: 16, height: 16 });
  manager.processQueue(1);
  const previous = manager.getRect('earth');
  assert.equal(manager.release('earth'), true);
  assert.equal(manager.get('earth'), null);
  manager.enqueue({ id: 'moon', source: {}, width: 16, height: 16 });
  manager.processQueue(1);
  assert.notDeepEqual(Array.from(manager.getRect('moon')), Array.from(previous));
  manager.dispose();
  assert.throws(() => manager.processQueue(1), /libéré/);
});

test('convertit les coordonnées canvas haut-gauche en UV WebGL bas-gauche avec v=1 au nord', () => {
  const allocator = new SatelliteAtlasPageAllocator({ pageSize: 128, gutter: 4 });
  const allocation = allocator.allocate('north-west', 32, 16);
  assert.equal(allocation.y, 4);
  assert.equal(allocation.uv[1], (128 - (4 + 16)) / 128);
});
