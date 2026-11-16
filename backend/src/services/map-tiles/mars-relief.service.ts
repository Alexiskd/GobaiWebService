// Relief géométrique de Mars : DEM MOLA NASA Trek converti en tuiles Terrarium,
// consommées par le même moteur générique que le relief de la Terre et de la Lune.
import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ByteCache } from '../../common/byte-cache';
import { isValidTile } from './tile-math';
import { decodeFloat32Tiff, encodeTerrariumPng, type HeightGrid } from './terrarium';

export const MARS_RELIEF_MAX_ZOOM = 8;
const TILE_SIZE = 256;
const TIMEOUT_MS = 20_000;
const MARS_LIMIT_M = 25_000;
// ImageServer ArcGIS de la mosaïque mondiale MOLA (Mars Global Surveyor, résolution nominale ~463 m).
const DEFAULT_URL = 'https://trek.nasa.gov/mars/trekarcgis/rest/services/Mars_MGS_MOLA_DEM_mosaic_global_463m_8/ImageServer';

export function marsTileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const span = 180 / 2 ** z;
  const west = -180 + x * span, north = 90 - y * span;
  return [west, north - span, west + span, north];
}

export function marsReliefExportUrl(base: string, z: number, x: number, y: number, size = TILE_SIZE): string {
  const params = new URLSearchParams({
    bbox: marsTileBounds(z, x, y).join(','), size: `${size},${size}`, format: 'tiff', pixelType: 'F32',
    compression: 'None', interpolation: 'RSP_BilinearInterpolation', f: 'image',
  });
  return `${base.replace(/\/+$/, '')}/exportImage?${params.toString()}`;
}

export function cleanMarsHeights(grid: HeightGrid): HeightGrid {
  const out = new Float32Array(grid.data.length);
  for (let i = 0; i < grid.data.length; i++) {
    const h = grid.data[i];
    out[i] = Number.isFinite(h) && Math.abs(h) <= MARS_LIMIT_M ? h : Number.NaN;
  }
  return { width: grid.width, height: grid.height, data: out };
}

@Injectable()
export class MarsReliefService {
  private readonly cache = new ByteCache(48 * 1024 * 1024);
  private readonly pending = new Map<string, Promise<Buffer>>();
  private readonly baseUrl = process.env.MARS_RELIEF_IMAGESERVER_URL?.trim() || DEFAULT_URL;
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  async tile(z: number, x: number, y: number): Promise<{ body: Buffer; contentType: string; cached: boolean }> {
    if (!isValidTile(z, x, y, 'equirectangular') || z > MARS_RELIEF_MAX_ZOOM) {
      throw new BadRequestException(`Tuile de relief martien invalide : ${z}/${x}/${y} (niveaux 0 à ${MARS_RELIEF_MAX_ZOOM}).`);
    }
    const key = `${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) return { body: hit, contentType: 'image/png', cached: true };
    let job = this.pending.get(key);
    if (!job) {
      job = this.build(z, x, y).finally(() => this.pending.delete(key));
      this.pending.set(key, job);
    }
    const body = await job;
    this.cache.set(key, body);
    return { body, contentType: 'image/png', cached: false };
  }

  private async build(z: number, x: number, y: number): Promise<Buffer> {
    let response: Response;
    try {
      response = await this.fetchFn(marsReliefExportUrl(this.baseUrl, z, x, y), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      throw new BadGatewayException(`Relief MOLA martien indisponible (${(error as Error).message}).`);
    }
    if (!response.ok) throw new BadGatewayException(`Le serveur MOLA a répondu ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    try {
      const grid = cleanMarsHeights(decodeFloat32Tiff(bytes));
      return encodeTerrariumPng(grid, Math.max(0.25, 2 ** (4 - z)));
    } catch (error) {
      throw new BadGatewayException(`Réponse d'altitude MOLA illisible : ${(error as Error).message}`);
    }
  }
}
