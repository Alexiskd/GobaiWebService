/**
 * Budget mémoire CPU du catalogue Gaia chargé en streaming.
 * Les secteurs demandés par la vue sont épinglés ; les autres sont évincés en LRU.
 * L'estimation inclut une marge pour les objets JS et leurs index, pas seulement les Float32.
 */
export class GalacticCatalogResidencyManager {
  constructor({ maxSectors = 24, maxStars = 250_000, maxEstimatedBytes = 96 * 1024 * 1024, bytesPerStar = 384, onEvict, now = () => Date.now() } = {}) {
    this.maxSectors = Math.max(1, Math.floor(Number(maxSectors) || 1));
    this.maxStars = Math.max(1, Math.floor(Number(maxStars) || 1));
    this.maxEstimatedBytes = Math.max(1024, Math.floor(Number(maxEstimatedBytes) || 1024));
    this.bytesPerStar = Math.max(64, Math.floor(Number(bytesPerStar) || 384));
    this.onEvict = onEvict;
    this.now = now;
    this.sectors = new Map();
    this.pinned = new Set();
    this.disposed = false;
    this.stats = { registrations: 0, evictions: 0, budgetBlocked: 0 };
  }

  setBudget({ maxSectors, maxStars, maxEstimatedBytes, bytesPerStar } = {}) {
    if (maxSectors !== undefined) this.maxSectors = Math.max(1, Math.floor(Number(maxSectors) || 1));
    if (maxStars !== undefined) this.maxStars = Math.max(1, Math.floor(Number(maxStars) || 1));
    if (maxEstimatedBytes !== undefined) this.maxEstimatedBytes = Math.max(1024, Math.floor(Number(maxEstimatedBytes) || 1024));
    if (bytesPerStar !== undefined) this.bytesPerStar = Math.max(64, Math.floor(Number(bytesPerStar) || 64));
    this.#enforceBudget();
    return this.getStats();
  }

  setPinned(keys = []) {
    if (this.disposed) return this.getStats();
    this.pinned = new Set(keys);
    for (const key of this.pinned) this.touchSector(key);
    this.#enforceBudget();
    return this.getStats();
  }

  registerSector(key, starIds = [], { cursor = null, pageCount = 0 } = {}) {
    if (this.disposed || !key) return this.getStats();
    const previous = this.sectors.get(key);
    const ids = new Set([...(previous?.starIds || []), ...starIds].filter(Boolean));
    this.sectors.set(key, { key, starIds: ids, lastAccess: this.now(), cursor, pageCount: Math.max(0, Number(pageCount) || 0) });
    this.stats.registrations += 1;
    this.#enforceBudget();
    return this.getStats();
  }

  touchSector(key) {
    const record = this.sectors.get(key);
    if (record) record.lastAccess = this.now();
    return Boolean(record);
  }

  removeSector(key) {
    return this.sectors.delete(key);
  }

  #totals() {
    let stars = 0;
    for (const record of this.sectors.values()) stars += record.starIds.size;
    // Les doublons inter-secteurs sont comptés par secteur : estimation volontairement prudente.
    return { sectors: this.sectors.size, stars, estimatedBytes: stars * this.bytesPerStar };
  }

  #overBudget() {
    const totals = this.#totals();
    return totals.sectors > this.maxSectors || totals.stars > this.maxStars || totals.estimatedBytes > this.maxEstimatedBytes;
  }

  #enforceBudget() {
    while (this.#overBudget()) {
      let candidate = null;
      for (const record of this.sectors.values()) {
        if (this.pinned.has(record.key)) continue;
        if (!candidate || record.lastAccess < candidate.lastAccess) candidate = record;
      }
      if (!candidate) { this.stats.budgetBlocked += 1; break; }
      this.sectors.delete(candidate.key);
      this.stats.evictions += 1;
      this.onEvict?.({ key: candidate.key, starIds: [...candidate.starIds], reason: 'lru-memory-budget' });
    }
  }

  getStats() {
    const totals = this.#totals();
    return { ...totals, pinnedSectors: this.pinned.size, maxSectors: this.maxSectors, maxStars: this.maxStars,
      maxEstimatedBytes: this.maxEstimatedBytes, bytesPerStar: this.bytesPerStar, ...this.stats };
  }

  dispose() { this.disposed = true; this.sectors.clear(); this.pinned.clear(); }
}

export function createGalacticCatalogResidencyManager(options) { return new GalacticCatalogResidencyManager(options); }
