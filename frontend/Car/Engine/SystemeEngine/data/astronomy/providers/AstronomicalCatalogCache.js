/** Cache mémoire LRU à TTL, volontairement sans persistance de données scientifiques dans localStorage. */
export class AstronomicalCatalogCache {
  constructor({ ttlMs = 15 * 60 * 1000, maxEntries = 100, now = () => Date.now() } = {}) {
    this.ttlMs = Math.max(0, ttlMs);
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
    this.now = now;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) { this.entries.delete(key); return null; }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    if (ttlMs <= 0) return value;
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value);
    return value;
  }

  clear() { this.entries.clear(); }
  get size() { return this.entries.size; }
}
