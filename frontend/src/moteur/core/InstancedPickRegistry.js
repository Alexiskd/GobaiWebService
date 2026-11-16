/**
 * Lot 13 — pont de picking pour les InstancedMesh.
 * Les identifiants sont lus dynamiquement depuis batch.ids : les suppressions par compactage
 * d'InstancedMeshBatch ne désynchronisent donc pas instanceId → identifiant métier.
 */
export class InstancedPickRegistry {
  constructor() {
    this.batches = new Map();
    this.disposed = false;
  }

  register(batch) {
    this.#assertAlive();
    const mesh = batch?.mesh;
    if (!mesh || !Array.isArray(batch.ids)) throw new TypeError('Un InstancedMeshBatch valide est requis.');
    if (this.batches.has(mesh)) throw new Error('Ce mesh instancié est déjà enregistré.');
    this.batches.set(mesh, batch);
    let active = true;
    return () => {
      if (!active) return false;
      active = false;
      return this.batches.delete(mesh);
    };
  }

  resolve(intersection) {
    if (!intersection || !Number.isInteger(intersection.instanceId)) return null;
    const batch = this.batches.get(intersection.object);
    if (!batch || batch.disposed) return null;
    return batch.ids[intersection.instanceId] ?? null;
  }

  getObjects() {
    this.#assertAlive();
    return [...this.batches.keys()];
  }

  dispose() {
    if (this.disposed) return;
    this.batches.clear();
    this.disposed = true;
  }

  #assertAlive() {
    if (this.disposed) throw new Error('InstancedPickRegistry est déjà détruit.');
  }
}
