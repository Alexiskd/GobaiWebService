/**
 * Résidence logique des secteurs galactiques autour de la caméra.
 * Les transitions de ressources restent déléguées au gestionnaire de périvolumes.
 */
export class GalacticSectorStreamingManager {
  constructor({ index, enterRadiusPc = 50, exitRadiusPc = 65, maxUpdatesPerFrame = 1 } = {}) {
    if (!index || typeof index.queryRadius !== 'function') throw new TypeError('Un index spatial est requis.');
    if (!Number.isFinite(enterRadiusPc) || enterRadiusPc <= 0 || !Number.isFinite(exitRadiusPc) || exitRadiusPc < enterRadiusPc) {
      throw new RangeError('Rayons de streaming invalides.');
    }
    if (!Number.isInteger(maxUpdatesPerFrame) || maxUpdatesPerFrame < 1) throw new RangeError('maxUpdatesPerFrame invalide.');
    this.index = index;
    this.enterRadiusPc = enterRadiusPc;
    this.exitRadiusPc = exitRadiusPc;
    this.maxUpdatesPerFrame = maxUpdatesPerFrame;
    this.activeSectors = new Set();
    this.visibleIds = new Set();
    this.lastCenter = null;
    this.lastResult = { activeSectors: [], visibleIds: [], entered: [], exited: [], scanned: 0 };
    this.disposed = false;
  }

  update(centerPc, { force = false } = {}) {
    if (this.disposed) return this.lastResult;
    if (!centerPc || !['x', 'y', 'z'].every((axis) => Number.isFinite(Number(centerPc[axis])))) {
      throw new TypeError('Centre caméra en parsecs invalide.');
    }
    const center = { x: Number(centerPc.x), y: Number(centerPc.y), z: Number(centerPc.z) };
    if (!force && this.lastCenter && this.#distanceSquared(center, this.lastCenter) < 0.01) return this.lastResult;

    const candidates = this.index.queryRadius(center, this.exitRadiusPc);
    const nextSectors = new Set();
    const nextVisibleIds = new Set();
    for (const record of candidates) {
      const wasActive = this.activeSectors.has(record.sector);
      const threshold = wasActive ? this.exitRadiusPc : this.enterRadiusPc;
      if (record.distance > threshold) continue;
      nextSectors.add(record.sector);
      nextVisibleIds.add(record.id);
    }
    // Un secteur reste résident si au moins un de ses objets est dans la zone d'hystérésis.
    const entered = [...nextSectors].filter((key) => !this.activeSectors.has(key));
    const exited = [...this.activeSectors].filter((key) => !nextSectors.has(key));
    this.activeSectors = nextSectors;
    this.visibleIds = nextVisibleIds;
    this.lastCenter = center;
    this.lastResult = {
      activeSectors: [...nextSectors].sort(),
      visibleIds: [...nextVisibleIds].sort(),
      entered: entered.sort(), exited: exited.sort(), scanned: candidates.length,
    };
    return this.lastResult;
  }

  isResident(id) { return this.visibleIds.has(id); }
  getStats() {
    return { activeSectors: this.activeSectors.size, visibleSystems: this.visibleIds.size,
      enterRadiusPc: this.enterRadiusPc, exitRadiusPc: this.exitRadiusPc,
      indexedSystems: this.index.getStats().objects };
  }
  #distanceSquared(a, b) { return ['x', 'y', 'z'].reduce((sum, axis) => sum + (a[axis] - b[axis]) ** 2, 0); }
  dispose() {
    this.activeSectors.clear(); this.visibleIds.clear(); this.lastCenter = null; this.disposed = true;
    this.lastResult = { activeSectors: [], visibleIds: [], entered: [], exited: [], scanned: 0 };
  }
}

export function createGalacticSectorStreamingManager(options) { return new GalacticSectorStreamingManager(options); }
