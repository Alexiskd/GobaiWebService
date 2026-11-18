/**
 * Pool de ressources Three.js explicitement partageables.
 * Une clé doit représenter une configuration strictement identique.
 * Le pool ne déduit jamais une équivalence à partir d'un objet arbitraire.
 */
export class SharedResourcePool {
  constructor({ onDispose = null } = {}) {
    this.entries = new Map();
    this.onDispose = typeof onDispose === 'function' ? onDispose : null;
  }

  acquire(key, factory) {
    if (typeof key !== 'string' || !key.trim()) throw new TypeError('Une clé de ressource non vide est requise.');
    if (typeof factory !== 'function') throw new TypeError('factory doit être une fonction.');
    let entry = this.entries.get(key);
    if (!entry) {
      const resource = factory();
      if (!resource || typeof resource.dispose !== 'function') {
        throw new TypeError('La ressource créée doit exposer dispose().');
      }
      entry = { resource, references: 0 };
      this.entries.set(key, entry);
      if (resource.userData && typeof resource.userData === 'object') {
        resource.userData.__sharedResourcePool = true;
      }
    }
    entry.references += 1;
    return entry.resource;
  }

  release(key) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    entry.references = Math.max(0, entry.references - 1);
    if (entry.references > 0) return false;
    this.entries.delete(key);
    entry.resource.dispose();
    this.onDispose?.(key, entry.resource);
    return true;
  }

  references(key) { return this.entries.get(key)?.references || 0; }

  snapshot() {
    let references = 0;
    for (const entry of this.entries.values()) references += entry.references;
    return { resources: this.entries.size, references };
  }

  dispose() {
    for (const [key, entry] of this.entries) {
      entry.resource.dispose();
      this.onDispose?.(key, entry.resource);
    }
    this.entries.clear();
  }
}
