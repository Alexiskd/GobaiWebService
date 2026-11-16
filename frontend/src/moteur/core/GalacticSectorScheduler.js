const DEG = Math.PI / 180;

function normalizeRa(value) { return ((value % 360) + 360) % 360; }
function angularDistanceDeg(a, b) {
  const ra1 = a.raDeg * DEG; const ra2 = b.raDeg * DEG;
  const dec1 = a.decDeg * DEG; const dec2 = b.decDeg * DEG;
  const cosine = Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / DEG;
}

/**
 * Planificateur borné de tuiles célestes Gaia autour de la direction caméra.
 * Il reste désactivé par défaut : l'application doit l'activer explicitement.
 */
export class GalacticSectorScheduler {
  constructor({ streamer, onSectorLoaded, onSectorEvicted, onSectorError, maxConcurrent = 1, maxQueued = 8, maxPrefetchSectors = 5, maxPages = 1, maxPagesPerSector = 5, pageSize = 500, retryDelayMs = 15000 } = {}) {
    if (!streamer || typeof streamer.loadConePages !== 'function') throw new TypeError('Un GaiaDR3SectorStreamer est requis.');
    if (typeof onSectorLoaded !== 'function') throw new TypeError('onSectorLoaded est requis.');
    this.streamer = streamer;
    this.onSectorLoaded = onSectorLoaded;
    this.onSectorEvicted = onSectorEvicted;
    this.onSectorError = onSectorError;
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    this.maxQueued = Math.max(1, Math.floor(maxQueued));
    this.maxPrefetchSectors = Math.max(1, Math.floor(maxPrefetchSectors));
    this.maxPages = Math.max(1, Math.min(100, Math.floor(maxPages)));
    this.maxPagesPerSector = Math.max(this.maxPages, Math.min(500, Math.floor(maxPagesPerSector)));
    this.pageCountBySector = new Map();
    this.maxLoadedCursors = new Map();
    this.pageSize = Math.max(1, Math.min(500, Math.floor(pageSize)));
    this.retryDelayMs = Math.max(0, Number(retryDelayMs) || 0);
    this.enabled = false;
    this.queue = [];
    this.inflight = new Map();
    this.loaded = new Set();
    this.sectorStarIds = new Map();
    this.failures = new Map();
    this.active = 0;
    this.disposed = false;
    this.lastView = null;
    this.stats = { scheduled: 0, completed: 0, failed: 0, aborted: 0, skippedLoaded: 0, skippedBackoff: 0 };
  }

  setEnabled(enabled) {
    if (this.disposed) return false;
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.cancelPending('Streaming Gaia désactivé.');
    return this.enabled;
  }

  updateView({ raDeg, decDeg, radiusDeg = 1 } = {}) {
    if (this.disposed || !this.enabled) return this.getStats();
    const view = { raDeg: Number(raDeg), decDeg: Number(decDeg), radiusDeg: Number(radiusDeg) };
    if (!Number.isFinite(view.raDeg) || view.raDeg < 0 || view.raDeg > 360 || !Number.isFinite(view.decDeg) || view.decDeg < -90 || view.decDeg > 90 || !Number.isFinite(view.radiusDeg) || view.radiusDeg <= 0 || view.radiusDeg > 5) {
      throw new TypeError('Direction ou rayon de streaming Gaia invalide.');
    }
    this.lastView = view;
    const sectors = this.#buildSectors(view);
    const desired = new Set(sectors.map((sector) => sector.key));
    for (const key of new Set([...this.loaded, ...this.sectorStarIds.keys()])) {
      if (desired.has(key)) continue;
      const starIds = [...(this.sectorStarIds.get(key) || [])];
      this.onSectorEvicted?.({ key, starIds });
      this.loaded.delete(key);
      this.sectorStarIds.delete(key);
      this.pageCountBySector.delete(key);
      this.maxLoadedCursors.delete(key);
    }

    // Annule les téléchargements et retire les tâches qui ne servent plus le champ courant.
    for (const [key, task] of this.inflight) {
      if (!desired.has(key)) {
        task.controller.abort(new DOMException('Secteur sorti du champ de préchargement.', 'AbortError'));
        this.stats.aborted += 1;
      }
    }
    this.queue = this.queue.filter((task) => desired.has(task.key));

    for (const sector of sectors) {
      if (this.loaded.has(sector.key) || this.inflight.has(sector.key) || this.queue.some((task) => task.key === sector.key)) {
        if (this.loaded.has(sector.key)) this.stats.skippedLoaded += 1;
        continue;
      }
      const failedAt = this.failures.get(sector.key);
      if (failedAt && Date.now() - failedAt < this.retryDelayMs) { this.stats.skippedBackoff += 1; continue; }
      const continuation = this.maxLoadedCursors.get(sector.key);
      this.queue.push(continuation ? { ...sector, sourceIdAfter: continuation } : sector);
      this.stats.scheduled += 1;
    }
    this.queue.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
    if (this.queue.length > this.maxQueued) this.queue.length = this.maxQueued;
    this.#pump();
    return this.getStats();
  }

  #buildSectors(view) {
    const step = Math.max(0.1, view.radiusDeg * 1.5);
    const decCell = Math.max(-90 + step / 2, Math.min(90 - step / 2, Math.floor((view.decDeg + 90) / step) * step - 90 + step / 2));
    const cosDec = Math.max(0.2, Math.cos(view.decDeg * DEG));
    const raStep = step / cosDec;
    const raCell = normalizeRa(Math.floor(view.raDeg / raStep) * raStep + raStep / 2);
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    return offsets.slice(0, this.maxPrefetchSectors).map(([dx, dy]) => {
      const dec = Math.max(-90, Math.min(90, decCell + dy * step));
      const ra = normalizeRa(raCell + dx * raStep);
      const center = { raDeg: ra, decDeg: dec };
      const key = `gaia-sky:${ra.toFixed(4)}:${dec.toFixed(4)}:${step.toFixed(4)}`;
      return { key, raDeg: ra, decDeg: dec, radiusDeg: Math.min(5, step * 0.78), limit: this.pageSize, priority: angularDistanceDeg(view, center) };
    }).sort((a, b) => a.priority - b.priority);
  }

  #pump() {
    while (!this.disposed && this.enabled && this.active < this.maxConcurrent && this.queue.length) {
      const task = this.queue.shift();
      if (this.inflight.has(task.key) || this.loaded.has(task.key)) continue;
      const controller = new AbortController();
      this.inflight.set(task.key, { controller, task });
      this.active += 1;
      this.streamer.loadConePages(task, { signal: controller.signal, maxPages: this.maxPages })
        .then((result) => {
          if (controller.signal.aborted || this.disposed || !this.enabled) return;
          const pageCount = (this.pageCountBySector.get(task.key) || 0) + (result.pagesLoaded || 1);
          this.pageCountBySector.set(task.key, pageCount);
          this.failures.delete(task.key);
          this.stats.completed += 1;
          const sectorIds = this.sectorStarIds.get(task.key) || new Set();
          for (const star of result.stars || []) if (star?.id) sectorIds.add(star.id);
          this.sectorStarIds.set(task.key, sectorIds);
          this.onSectorLoaded({ ...task, result });
          if (result.hasMore && result.nextSourceIdAfter && pageCount < this.maxPagesPerSector) {
            this.maxLoadedCursors.set(task.key, result.nextSourceIdAfter);
            this.queue.push({ ...task, sourceIdAfter: result.nextSourceIdAfter, priority: task.priority + 0.001 });
            this.queue.sort((a, b) => a.priority - b.priority || a.key.localeCompare(b.key));
          } else {
            this.loaded.add(task.key);
            this.maxLoadedCursors.delete(task.key);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted || error?.name === 'AbortError') return;
          this.failures.set(task.key, Date.now());
          this.stats.failed += 1;
          this.onSectorError?.({ ...task, error });
        })
        .finally(() => {
          this.inflight.delete(task.key);
          this.active = Math.max(0, this.active - 1);
          this.#pump();
        });
    }
  }

  cancelPending(reason = 'Streaming Gaia interrompu.') {
    this.queue.length = 0;
    for (const task of this.inflight.values()) task.controller.abort(new DOMException(reason, 'AbortError'));
  }

  getStats() {
    return { enabled: this.enabled, queued: this.queue.length, active: this.active, inflight: this.inflight.size,
      loadedSectors: this.loaded.size, failedSectors: this.failures.size, maxConcurrent: this.maxConcurrent,
      maxQueued: this.maxQueued, maxPages: this.maxPages, maxPagesPerSector: this.maxPagesPerSector, pageSize: this.pageSize, ...this.stats };
  }

  dispose() {
    if (this.disposed) return;
    this.enabled = false;
    this.cancelPending('Planificateur détruit.');
    this.disposed = true;
    this.loaded.clear(); this.sectorStarIds.clear(); this.failures.clear(); this.pageCountBySector.clear(); this.maxLoadedCursors.clear(); this.lastView = null;
  }
}

export function createGalacticSectorScheduler(options) { return new GalacticSectorScheduler(options); }
