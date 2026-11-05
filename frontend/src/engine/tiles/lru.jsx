/**
 * Cache LRU borné. `get` et `touch` marquent l'entrée comme récente ; au-delà de `capacity`,
 * les plus anciennes sont retirées et `onEvict(key, value)` est appelé (libération des textures).
 */
export class LruCache {
  constructor(capacity, onEvict = () => {}) {
    this.capacity = capacity;
    this.onEvict = onEvict;
    this.map = new Map();
  }
  get size() { return this.map.size; }
  has(key) { return this.map.has(key); }
  /** Lecture sans effet sur l'ordre. */
  peek(key) { return this.map.get(key); }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  touch(key) { this.get(key); }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const [oldKey, oldValue] = this.map.entries().next().value;
      this.map.delete(oldKey);
      this.onEvict(oldKey, oldValue);
    }
  }
  delete(key) {
    if (!this.map.has(key)) return false;
    const v = this.map.get(key);
    this.map.delete(key);
    this.onEvict(key, v);
    return true;
  }
  clear() { [...this.map.keys()].forEach((k) => this.delete(k)); }
  keys() { return [...this.map.keys()]; }
}
