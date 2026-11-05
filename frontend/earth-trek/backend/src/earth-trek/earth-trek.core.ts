// Cœur du Trek de la Terre, sans dépendance à NestJS (testable avec node --test) :
// liste des couches, proxy de tuiles avec cache mémoire, limite de requêtes simultanées et messages d'erreur clairs.
import { EARTH_TREK_LAYERS, type EarthTrekEnv, type EarthTrekLayerDef } from './earth-trek.layers';
import { EARTH_TREK_STOPS } from './earth-trek.stops';

export class EarthTrekError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface TileResult {
  status: 200 | 204;
  body?: Buffer;
  contentType?: string;
  cache: 'hit' | 'miss';
}

export interface PublicLayer {
  id: string;
  label: string;
  description: string;
  provider: string;
  kind: string;
  body: 'earth';
  trek: 'earth';
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  attributionText: string;
  attributionUrl: string;
  experimental: boolean;
  available: boolean;
  reason: string | null;
  tileUrl: string;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface EarthTrekOptions {
  fetch?: FetchLike;
  cacheBytes?: number;
  ttlMs?: number;
  emptyTtlMs?: number;
  timeoutMs?: number;
  maxConcurrent?: number;
  routePrefix?: string;
}

interface CacheEntry {
  expires: number;
  result: TileResult;
  bytes: number;
}

/** Cache LRU borné en octets (ordre d'insertion de Map = ordre d'usage). */
export class TileCache {
  private readonly map = new Map<string, CacheEntry>();
  private used = 0;

  constructor(private readonly maxBytes: number) {}

  get size() { return this.map.size; }
  get bytes() { return this.used; }

  get(key: string, now = Date.now()): TileResult | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    this.map.delete(key);
    if (entry.expires <= now) { this.used -= entry.bytes; return null; }
    this.map.set(key, entry);
    return entry.result;
  }

  set(key: string, result: TileResult, ttlMs: number, now = Date.now()) {
    const bytes = (result.body?.length ?? 0) + 64;
    if (bytes > this.maxBytes) return;
    const old = this.map.get(key);
    if (old) { this.used -= old.bytes; this.map.delete(key); }
    this.map.set(key, { expires: now + ttlMs, result, bytes });
    this.used += bytes;
    for (const [k, e] of this.map) {
      if (this.used <= this.maxBytes) break;
      this.map.delete(k);
      this.used -= e.bytes;
    }
  }
}

/** File d'attente simple : au plus `limit` requêtes en cours par fournisseur. */
class Limiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

export class EarthTrekCore {
  private readonly fetchImpl: FetchLike;
  private readonly cache: TileCache;
  private readonly inflight = new Map<string, Promise<TileResult>>();
  private readonly limiters = new Map<string, Limiter>();
  private readonly opts: Required<Omit<EarthTrekOptions, 'fetch'>>;

  constructor(private readonly env: EarthTrekEnv = process.env as EarthTrekEnv, options: EarthTrekOptions = {}) {
    this.fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.opts = {
      cacheBytes: options.cacheBytes ?? 256 * 1024 * 1024,
      ttlMs: options.ttlMs ?? 24 * 3600 * 1000,
      emptyTtlMs: options.emptyTtlMs ?? 3600 * 1000,
      timeoutMs: options.timeoutMs ?? 15_000,
      maxConcurrent: options.maxConcurrent ?? 12,
      routePrefix: options.routePrefix ?? '/api/v1/earth-trek',
    };
    this.cache = new TileCache(this.opts.cacheBytes);
  }

  /** Couches publiques : jamais de clé ni d'URL du fournisseur, seulement la route du proxy. */
  layers(): PublicLayer[] {
    return EARTH_TREK_LAYERS.map((def) => {
      const reason = def.missing(this.env);
      return {
        id: def.id,
        label: def.label,
        description: def.description,
        provider: def.id,
        kind: def.kind,
        body: 'earth',
        trek: 'earth',
        minZoom: def.minZoom,
        maxZoom: def.maxZoom,
        tileSize: def.tileSize,
        attributionText: def.attribution,
        attributionUrl: def.attributionUrl,
        experimental: Boolean(def.experimental),
        available: reason === null,
        reason,
        tileUrl: `${this.opts.routePrefix}/tiles/${def.id}/{z}/{x}/{y}`,
      };
    });
  }

  stops() {
    const available = new Set(this.layers().filter((l) => l.available).map((l) => l.id));
    // Si le fond conseillé n'est pas configuré, on propose le premier fond disponible.
    const fallback = this.layers().find((l) => l.available)?.id ?? null;
    return EARTH_TREK_STOPS.map((s) => ({ ...s, layer: available.has(s.layer) ? s.layer : fallback }));
  }

  attribution(layerId: string) {
    const def = this.layer(layerId);
    return { layerId: def.id, copyright: def.attribution, url: def.attributionUrl };
  }

  private layer(id: string): EarthTrekLayerDef {
    const def = EARTH_TREK_LAYERS.find((l) => l.id === id);
    if (!def) throw new EarthTrekError(`Couche inconnue : ${id}.`, 404);
    return def;
  }

  /** Une tuile z/x/y (grille Web Mercator, origine en haut à gauche). 204 si le fournisseur n'a rien à cet endroit. */
  async tile(layerId: string, zRaw: string | number, xRaw: string | number, yRaw: string | number): Promise<TileResult> {
    const def = this.layer(layerId);
    const [z, x, y] = [zRaw, xRaw, yRaw].map((v) => Number(String(v).replace(/\.\w+$/, '')));
    if (![z, x, y].every(Number.isInteger)) throw new EarthTrekError('Coordonnées de tuile invalides.', 400);
    if (z < def.minZoom || z > def.maxZoom) throw new EarthTrekError(`Niveau ${z} hors de la plage ${def.minZoom}–${def.maxZoom}.`, 400);
    const n = 2 ** z;
    if (x < 0 || y < 0 || x >= n || y >= n) throw new EarthTrekError('Tuile hors de la grille.', 400);
    const missing = def.missing(this.env);
    if (missing) throw new EarthTrekError(`${def.label} non configurée : ${missing}`, 503);

    const key = `${def.id}/${z}/${x}/${y}`;
    const cached = this.cache.get(key);
    if (cached) return { ...cached, cache: 'hit' };
    const pending = this.inflight.get(key);
    if (pending) return pending; // même tuile demandée plusieurs fois en même temps : une seule requête

    const promise = this.limiter(def.provider).run(() => this.download(def, z, x, y))
      .then((result) => {
        this.cache.set(key, result, result.status === 200 ? this.opts.ttlMs : this.opts.emptyTtlMs);
        return result;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private limiter(provider: string) {
    let limiter = this.limiters.get(provider);
    if (!limiter) { limiter = new Limiter(this.opts.maxConcurrent); this.limiters.set(provider, limiter); }
    return limiter;
  }

  private async download(def: EarthTrekLayerDef, z: number, x: number, y: number): Promise<TileResult> {
    const { url, headers } = def.request(z, x, y, this.env);
    let response;
    try {
      response = await this.fetchImpl(url, { headers: { Accept: 'image/*', ...headers }, signal: AbortSignal.timeout(this.opts.timeoutMs) });
    } catch (error) {
      const timeout = (error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError';
      throw new EarthTrekError(`${def.label} : ${timeout ? 'délai dépassé' : 'fournisseur injoignable'}.`, 504);
    }
    const status = response.status;
    if (status === 404 || status === 204) return { status: 204, cache: 'miss' };
    if (status === 401 || status === 403) throw new EarthTrekError(`${def.label} : clé refusée par le fournisseur (${status}).`, 502);
    if (status === 429) throw new EarthTrekError(`${def.label} : quota de requêtes atteint, réessayez plus tard.`, 503);
    if (status < 200 || status >= 300) throw new EarthTrekError(`${def.label} : erreur du fournisseur (${status}).`, 502);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Les services OGC répondent parfois 200 avec un XML d'exception : ce n'est pas une image.
    if (!contentType.startsWith('image/')) {
      if (contentType.includes('xml') || contentType.includes('json')) return { status: 204, cache: 'miss' };
      throw new EarthTrekError(`${def.label} : réponse inattendue (${contentType}).`, 502);
    }
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length) return { status: 204, cache: 'miss' };
    return { status: 200, body, contentType, cache: 'miss' };
  }

  cacheStats() {
    return { tiles: this.cache.size, bytes: this.cache.bytes, maxBytes: this.opts.cacheBytes };
  }
}
