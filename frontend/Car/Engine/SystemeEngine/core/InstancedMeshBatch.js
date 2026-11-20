/**
 * Lot 11 — conteneur d'instances Three.js avec identifiants stables.
 * La géométrie et le matériau sont empruntés par défaut : le batch ne les détruit pas.
 * Les transformations sont fournies sous forme de Matrix4 déjà calculée par le moteur appelant.
 */
export class InstancedMeshBatch {
  constructor({ THREE, geometry, material, capacity = 256, name = 'instanced-batch', ownsGeometry = false, ownsMaterial = false }) {
    if (!THREE || typeof THREE.InstancedMesh !== 'function') throw new TypeError('THREE.InstancedMesh est requis.');
    if (!geometry || !material) throw new TypeError('Une géométrie et un matériau sont requis.');
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity doit être un entier positif.');
    this.THREE = THREE;
    this.geometry = geometry;
    this.material = material;
    this.capacity = capacity;
    this.ownsGeometry = Boolean(ownsGeometry);
    this.ownsMaterial = Boolean(ownsMaterial);
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = name;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.ids = [];
    this.indexById = new Map();
    this.disposed = false;
    this.color = typeof THREE.Color === 'function' ? new THREE.Color() : null;
  }

  upsert(id, matrix, color = null) {
    this.#assertAlive();
    if (id === null || id === undefined || id === '') throw new TypeError('Un identifiant non vide est requis.');
    if (!matrix || typeof matrix !== 'object') throw new TypeError('Une Matrix4 est requise.');
    let index = this.indexById.get(id);
    if (index === undefined) {
      if (this.ids.length >= this.capacity) return false;
      index = this.ids.length;
      this.ids.push(id);
      this.indexById.set(id, index);
    }
    this.mesh.setMatrixAt(index, matrix);
    if (color !== null && typeof this.mesh.setColorAt === 'function' && this.color) {
      this.color.set(color);
      this.mesh.setColorAt(index, this.color);
    }
    this.mesh.count = this.ids.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return index;
  }

  remove(id) {
    this.#assertAlive();
    const index = this.indexById.get(id);
    if (index === undefined) return false;
    const lastIndex = this.ids.length - 1;
    if (index !== lastIndex) {
      const lastId = this.ids[lastIndex];
      const matrix = new this.THREE.Matrix4();
      this.mesh.getMatrixAt(lastIndex, matrix);
      this.mesh.setMatrixAt(index, matrix);
      if (this.mesh.instanceColor && typeof this.mesh.getColorAt === 'function' && typeof this.mesh.setColorAt === 'function') {
        const color = new this.THREE.Color();
        this.mesh.getColorAt(lastIndex, color);
        this.mesh.setColorAt(index, color);
      }
      this.ids[index] = lastId;
      this.indexById.set(lastId, index);
    }
    this.ids.pop();
    this.indexById.delete(id);
    this.mesh.count = this.ids.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return true;
  }

  has(id) { return this.indexById.has(id); }
  get size() { return this.ids.length; }

  #assertAlive() {
    if (this.disposed) throw new Error('InstancedMeshBatch est déjà détruit.');
  }

  dispose() {
    if (this.disposed) return;
    this.mesh.count = 0;
    this.mesh.dispose?.();
    if (this.ownsGeometry) this.geometry.dispose?.();
    if (this.ownsMaterial) {
      if (Array.isArray(this.material)) this.material.forEach((item) => item?.dispose?.());
      else this.material.dispose?.();
    }
    this.ids.length = 0;
    this.indexById.clear();
    this.disposed = true;
  }
}
