// Blend de la Lune : le modèle 3D complet de la Lune, reconstruit à partir des couches de la carte réelle et de
// l'outil de relief, puis enregistré dans BP (la base PostgreSQL du serveur).
//
//   relief  : mosaïque des altitudes LOLA (MoonReliefService, niveau 3, ≈ 2,7 km), maillage en sphère de 1 737,4 km ;
//   couleur : « Lune réelle », composée comme dans le moteur (tileShaders.jsx, mode 2) — teinte et saturation des
//             couleurs naturelles NASA SVS, luminosité fine du détail Kaguya (niveau 3, 4 096 × 2 048) ; dans les trous
//             de Kaguya, la luminosité naturelle prend sa place ; teinte naturelle à 75 % ;
//   fichier : glTF binaire (.glb) avec la texture JPEG intégrée, une ligne par variante (relief ×1, ×5, ×10) dans BP.
// Erreurs et cycle de vie NestJS.
import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
// Connexions à PostgreSQL.
import { Pool } from 'pg';
// Couleurs naturelles de la Lune (NASA SVS).
import { MoonColorService } from './moon-color.service';
// Tuiles de la Lune (Kaguya).
import { MoonTileCacheService } from './moon-tile-cache.service';
// Relief de la Lune (mosaïque LOLA).
import { MoonReliefService } from './moon-relief.service';
// Maillage et glTF.
import { buildMoonMesh, meshToGlb } from './moon-relief-model';

/** Variantes du blend : exagération du relief. */
export const MOON_BLEND_VARIANTS = [1, 5, 10] as const;
/** Niveau des tuiles Kaguya rassemblées : 16 × 8 tuiles, texture de 4 096 × 2 048. */
const COLOR_ZOOM = 3;
/** Taille d'une tuile de texture. */
const TILE = 256;
/** Grille du maillage : un demi-degré. */
const MESH_COLS = 720;
/** Couche du détail Kaguya. */
const KAGUYA_LAYER = 'moon-kaguya';

/** Composition « Lune réelle » d'un pixel, la même que celle du moteur : couleur naturelle `nat`, luminosité du détail `kl` (null = trou). */
export function realMoonPixel(nat: [number, number, number], kl: number | null): [number, number, number] {
  const nl = Math.max(0.299 * nat[0] + 0.587 * nat[1] + 0.114 * nat[2], 0.04);
  const l = kl === null || kl < 0.006 ? nl : kl;
  return nat.map((c) => Math.min(1, Math.max(0, l * (1 + ((c / nl) - 1) * 0.75)))) as [number, number, number];
}

// Fabrique minimale de sharp (bibliothèque chargée à la première utilisation).
type SharpImage = {
  resize(w: number, h: number, o?: Record<string, unknown>): SharpImage;
  removeAlpha(): SharpImage; ensureAlpha(): SharpImage; greyscale(): SharpImage;
  raw(): SharpImage; jpeg(o?: Record<string, unknown>): SharpImage;
  toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }>;
  toBuffer(): Promise<Buffer>;
};
type SharpFn = (input: Buffer, o?: Record<string, unknown>) => SharpImage;

/** Charge sharp (require, puis import pour la version en module ES). */
async function loadSharp(): Promise<SharpFn> {
  const pick = (m: unknown) => ((m as { default?: unknown })?.default ?? m) as SharpFn;
  try { return pick(require('sharp')); } catch { /* essai suivant */ }
  const load = new Function('name', 'return import(name)') as (name: string) => Promise<unknown>;
  return pick(await load('sharp'));
}

/** Ligne d'une variante enregistrée dans BP. */
export interface MoonBlendEntry { exaggeration: number; stored: boolean; size: number | null; createdAt: string | null; building: boolean; error: string | null }

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS moon_blend (
    exaggeration SMALLINT PRIMARY KEY,
    glb BYTEA NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

// Service du blend de la Lune.
@Injectable()
export class MoonBlendService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MoonBlendService.name);
  private readonly pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;
  // Fabrications en cours et dernière erreur, par variante.
  private readonly building = new Map<number, Promise<void>>();
  private readonly errors = new Map<number, string>();
  // Texture « Lune réelle » partagée par les variantes (fabriquée une fois).
  private texture: Promise<Buffer> | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly relief: MoonReliefService,
    private readonly tiles: MoonTileCacheService,
    private readonly colors: MoonColorService,
    databaseUrl: string | undefined = process.env.DATABASE_URL?.trim(),
  ) {
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl, max: 2, ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    }
  }

  /** Au démarrage : le blend réel (×1) est fabriqué et enregistré dans BP s'il n'y est pas encore, après 2 minutes. */
  onModuleInit(): void {
    if (!this.pool) return;
    this.timer = setTimeout(() => {
      void this.list().then((l) => { if (!l.find((e) => e.exaggeration === 1)?.stored) this.start(1); }).catch(() => {});
    }, 120_000);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.pool?.end();
  }

  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.reject(new NotFoundException('Base BP non branchée (DATABASE_URL absent).'));
    this.schemaReady ??= this.pool.query(SCHEMA).then(() => undefined);
    this.schemaReady.catch(() => { this.schemaReady = null; });
    return this.schemaReady;
  }

  /** Variante valide, sinon erreur 400. */
  private variant(e: number): number {
    if (!(MOON_BLEND_VARIANTS as readonly number[]).includes(e)) throw new BadRequestException(`Variante inconnue : ×${e} (×${MOON_BLEND_VARIANTS.join(', ×')}).`);
    return e;
  }

  /** État de chaque variante : enregistrée ou non dans BP, taille, date, fabrication en cours, erreur. */
  async list(): Promise<{ database: boolean; variants: MoonBlendEntry[] }> {
    const rows = new Map<number, { size: number; created_at: Date }>();
    if (this.pool) {
      try {
        await this.ensureSchema();
        const r = await this.pool.query<{ exaggeration: number; size: number; created_at: Date }>('SELECT exaggeration, size, created_at FROM moon_blend');
        for (const x of r.rows) rows.set(Number(x.exaggeration), x);
      } catch (e) {
        this.logger.warn(`Blend lunaire : lecture BP impossible (${(e as Error).message}).`);
      }
    }
    return {
      database: Boolean(this.pool),
      variants: MOON_BLEND_VARIANTS.map((e) => {
        const r = rows.get(e);
        return { exaggeration: e, stored: Boolean(r), size: r ? Number(r.size) : null, createdAt: r ? new Date(r.created_at).toISOString() : null, building: this.building.has(e), error: this.errors.get(e) ?? null };
      }),
    };
  }

  /** Lance la fabrication d'une variante en arrière-plan (sans effet si elle est déjà en cours). */
  start(exaggeration: number): void {
    const e = this.variant(exaggeration);
    if (!this.pool) throw new NotFoundException('Base BP non branchée (DATABASE_URL absent) : le blend ne peut pas être enregistré.');
    if (this.building.has(e)) return;
    this.errors.delete(e);
    const job = this.build(e)
      .catch((err: Error) => { this.errors.set(e, err.message); this.logger.warn(`Blend lunaire ×${e} : ${err.message}`); })
      .finally(() => this.building.delete(e));
    this.building.set(e, job);
  }

  /** Fichier .glb d'une variante, lu dans BP. */
  async glb(exaggeration: number): Promise<Buffer> {
    const e = this.variant(exaggeration);
    await this.ensureSchema();
    const r = await this.pool!.query<{ glb: Buffer }>('SELECT glb FROM moon_blend WHERE exaggeration = $1', [e]);
    if (!r.rows[0]) throw new NotFoundException(`Blend ×${e} pas encore enregistré dans BP.`);
    return r.rows[0].glb;
  }

  /** Fabrique la variante (relief + texture réelle) et l'enregistre dans BP. */
  private async build(e: number): Promise<void> {
    await this.ensureSchema();
    const t0 = Date.now();
    const [mosaic, jpeg] = await Promise.all([this.relief.mosaic(), this.realTexture()]);
    const mesh = buildMoonMesh(mosaic, MESH_COLS, MESH_COLS / 2, e);
    const glb = meshToGlb(mesh, 'Lune — blend', {
      relief: 'LRO LOLA DEM 256 ppd (NASA Moon Trek), niveau 3', color: 'NASA SVS (couleurs) × Kaguya TC (détail), niveau 3',
      radiusKm: 1737.4, units: 'km', exaggeration: e,
    }, jpeg);
    await this.pool!.query(
      'INSERT INTO moon_blend (exaggeration, glb, size) VALUES ($1, $2, $3) ON CONFLICT (exaggeration) DO UPDATE SET glb = EXCLUDED.glb, size = EXCLUDED.size, created_at = now()',
      [e, glb, glb.length],
    );
    this.logger.log(`Blend lunaire ×${e} enregistré dans BP : ${(glb.length / 1e6).toFixed(1)} Mo en ${Math.round((Date.now() - t0) / 1000)} s.`);
  }

  /** Texture « Lune réelle » en JPEG, 4 096 × 2 048, plate carrée, nord en haut (fabriquée une fois). */
  private realTexture(): Promise<Buffer> {
    this.texture ??= this.composeTexture();
    this.texture.catch(() => { this.texture = null; });
    return this.texture;
  }

  private async composeTexture(): Promise<Buffer> {
    const sharp = await loadSharp();
    const cols = 2 ** (COLOR_ZOOM + 1), rows = 2 ** COLOR_ZOOM, W = cols * TILE, H = rows * TILE;
    // Couleurs naturelles, mises à la taille de la texture.
    const color = await this.colors.get();
    const nat = await sharp(color.body).removeAlpha().resize(W, H, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    // Détail Kaguya en gris, avec sa transparence (trous de la mosaïque), tuile par tuile ; une tuile absente = trou.
    const detail = new Float32Array(W * H).fill(-1);
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
      try {
        const tile = await this.tiles.get(KAGUYA_LAYER, COLOR_ZOOM, tx, ty);
        const g = await sharp(tile.body).ensureAlpha().resize(TILE, TILE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
        const ch = g.info.channels;
        for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
          const s = (y * TILE + x) * ch;
          if (g.data[s + ch - 1] < 128) continue;
          detail[(ty * TILE + y) * W + tx * TILE + x] = (0.299 * g.data[s] + 0.587 * g.data[s + 1] + 0.114 * g.data[s + 2]) / 255;
        }
      } catch (err) {
        this.logger.warn(`Blend lunaire : tuile Kaguya ${COLOR_ZOOM}/${tx}/${ty} absente (${(err as Error).message}).`);
      }
    }
    // Composition pixel par pixel.
    const out = Buffer.alloc(W * H * 3), nc = nat.info.channels;
    for (let i = 0; i < W * H; i++) {
      const n: [number, number, number] = [nat.data[i * nc] / 255, nat.data[i * nc + 1] / 255, nat.data[i * nc + 2] / 255];
      const p = realMoonPixel(n, detail[i] < 0 ? null : detail[i]);
      out[i * 3] = Math.round(p[0] * 255); out[i * 3 + 1] = Math.round(p[1] * 255); out[i * 3 + 2] = Math.round(p[2] * 255);
    }
    return sharp(out, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }
}
