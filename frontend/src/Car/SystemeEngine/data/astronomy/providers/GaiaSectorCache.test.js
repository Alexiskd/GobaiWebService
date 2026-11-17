import test from 'node:test';
import assert from 'node:assert/strict';
import { GaiaSectorCache } from './GaiaSectorCache.js';

test('GaiaSectorCache conserve les données en mémoire si IndexedDB est indisponible', async () => {
  const cache = new GaiaSectorCache({ indexedDB: null, now: () => 100 });
  await cache.set('sector', { stars: [1] });
  assert.deepEqual(await cache.get('sector'), { stars: [1] });
  assert.equal(cache.getStats().persistent, false);
});

test('GaiaSectorCache expire les secteurs selon le TTL', async () => {
  let now = 10;
  const cache = new GaiaSectorCache({ indexedDB: null, ttlMs: 5, now: () => now });
  await cache.set('sector', { count: 2 });
  now = 16;
  assert.equal(await cache.get('sector'), null);
});
