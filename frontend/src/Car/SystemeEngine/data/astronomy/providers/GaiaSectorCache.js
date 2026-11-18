const DEFAULT_DB_NAME = 'gobai-space-gaia-dr3';
const DEFAULT_STORE = 'sectors';

/** Cache IndexedDB avec repli mémoire si le navigateur bloque le stockage persistant. */
export class GaiaSectorCache {
  constructor({ indexedDB = globalThis.indexedDB, dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE, ttlMs = 24 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
    this.indexedDB = indexedDB;
    this.dbName = dbName;
    this.storeName = storeName;
    this.ttlMs = Math.max(0, Number(ttlMs) || 0);
    this.now = now;
    this.memory = new Map();
    this.dbPromise = null;
    this.persistent = Boolean(indexedDB?.open);
  }

  async #open() {
    if (!this.persistent) return null;
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName, { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible.'));
        request.onblocked = () => reject(new Error('Ouverture IndexedDB bloquée.'));
      }).catch((error) => { this.persistent = false; this.dbPromise = null; return null; });
    }
    return this.dbPromise;
  }

  async get(key) {
    const memory = this.memory.get(key);
    if (memory && memory.expiresAt > this.now()) return memory.value;
    if (memory) this.memory.delete(key);
    const db = await this.#open();
    if (!db) return null;
    try {
      const entry = await new Promise((resolve, reject) => {
        const request = db.transaction(this.storeName, 'readonly').objectStore(this.storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      if (!entry) return null;
      if (entry.expiresAt <= this.now()) { await this.delete(key); return null; }
      this.memory.set(key, entry);
      return entry.value;
    } catch { this.persistent = false; return null; }
  }

  async set(key, value, ttlMs = this.ttlMs) {
    if (ttlMs <= 0) return value;
    const entry = { key, value, expiresAt: this.now() + ttlMs };
    this.memory.set(key, entry);
    const db = await this.#open();
    if (db) {
      try { await new Promise((resolve, reject) => {
        const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(entry);
        request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
      }); } catch { this.persistent = false; }
    }
    return value;
  }

  async delete(key) {
    this.memory.delete(key);
    const db = await this.#open();
    if (!db) return;
    try { await new Promise((resolve, reject) => {
      const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).delete(key);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    }); } catch { this.persistent = false; }
  }

  async clear() {
    this.memory.clear();
    const db = await this.#open();
    if (!db) return;
    try { await new Promise((resolve, reject) => {
      const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).clear();
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    }); } catch { this.persistent = false; }
  }

  getStats() { return { memoryEntries: this.memory.size, persistent: this.persistent, ttlMs: this.ttlMs }; }
}

export function createGaiaSectorCache(options) { return new GaiaSectorCache(options); }
