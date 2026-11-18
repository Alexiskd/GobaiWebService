import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedResourcePool } from './SharedResourcePool.js';

function resource() {
  return { userData: {}, disposeCount: 0, dispose() { this.disposeCount += 1; } };
}

test('réutilise une ressource pour une même clé explicite', () => {
  const pool = new SharedResourcePool();
  let created = 0;
  const factory = () => { created += 1; return resource(); };
  const first = pool.acquire('mat:red', factory);
  const second = pool.acquire('mat:red', factory);
  assert.equal(first, second);
  assert.equal(created, 1);
  assert.equal(pool.references('mat:red'), 2);
  assert.equal(first.userData.__sharedResourcePool, true);
});

test('ne détruit la ressource qu’au dernier release', () => {
  const pool = new SharedResourcePool();
  const shared = pool.acquire('mat:blue', resource);
  pool.acquire('mat:blue', resource);
  assert.equal(pool.release('mat:blue'), false);
  assert.equal(shared.disposeCount, 0);
  assert.equal(pool.release('mat:blue'), true);
  assert.equal(shared.disposeCount, 1);
  assert.equal(pool.snapshot().resources, 0);
});

test('isole les clés et valide les entrées', () => {
  const pool = new SharedResourcePool();
  const a = pool.acquire('a', resource);
  const b = pool.acquire('b', resource);
  assert.notEqual(a, b);
  assert.throws(() => pool.acquire('', resource), TypeError);
  assert.throws(() => pool.acquire('c', null), TypeError);
  pool.dispose();
  assert.equal(a.disposeCount, 1);
  assert.equal(b.disposeCount, 1);
});
