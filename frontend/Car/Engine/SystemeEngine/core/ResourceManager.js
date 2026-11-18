/** Gestion de durée de vie des ressources partagées (textures, géométries, buffers…). */
export class ResourceManager {
  #resources = new Map();

  acquire(key, resource, { dispose } = {}) {
    if (typeof key !== 'string' || !key) throw new TypeError('Une clé de ressource non vide est requise.');
    if (!resource) throw new TypeError(`Ressource absente pour "${key}".`);
    const current = this.#resources.get(key);
    if (current && current.resource !== resource) {
      throw new Error(`La clé "${key}" est déjà associée à une autre ressource.`);
    }
    const entry = current ?? { resource, refs: 0, dispose: dispose ?? inferDisposer(resource) };
    entry.refs += 1;
    this.#resources.set(key, entry);
    return resource;
  }

  release(key) {
    const entry = this.#resources.get(key);
    if (!entry) return false;
    entry.refs -= 1;
    if (entry.refs <= 0) {
      this.#resources.delete(key);
      entry.dispose?.(entry.resource);
    }
    return true;
  }

  get(key) { return this.#resources.get(key)?.resource ?? null; }
  getRefCount(key) { return this.#resources.get(key)?.refs ?? 0; }
  has(key) { return this.#resources.has(key); }

  disposeAll() {
    for (const entry of this.#resources.values()) entry.dispose?.(entry.resource);
    this.#resources.clear();
  }

  get size() { return this.#resources.size; }
}

function inferDisposer(resource) {
  if (typeof resource.dispose === 'function') return (value) => value.dispose();
  if (typeof resource.close === 'function') return (value) => value.close();
  return null;
}
