/**
 * Relie les pages d'un atlas multi-couches au budget GPU central.
 * Le bridge est propriétaire des inscriptions dans le budget, pas des atlas
 * ni des textures : l'éviction ciblée passe par atlas.evictPage().
 */
export class SatelliteAtlasGpuBudgetBridge {
  constructor({
    atlas,
    budgetManager,
    bytesPerPage,
    priority = 0,
    resourceIdPrefix = 'satellite-atlas',
    onError,
  } = {}) {
    if (!atlas || typeof atlas.getPageInfo !== 'function' || typeof atlas.evictPage !== 'function' || typeof atlas.get !== 'function') {
      throw new TypeError('Un atlas multi-couches compatible est requis.');
    }
    if (!budgetManager || typeof budgetManager.register !== 'function' || typeof budgetManager.pin !== 'function'
      || typeof budgetManager.unpin !== 'function' || typeof budgetManager.forget !== 'function'
      || typeof budgetManager.touch !== 'function' || typeof budgetManager.getStats !== 'function'
      || typeof budgetManager.syncPerivolumeDecisions !== 'function') {
      throw new TypeError('Un SatelliteGpuMemoryBudgetManager est requis.');
    }
    if (bytesPerPage !== undefined && typeof bytesPerPage !== 'function') throw new TypeError('bytesPerPage doit être une fonction.');
    if (!Number.isFinite(Number(priority))) throw new TypeError('priority doit être fini.');
    if (typeof resourceIdPrefix !== 'string' || !resourceIdPrefix.trim()) throw new TypeError('resourceIdPrefix doit être non vide.');
    this.atlas = atlas;
    this.budgetManager = budgetManager;
    this.bytesPerPage = bytesPerPage || ((info) => info.pageSize * info.pageSize * 4 * info.channelCount);
    this.priority = Number(priority);
    this.resourceIdPrefix = resourceIdPrefix;
    this.onError = typeof onError === 'function' ? onError : null;
    this.pages = new Map();
    this.sequence = 0;
    this.disposed = false;
  }

  /** Enregistre les nouvelles pages et réconcilie les pages évincées en interne. */
  sync() {
    this.#assertAlive();
    const liveIndexes = new Set();
    const results = { registered: [], updated: [], forgotten: [], rejected: [], withinBudget: true };

    for (let index = 0; index < this.atlas.pages.length; index += 1) {
      const info = this.atlas.getPageInfo(index);
      if (!info) continue;
      liveIndexes.add(index);
      if (typeof info.bodyId !== 'string' || !info.bodyId.trim()) {
        throw new Error(`La page atlas ${index} n'a pas de bodyId ; fournissez-le à enqueue()/TileLayer.`);
      }
      let tracked = this.pages.get(index);
      if (tracked && tracked.page !== info.page) {
        this.budgetManager.forget(tracked.resourceId);
        this.pages.delete(index);
        results.forgotten.push(tracked.resourceId);
        tracked = null;
      }
      if (!tracked) {
        const resourceId = `${this.resourceIdPrefix}:${index}:${++this.sequence}`;
        const bytes = Number(this.bytesPerPage(info));
        if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError(`Estimation mémoire invalide pour la page ${index}.`);
        const registration = this.budgetManager.register({
          id: resourceId,
          bodyId: info.bodyId,
          bytes: Math.floor(bytes),
          priority: this.priority,
          pinned: info.references > 0,
          metadata: { type: 'multilayer-atlas-page', pageIndex: index, channelCount: info.channelCount, pageSize: info.pageSize },
          evict: () => {
            const evicted = this.atlas.evictPage(index, info.page);
            if (evicted && this.pages.get(index)?.page === info.page) this.pages.delete(index);
            return evicted;
          },
        });
        if (!registration.accepted) {
          results.rejected.push({ index, resourceId, reason: registration.reason });
          continue;
        }
        this.pages.set(index, { page: info.page, resourceId, bodyId: info.bodyId });
        results.registered.push(resourceId);
        if (info.references > 0) this.budgetManager.pin(resourceId);
      } else {
        if (tracked.bodyId !== info.bodyId) throw new Error(`Le propriétaire de la page atlas ${index} a changé.`);
        this.budgetManager.touch(tracked.resourceId);
        if (info.references > 0) this.budgetManager.pin(tracked.resourceId);
        else this.budgetManager.unpin(tracked.resourceId);
        results.updated.push(tracked.resourceId);
      }
      if (this.atlas.getPageInfo(index)?.page !== info.page) {
        const current = this.pages.get(index);
        if (current?.page === info.page) this.pages.delete(index);
      }
    }

    for (const [index, tracked] of [...this.pages]) {
      if (!liveIndexes.has(index) || this.atlas.getPageInfo(index)?.page !== tracked.page) {
        this.budgetManager.forget(tracked.resourceId);
        this.pages.delete(index);
        results.forgotten.push(tracked.resourceId);
      }
    }
    const budgetStats = this.budgetManager.getStats();
    const bodiesWithinBudget = Object.values(budgetStats.byBody).every((body) => body.bytes <= body.budgetBytes);
    results.withinBudget = results.withinBudget && budgetStats.usedBytes <= budgetStats.globalBudgetBytes && bodiesWithinBudget;
    return Object.freeze({
      ...results,
      registered: Object.freeze(results.registered),
      updated: Object.freeze(results.updated),
      forgotten: Object.freeze(results.forgotten),
      rejected: Object.freeze(results.rejected),
    });
  }

  /** Retient une entrée atlas et épingle sa page dans le budget GPU. */
  retainEntry(id) {
    this.#assertAlive();
    const entry = this.atlas.get(id);
    if (!entry || !this.atlas.retain(id)) return false;
    try {
      this.sync();
      const tracked = this.pages.get(entry.pageIndex);
      if (!tracked || tracked.page !== this.atlas.getPageInfo(entry.pageIndex)?.page) {
        this.atlas.release(id);
        return false;
      }
      this.budgetManager.pin(tracked.resourceId);
      this.budgetManager.touch(tracked.resourceId);
      return true;
    } catch (error) {
      this.atlas.release(id);
      this.onError?.(error, id);
      return false;
    }
  }

  /** Libère l'entrée puis autorise l'éviction de sa page si elle devient inactive. */
  releaseEntry(id) {
    this.#assertAlive();
    const entry = this.atlas.get(id);
    const released = this.atlas.release(id);
    if (!released) return false;
    if (entry) {
      const tracked = this.pages.get(entry.pageIndex);
      if (tracked) {
        const info = this.atlas.getPageInfo(entry.pageIndex);
        if (info?.page === tracked.page && info.references === 0) this.budgetManager.unpin(tracked.resourceId);
      }
    }
    this.sync();
    return true;
  }

  touchEntry(id) {
    this.#assertAlive();
    const entry = this.atlas.get(id);
    if (!entry) return false;
    const tracked = this.pages.get(entry.pageIndex);
    if (!tracked) return false;
    this.budgetManager.touch(tracked.resourceId);
    return true;
  }

  syncPerivolumeDecisions(decisions) {
    this.#assertAlive();
    this.budgetManager.syncPerivolumeDecisions(decisions);
    return this.sync();
  }

  getStats() {
    this.#assertAlive();
    return Object.freeze({ trackedPages: this.pages.size, budget: this.budgetManager.getStats() });
  }

  /** Détache les inscriptions ; l'atlas et ses textures restent la propriété de l'appelant. */
  dispose() {
    if (this.disposed) return;
    for (const tracked of this.pages.values()) this.budgetManager.forget(tracked.resourceId);
    this.pages.clear();
    this.disposed = true;
  }

  #assertAlive() {
    if (this.disposed) throw new Error('SatelliteAtlasGpuBudgetBridge est déjà libéré.');
  }
}
