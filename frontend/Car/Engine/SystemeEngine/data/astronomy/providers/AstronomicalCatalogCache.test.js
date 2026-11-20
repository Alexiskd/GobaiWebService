import test from 'node:test';
import assert from 'node:assert/strict';
import { AstronomicalCatalogCache } from './AstronomicalCatalogCache.js';

test('cache les résultats jusqu’à expiration TTL', () => {
  let now = 100;
  const cache = new AstronomicalCatalogCache({ ttlMs: 20, now: () => now });
  cache.set('gaia:1', { value: 1 });
  assert.deepEqual(cache.get('gaia:1'), { value: 1 });
  now = 121;
  assert.equal(cache.get('gaia:1'), null);
});

test('applique une éviction LRU lorsque le cache est plein', () => {
  const cache = new AstronomicalCatalogCache({ maxEntries: 2 });
  cache.set('a', 1); cache.set('b', 2); cache.get('a'); cache.set('c', 3);
  assert.equal(cache.get('b'), null);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.size, 2);
});
