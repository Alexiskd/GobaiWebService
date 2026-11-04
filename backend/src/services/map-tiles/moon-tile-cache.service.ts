import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { AppConfig } from '../../common/configuration';
import { MOON_LAYER_LEVELS, moonCols, moonRows, NasaTrekMoonProvider } from './providers/nasa-trek-moon.provider';

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 4 * 1024 * 1024;
const RETRIES = 3;

export interface MoonTile {
  body: Buffer;
  contentType: string;
  /** true = servie depuis le disque. */
  cached: boolean;
}

export interface MoonPrefetchStatus {
  running: boolean;
  maxZoom: number;
  done: number;
  total: number;
  failed: number;
}

/**
 * Cache disque des tuiles de la Lune (NASA Moon Trek). Une tuile est téléchargée une seule fois chez la NASA,
 * écrite dans `MOON_TILE_CACHE_DIR/{couche}/{z}/{x}/{y}.png`, puis servie depuis le disque (quelques millisecondes).
 *
 * Préchargement : toutes les tuiles des niveaux 0 à `MOON_PREFETCH_MAX_ZOOM` des deux couches (Kaguya et LOLA).
 * Nombre de tuiles par couche jusqu'au niveau n : 2·(4^(n+1) − 1)/3 → n=4 : 682, n=6 : 10 922, n=8 : 174 762.
 * Les tuiles déjà sur le disque sont sautées : relancer le préchargement ne retélécharge rien.
 */
@Injectable()
export class MoonTileCacheService {
  private readonly log = new Logger('MoonTiles');
  private readonly inflight = new Map<string, Promise<MoonTile>>();
  private readonly dir: string;
  private prefetch: MoonPrefetchStatus;

  constructor(
    private readonly config: AppConfig,
    private readonly provider: NasaTrekMoonProvider = new NasaTrekMoonProvider(config.tiles.moon),
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {
    this.dir = path.resolve(config.tiles.moonCache.dir);
    this.prefetch = { running: false, maxZoom: config.tiles.moonCache.prefetchMaxZoom, done: 0, total: 0, failed: 0 };
  }

  status(): MoonPrefetchStatus {
    return { ...this.prefetch };
  }

  /** Tuile depuis le disque, sinon téléchargée chez la NASA et enregistrée. Les demandes simultanées sont regroupées. */
  get(layerId: string, z: number, x: number, y: number): Promise<MoonTile> {
    const url = this.provider.upstreamUrl(layerId, z, x, y);
    if (!url) throw new NotFoundException(`Tuile lunaire inexistante : ${layerId} ${z}/${x}/${y}.`);
    const key = `${layerId}/${z}/${x}/${y}`;
    let p = this.inflight.get(key);
    if (!p) {
      p = this.load(key, url).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  private file(key: string) {
    return path.join(this.dir, `${key}.png`);
  }

  private async load(key: string, url: string): Promise<MoonTile> {
    const file = this.file(key);
    try {
      return { body: await fs.readFile(file), contentType: 'image/png', cached: true };
    } catch { /* pas encore en cache */ }

    const tile = await this.download(url);
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      // Écriture atomique : un fichier à moitié écrit (arrêt du serveur) ne sera jamais servi.
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, tile.body);
      await fs.rename(tmp, file);
    } catch (e) {
      this.log.warn(`Écriture du cache impossible (${file}) : ${(e as Error).message}`);
    }
    return tile;
  }

  private async download(url: string): Promise<MoonTile> {
    let last = '';
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      try {
        const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const contentType = res.headers.get('content-type') || 'image/png';
        if (res.status === 404) throw new NotFoundException(`Tuile absente chez la NASA : ${url}`);
        if (!res.ok || !contentType.startsWith('image/')) {
          last = `HTTP ${res.status} ${contentType}`;
        } else {
          const body = Buffer.from(await res.arrayBuffer());
          if (body.length > MAX_BYTES) throw new BadGatewayException('Tuile lunaire trop lourde.');
          return { body, contentType, cached: false };
        }
      } catch (e) {
        if (e instanceof NotFoundException || e instanceof BadGatewayException) throw e;
        last = (e as Error).message;
      }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
    throw new BadGatewayException(`NASA Moon Trek injoignable (${url}) : ${last}`);
  }

  /** Nombre de tuiles à précharger jusqu'au niveau `maxZoom` (toutes couches, bornées à leur niveau natif). */
  static countTiles(maxZoom: number): number {
    let n = 0;
    for (const l of MOON_LAYER_LEVELS) for (let z = 0; z <= Math.min(maxZoom, l.maxZoom); z++) n += moonCols(z) * moonRows(z);
    return n;
  }

  /**
   * Précharge toute la Lune jusqu'au niveau `maxZoom` (niveaux bas d'abord : la Lune entière est vite disponible).
   * Sans effet si un préchargement tourne déjà. `onProgress` est appelé après chaque tuile.
   */
  async prefetchAll(
    maxZoom = this.config.tiles.moonCache.prefetchMaxZoom,
    concurrency = this.config.tiles.moonCache.prefetchConcurrency,
    onProgress?: (s: MoonPrefetchStatus) => void,
  ): Promise<MoonPrefetchStatus> {
    if (this.prefetch.running || maxZoom < 0) return this.status();
    this.prefetch = { running: true, maxZoom, done: 0, total: MoonTileCacheService.countTiles(maxZoom), failed: 0 };

    const jobs = (function* () {
      for (let z = 0; z <= maxZoom; z++) {
        for (const l of MOON_LAYER_LEVELS) {
          if (z > l.maxZoom) continue;
          for (let y = 0; y < moonRows(z); y++) for (let x = 0; x < moonCols(z); x++) yield { id: l.id, z, x, y };
        }
      }
    })();

    const worker = async () => {
      for (let j = jobs.next(); !j.done; j = jobs.next()) {
        const { id, z, x, y } = j.value;
        try { await this.get(id, z, x, y); } catch { this.prefetch.failed++; }
        this.prefetch.done++;
        onProgress?.(this.status());
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    this.prefetch.running = false;
    return this.status();
  }

  /** Lancé au démarrage du serveur, en arrière-plan : n'empêche pas l'API de répondre. */
  startBackgroundPrefetch(): void {
    const { prefetchMaxZoom } = this.config.tiles.moonCache;
    if (prefetchMaxZoom < 0) return;
    this.log.log(`Préchargement de la Lune : niveaux 0 à ${prefetchMaxZoom} (${MoonTileCacheService.countTiles(prefetchMaxZoom)} tuiles) dans ${this.dir}`);
    const t0 = Date.now();
    this.prefetchAll()
      .then((s) => this.log.log(`Lune préchargée : ${s.done - s.failed}/${s.total} tuiles en ${Math.round((Date.now() - t0) / 1000)} s${s.failed ? ` (${s.failed} échecs, réessayés au prochain démarrage)` : ''}`))
      .catch((e) => this.log.warn(`Préchargement interrompu : ${(e as Error).message}`));
  }
}
