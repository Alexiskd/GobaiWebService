export interface CacheLookup<T> {
  value: T;
  hit: boolean;
  stale: boolean;
  ageMs: number;
  ttlMs: number;
}

interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

export class TtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly staleMs = 0,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get ttl(): number {
    return this.ttlMs;
  }

  get(key: string): CacheLookup<T> | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    const ageMs = Date.now() - entry.storedAt;
    if (ageMs >= this.ttlMs + this.staleMs) {
      this.entries.delete(key);
      return null;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);

    return {
      value: entry.value,
      hit: true,
      stale: ageMs >= this.ttlMs,
      ageMs,
      ttlMs: this.ttlMs,
    };
  }

  peek(key: string): T | undefined {
    return this.get(key)?.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, storedAt: Date.now() });
    this.evict();
  }

  async getOrLoad(
    key: string,
    loader: () => Promise<T>,
  ): Promise<CacheLookup<T>> {
    const cached = this.get(key);
    if (cached) {
      if (cached.stale) {
        void this.load(key, loader).catch(() => undefined);
      }
      return cached;
    }

    const value = await this.load(key, loader);
    return { value, hit: false, stale: false, ageMs: 0, ttlMs: this.ttlMs };
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private load(key: string, loader: () => Promise<T>): Promise<T> {
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }

    const task = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key) === task) {
          this.inflight.delete(key);
        }
      });
    this.inflight.set(key, task);
    return task;
  }

  private evict(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) {
        return;
      }
      this.entries.delete(oldest.value);
    }
  }
}
