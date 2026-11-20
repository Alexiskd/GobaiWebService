// Importe de NestJS les exceptions HTTP, le décorateur de service, le journal et le crochet d'arrêt du module.
import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, type OnModuleDestroy } from '@nestjs/common';
// Importe Pool, le groupe de connexions PostgreSQL.
import { Pool } from 'pg';
// Importe ByteCache, le cache mémoire borné en octets.
import { ByteCache } from '../../common/byte-cache';
// Importe la validation d'une tuile dans une grille.
import { isValidTile } from './tile-math';
// Importe le décodeur du TIFF en flottants et l'encodeur Terrarium.
import { decodeFloat32Tiff, encodeTerrariumPng, type HeightGrid } from './terrarium';
// Importe les sources des astres et les fonctions pures du relief.
import {
  BODY_RELIEF_SOURCES, bodyReliefExportUrl, bodyReliefSource, bodyVerticalStep, cleanBodyHeights, missingShare, type BodyReliefSource,
} from './body-relief';

/** Délai d'une demande à NASA Trek. */
const TIMEOUT_MS = 20_000;
/** Au-delà de cette part de pixels sans donnée, la réponse de Trek est tenue pour fausse (mauvaise emprise) : rien n'est servi ni gardé. */
const MAX_MISSING = 0.98;

/**
 * Table des tuiles de relief gardées dans BP (la base PostgreSQL de Render) : une ligne par astre et par tuile.
 * Une tuile n'est fabriquée qu'une fois ; les redémarrages et les autres instances la relisent ici.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS body_relief_tiles (
    body TEXT NOT NULL, z SMALLINT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL,
    png BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (body, z, x, y)
  )`;

/** État du relief des astres : par astre, sa source, ses niveaux et le nombre de tuiles déjà dans BP. */
export interface BodyReliefStatus {
  database: boolean;
  bodies: { id: string; label: string; dataset: string; radiusKm: number; maxZoom: number; stored: number; template: string }[];
}

/**
 * Relief de Mars et de Mercure, sur le modèle de celui de la Lune : altitudes lues sur les ImageServer de NASA
 * Trek, réencodées en tuiles Terrarium PNG de 256 px dans le découpage géographique 2^(z+1) × 2^z.
 * Trois étages : mémoire du processus, puis BP si DATABASE_URL est réglé, puis NASA Trek. Sans base, le relief
 * est servi quand même, depuis la mémoire seule. Aucun préchargement : chaque tuile est fabriquée à sa première
 * demande, puis gardée.
 */
@Injectable()
export class BodyReliefService implements OnModuleDestroy {
  // Le journal du service.
  private readonly logger = new Logger(BodyReliefService.name);
  // Cache mémoire des tuiles encodées : 64 Mo pour tous les astres.
  private readonly cache = new ByteCache(64 * 1024 * 1024);
  // Fabrications en cours, pour ne pas demander deux fois la même tuile à Trek.
  private readonly pending = new Map<string, Promise<Buffer>>();
  // Le groupe de connexions à BP, ou null sans DATABASE_URL.
  private readonly pool: Pool | null = null;
  // La création de la table, lancée une seule fois.
  private schemaReady: Promise<void> | null = null;
  // Les tuiles déjà dans BP (« astre/z/x/y »), pour ne pas interroger la base à vide.
  private readonly stored = new Set<string>();

  // Constructeur : la fonction de téléchargement (remplaçable dans les tests) et l'adresse de la base.
  constructor(
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    databaseUrl: string | undefined = process.env.DATABASE_URL?.trim(),
  ) {
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl, max: 2, ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    }
  }

  // À l'arrêt du module : ferme les connexions.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Adresse de l'ImageServer d'un astre : la variable d'environnement de la source, sinon son adresse par défaut. */
  private baseUrl(source: BodyReliefSource): string {
    return process.env[source.env]?.trim() || source.url;
  }

  /** Crée la table au besoin et relit la liste des tuiles déjà gardées. */
  private ensureSchema(): Promise<void> {
    this.schemaReady ??= (async () => {
      await this.pool!.query(SCHEMA);
      const { rows } = await this.pool!.query<{ body: string; z: number; x: number; y: number }>('SELECT body, z, x, y FROM body_relief_tiles');
      for (const r of rows) this.stored.add(`${r.body}/${r.z}/${r.x}/${r.y}`);
    })();
    // Un échec (base injoignable) ne doit pas rester en mémoire : la prochaine demande réessaie.
    this.schemaReady.catch(() => { this.schemaReady = null; });
    return this.schemaReady;
  }

  /** Une tuile Terrarium d'un astre : { body, contentType, cached } ; cached = lue en mémoire ou dans BP. */
  async tile(body: string, z: number, x: number, y: number): Promise<{ body: Buffer; contentType: string; cached: boolean }> {
    const source = bodyReliefSource(body);
    if (!source) throw new NotFoundException(`Aucun relief servi pour « ${body} » (astres : ${Object.keys(BODY_RELIEF_SOURCES).join(', ')}).`);
    if (!isValidTile(z, x, y, 'equirectangular') || z > source.maxZoom) {
      throw new BadRequestException(`Tuile de relief de ${source.label} invalide : ${z}/${x}/${y} (niveaux 0 à ${source.maxZoom}, grille 2^(z+1) × 2^z).`);
    }
    const key = `${source.id}/${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) return { body: hit, contentType: 'image/png', cached: true };
    let job = this.pending.get(key);
    let fromDb = false;
    if (!job) {
      job = (async () => {
        const inDb = await this.readDb(source, z, x, y);
        if (inDb) { fromDb = true; return inDb; }
        const png = await this.build(source, z, x, y);
        await this.writeDb(source, z, x, y, png);
        return png;
      })().finally(() => this.pending.delete(key));
      this.pending.set(key, job);
    }
    const png = await job;
    this.cache.set(key, png);
    return { body: png, contentType: 'image/png', cached: fromDb };
  }

  /** Lit une tuile dans BP ; null si elle n'y est pas ou si la base ne répond pas. */
  private async readDb(source: BodyReliefSource, z: number, x: number, y: number): Promise<Buffer | null> {
    if (!this.pool) return null;
    try {
      await this.ensureSchema();
      if (!this.stored.has(`${source.id}/${z}/${x}/${y}`)) return null;
      const { rows } = await this.pool.query<{ png: Buffer }>('SELECT png FROM body_relief_tiles WHERE body=$1 AND z=$2 AND x=$3 AND y=$4', [source.id, z, x, y]);
      return rows[0]?.png ?? null;
    } catch (e) {
      this.logger.warn(`Relief de ${source.label} : lecture BP impossible (${(e as Error).message}).`);
      return null;
    }
  }

  /** Garde une tuile dans BP ; un échec est journalisé sans empêcher de la servir. */
  private async writeDb(source: BodyReliefSource, z: number, x: number, y: number, png: Buffer): Promise<void> {
    if (!this.pool) return;
    try {
      await this.ensureSchema();
      await this.pool.query('INSERT INTO body_relief_tiles (body, z, x, y, png) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (body, z, x, y) DO NOTHING', [source.id, z, x, y, png]);
      this.stored.add(`${source.id}/${z}/${x}/${y}`);
    } catch (e) {
      this.logger.warn(`Relief de ${source.label} : écriture BP impossible (${(e as Error).message}).`);
    }
  }

  /** État : la base est-elle branchée, et pour chaque astre sa source et le nombre de tuiles gardées. */
  status(): BodyReliefStatus {
    return {
      database: Boolean(this.pool),
      bodies: Object.values(BODY_RELIEF_SOURCES).map((s) => {
        let stored = 0;
        for (const k of this.stored) if (k.startsWith(`${s.id}/`)) stored++;
        return { id: s.id, label: s.label, dataset: s.dataset, radiusKm: s.radiusKm, maxZoom: s.maxZoom, stored, template: `/api/v1/tiles/relief/${s.id}/{z}/{x}/{y}.png` };
      }),
    };
  }

  /** Fabrique une tuile : demande le TIFF à NASA Trek, nettoie les altitudes, encode en Terrarium. */
  private async build(source: BodyReliefSource, z: number, x: number, y: number): Promise<Buffer> {
    const url = bodyReliefExportUrl(source, this.baseUrl(source), z, x, y);
    let res: Response;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new BadGatewayException(`Relief de ${source.label} : NASA Trek injoignable (${(e as Error).message}).`);
    }
    if (!res.ok) throw new BadGatewayException(`Relief de ${source.label} : NASA Trek a répondu ${res.status}.`);
    const buf = Buffer.from(await res.arrayBuffer());
    let grid: HeightGrid;
    try {
      grid = cleanBodyHeights(decodeFloat32Tiff(buf), source.limitM);
    } catch (e) {
      // Une erreur du service arrive en JSON ou en HTML avec un code 200 : le début de la réponse aide à comprendre.
      this.logger.warn(`Relief de ${source.label} ${z}/${x}/${y} : ${(e as Error).message} (${buf.subarray(0, 120).toString('latin1')})`);
      throw new BadGatewayException(`Relief de ${source.label} : réponse illisible de NASA Trek.`);
    }
    // Une tuile presque entièrement vide n'est pas un terrain plat : c'est une emprise que le service ne couvre pas.
    // Elle n'est ni servie ni gardée dans BP, pour ne pas figer un faux relief plat.
    if (missingShare(grid) > MAX_MISSING) {
      this.logger.warn(`Relief de ${source.label} ${z}/${x}/${y} : aucune altitude dans la réponse de NASA Trek.`);
      throw new BadGatewayException(`Relief de ${source.label} : aucune altitude pour cette tuile.`);
    }
    return encodeTerrariumPng(grid, bodyVerticalStep(z));
  }
}
