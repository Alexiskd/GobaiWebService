// Tuiles KTX2 de la Terre vue de loin (niveaux 0 à 6), préconverties et enregistrées dans BP (la base PostgreSQL
// du serveur). Une tuile KTX2 reste compressée dans la mémoire graphique (4 à 8 fois moins qu'un JPEG décodé), ce
// qui allège l'iPhone. Les tuiles ne sont écrites que par le script de préconversion (backend/scripts/earth-ktx2.mjs),
// qui lit DATABASE_URL : aucune route d'écriture n'est exposée. Ici, lecture seule.
//   table  : earth_ktx2 (layer, z, x, y) → data (octets du fichier .ktx2) ; une ligne par tuile.
//   routes : voir tiles.controller.ts (earth-ktx2/status et earth-ktx2/:layer/:z/:x/:y).

// Erreurs et cycle de vie NestJS.
import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
// Connexions à PostgreSQL.
import { Pool } from 'pg';

/** Couches préconverties : Sentinel-2 cloudless (EOX) et Blue Marble (NASA GIBS). */
// Déclare et exporte les couches acceptées.
export const EARTH_KTX2_LAYERS = ['sentinel2', 'gibs'] as const;
/** Niveau le plus fin préconverti : 6 (5 461 tuiles par couche, de 0 à 6). */
// Déclare et exporte le niveau maximal.
export const EARTH_KTX2_MAX_ZOOM = 6;

// Schéma de la table : une ligne par tuile, clé (couche, niveau, colonne, ligne).
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS earth_ktx2 (
    layer TEXT NOT NULL,
    z SMALLINT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    data BYTEA NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (layer, z, x, y)
  )`;

/** Tuile demandée, vérifiée : couche connue, niveau de 0 à 6, colonne et ligne dans la grille 2^z. */
// Déclare et exporte checkEarthKtx2 : la couche, le niveau, la colonne et la ligne (texte ou nombres).
export function checkEarthKtx2(layer: string, z: number, x: number, y: number): { layer: string; z: number; x: number; y: number } {
  // Couche inconnue : erreur 400.
  if (!(EARTH_KTX2_LAYERS as readonly string[]).includes(layer)) throw new BadRequestException(`Couche inconnue : ${layer} (${EARTH_KTX2_LAYERS.join(', ')}).`);
  // Niveau hors de 0 … 6 : erreur 400.
  if (!Number.isInteger(z) || z < 0 || z > EARTH_KTX2_MAX_ZOOM) throw new BadRequestException(`Niveau hors de 0 à ${EARTH_KTX2_MAX_ZOOM} : ${z}.`);
  // Taille de la grille à ce niveau.
  const n = 2 ** z;
  // Colonne ou ligne hors de la grille : erreur 400.
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= n || y >= n) throw new BadRequestException(`Tuile hors de la grille ${n} × ${n} : ${x}/${y}.`);
  // La tuile vérifiée.
  return { layer, z, x, y };
// Fin de checkEarthKtx2.
}

// Service des tuiles KTX2 de la Terre (lecture seule).
@Injectable()
export class EarthKtx2Service implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EarthKtx2Service.name);
  private readonly pool: Pool | null = null;
  private schemaReady: Promise<void> | null = null;

  constructor(databaseUrl: string | undefined = process.env.DATABASE_URL?.trim()) {
    // Sans DATABASE_URL : pas de connexion, toutes les tuiles répondent 404 (l'app retombe sur les JPEG).
    if (databaseUrl) {
      this.pool = new Pool({ connectionString: databaseUrl, max: 2, ssl: databaseUrl.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    }
  }

  /** Au démarrage : écrit dans les logs si BP est branchée et combien de tuiles KTX2 y sont enregistrées. */
  onModuleInit(): void {
    if (!this.pool) { this.logger.warn('Tuiles KTX2 : BP non branchée (DATABASE_URL absent).'); return; }
    void this.status().then((s) => this.logger.log(`Tuiles KTX2 : BP branchée, ${s.total} tuile(s) en base.`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  // Crée la table au premier besoin.
  private ensureSchema(): Promise<void> {
    if (!this.pool) return Promise.reject(new NotFoundException('Base BP non branchée (DATABASE_URL absent).'));
    this.schemaReady ??= this.pool.query(SCHEMA).then(() => undefined);
    this.schemaReady.catch(() => { this.schemaReady = null; });
    return this.schemaReady;
  }

  /** Octets du fichier .ktx2 d'une tuile, lus dans BP ; erreur 404 si elle n'y est pas (l'app prend alors le JPEG). */
  async tile(layer: string, z: number, x: number, y: number): Promise<Buffer> {
    const t = checkEarthKtx2(layer, z, x, y);
    await this.ensureSchema();
    const r = await this.pool!.query<{ data: Buffer }>('SELECT data FROM earth_ktx2 WHERE layer = $1 AND z = $2 AND x = $3 AND y = $4', [t.layer, t.z, t.x, t.y]);
    if (!r.rows[0]) throw new NotFoundException(`Tuile KTX2 ${t.layer}/${t.z}/${t.x}/${t.y} pas enregistrée dans BP.`);
    return r.rows[0].data;
  }

  /** Nombre de tuiles enregistrées, par couche et par niveau, et taille totale en octets. */
  async status(): Promise<{ database: boolean; total: number; bytes: number; layers: Record<string, Record<number, number>> }> {
    const out = { database: Boolean(this.pool), total: 0, bytes: 0, layers: {} as Record<string, Record<number, number>> };
    if (!this.pool) return out;
    try {
      await this.ensureSchema();
      const r = await this.pool.query<{ layer: string; z: number; n: string; bytes: string }>('SELECT layer, z, count(*) AS n, sum(size) AS bytes FROM earth_ktx2 GROUP BY layer, z ORDER BY layer, z');
      for (const row of r.rows) {
        (out.layers[row.layer] ??= {})[Number(row.z)] = Number(row.n);
        out.total += Number(row.n); out.bytes += Number(row.bytes);
      }
    } catch (e) {
      this.logger.warn(`Tuiles KTX2 : lecture BP impossible (${(e as Error).message}).`);
    }
    return out;
  }
}
