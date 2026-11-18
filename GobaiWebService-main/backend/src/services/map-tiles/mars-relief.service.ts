// Relief de Mars : adaptation du pipeline Terrarium de la Terre et du pipeline LOLA de la Lune.
// La source est un DEM numérique MOLA (pas la couche MOLA colorisée/hillshade de Trek) : chaque pixel représente
// une altitude en mètres au-dessus de l'aréoïde martien. Les images couleur restent indépendantes du DEM.
import { BadGatewayException, BadRequestException, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ByteCache } from '../../common/byte-cache';
import { isValidTile } from './tile-math';
import { decodeFloat32Tiff, decodeTerrariumPng, encodeTerrariumPng, type HeightGrid } from './terrarium';
import { buildMarsMesh, meshToGlb, type Mosaic } from './mars-relief-model';

export const MARS_RELIEF_MAX_ZOOM = 7;
export const MARS_RELIEF_TILE = 256;
const TIMEOUT_MS = 25_000;
const MARS_LIMIT_M = 25_000;
const MARS_MIN_M = -12_000;
const MARS_RADIUS_M = 3_396_190;
const DEFAULT_URL = 'https://tiles.arcgis.com/tiles/lqRTrQp2HrfnJt8U/arcgis/rest/services/Mars_HRSC_MOLA_ProjectRaster/ImageServer';
const FALLBACK_URL = 'https://trek.nasa.gov/mars/trekarcgis/rest/services/Mars_MGS_MOLA_DEM_mosaic_global_463m/ImageServer';

/** Emprise de la tuile en coordonnées Mars Equidistant Cylindrical (mètres), longitude Est positive. */
export function marsTileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const lonSpan = 360 / (2 ** (z + 1));
  const latSpan = 180 / (2 ** z);
  const west = -180 + x * lonSpan;
  const east = west + lonSpan;
  const north = 90 - y * latSpan;
  const south = north - latSpan;
  const toX = (lon: number) => MARS_RADIUS_M * lon * Math.PI / 180;
  const toY = (lat: number) => MARS_RADIUS_M * lat * Math.PI / 180;
  return [toX(west), toY(south), toX(east), toY(north)];
}

/** URL ArcGIS exportImage en F32 ; reprojection dans le repère MarsEC0 (WKID 104905). */
export function marsReliefExportUrl(base: string, z: number, x: number, y: number, size = MARS_RELIEF_TILE): string {
  const params = new URLSearchParams({
    bbox: marsTileBounds(z, x, y).join(','), bboxSR: '104905', imageSR: '104905',
    size: `${size},${size}`, format: 'tiff', pixelType: 'F32', compression: 'LZ77',
    interpolation: 'RSP_BilinearInterpolation', f: 'image',
  });
  return `${base.replace(/\/+$/, '')}/exportImage?${params.toString()}`;
}

/** Nettoie les altitudes MOLA/HRSC : mètres au-dessus de l'aréoïde, NaN pour nodata ou valeurs impossibles. */
export function cleanMarsHeights(grid: HeightGrid): HeightGrid {
  const d = grid.data;
  // Les ImageServer DEM configurés ici doivent exposer des mètres ; aucune conversion automatique km→m
  // n'est appliquée, car elle fausserait les faibles altitudes si la tuile ne couvrait qu'une plaine.
  const scale = 1;
  const out = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) {
    const m = d[i] * scale;
    out[i] = Number.isFinite(m) && m >= MARS_MIN_M && m <= MARS_LIMIT_M ? m : Number.NaN;
  }
  return { width: grid.width, height: grid.height, data: out };
}

export const marsVerticalStep = (z: number): number => Math.max(0.5, Math.min(2, 2 ** (4 - z)));
const MODEL_ZOOM = 3;
const SCHEMA = `CREATE TABLE IF NOT EXISTS mars_relief_tiles (
  z SMALLINT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL,
  png BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (z, x, y)
)`;

@Injectable()
export class MarsReliefService implements OnModuleDestroy {
  private readonly logger = new Logger(MarsReliefService.name);
  private readonly cache = new ByteCache(48 * 1024 * 1024);
  private readonly pending = new Map<string, Promise<Buffer>>();
  private readonly urls = [process.env.MARS_RELIEF_IMAGESERVER_URL?.trim() || DEFAULT_URL, process.env.MARS_RELIEF_FALLBACK_IMAGESERVER_URL?.trim() || FALLBACK_URL];
  private readonly pool: Pool | null;
  private schemaReady: Promise<void> | null = null;
  private readonly stored = new Set<string>();
  private readonly models = new Map<string, Promise<Buffer>>();

  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args), databaseUrl: string | undefined = process.env.DATABASE_URL?.trim()) {
    this.pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 3, ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined }) : null;
    this.pool?.on('error', (e: Error) => this.logger.warn(`PostgreSQL relief Mars : ${e.message}`));
  }

  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  private ensureSchema(): Promise<void> {
    this.schemaReady ??= (async () => {
      await this.pool!.query(SCHEMA);
      const { rows } = await this.pool!.query<{ z: number; x: number; y: number }>('SELECT z,x,y FROM mars_relief_tiles');
      for (const r of rows) this.stored.add(`${r.z}/${r.x}/${r.y}`);
    })();
    return this.schemaReady;
  }

  async tile(z: number, x: number, y: number): Promise<{ body: Buffer; contentType: string; cached: boolean }> {
    if (!isValidTile(z, x, y, 'equirectangular') || z > MARS_RELIEF_MAX_ZOOM) throw new BadRequestException(`Tuile de relief martien invalide : ${z}/${x}/${y}.`);
    const key = `${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) return { body: hit, contentType: 'image/png', cached: true };
    let job = this.pending.get(key);
    let fromDb = false;
    if (!job) {
      job = (async () => {
        const inDb = await this.readDb(z, x, y);
        if (inDb) { fromDb = true; return inDb; }
        const body = await this.build(z, x, y);
        await this.writeDb(z, x, y, body);
        return body;
      })().finally(() => this.pending.delete(key));
      this.pending.set(key, job);
    }
    const body = await job;
    this.cache.set(key, body);
    return { body, contentType: 'image/png', cached: fromDb };
  }

  private async readDb(z: number, x: number, y: number): Promise<Buffer | null> {
    if (!this.pool) return null;
    try {
      await this.ensureSchema();
      if (!this.stored.has(`${z}/${x}/${y}`)) return null;
      const { rows } = await this.pool.query<{ png: Buffer }>('SELECT png FROM mars_relief_tiles WHERE z=$1 AND x=$2 AND y=$3', [z, x, y]);
      return rows[0]?.png ?? null;
    } catch (e) { this.logger.warn(`Lecture cache relief Mars impossible : ${(e as Error).message}`); return null; }
  }

  private async writeDb(z: number, x: number, y: number, png: Buffer): Promise<void> {
    if (!this.pool) return;
    try {
      await this.ensureSchema();
      await this.pool.query('INSERT INTO mars_relief_tiles (z,x,y,png) VALUES ($1,$2,$3,$4) ON CONFLICT (z,x,y) DO NOTHING', [z, x, y, png]);
      this.stored.add(`${z}/${x}/${y}`);
    } catch (e) { this.logger.warn(`Écriture cache relief Mars impossible : ${(e as Error).message}`); }
  }

  status() {
    return { source: 'HRSC-MOLA numeric DEM, fallback MOLA MEGDR (NASA Mars Trek)', database: Boolean(this.pool), cachedTiles: this.stored.size,
      maxZoom: MARS_RELIEF_MAX_ZOOM, tileSize: MARS_RELIEF_TILE,
      model: { zoom: MODEL_ZOOM, url: '/api/v1/tiles/mars-relief/model.glb?cols=720&exaggeration=1' } };
  }

  async mosaic(): Promise<Mosaic> {
    const z = MODEL_ZOOM, cols = 2 ** (z + 1), rows = 2 ** z, size = MARS_RELIEF_TILE;
    const width = cols * size, height = rows * size, data = new Float32Array(width * height);
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
      const g = decodeTerrariumPng((await this.tile(z, tx, ty)).body);
      for (let r = 0; r < size; r++) data.set(g.data.subarray(r * size, (r + 1) * size), (ty * size + r) * width + tx * size);
    }
    return { width, height, data };
  }

  model(cols: number, exaggeration: number): Promise<Buffer> {
    const c = [360, 720, 1440].includes(cols) ? cols : 720;
    const e = Math.min(10, Math.max(1, Number.isFinite(exaggeration) ? exaggeration : 1));
    const key = `${c}x${e}`;
    let job = this.models.get(key);
    if (!job) {
      job = this.mosaic().then((m) => meshToGlb(buildMarsMesh(m, c, c / 2, e), 'Mars — relief MOLA', {
        source: 'NASA MOLA MEGDR / USGS MOLA-HRSC numeric DEM', datum: 'Mars areoid', radiusKm: 3396.19,
        units: 'km', exaggeration: e, grid: `${c} × ${c / 2}`, mosaicZoom: MODEL_ZOOM,
      }));
      job.catch(() => this.models.delete(key));
      this.models.set(key, job);
    }
    return job;
  }

  private async build(z: number, x: number, y: number): Promise<Buffer> {
    let lastError = 'aucune source disponible';
    for (const base of this.urls) {
      const url = marsReliefExportUrl(base, z, x, y);
      try {
        const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) { lastError = `${res.status} depuis ${base}`; continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const grid = cleanMarsHeights(decodeFloat32Tiff(buf));
        const valid = grid.data.reduce((n, h) => n + (Number.isFinite(h) ? 1 : 0), 0);
        if (!valid) { lastError = `aucune altitude valide depuis ${base}`; continue; }
        return encodeTerrariumPng(grid, marsVerticalStep(z));
      } catch (e) { lastError = `${base}: ${(e as Error).message}`; }
    }
    this.logger.error(`Sources DEM martiennes inaccessibles : ${lastError}`);
    throw new BadGatewayException(`Relief de Mars : impossible de récupérer le DEM MOLA/HRSC (${lastError}).`);
  }
}
