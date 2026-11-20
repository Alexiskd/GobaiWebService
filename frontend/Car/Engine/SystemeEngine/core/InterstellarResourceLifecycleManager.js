/** Gestion du cycle de vie CPU/GPU des systèmes stellaires externes. */
export class InterstellarResourceLifecycleManager {
  constructor({ onError = () => {} } = {}) {
    this.records = new Map();
    this.onError = onError;
    this.disposed = false;
  }

  register(id, { release = () => {}, restore = () => {}, abortController = null } = {}) {
    if (this.disposed) throw new Error('Le gestionnaire de ressources est détruit.');
    if (!id || this.records.has(id)) throw new Error(`Système interstellaire déjà enregistré ou identifiant invalide : ${id}`);
    this.records.set(id, { id, release, restore, abortController, state: 'ACTIVE', released: false });
    return () => this.unregister(id);
  }

  attachAbortController(id, controller) {
    const record = this.records.get(id);
    if (!record || !controller?.abort) return false;
    record.abortController = controller;
    return true;
  }

  update(id, state) {
    const record = this.records.get(id);
    if (!record) return false;
    const next = String(state || 'ACTIVE').toUpperCase();
    if (!['ACTIVE', 'BACKGROUND', 'UNLOADED'].includes(next)) throw new TypeError(`État de chargement inconnu : ${state}`);
    if (next === record.state) return false;
    try {
      if (next === 'UNLOADED') {
        record.abortController?.abort?.();
        record.abortController = null;
        if (!record.released) record.release();
        record.released = true;
      } else if (record.released) {
        record.restore();
        record.released = false;
      }
      record.state = next;
      return true;
    } catch (error) {
      this.onError(error, id, next);
      return false;
    }
  }

  unregister(id) {
    const record = this.records.get(id);
    if (!record) return false;
    record.abortController?.abort?.();
    if (!record.released) {
      try { record.release(); } catch (error) { this.onError(error, id, 'DISPOSE'); }
    }
    this.records.delete(id);
    return true;
  }

  getState(id) { return this.records.get(id)?.state ?? null; }
  getStats() {
    return { systems: this.records.size, loaded: [...this.records.values()].filter((item) => !item.released).length,
      unloaded: [...this.records.values()].filter((item) => item.released).length };
  }
  dispose() {
    if (this.disposed) return;
    for (const id of [...this.records.keys()]) this.unregister(id);
    this.disposed = true;
  }
}

export function createInterstellarResourceLifecycleManager(options) {
  return new InterstellarResourceLifecycleManager(options);
}
