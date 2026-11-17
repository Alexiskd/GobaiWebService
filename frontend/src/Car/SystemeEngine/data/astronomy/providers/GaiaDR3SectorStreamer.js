import { GaiaSectorCache } from './GaiaSectorCache.js';

const DEG = Math.PI / 180;
const validCone = ({ raDeg, decDeg, radiusDeg, limit }) => Number.isFinite(raDeg) && raDeg >= 0 && raDeg <= 360
  && Number.isFinite(decDeg) && decDeg >= -90 && decDeg <= 90
  && Number.isFinite(radiusDeg) && radiusDeg > 0 && radiusDeg <= 5
  && Number.isInteger(limit) && limit > 0;

export function gaiaRecordToHeliocentricParsecs(record) {
  const ra = Number(record?.coordinates?.raDeg);
  const dec = Number(record?.coordinates?.decDeg);
  const parallax = Number(record?.astrometry?.parallaxMas);
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(parallax) || parallax <= 0) return null;
  const distancePc = 1000 / parallax;
  if (!Number.isFinite(distancePc) || distancePc <= 0) return null;
  const raRad = ra * DEG; const decRad = dec * DEG; const cosDec = Math.cos(decRad);
  return {
    x: distancePc * cosDec * Math.cos(raRad),
    y: distancePc * cosDec * Math.sin(raRad),
    z: distancePc * Math.sin(decRad),
  };
}

function makeCacheKey({ raDeg, decDeg, radiusDeg, limit, sourceIdAfter = null }) {
  return `gaia-dr3:v2:${raDeg.toFixed(4)}:${decDeg.toFixed(4)}:${radiusDeg.toFixed(4)}:${limit}:after:${sourceIdAfter ?? 'start'}`;
}

/** Télécharge des cônes Gaia DR3 à la demande et conserve les lots en IndexedDB. */
export class GaiaDR3SectorStreamer {
  constructor({ catalogService, cache = new GaiaSectorCache(), maxConcurrent = 2, maxStarsPerCone = 500 } = {}) {
    if (!catalogService || typeof catalogService.searchGaiaCone !== 'function') throw new TypeError('catalogService.searchGaiaCone requis.');
    this.catalogService = catalogService;
    this.cache = cache;
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
    this.maxStarsPerCone = Math.max(1, Math.min(500, Math.floor(maxStarsPerCone)));
    this.inflight = new Map();
    this.queue = [];
    this.active = 0;
    this.disposed = false;
    this.stats = { cacheHits: 0, networkLoads: 0, aborted: 0, acceptedStars: 0, rejectedNoParallax: 0 };
  }

  async loadCone(input, { signal } = {}) {
    if (this.disposed) throw new Error('GaiaDR3SectorStreamer est détruit.');
    const cone = { raDeg: Number(input?.raDeg), decDeg: Number(input?.decDeg), radiusDeg: Number(input?.radiusDeg), limit: Math.min(this.maxStarsPerCone, Math.floor(Number(input?.limit) || this.maxStarsPerCone)), sourceIdAfter: input?.sourceIdAfter == null ? null : String(input.sourceIdAfter) };
    if (cone.sourceIdAfter !== null && !/^\d+$/.test(cone.sourceIdAfter)) throw new TypeError('Curseur Gaia source_id invalide.');
    if (!validCone(cone)) throw new TypeError('Cône Gaia invalide.');
    if (signal?.aborted) throw signal.reason || new DOMException('Requête annulée.', 'AbortError');
    const key = makeCacheKey(cone);
    const cached = await this.cache.get(key);
    if (cached) { this.stats.cacheHits += 1; return { ...cached, cache: 'hit' }; }
    if (this.inflight.has(key)) return this.#join(this.inflight.get(key), signal);
    const controller = new AbortController();
    const task = { key, controller, waiters: 0, settled: false };
    const promise = this.#schedule(async () => {
      this.stats.networkLoads += 1;
      const response = await this.catalogService.searchGaiaCone(cone, { signal: controller.signal });
      if (controller.signal.aborted) throw controller.signal.reason || new DOMException('Requête annulée.', 'AbortError');
      const stars = [];
      for (const record of response.records || []) {
        const positionPc = gaiaRecordToHeliocentricParsecs(record);
        if (!positionPc) { this.stats.rejectedNoParallax += 1; continue; }
        stars.push({ id: record.id, sourceId: record.sourceId, positionPc, magnitude: record.photometry?.gaiaG ?? 12, colorIndex: record.photometry?.gaiaBpMinusRp ?? null, record });
      }
      this.stats.acceptedStars += stars.length;
      const result = { key, stars, count: stars.length, retrievedAt: response.retrievedAt || new Date().toISOString(), provider: 'ESA Gaia DR3' };
      await this.cache.set(key, result);
      return result;
    }).finally(() => { task.settled = true; this.inflight.delete(key); });
    task.promise = promise;
    this.inflight.set(key, task);
    return this.#join(task, signal);
  }

  /** Charge plusieurs pages ordonnées par source_id, sans doublons, avec un plafond explicite. */
  async loadConePages(input, { signal, maxPages = 10, onPage } = {}) {
    const pageLimit = Math.max(1, Math.min(100, Math.floor(Number(maxPages) || 1)));
    const pageSize = Math.min(this.maxStarsPerCone, Math.floor(Number(input?.limit) || this.maxStarsPerCone));
    const starsById = new Map();
    let sourceIdAfter = input?.sourceIdAfter == null ? null : String(input.sourceIdAfter);
    let pagesLoaded = 0;
    let lastPage = null;
    while (pagesLoaded < pageLimit) {
      if (signal?.aborted) throw signal.reason || new DOMException('Requête annulée.', 'AbortError');
      const page = await this.loadCone({ ...input, limit: pageSize, sourceIdAfter }, { signal });
      pagesLoaded += 1;
      lastPage = page;
      for (const star of page.stars) starsById.set(String(star.sourceId ?? star.id), star);
      const ids = page.stars.map((star) => String(star.sourceId ?? '')).filter((id) => /^\d+$/.test(id)).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
      if (page.count < pageSize || ids.length === 0) break;
      const nextCursor = ids[ids.length - 1];
      if (sourceIdAfter !== null && BigInt(nextCursor) <= BigInt(sourceIdAfter)) break;
      sourceIdAfter = nextCursor;
      onPage?.({ page: pagesLoaded, count: page.count, totalUnique: starsById.size, sourceIdAfter });
    }
    const stars = [...starsById.values()];
    return { key: `gaia-dr3-pages:${lastPage?.key || 'empty'}`, stars, count: stars.length, pagesLoaded, hasMore: pagesLoaded === pageLimit && lastPage?.count === pageSize, nextSourceIdAfter: sourceIdAfter, retrievedAt: lastPage?.retrievedAt || new Date().toISOString(), provider: 'ESA Gaia DR3' };
  }

  #join(task, signal) {
    task.waiters += 1;
    if (!signal) return task.promise.finally(() => { task.waiters = Math.max(0, task.waiters - 1); });
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn, value) => { if (done) return; done = true; signal.removeEventListener('abort', onAbort); task.waiters = Math.max(0, task.waiters - 1); fn(value); };
      const onAbort = () => {
        finish(reject, signal.reason || new DOMException('Requête annulée.', 'AbortError'));
        if (!task.settled && task.waiters === 0) { task.controller.abort(); this.stats.aborted += 1; }
      };
      signal.addEventListener('abort', onAbort, { once: true });
      task.promise.then((value) => finish(resolve, value), (error) => finish(reject, error));
    });
  }

  #schedule(work) {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.active += 1;
        Promise.resolve().then(work).then(resolve, reject).finally(() => {
          this.active -= 1;
          const next = this.queue.shift(); next?.();
        });
      };
      if (this.active < this.maxConcurrent) run(); else this.queue.push(run);
    });
  }

  cancelAll(reason = 'Streaming Gaia interrompu.') {
    for (const task of this.inflight.values()) { task.controller.abort(new DOMException(reason, 'AbortError')); this.stats.aborted += 1; }
    this.inflight.clear();
  }

  getStats() { return { ...this.stats, inflight: this.inflight.size, queued: this.queue.length, active: this.active, cache: this.cache.getStats?.() || null }; }
  dispose() { if (this.disposed) return; this.disposed = true; this.cancelAll('Streamer détruit.'); }
}

export function createGaiaDR3SectorStreamer(options) { return new GaiaDR3SectorStreamer(options); }
