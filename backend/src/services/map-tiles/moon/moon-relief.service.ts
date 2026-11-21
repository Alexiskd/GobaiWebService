// Relief de la Lune en tuiles Terrarium, sur le modèle de Mapterhorn pour la Terre : les altitudes LOLA (LRO) de
// NASA Moon Trek sont lues en flottants, puis réencodées en Terrarium PNG, dans le découpage géographique de la Lune
// (2^(z+1) × 2^z tuiles, du pôle Nord au pôle Sud), le même que ses images.
//
// Source : LRO_LOLA_DEM_Global_256ppd_v06 (ImageServer ArcGIS de Moon Trek), altitudes en mètres par rapport à la
// sphère de 1 737,4 km, 256 pixels par degré (≈ 118 m), sans trou. Au niveau 7, une tuile de 256 px couvre 1,4° :
// c'est le niveau le plus fin utile (le 8 agrandit la source deux fois, le moteur agrandit au-delà).
//
// Comme chez Mapterhorn, la précision verticale est arrondie selon le niveau (1 m aux niveaux grossiers, 25 cm au
// plus fin) : les tuiles sont plus légères sans perte visible.
// Erreurs HTTP de NestJS.
import { BadGatewayException, BadRequestException, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
// Connexions à PostgreSQL (BP, la base Render).
import { Pool } from 'pg';
// Cache mémoire borné en octets.
import { ByteCache } from '../../../common/byte-cache';
// Validation d'une tuile dans une grille.
import { isValidTile } from '../tile-math';
// Lecture du TIFF flottant et écriture Terrarium.
import { decodeFloat32Tiff, decodeTerrariumPng, encodeTerrariumPng, type HeightGrid } from '../terrarium';
// Maillage et fichier glTF du modèle 3D.
import { buildMoonMesh, meshToGlb, type Mosaic } from './moon-relief-model';

/** Niveau le plus fin servi. */
export const MOON_RELIEF_MAX_ZOOM = 8;
/** Taille des tuiles. */
export const MOON_RELIEF_TILE = 256;
/** Délai d'attente de Moon Trek. */
const TIMEOUT_MS = 20_000;
/** Altitudes plausibles sur la Lune, en mètres (−9,1 km à +10,8 km) avec marge ; au-delà : pas de donnée. */
const MOON_LIMIT_M = 12_000;
/** Service ArcGIS des altitudes LOLA (modifiable par MOON_RELIEF_IMAGESERVER_URL). */
const DEFAULT_URL = 'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer';

/** Emprise d'une tuile du découpage géographique : ouest, sud, est, nord, en degrés. */
export function moonTileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const span = 180 / 2 ** z;
  const west = -180 + x * span, north = 90 - y * span;
  return [west, north - span, west + span, north];
}

/** Pas vertical d'arrondi au niveau z : 1 m jusqu'au niveau 4, puis divisé par deux par niveau, 25 cm au plus fin. */
export const moonVerticalStep = (z: number): number => Math.max(0.25, Math.min(1, 2 ** (4 - z)));

/** Adresse d'export ArcGIS d'une tuile : flottants 32 bits, TIFF sans compression, interpolation bilinéaire. */
export function moonReliefExportUrl(base: string, z: number, x: number, y: number, size = MOON_RELIEF_TILE): string {
  const params = new URLSearchParams({
    bbox: moonTileBounds(z, x, y).join(','),
    size: `${size},${size}`,
    format: 'tiff',
    pixelType: 'F32',
    compression: 'None',
    interpolation: 'RSP_BilinearInterpolation',
    f: 'image',
  });
  return `${base.replace(/\/+$/, '')}/exportImage?${params.toString()}`;
}

/**
 * Nettoie une grille LOLA : valeur non finie ou hors des altitudes lunaires → sans donnée ; grille en kilomètres
 * (toutes les valeurs sous 25 en valeur absolue) → convertie en mètres.
 */
export function cleanMoonHeights(grid: HeightGrid): HeightGrid {
  const d = grid.data;
  let maxAbs = 0;
  for (let i = 0; i < d.length; i++) if (Number.isFinite(d[i]) && Math.abs(d[i]) < 1e6) maxAbs = Math.max(maxAbs, Math.abs(d[i]));
  const scale = maxAbs > 0 && maxAbs < 25 ? 1000 : 1;
  const out = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) {
    const m = d[i] * scale;
    out[i] = Number.isFinite(m) && Math.abs(m) <= MOON_LIMIT_M ? m : Number.NaN;
  }
  return { width: grid.width, height: grid.height, data: out };
}

/** Niveau le plus fin préchargé dans BP (base PostgreSQL), 5 par défaut (2 730 tuiles), de 0 à 7. */
export const MOON_RELIEF_PRELOAD_MAX_ZOOM = Math.min(7, Math.max(0, Number(process.env.MOON_RELIEF_PRELOAD_MAX_ZOOM ?? 5) || 0));
/** Niveau des tuiles rassemblées pour le modèle 3D : 16 × 8 tuiles de 256 px, mosaïque de 4 096 × 2 048 (≈ 2,7 km). */
export const MOON_MODEL_ZOOM = 3;
/** Téléchargements simultanés du préchargement (Moon Trek est un service public : on reste mesuré). */
const PRELOAD_CONCURRENCY = 3;

/** Nombre de tuiles des niveaux 0 à z du découpage géographique : somme de 2^(2k+1). */
export const moonTileCount = (maxZoom: number): number => { let n = 0; for (let k = 0; k <= maxZoom; k++) n += 2 ** (2 * k + 1); return n; };

/** Table des tuiles de relief dans BP. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS moon_relief_tiles (
    z SMALLINT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL,
    png BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (z, x, y)
  )`;

/** État du préchargement, renvoyé par GET /tiles/moon-relief/status. */
export interface MoonReliefStatus {
  database: boolean;
  preload: { maxZoom: number; total: number; stored: number; failed: number; running: boolean; startedAt: string | null; finishedAt: string | null };
  model: { zoom: number; ready: boolean; url: string };
}

// Service des tuiles de relief de la Lune : mémoire → BP → Moon Trek, préchargement et modèle 3D.
@Injectable()
export class MoonReliefService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MoonReliefService.name);
  // Tuiles prêtes, gardées en mémoire (64 Mo au plus).
  private readonly cache = new ByteCache(64 * 1024 * 1024);
  // Calculs en cours, partagés entre requêtes simultanées pour la même tuile.
  private readonly pending = new Map<string, Promise<Buffer>>();
  // Adresse du service ArcGIS.
  private readonly baseUrl = process.env.MOON_RELIEF_IMAGESERVER_URL?.trim() || DEFAULT_URL;
  // Connexions à BP, ou null sans DATABASE_URL.
  private readonly pool: Pool | null = null;
  // Table créée (promesse partagée).
  private schemaReady: Promise<void> | null = null;
  // Tuiles présentes en base (clés « z/x/y »).
  private readonly stored = new Set<string>();
  // État du préchargement.
  private run = { running: false, failed: 0, startedAt: null as string | null, finishedAt: null as string | null };
  // Modèles 3D déjà fabriqués, par réglage (résolution, exagération).
  private readonly models = new Map<string, Promise<Buffer>>();

  // Constructeur : la fonction de téléchargement et l'adresse de la base (remplaçables dans les tests).
  constructor(
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    databaseUrl: string | undefined = process.env.DATABASE_URL?.trim(),
  ) {
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl, max: 4, ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    }
  }

  /** Au démarrage : préchargement dans BP en arrière-plan (le serveur n'attend pas). */
  onModuleInit(): void {
    if (!this.pool) { this.logger.warn('DATABASE_URL absent : relief de la Lune servi sans préchargement (mémoire seule).'); return; }
    void this.preload().catch((e: Error) => this.logger.warn(`Relief lunaire : préchargement interrompu (${e.message}).`));
  }

  // À l'arrêt : ferme les connexions.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Crée la table si besoin et lit la liste des tuiles déjà en base. */
  private ensureSchema(): Promise<void> {
    this.schemaReady ??= (async () => {
      await this.pool!.query(SCHEMA);
      const { rows } = await this.pool!.query<{ z: number; x: number; y: number }>('SELECT z, x, y FROM moon_relief_tiles');
      for (const r of rows) this.stored.add(`${r.z}/${r.x}/${r.y}`);
    })();
    return this.schemaReady;
  }

  /** Tuile Terrarium PNG (z, x, y) ; vrai `cached` si elle venait de la mémoire ou de BP. */
  async tile(z: number, x: number, y: number): Promise<{ body: Buffer; contentType: string; cached: boolean }> {
    if (!isValidTile(z, x, y, 'equirectangular') || z > MOON_RELIEF_MAX_ZOOM) {
      throw new BadRequestException(`Tuile de relief lunaire invalide : ${z}/${x}/${y} (niveaux 0 à ${MOON_RELIEF_MAX_ZOOM}, grille 2^(z+1) × 2^z).`);
    }
    const key = `${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) return { body: hit, contentType: 'image/png', cached: true };
    let job = this.pending.get(key);
    let fromDb = false;
    if (!job) {
      job = (async () => {
        // Déjà en base : lue dans BP.
        const inDb = await this.readDb(z, x, y);
        if (inDb) { fromDb = true; return inDb; }
        // Sinon : fabriquée chez Moon Trek, puis enregistrée dans BP.
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

  /** Tuile lue dans BP, ou null (absente, ou base indisponible). */
  private async readDb(z: number, x: number, y: number): Promise<Buffer | null> {
    if (!this.pool) return null;
    try {
      await this.ensureSchema();
      if (!this.stored.has(`${z}/${x}/${y}`)) return null;
      const { rows } = await this.pool.query<{ png: Buffer }>('SELECT png FROM moon_relief_tiles WHERE z=$1 AND x=$2 AND y=$3', [z, x, y]);
      return rows[0]?.png ?? null;
    } catch (e) {
      this.logger.warn(`Relief lunaire : lecture BP impossible (${(e as Error).message}).`);
      return null;
    }
  }

  /** Enregistre une tuile dans BP ; un échec est noté sans bloquer la réponse. */
  private async writeDb(z: number, x: number, y: number, png: Buffer): Promise<void> {
    if (!this.pool) return;
    try {
      await this.ensureSchema();
      await this.pool.query('INSERT INTO moon_relief_tiles (z, x, y, png) VALUES ($1, $2, $3, $4) ON CONFLICT (z, x, y) DO NOTHING', [z, x, y, png]);
      this.stored.add(`${z}/${x}/${y}`);
    } catch (e) {
      this.logger.warn(`Relief lunaire : écriture BP impossible (${(e as Error).message}).`);
    }
  }

  /**
   * Précharge dans BP toutes les tuiles des niveaux 0 à MOON_RELIEF_PRELOAD_MAX_ZOOM absentes de la base, du plus
   * grossier au plus fin (le modèle 3D, au niveau 3, est donc prêt tôt). Une tuile en échec est retentée une fois.
   */
  async preload(): Promise<void> {
    if (!this.pool || this.run.running) return;
    await this.ensureSchema();
    this.run = { running: true, failed: 0, startedAt: new Date().toISOString(), finishedAt: null };
    const todo: [number, number, number][] = [];
    for (let z = 0; z <= MOON_RELIEF_PRELOAD_MAX_ZOOM; z++) for (let y = 0; y < 2 ** z; y++) for (let x = 0; x < 2 ** (z + 1); x++) {
      if (!this.stored.has(`${z}/${x}/${y}`)) todo.push([z, x, y]);
    }
    this.logger.log(`Relief lunaire : ${this.stored.size} tuiles déjà dans BP, ${todo.length} à précharger (niveaux 0 à ${MOON_RELIEF_PRELOAD_MAX_ZOOM}).`);
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const [z, x, y] = todo[next++];
        for (let attempt = 0; attempt < 2; attempt++) {
          try { await this.tile(z, x, y); break; } catch { if (attempt === 1) this.run.failed++; }
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: PRELOAD_CONCURRENCY }, worker));
    } finally {
      this.run = { ...this.run, running: false, finishedAt: new Date().toISOString() };
      this.logger.log(`Relief lunaire : préchargement terminé, ${this.stored.size} tuiles dans BP, ${this.run.failed} en échec.`);
    }
  }

  /** État du préchargement et du modèle 3D. */
  status(): MoonReliefStatus {
    const total = moonTileCount(MOON_RELIEF_PRELOAD_MAX_ZOOM);
    let stored = 0;
    for (const k of this.stored) if (Number(k.split('/')[0]) <= MOON_RELIEF_PRELOAD_MAX_ZOOM) stored++;
    let modelReady = true;
    for (let y = 0; y < 2 ** MOON_MODEL_ZOOM && modelReady; y++) for (let x = 0; x < 2 ** (MOON_MODEL_ZOOM + 1); x++) if (!this.stored.has(`${MOON_MODEL_ZOOM}/${x}/${y}`)) { modelReady = false; break; }
    return {
      database: Boolean(this.pool),
      preload: { maxZoom: MOON_RELIEF_PRELOAD_MAX_ZOOM, total, stored, failed: this.run.failed, running: this.run.running, startedAt: this.run.startedAt, finishedAt: this.run.finishedAt },
      model: { zoom: MOON_MODEL_ZOOM, ready: Boolean(this.pool) && modelReady, url: '/api/v1/tiles/moon-relief/model.glb' },
    };
  }

  /** Mosaïque mondiale des altitudes au niveau du modèle, rassemblée depuis BP (ou Moon Trek pour les manquantes). */
  async mosaic(): Promise<Mosaic> {
    const z = MOON_MODEL_ZOOM, cols = 2 ** (z + 1), rows = 2 ** z, size = MOON_RELIEF_TILE;
    const width = cols * size, height = rows * size, data = new Float32Array(width * height);
    for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) {
      const g = decodeTerrariumPng((await this.tile(z, tx, ty)).body);
      for (let r = 0; r < size; r++) data.set(g.data.subarray(r * size, (r + 1) * size), (ty * size + r) * width + tx * size);
    }
    return { width, height, data };
  }

  /**
   * Modèle 3D du relief (.glb) : `cols` colonnes (360, 720 ou 1 440, la moitié en lignes), relief multiplié par
   * `exaggeration` (1 à 20). Fabriqué une fois par réglage, puis gardé en mémoire.
   */
  model(cols: number, exaggeration: number): Promise<Buffer> {
    const c = [360, 720, 1440].includes(cols) ? cols : 720;
    const e = Math.min(20, Math.max(1, Math.round(exaggeration) || 1));
    const key = `${c}x${e}`;
    let job = this.models.get(key);
    if (!job) {
      job = this.mosaic().then((m) => meshToGlb(buildMoonMesh(m, c, c / 2, e), 'Lune — relief LOLA', {
        source: 'LRO LOLA DEM 256 ppd (NASA Moon Trek), rassemblé au niveau 3', radiusKm: 1737.4, units: 'km', exaggeration: e, grid: `${c} × ${c / 2}`,
      }));
      // Un échec n'est pas gardé : le prochain appel réessaie.
      job.catch(() => this.models.delete(key));
      this.models.set(key, job);
    }
    return job;
  }

  /** Télécharge les altitudes de la tuile chez Moon Trek et les encode en Terrarium. */
  private async build(z: number, x: number, y: number): Promise<Buffer> {
    const url = moonReliefExportUrl(this.baseUrl, z, x, y);
    let res: Response;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new BadGatewayException(`Relief lunaire : Moon Trek injoignable (${(e as Error).message}).`);
    }
    if (!res.ok) throw new BadGatewayException(`Relief lunaire : Moon Trek a répondu ${res.status}.`);
    const buf = Buffer.from(await res.arrayBuffer());
    let grid: HeightGrid;
    try {
      grid = decodeFloat32Tiff(buf);
    } catch (e) {
      // Réponse qui n'est pas un TIFF (message d'erreur ArcGIS en JSON, par exemple).
      this.logger.warn(`Relief lunaire ${z}/${x}/${y} : ${(e as Error).message} (${buf.subarray(0, 120).toString('latin1')})`);
      throw new BadGatewayException('Relief lunaire : réponse illisible de Moon Trek.');
    }
    return encodeTerrariumPng(cleanMoonHeights(grid), moonVerticalStep(z));
  }
}
