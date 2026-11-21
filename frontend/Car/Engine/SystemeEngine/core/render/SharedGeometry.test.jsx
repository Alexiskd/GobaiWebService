import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireUnitSphereGeometry, unitSphereGeometryKey } from './SharedGeometry.js';
import { SharedResourcePool } from '../system/SharedResourcePool.js';

 test('la clé distingue les topologies et rejette les segments invalides', () => {
  assert.equal(unitSphereGeometryKey(48, 32), 'unit-sphere:48:32');
  assert.notEqual(unitSphereGeometryKey(48, 32), unitSphereGeometryKey(96, 64));
  assert.throws(() => unitSphereGeometryKey(2, 32), RangeError);
});

test('les sphères unitaires identiques sont partagées et libérées à la dernière référence', () => {
  let created = 0;
  let disposed = 0;
  class FakeSphereGeometry {
    constructor(radius, width, height) { this.radius = radius; this.width = width; this.height = height; this.userData = {}; created += 1; }
    dispose() { disposed += 1; }
  }
  const pool = new SharedResourcePool();
  const THREE = { SphereGeometry: FakeSphereGeometry };
  const a = acquireUnitSphereGeometry(pool, THREE, 48, 32);
  const b = acquireUnitSphereGeometry(pool, THREE, 48, 32);
  assert.equal(a.geometry, b.geometry);
  assert.equal(a.geometry.radius, 1);
  assert.equal(created, 1);
  assert.equal(pool.references(a.key), 2);
  assert.equal(pool.release(a.key), false);
  assert.equal(disposed, 0);
  assert.equal(pool.release(b.key), true);
  assert.equal(disposed, 1);
});
