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
import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
// Cache mémoire borné en octets.
import { ByteCache } from '../../common/byte-cache';
// Validation d'une tuile dans une grille.
import { isValidTile } from './tile-math';
// Lecture du TIFF flottant et écriture Terrarium.
import { decodeFloat32Tiff, encodeTerrariumPng, type HeightGrid } from './terrarium';

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

// Service des tuiles de relief de la Lune.
@Injectable()
export class MoonReliefService {
  private readonly logger = new Logger(MoonReliefService.name);
  // Tuiles prêtes, gardées en mémoire (64 Mo au plus).
  private readonly cache = new ByteCache(64 * 1024 * 1024);
  // Calculs en cours, partagés entre requêtes simultanées pour la même tuile.
  private readonly pending = new Map<string, Promise<Buffer>>();
  // Adresse du service ArcGIS.
  private readonly baseUrl = process.env.MOON_RELIEF_IMAGESERVER_URL?.trim() || DEFAULT_URL;

  // Constructeur : la fonction de téléchargement (remplaçable dans les tests).
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args)) {}

  /** Tuile Terrarium PNG (z, x, y) ; vrai `cached` si elle venait de la mémoire. */
  async tile(z: number, x: number, y: number): Promise<{ body: Buffer; contentType: string; cached: boolean }> {
    if (!isValidTile(z, x, y, 'equirectangular') || z > MOON_RELIEF_MAX_ZOOM) {
      throw new BadRequestException(`Tuile de relief lunaire invalide : ${z}/${x}/${y} (niveaux 0 à ${MOON_RELIEF_MAX_ZOOM}, grille 2^(z+1) × 2^z).`);
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
