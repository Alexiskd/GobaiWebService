import test from 'node:test';
import assert from 'node:assert/strict';
import { InstancedMeshBatch } from './InstancedMeshBatch.js';

class Matrix4 { constructor(value = null) { this.value = value; } }
class Color { set(value) { this.value = value; return this; } }
class InstancedMesh {
  constructor(geometry, material, capacity) {
    this.geometry = geometry; this.material = material; this.capacity = capacity;
    this.matrices = []; this.colors = []; this.instanceMatrix = { needsUpdate: false };
    this.count = 0; this.disposed = false;
  }
  setMatrixAt(i, value) { this.matrices[i] = new Matrix4(value.value); }
  getMatrixAt(i, target) { target.value = this.matrices[i]?.value; }
  setColorAt(i, value) { this.colors[i] = new Color().set(value.value); this.instanceColor ||= { needsUpdate: false }; }
  getColorAt(i, target) { target.set(this.colors[i]?.value); }
  dispose() { this.disposed = true; }
}
const THREE = { InstancedMesh, Matrix4, Color };
const resource = () => ({ disposed: 0, dispose() { this.disposed += 1; } });

test('ajoute et met à jour une instance sans dupliquer son identifiant', () => {
  const batch = new InstancedMeshBatch({ THREE, geometry: resource(), material: resource(), capacity: 2 });
  assert.equal(batch.upsert('earth', new Matrix4('m1')), 0);
  assert.equal(batch.upsert('earth', new Matrix4('m2')), 0);
  assert.equal(batch.size, 1);
  assert.equal(batch.mesh.count, 1);
  assert.equal(batch.mesh.matrices[0].value, 'm2');
});

test('refuse proprement les ajouts au-delà de la capacité', () => {
  const batch = new InstancedMeshBatch({ THREE, geometry: resource(), material: resource(), capacity: 1 });
  batch.upsert('a', new Matrix4('a'));
  assert.equal(batch.upsert('b', new Matrix4('b')), false);
  assert.equal(batch.size, 1);
});

test('retire une instance par compactage en conservant les identifiants', () => {
  const batch = new InstancedMeshBatch({ THREE, geometry: resource(), material: resource(), capacity: 3 });
  batch.upsert('a', new Matrix4('A'));
  batch.upsert('b', new Matrix4('B'));
  batch.upsert('c', new Matrix4('C'));
  assert.equal(batch.remove('b'), true);
  assert.equal(batch.has('b'), false);
  assert.equal(batch.has('c'), true);
  assert.equal(batch.mesh.matrices[1].value, 'C');
  assert.equal(batch.mesh.count, 2);
});

test('ne détruit pas les ressources empruntées et rend dispose idempotent', () => {
  const geometry = resource(); const material = resource();
  const batch = new InstancedMeshBatch({ THREE, geometry, material, capacity: 1 });
  batch.dispose(); batch.dispose();
  assert.equal(batch.mesh.disposed, true);
  assert.equal(geometry.disposed, 0);
  assert.equal(material.disposed, 0);
  assert.throws(() => batch.upsert('x', new Matrix4()), /détruit/);
});

test('détruit les ressources uniquement si le batch en est propriétaire', () => {
  const geometry = resource(); const material = resource();
  const batch = new InstancedMeshBatch({ THREE, geometry, material, capacity: 1, ownsGeometry: true, ownsMaterial: true });
  batch.dispose();
  assert.equal(geometry.disposed, 1);
  assert.equal(material.disposed, 1);
});
