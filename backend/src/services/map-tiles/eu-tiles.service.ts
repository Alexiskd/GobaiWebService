import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { AppConfig } from '../../common/configuration';

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 2 * 1024 * 1024;

export interface EuStatus { running: boolean; done: number; total: number; failed: number; maxZoomFull: number }

const lonToX = (lon: number, z: number) => Math.min(2 ** z - 1, Math.max(0, Math.floor(((lon + 180) / 360) * 2 ** z)));
const latToY = (lat: number, z: number) => {
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return Math.min(2 ** z - 1, Math.max(0, Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z)));
};

/**
 * Europe préchargée : imagerie Sentinel-2 cloudless (EOX, données Copernicus) de toute l'Union européenne, gardée sur
 * le disque du serveur, en tuiles XYZ Web Mercator de 256 px.
 *  - préchargement au démarrage dans la limite de `EU_PREFETCH_MAX_TILES` (200 000 par défaut) : tous les niveaux
 *    complets qui tiennent (0 à 11 sur l'emprise de l'UE ≈ 177 000 tuiles), puis le niveau suivant en partant du
 *    centre de l'Europe ; reprise là où il s'était arrêté, débit limité pour ménager le service ;
 *  - au-delà (ou hors de l'UE), le client utilise la couche terrestre active.
 * Licence : millésime 2016 CC BY 4.0 (usage commercial permis) ; 2017 et suivants CC BY-NC-SA (non commercial).
 */
@Injectable()
export class EuTilesService {
  private readonly log = new Logger('Europe');
  private readonly dir: string;
  private readonly inflight = new Map<string, Promise<Buffer>>();
  private state: EuStatus = { running: false, done: 0, total: 0, failed: 0, maxZoomFull: -1 };

  constructor(private readonly config: AppConfig, private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {
    this.dir = path.resolve(path.dirname(path.resolve(config.tiles.moonCache.dir)), 'eu-tiles', config.eu.layer);
  }

  status(): EuStatus { return { ...this.state }; }

  /** La tuile est-elle dans l'emprise de l'UE et à un niveau servi par l'imagerie européenne ? */
  covers(z: number, x: number, y: number): boolean {
    const { bbox, maxZoom } = this.config.eu;
    if (z > maxZoom) return false;
    const [w, s, e, n] = bbox;
    return x >= lonToX(w, z) && x <= lonToX(e, z) && y >= latToY(n, z) && y <= latToY(s, z);
  }

  private upstream(z: number, x: number, y: number) {
    return this.config.eu.tileUrl.replace('{layer}', this.config.eu.layer).replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  }

  get(z: number, x: number, y: number): Promise<Buffer> {
    const key = `${z}/${x}/${y}`;
    let p = this.inflight.get(key);
    if (!p) {
      p = this.load(key, z, x, y).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }

  private async load(key: string, z: number, x: number, y: number): Promise<Buffer> {
    const file = path.join(this.dir, `${key}.jpg`);
    try { return await fs.readFile(file); } catch { /* pas encore sur le disque */ }
    const url = this.upstream(z, x, y);
    let res: Response;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new BadGatewayException(`Imagerie européenne injoignable : ${(e as Error).message}`);
    }
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) throw new BadGatewayException(`Imagerie européenne : HTTP ${res.status} ${type}`.trim());
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) throw new BadGatewayException('Tuile européenne trop lourde');
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, body);
      await fs.rename(tmp, file);
    } catch (e) { this.log.warn(`Écriture impossible : ${(e as Error).message}`); }
    return body;
  }

  /** Plan de préchargement : niveaux complets tant que le budget le permet, puis le niveau suivant depuis le centre. */
  plan(maxTiles = this.config.eu.prefetchMaxTiles): { tiles: Array<[number, number, number]>; maxZoomFull: number } {
    const { bbox, maxZoom } = this.config.eu;
    const [w, s, e, n] = bbox;
    const tiles: Array<[number, number, number]> = [];
    let maxZoomFull = -1;
    for (let z = 0; z <= maxZoom && tiles.length < maxTiles; z++) {
      const x0 = lonToX(w, z), x1 = lonToX(e, z), y0 = latToY(n, z), y1 = latToY(s, z);
      const level: Array<[number, number, number]> = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) level.push([z, x, y]);
      if (tiles.length + level.length <= maxTiles) { for (const t of level) tiles.push(t); maxZoomFull = z; continue; }
      // Niveau partiel : d'abord autour du centre de l'Union européenne (≈ 50° N, 10° E).
      const cx = lonToX(10, z) + 0.5, cy = latToY(50, z) + 0.5;
      level.sort((a, b) => Math.hypot(a[1] - cx, a[2] - cy) - Math.hypot(b[1] - cx, b[2] - cy));
      for (const t of level.slice(0, maxTiles - tiles.length)) tiles.push(t);
    }
    return { tiles, maxZoomFull };
  }

  async prefetch(): Promise<EuStatus> {
    if (this.state.running) return this.status();
    const { tiles, maxZoomFull } = this.plan();
    this.state = { running: true, done: 0, total: tiles.length, failed: 0, maxZoomFull };
    this.log.log(`Préchargement de l'Union européenne : ${tiles.length} tuiles (complet jusqu'au niveau ${maxZoomFull}) → ${this.dir}`);
    const t0 = Date.now();
    const minGapMs = 1000 / Math.max(1, this.config.eu.prefetchRate); // débit limité (tuiles par seconde)
    let i = 0, next = Date.now();
    const worker = async () => {
      while (i < tiles.length) {
        const [z, x, y] = tiles[i++];
        const file = path.join(this.dir, `${z}/${x}/${y}.jpg`);
        const exists = await fs.access(file).then(() => true, () => false);
        if (!exists) {
          const wait = next - Date.now();
          next = Math.max(next, Date.now()) + minGapMs;
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
          await this.get(z, x, y).catch(() => { this.state.failed++; });
        }
        this.state.done++;
        if (this.state.done % 10000 === 0) this.log.log(`Europe : ${this.state.done}/${tiles.length}`);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    this.state.running = false;
    this.log.log(`Europe préchargée : ${this.state.done - this.state.failed}/${tiles.length} tuiles en ${Math.round((Date.now() - t0) / 60000)} min`);
    return this.status();
  }
}
