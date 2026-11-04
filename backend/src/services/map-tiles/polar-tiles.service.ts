import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { deflateSync } from 'node:zlib';
import type { AppConfig } from '../../common/configuration';
 
import { MoonTileCacheService } from './moon-tile-cache.service';
import { POLAR_LAYERS, polarPixelSize, polarTilePoint, polarXYToLonLat, MOON_RADIUS_M, type Pole } from './moon-polar';
import { decodePng, type GrayImage } from './png-decode';
 
export { POLAR_LAYERS } from './moon-polar';
 
const TILE = 256;
const DECODED_CACHE = 384;
const MAX_SOURCE_TILES = 96;
 
type PolarLayer = (typeof POLAR_LAYERS)[number];
 
interface Plan {
  W: number;
  H: number;
  gx: Float64Array;
  gy: Float64Array;
  need: Set<string>;
}
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Encodeur PNG (gris + alpha, 8 bits)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
 
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
 
/** PNG gris + alpha (8 bits) : `ga` = [g0, a0, g1, a1, …]. */
function encodeGrayAlphaPng(width: number, height: number, ga: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 4; // 8 bits, gris + alpha (compression, filtre, entrelacement : 0)
  const stride = width * 2 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // pas de filtre
    Buffer.from(ga.buffer, ga.byteOffset + y * width * 2, width * 2).copy(raw, y * stride + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 6 })), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Service
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
/**
 * Tuiles des calottes polaires, fabriquées par le serveur : chaque pixel de la grille stéréographique polaire est
 * pris (interpolation bilinéaire pondérée par l'alpha) dans les tuiles en plate carrée de même finesse, elles-mêmes
 * servies par le cache disque de la Lune. Résultat : un échantillonnage régulier jusqu'au pôle, sans éventail ni
 * tourbillon. Gardées sur le disque (`cache/moon-polar`) uniquement si toutes les tuiles sources ont été obtenues.
 */
@Injectable()
export class PolarTilesService {
  private readonly log = new Logger('MoonPolar');
  private readonly decoded = new Map<string, Promise<GrayImage | null>>();
  private readonly inflight = new Map<string, Promise<Buffer>>();
  private readonly dir: string;
 
  constructor(private readonly config: AppConfig, private readonly source: MoonTileCacheService) {
    this.dir = path.resolve(path.dirname(path.resolve(config.tiles.moonCache.dir)), 'moon-polar');
  }
 
  get(pole: Pole, layerId: string, z: number, x: number, y: number): Promise<Buffer> {
    const layer = POLAR_LAYERS.find((l) => l.id === layerId);
    const valid = [z, x, y].every(Number.isInteger) && z >= 0 && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;
    if (!layer || !valid || z > layer.maxZoom || (pole !== 'north' && pole !== 'south')) {
      return Promise.reject(new NotFoundException(`Tuile polaire inexistante : ${pole} ${layerId} ${z}/${x}/${y}`));
    }
    const key = `${layerId}/${pole}/${z}/${x}/${y}`;
    let p = this.inflight.get(key);
    if (!p) {
      p = this.load(key, pole, layer, z, x, y).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }
 
  private async load(key: string, pole: Pole, layer: PolarLayer, z: number, x: number, y: number): Promise<Buffer> {
    const file = path.join(this.dir, `${key}.png`);
    try { return await fs.readFile(file); } catch { /* à fabriquer */ }
 
    const { png, complete } = await this.render(pole, layer, z, x, y);
    if (!complete) {
      // Une source a manqué (réseau, archive) : on sert la tuile mais on ne la fige pas sur le disque.
      this.log.warn(`Tuile ${key} incomplète : non mise en cache`);
      return png;
    }
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, png);
      await fs.rename(tmp, file);
    } catch (e) {
      this.log.warn(`Écriture impossible (${file}) : ${(e as Error).message}`);
    }
    return png;
  }
 
  /** Niveau de la source en plate carrée dont le pixel (en latitude) est au plus aussi grand que celui de la tuile. */
  static sourceZoom(z: number, srcMax: number): number {
    const px = polarPixelSize(z, TILE);
    const zs = Math.ceil(Math.log2((Math.PI * MOON_RADIUS_M) / (TILE * px)));
    return Math.max(0, Math.min(srcMax, zs));
  }
 
  private async render(pole: Pole, layer: PolarLayer, z: number, x: number, y: number) {
    // Tout près du pôle, une tuile polaire couvre toutes les longitudes : au niveau source le plus fin il faudrait des
    // milliers de tuiles (la plate carrée y est très suréchantillonnée en longitude). On descend d'un niveau source
    // tant qu'il en faut plus de MAX_SOURCE_TILES : seule une petite zone autour du pôle exact perd un peu de finesse.
    for (let zs = PolarTilesService.sourceZoom(z, layer.srcMaxZoom); ; zs--) {
      const plan = this.plan(pole, z, x, y, zs);
      if (plan.need.size <= MAX_SOURCE_TILES || zs === 0) return this.compose(layer.id, zs, plan);
    }
  }
 
  /** Coordonnées source (pixels de la mosaïque plate carrée au niveau zs) de chaque pixel, et tuiles source requises. */
  private plan(pole: Pole, z: number, x: number, y: number, zs: number): Plan {
    const W = TILE * 2 ** (zs + 1), H = TILE * 2 ** zs;
    const gx = new Float64Array(TILE * TILE), gy = new Float64Array(TILE * TILE);
    const need = new Set<string>();
    const add = (sx: number, sy: number) => {
      const wx = ((sx % W) + W) % W, wy = Math.max(0, Math.min(H - 1, sy));
      need.add(`${Math.floor(wx / TILE)},${Math.floor(wy / TILE)}`);
    };
    for (let j = 0; j < TILE; j++) {
      for (let i = 0; i < TILE; i++) {
        const [X, Y] = polarTilePoint(z, x, y, (i + 0.5) / TILE, (j + 0.5) / TILE);
        const [lon, lat] = polarXYToLonLat(X, Y, pole);
        const k = j * TILE + i;
        gx[k] = ((lon + 180) / 360) * W - 0.5;
        gy[k] = Math.max(0, Math.min(H - 1, ((90 - lat) / 180) * H - 0.5));
        const x0 = Math.floor(gx[k]), y0 = Math.floor(gy[k]);
        add(x0, y0); add(x0 + 1, y0); add(x0, y0 + 1); add(x0 + 1, y0 + 1);
      }
    }
    return { W, H, gx, gy, need };
  }
 
  private async compose(layerId: string, zs: number, { W, H, gx, gy, need }: Plan): Promise<{ png: Buffer; complete: boolean }> {
    const tiles = new Map<string, GrayImage | null>();
    await Promise.all([...need].map(async (t) => {
      const [tx, ty] = t.split(',').map(Number);
      tiles.set(t, await this.decodedSource(layerId, zs, tx, ty));
    }));
    const missing = [...tiles.values()].filter((t) => !t).length;
    if (missing === tiles.size) throw new BadGatewayException('Aucune tuile source disponible pour cette calotte');
 
    const px = (sx: number, sy: number): [number, number] => {
      const wx = ((sx % W) + W) % W, wy = Math.max(0, Math.min(H - 1, sy));
      const t = tiles.get(`${Math.floor(wx / TILE)},${Math.floor(wy / TILE)}`);
      if (!t) return [0, 0];
      const k = (wy % TILE) * t.width + (wx % TILE);
      return [t.gray[k], t.alpha ? t.alpha[k] : 255];
    };
 
    const ga = new Uint8Array(TILE * TILE * 2);
    for (let k = 0; k < TILE * TILE; k++) {
      const x0 = Math.floor(gx[k]), y0 = Math.floor(gy[k]), fx = gx[k] - x0, fy = gy[k] - y0;
      const [g00, a00] = px(x0, y0), [g10, a10] = px(x0 + 1, y0), [g01, a01] = px(x0, y0 + 1), [g11, a11] = px(x0 + 1, y0 + 1);
      const w00 = (1 - fx) * (1 - fy) * (a00 / 255), w10 = fx * (1 - fy) * (a10 / 255);
      const w01 = (1 - fx) * fy * (a01 / 255), w11 = fx * fy * (a11 / 255);
      const w = w00 + w10 + w01 + w11;
      if (w < 0.5) continue; // pas de donnée : transparent
      ga[k * 2] = Math.round((g00 * w00 + g10 * w10 + g01 * w01 + g11 * w11) / w);
      ga[k * 2 + 1] = 255;
    }
    return { png: encodeGrayAlphaPng(TILE, TILE, ga), complete: missing === 0 };
  }
 
  /** Tuile source décodée, avec cache LRU en mémoire. Un échec n'est pas mémorisé : il sera retenté. */
  private decodedSource(layerId: string, z: number, x: number, y: number): Promise<GrayImage | null> {
    const key = `${layerId}/${z}/${x}/${y}`;
    const hit = this.decoded.get(key);
    if (hit) { this.decoded.delete(key); this.decoded.set(key, hit); return hit; }
 
    const p: Promise<GrayImage | null> = this.source.get(layerId, z, x, y)
      .then((t) => decodePng(t.body))
      .catch((e) => {
        this.log.warn(`Source ${key} : ${(e as Error).message}`);
        if (this.decoded.get(key) === p) this.decoded.delete(key);
        return null;
      });
    this.decoded.set(key, p);
    while (this.decoded.size > DECODED_CACHE) this.decoded.delete(this.decoded.keys().next().value as string);
    return p;
  }
 
  /** Préchargement des calottes (niveaux 0 à maxZoom, deux pôles, toutes les couches), en arrière-plan. */
  async prefetch(maxZoom = 3, concurrency = 2): Promise<void> {
    const jobs: Array<[Pole, string, number, number, number]> = [];
    for (let z = 0; z <= maxZoom; z++) {
      for (const pole of ['south', 'north'] as const) {
        for (const l of POLAR_LAYERS) {
          if (z > l.maxZoom) continue;
          for (let y = 0; y < 2 ** z; y++) for (let x = 0; x < 2 ** z; x++) jobs.push([pole, l.id, z, x, y]);
        }
      }
    }
    let next = 0, failed = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        await this.get(...job).catch(() => { failed++; });
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    this.log.log(`Calottes polaires préparées : ${jobs.length - failed}/${jobs.length} tuiles`);
  }
}