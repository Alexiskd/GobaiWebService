/**
 * Gestionnaire d'atlas couleur multi-astre, indépendant de l'API DOM.
 * Les sources sont injectées et copiées par un callback afin de pouvoir tester
 * l'allocation sans WebGL. Les rectangles retournés désignent l'image utile,
 * sans le gutter, et sont normalisés pour le shader du lot 16.
 */

const finitePositive = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${label} doit être positif et fini.`);
  return Math.floor(number);
};

function normalizeDimensions(width, height, maxContentSize) {
  const w = finitePositive(width, 'width');
  const h = finitePositive(height, 'height');
  const scale = Math.min(1, maxContentSize / Math.max(w, h));
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
    scale,
  };
}

/** Allocateur shelf déterministe : les slots libérés ne sont pas recyclés. */
export class SatelliteAtlasPageAllocator {
  constructor({ pageSize = 2048, gutter = 4 } = {}) {
    this.pageSize = finitePositive(pageSize, 'pageSize');
    this.gutter = finitePositive(gutter, 'gutter');
    if (this.gutter * 2 >= this.pageSize) throw new RangeError('Le gutter est trop grand pour la page.');
    this.maxContentSize = this.pageSize - this.gutter * 2;
    this.cursorX = 0;
    this.cursorY = 0;
    this.rowHeight = 0;
    this.allocations = new Map();
  }

  allocate(id, width, height) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('Un identifiant atlas non vide est requis.');
    if (this.allocations.has(id)) throw new Error(`Identifiant atlas déjà alloué : ${id}`);
    const size = normalizeDimensions(width, height, this.maxContentSize);
    const outerWidth = size.width + this.gutter * 2;
    const outerHeight = size.height + this.gutter * 2;
    let x = this.cursorX;
    let y = this.cursorY;
    let rowHeight = this.rowHeight;

    if (x + outerWidth > this.pageSize) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    if (y + outerHeight > this.pageSize) return null;

    this.cursorX = x + outerWidth;
    this.cursorY = y;
    this.rowHeight = Math.max(rowHeight, outerHeight);
    const allocation = Object.freeze({
      id,
      x: x + this.gutter,
      y: y + this.gutter,
      width: size.width,
      height: size.height,
      outerX: x,
      outerY: y,
      outerWidth,
      outerHeight,
      gutter: this.gutter,
      scale: size.scale,
      uv: new Float32Array([
        (x + this.gutter) / this.pageSize,
        (this.pageSize - (y + this.gutter + size.height)) / this.pageSize,
        size.width / this.pageSize,
        size.height / this.pageSize,
      ]),
    });
    this.allocations.set(id, allocation);
    return allocation;
  }

  has(id) { return this.allocations.has(id); }
  get(id) { return this.allocations.get(id) || null; }
  get size() { return this.allocations.size; }
}

/**
 * File d'attente priorisée et gestion des pages. createPage() doit retourner
 * { texture, context?, canvas? }. blit() reçoit les coordonnées pixels utiles.
 */
export class SatelliteTextureAtlasManager {
  constructor({
    pageSize = 2048,
    gutter = 4,
    maxPages = 4,
    createPage,
    blit,
    onError,
  } = {}) {
    this.pageSize = finitePositive(pageSize, 'pageSize');
    this.gutter = finitePositive(gutter, 'gutter');
    this.maxPages = finitePositive(maxPages, 'maxPages');
    if (typeof createPage !== 'function' || typeof blit !== 'function') {
      throw new TypeError('createPage et blit sont requis pour créer les pages atlas.');
    }
    this.createPage = createPage;
    this.blit = blit;
    this.onError = typeof onError === 'function' ? onError : null;
    this.pages = [];
    this.entries = new Map();
    this.queue = new Map();
    this.sequence = 0;
    this.disposed = false;
  }

  enqueue({ id, source, width, height, priority = 0 }) {
    this.#assertAlive();
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('id doit être une chaîne non vide.');
    if (!source) throw new TypeError('Une source image est requise.');
    if (this.entries.has(id)) throw new Error(`La source ${id} est déjà présente dans l’atlas.`);
    const w = finitePositive(width, 'width');
    const h = finitePositive(height, 'height');
    const p = Number(priority);
    if (!Number.isFinite(p)) throw new TypeError('priority doit être fini.');
    const previous = this.queue.get(id);
    this.queue.set(id, { id, source, width: w, height: h, priority: p, sequence: previous?.sequence ?? this.sequence++ });
    return id;
  }

  processQueue(maxItems = 1) {
    this.#assertAlive();
    if (!Number.isInteger(maxItems) || maxItems < 0) throw new RangeError('maxItems doit être un entier positif ou nul.');
    const pending = [...this.queue.values()].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    const results = [];
    for (const item of pending) {
      if (results.length >= maxItems) break;
      const slot = this.#allocate(item);
      if (!slot) continue;
      try {
        this.blit(slot.page, item.source, slot.allocation);
        if (slot.page.texture) slot.page.texture.needsUpdate = true;
        const entry = Object.freeze({
          id: item.id,
          pageIndex: slot.pageIndex,
          texture: slot.page.texture,
          allocation: slot.allocation,
          uv: new Float32Array(slot.allocation.uv),
          sourceWidth: item.width,
          sourceHeight: item.height,
          scale: slot.allocation.scale,
          status: 'ready',
        });
        this.entries.set(item.id, entry);
        this.queue.delete(item.id);
        results.push(entry);
      } catch (error) {
        this.queue.delete(item.id);
        this.onError?.(error, item.id);
      }
    }
    return results;
  }

  get(id) { return this.entries.get(id) || null; }
  getRect(id) {
    const entry = this.get(id);
    return entry ? new Float32Array(entry.uv) : null;
  }
  getPendingCount() { return this.queue.size; }
  getPageCount() { return this.pages.length; }

  release(id) {
    this.#assertAlive();
    this.queue.delete(id);
    const entry = this.entries.get(id);
    if (!entry) return false;
    this.entries.delete(id);
    // Les rectangles ne sont pas réutilisés avant une remise à zéro de page :
    // cela évite d'écraser une région encore référencée par une instance GPU.
    return true;
  }

  dispose() {
    if (this.disposed) return;
    for (const page of this.pages) {
      page.texture?.dispose?.();
      page.dispose?.();
    }
    this.pages.length = 0;
    this.entries.clear();
    this.queue.clear();
    this.disposed = true;
  }

  #assertAlive() {
    if (this.disposed) throw new Error('SatelliteTextureAtlasManager est déjà libéré.');
  }

  #allocate(item) {
    for (let index = 0; index < this.pages.length; index += 1) {
      const allocation = this.pages[index].allocator.allocate(item.id, item.width, item.height);
      if (allocation) return { page: this.pages[index], pageIndex: index, allocation };
    }
    if (this.pages.length >= this.maxPages) return null;
    const page = this.createPage({ pageSize: this.pageSize, index: this.pages.length });
    if (!page || !page.texture) throw new TypeError('createPage doit retourner une page avec texture.');
    page.allocator = new SatelliteAtlasPageAllocator({ pageSize: this.pageSize, gutter: this.gutter });
    this.pages.push(page);
    const pageIndex = this.pages.length - 1;
    const allocation = page.allocator.allocate(item.id, item.width, item.height);
    return allocation ? { page, pageIndex, allocation } : null;
  }
}

/** Crée une page CanvasTexture (appelable uniquement dans un navigateur). */
export function createCanvasSatelliteAtlasPage(THREE, { pageSize = 2048 } = {}) {
  if (!THREE?.CanvasTexture || typeof document === 'undefined') {
    throw new Error('CanvasTexture et document sont requis pour créer une page navigateur.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = pageSize;
  canvas.height = pageSize;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Impossible de créer le contexte 2D de l’atlas.');
  context.fillStyle = '#000000';
  context.fillRect(0, 0, pageSize, pageSize);
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return { canvas, context, texture, dispose() { canvas.width = 1; canvas.height = 1; } };
}

/** Copie une image et prolonge ses bords dans le gutter pour limiter le bleeding. */
export function blitSatelliteAtlasImage(page, source, allocation) {
  const context = page?.context;
  if (!context?.drawImage) throw new TypeError('La page doit fournir un contexte Canvas 2D.');
  const { x, y, width, height, gutter } = allocation;
  context.drawImage(source, x, y, width, height);
  if (gutter > 0) {
    // Bords supérieur/inférieur et gauche/droite.
    context.drawImage(page.canvas, x, y, width, 1, x, y - gutter, width, gutter);
    context.drawImage(page.canvas, x, y + height - 1, width, 1, x, y + height, width, gutter);
    context.drawImage(page.canvas, x, y, 1, height, x - gutter, y, gutter, height);
    context.drawImage(page.canvas, x + width - 1, y, 1, height, x + width, y, gutter, height);
    // Coins : copie d'un pixel source dans chaque coin du gutter.
    context.drawImage(page.canvas, x, y, 1, 1, x - gutter, y - gutter, gutter, gutter);
    context.drawImage(page.canvas, x + width - 1, y, 1, 1, x + width, y - gutter, gutter, gutter);
    context.drawImage(page.canvas, x, y + height - 1, 1, 1, x - gutter, y + height, gutter, gutter);
    context.drawImage(page.canvas, x + width - 1, y + height - 1, 1, 1, x + width, y + height, gutter, gutter);
  }
}
