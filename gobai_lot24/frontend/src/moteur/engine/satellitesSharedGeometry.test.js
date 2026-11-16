import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireUnitSphereGeometry } from '../core/SharedGeometry.js';
import { SharedResourcePool } from '../core/SharedResourcePool.js';

class FakeSphereGeometry {
  constructor(radius, width, height) { this.radius = radius; this.width = width; this.height = height; this.userData = {}; this.disposed = 0; }
  dispose() { this.disposed += 1; }
}

function fakeMesh(geometry) {
  return { geometry, scale: { x: 1, y: 1, z: 1, setScalar(value) { this.x = this.y = this.z = value; } } };
}

test('les sphères des satellites partagent une topologie unitaire, avec rayons indépendants', () => {
  const pool = new SharedResourcePool();
  const THREE = { SphereGeometry: FakeSphereGeometry };
  const shared = acquireUnitSphereGeometry(pool, THREE, 64, 48);
  const io = fakeMesh(shared.geometry);
  const europa = fakeMesh(shared.geometry);
  io.scale.setScalar(1821.49);
  europa.scale.setScalar(1560.8);
  assert.equal(io.geometry, europa.geometry);
  assert.equal(io.geometry.radius, 1);
  assert.equal(io.scale.x, 1821.49);
  assert.equal(europa.scale.x, 1560.8);
  pool.release(shared.key);
  assert.equal(shared.geometry.disposed, 1);
});
