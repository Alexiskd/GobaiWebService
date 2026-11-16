import { SatelliteAtlasPageAllocator } from './SatelliteTextureAtlas.js';

const DEFAULT_CHANNELS = Object.freeze(['color', 'elevation', 'normal', 'night']);

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${label} doit être positif et fini.`);
  return Math.floor(number);
}

/**
 * Atlas multi-couches : une seule allocation UV est partagée par tous les
 * canaux d'une page. Chaque canal possède sa propre texture GPU et son blit.
 * Les callbacks createPage/blit sont injectés pour garder le module testable
 * sans DOM ni WebGL.
 */
export class SatelliteMultiLayerTextureAtlasManager {
  constructor({ pageSize = 2048, gutter = 4, maxPages = 4, channels, onError } = {}) {
    this.pageSize = positiveInteger(pageSize, 'pageSize');
    this.gutter = positiveInteger(gutter, 'gutter');
    this.maxPages = positiveInteger(maxPages, 'maxPages');
    const definitions = channels || {};
    const names = Object.keys(definitions);
    if (!names.length) throw new TypeError('Au moins un canal atlas doit être configuré.');
    for (const name of names) {
      const channel = definitions[name];
      if (!channel || typeof channel.createPage !== 'function' || typeof channel.blit !== 'function') {
        throw new TypeError(`Le canal ${name} doit fournir createPage et blit.`);
      }
    }
    this.channelNames = Object.freeze(names);
    this.channels = definitions;
    this.onError = typeof onError === 'function' ? onError : null;
    this.pages = [];
    this.entries = new Map();
    this.entryReferences = new Map();
    this.pageReferences = new Map();
    this.queue = new Map();
    this.sequence = 0;
    this.useSequence = 0;
    this.disposed = false;
  }

  enqueue({ id, width, height, layers, priority = 0, metadata = null, bodyId = metadata?.bodyId ?? null }) {
    this.#assertAlive();
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('id doit être une chaîne non vide.');
    if (this.entries.has(id)) throw new Error(`La surface ${id} est déjà chargée.`);
    const w = positiveInteger(width, 'width');
    const h = positiveInteger(height, 'height');
    if (!layers || typeof layers !== 'object' || Array.isArray(layers)) throw new TypeError('layers doit être un objet de sources par canal.');
    const layerEntries = Object.entries(layers);
    if (!layerEntries.length) throw new TypeError('Au moins une source de couche est requise.');
    for (const [name, source] of layerEntries) {
      if (!this.channels[name]) throw new Error(`Canal atlas non configuré : ${name}`);
      if (!source) throw new TypeError(`La source du canal ${name} est vide.`);
    }
    if (bodyId !== null && (typeof bodyId !== 'string' || !bodyId.trim())) throw new TypeError('bodyId doit être une chaîne non vide ou null.');
    const p = Number(priority);
    if (!Number.isFinite(p)) throw new TypeError('priority doit être fini.');
    this.queue.set(id, {
      id, width: w, height: h, layers: Object.fromEntries(layerEntries), priority: p, bodyId,
      metadata, sequence: this.queue.get(id)?.sequence ?? this.sequence++,
    });
    return id;
  }

  processQueue(maxItems = 1) {
    this.#assertAlive();
    if (!Number.isInteger(maxItems) || maxItems < 0) throw new RangeError('maxItems doit être un entier positif ou nul.');
    const pending = [...this.queue.values()].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    const completed = [];
    for (const item of pending) {
      if (completed.length >= maxItems) break;
      const slot = this.#allocate(item);
      if (!slot) continue;
      try {
        const textures = {};
        for (const channelName of this.channelNames) {
          const source = item.layers[channelName];
          if (!source) continue; // Canal optionnel : page initialisée par createPage().
          const channelPage = slot.page.layerPages[channelName];
          this.channels[channelName].blit(channelPage, source, slot.allocation, channelName);
          if (channelPage.texture) channelPage.texture.needsUpdate = true;
          textures[channelName] = channelPage.texture;
        }
        const entry = Object.freeze({
          id: item.id,
          pageIndex: slot.pageIndex,
          allocation: slot.allocation,
          uv: new Float32Array(slot.allocation.uv),
          textures: Object.freeze(textures),
          layers: Object.freeze(Object.keys(item.layers)),
          sourceWidth: item.width,
          sourceHeight: item.height,
          scale: slot.allocation.scale,
          metadata: item.metadata,
          status: 'ready',
        });
        this.entries.set(item.id, entry);
        this.entryReferences.set(item.id, 0);
        slot.page.lastUsed = ++this.useSequence;
        this.queue.delete(item.id);
        completed.push(entry);
      } catch (error) {
        this.queue.delete(item.id);
        this.onError?.(error, item.id);
      }
    }
    return completed;
  }

  cancelQueued(id) { this.#assertAlive(); return this.queue.delete(id); }
  get(id) { return this.entries.get(id) || null; }
  getRect(id) { const entry = this.get(id); return entry ? new Float32Array(entry.uv) : null; }
  getPendingCount() { return this.queue.size; }
  getPageCount() { return this.pages.reduce((count, page) => count + (page ? 1 : 0), 0); }

  /** Informations stables pour un adaptateur de budget mémoire. */
  getPageInfo(index) {
    const page = this.pages[index];
    if (!page) return null;
    return Object.freeze({
      index, page, bodyId: page.bodyId, pageSize: this.pageSize,
      channelCount: this.channelNames.length, channelNames: this.channelNames,
      references: this.pageReferences.get(index) || 0, lastUsed: page.lastUsed || 0,
    });
  }

  /** Détruit une page précise uniquement si aucune tuile ne la référence. */
  evictPage(index, expectedPage = null) {
    this.#assertAlive();
    if (!Number.isInteger(index) || index < 0) throw new RangeError('index de page invalide.');
    const page = this.pages[index];
    if (!page || (expectedPage && page !== expectedPage)) return false;
    if ((this.pageReferences.get(index) || 0) > 0) return false;
    for (const [id, entry] of this.entries) {
      if (entry.pageIndex === index) {
        this.entries.delete(id);
        this.entryReferences.delete(id);
      }
    }
    this.#disposePage(page);
    this.pages[index] = null;
    this.pageReferences.delete(index);
    return true;
  }

  /**
   * Détruit les pages sans aucune référence vivante. Toutes les entrées de ces
   * pages sont invalidées avant texture.dispose(), puis l'index est recyclable.
   * keepPages est le nombre de pages inactives à conserver au maximum.
   */
  evictIdlePages({ keepPages = 0, maxPagesToEvict = Infinity } = {}) {
    this.#assertAlive();
    if (!Number.isInteger(keepPages) || keepPages < 0) throw new RangeError('keepPages doit être un entier positif ou nul.');
    if (!(maxPagesToEvict === Infinity || (Number.isInteger(maxPagesToEvict) && maxPagesToEvict >= 0))) throw new RangeError('maxPagesToEvict invalide.');
    const idle = this.pages
      .map((page, index) => page && (this.pageReferences.get(index) || 0) === 0 ? { page, index, lastUsed: page.lastUsed || 0 } : null)
      .filter(Boolean)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    const toEvict = idle.slice(0, Math.min(Math.max(0, idle.length - keepPages), maxPagesToEvict));
    for (const { page, index } of toEvict) this.evictPage(index, page);
    return toEvict.map(({ index }) => index);
  }

  /** Retient une entrée tant qu'une tuile ou un matériau la référence. */
  retain(id) {
    this.#assertAlive();
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.entryReferences.set(id, (this.entryReferences.get(id) || 0) + 1);
    this.pageReferences.set(entry.pageIndex, (this.pageReferences.get(entry.pageIndex) || 0) + 1);
    return true;
  }

  /** Libère une référence logique ; la page GPU reste vivante jusqu'à dispose(). */
  release(id) {
    this.#assertAlive();
    this.queue.delete(id);
    const entry = this.entries.get(id);
    if (!entry) return false;
    const references = this.entryReferences.get(id) || 0;
    if (references > 0) {
      this.entryReferences.set(id, references - 1);
      this.pageReferences.set(entry.pageIndex, Math.max(0, (this.pageReferences.get(entry.pageIndex) || 0) - 1));
      if (references > 1) return true;
    }
    this.entries.delete(id);
    this.entryReferences.delete(id);
    return true;
  }

  /** Estimation RGBA8 ; ne remplace pas une mesure GPU du navigateur. */
  getMemoryStats() {
    const bytesPerPage = this.pageSize * this.pageSize * 4 * this.channelNames.length;
    let allocatedPixels = 0;
    for (const page of this.pages) if (page) allocatedPixels += page.allocator.allocations.size;
    let liveReferences = 0;
    for (const count of this.entryReferences.values()) liveReferences += count;
    return Object.freeze({
      pageCount: this.getPageCount(),
      channelCount: this.channelNames.length,
      estimatedGpuBytes: bytesPerPage * this.getPageCount(),
      estimatedGpuMiB: (bytesPerPage * this.getPageCount()) / (1024 * 1024),
      liveEntries: this.entries.size,
      pendingEntries: this.queue.size,
      liveReferences,
      pageReferences: Object.freeze(Object.fromEntries(this.pageReferences)),
      allocatedSlots: allocatedPixels,
      maxPages: this.maxPages,
      disposed: this.disposed,
    });
  }

  dispose() {
    if (this.disposed) return;
    for (const page of this.pages) if (page) this.#disposePage(page);
    this.pages.length = 0;
    this.entries.clear();
    this.entryReferences.clear();
    this.pageReferences.clear();
    this.queue.clear();
    this.disposed = true;
  }

  #disposePage(page) {
    for (const layerPage of Object.values(page.layerPages)) {
      layerPage.texture?.dispose?.();
      layerPage.dispose?.();
    }
  }

  #assertAlive() {
    if (this.disposed) throw new Error('SatelliteMultiLayerTextureAtlasManager est déjà libéré.');
  }

  #allocate(item) {
    for (let index = 0; index < this.pages.length; index += 1) {
      const current = this.pages[index];
      if (!current || current.bodyId !== item.bodyId) continue;
      const allocation = current.allocator.allocate(item.id, item.width, item.height);
      if (allocation) return { page: current, pageIndex: index, allocation };
    }
    if (this.getPageCount() >= this.maxPages) this.evictIdlePages({ keepPages: Math.max(0, this.maxPages - 1), maxPagesToEvict: 1 });
    if (this.getPageCount() >= this.maxPages) return null;
    const page = { allocator: new SatelliteAtlasPageAllocator({ pageSize: this.pageSize, gutter: this.gutter }), layerPages: {}, bodyId: item.bodyId, lastUsed: ++this.useSequence };
    let index = this.pages.findIndex((candidate) => candidate === null);
    if (index < 0) index = this.pages.length;
    try {
      for (const channelName of this.channelNames) {
        const layerPage = this.channels[channelName].createPage({ pageSize: this.pageSize, index, channel: channelName });
        if (!layerPage?.texture) throw new TypeError(`createPage du canal ${channelName} doit retourner une texture.`);
        page.layerPages[channelName] = layerPage;
      }
    } catch (error) {
      for (const layerPage of Object.values(page.layerPages)) {
        layerPage.texture?.dispose?.();
        layerPage.dispose?.();
      }
      throw error;
    }
    if (index === this.pages.length) this.pages.push(page);
    else this.pages[index] = page;
    this.pageReferences.set(index, 0);
    const allocation = page.allocator.allocate(item.id, item.width, item.height);
    return allocation ? { page, pageIndex: index, allocation } : null;
  }
}

/** Contrat documentaire pour les quatre canaux usuels. */
export const SATELLITE_ATLAS_CHANNELS = DEFAULT_CHANNELS;
