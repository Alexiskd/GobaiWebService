// Outils NestJS : Injectable, Logger (journal), et les erreurs 404, 502 et 503.
import { BadGatewayException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
// execFile : lance un programme ; existsSync : teste la présence d'un fichier.
import { execFile } from 'node:child_process';
// existsSync : teste la présence d'un fichier.
import { existsSync } from 'node:fs';
// Fonctions de fichiers asynchrones : dossier temporaire, écriture, lecture, suppression.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
// tmpdir : le dossier temporaire du système.
import { tmpdir } from 'node:os';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// gzipSync : compression gzip.
import { gzipSync } from 'node:zlib';
// Conversion Lambert-93 → WGS84 et cap de la grille.
import { gridNorthHeading, lambert93ToWgs84 } from '../contributions/lambert93';
// Fonctions et constantes des nuages LiDAR HD de l'IGN.
import {
  ByteCache, COPC_HEADER_BYTES, type CopcEntry, type CopcInfo, IGN_LIDAR_LAYER, type IgnLidarTile, LAZDEC_POINT_BYTES, LIDAR_IMAGERY, LIDAR_STEP,
  encodeNode, isLidarNodeKey, isLidarTileId, lidarWfsBboxUrl, lidarWfsUrl, parseCopcHeader, parseLidarBox, parseHierarchyPage, tileKmFromId, tilesFromWfs,
} from './lidar-tiles';

/**
 * Nuages de points LiDAR HD de l'IGN, lus en direct (voir lidar-tiles.ts) : rien n'est stocké dans le dépôt ni en base.
 *
 *  - list(lon, lat) : demande au WFS de la Géoplateforme les dalles autour du point, lit l'en-tête et la hiérarchie
 *    COPC de chacune (requêtes partielles HTTP Range, quelques kilo-octets) et renvoie leurs manifestes ;
 *  - node(dalle, nœud) : lit le seul bloc LAZ du nœud (HTTP Range), le décode avec tools/lidar/lazdec (compilé au
 *    build) et le convertit au format compact du navigateur, compressé en gzip. Les nœuds servis restent en mémoire.
 */
/** Mémoire réservée aux nœuds déjà servis (le service gratuit de Render a 512 Mo en tout). */
// Taille du cache mémoire : 48 Mo.
const CACHE_BYTES = 48 * 1024 * 1024;
/** Dalles dont le manifeste est gardé en mémoire. */
// Nombre maximal de manifestes gardés : 64.
const MAX_MANIFESTS = 64;
/** Décodages simultanés au plus (mémoire et processeur du serveur). */
// Deux décodages à la fois.
const MAX_DECODES = 2;
/** Délai maximal d'une requête vers l'IGN (ms). */
// 20 secondes.
const FETCH_TIMEOUT_MS = 20_000;
/** Version du format des nœuds servis : change l'adresse (cache du navigateur) si la conversion change. */
// Version « ign1 ».
const NODE_VERSION = 'ign1';

/** Dalle préparée : son manifeste public, l'adresse du nuage, l'en-tête COPC et les blocs de ses nœuds. */
interface PreparedTile { manifest: Record<string, unknown>; url: string; info: CopcInfo; entries: Map<string, CopcEntry> }

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des nuages LiDAR HD de l'IGN.
export class LidarTilesService {
  // Journal préfixé par le nom de la classe.
  private readonly logger = new Logger(LidarTilesService.name);
  // Décodeur LAZ compilé au build (backend/tools/lidar/lazdec), calculé depuis l'emplacement du fichier compilé.
  private readonly lazdec = join(__dirname, '..', '..', '..', 'tools', 'lidar', 'lazdec');
  // Couche WFS des métadonnées des dalles (remplaçable par LIDAR_IGN_WFS_LAYER).
  private readonly layer = process.env.LIDAR_IGN_WFS_LAYER?.trim() || IGN_LIDAR_LAYER;
  // Dalles préparées, par identifiant (les plus anciennes sortent au-delà du plafond).
  private readonly tiles = new Map<string, Promise<PreparedTile>>();
  // Cache mémoire des nœuds déjà convertis et compressés.
  private readonly cache = new ByteCache(CACHE_BYTES);
  // Décodages en cours, et file d'attente des suivants.
  private running = 0;
  // File d'attente : fonctions qui libèrent la place suivante.
  private readonly waiting: (() => void)[] = [];

  /** Le décodeur est-il disponible ? */
  // Accesseur available.
  get available(): boolean { return existsSync(this.lazdec); }

  /** Requête vers l'IGN avec délai maximal ; `range` [début, fin[ demande une partie du fichier (réponse 206 exigée). */
  // Méthode fetchBytes : l'adresse et la plage facultative.
  private async fetchBytes(url: string, range?: [number, number]): Promise<Buffer> {
    // Contrôleur d'annulation, déclenché au délai maximal.
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    // Essai (début).
    try {
      // Requête, avec la plage demandée.
      const res = await fetch(url, { signal: ctrl.signal, headers: range ? { Range: `bytes=${range[0]}-${range[1] - 1}` } : {} });
      // Plage demandée mais fichier entier renvoyé (des centaines de Mo) : abandon.
      if (range && res.status !== 206) { ctrl.abort(); throw new Error(`IGN : lecture partielle refusée (${res.status}).`); }
      // Réponse en erreur.
      if (!res.ok) throw new Error(`IGN : réponse ${res.status}.`);
      // Les octets.
      return Buffer.from(await res.arrayBuffer());
    // Dans tous les cas : arrête le minuteur.
    } finally { clearTimeout(timer); }
  // Fin de fetchBytes.
  }

  /**
   * Dalles autour d'un point (degrés) dans un rayon (m, 100 à 1 500, 600 par défaut), ou, si `bbox` est donnée, toutes
   * celles qui touchent cette emprise (le champ de la caméra, 8 km de côté au plus, 32 dalles au plus), avec leurs
   * manifestes, les plus proches du point d'abord. Rien hors de France ou si le décodeur manque.
   */
  // Méthode list : la longitude, la latitude, le rayon et l'emprise facultative.
  async list(lon: number, lat: number, radiusM = 600, bbox?: string) {
    // Emprise du champ de la caméra, si elle est donnée et lisible.
    const box = parseLidarBox(bbox);
    // Rayon borné, 600 m s'il est absent ou invalide.
    const r = Number.isFinite(radiusM) && radiusM > 0 ? Math.min(1500, Math.max(100, radiusM)) : 600;
    // Réponse vide, avec l'état du décodeur.
    const empty = { storage: 'ign', available: this.available, items: [] as unknown[] };
    // Point invalide, ou décodeur absent : rien.
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !this.available) return empty;
    // Dalles trouvées dans le WFS de l'IGN.
    let found: IgnLidarTile[];
    // Essai (début).
    try {
      // Requête WFS, réponse JSON.
      found = tilesFromWfs(JSON.parse((await this.fetchBytes(box ? lidarWfsBboxUrl(box, this.layer, 64) : lidarWfsUrl(lon, lat, r, this.layer, 16))).toString('utf8')));
    // Échec : journalisé, rien.
    } catch (e) { this.logger.warn(`WFS LiDAR HD : ${(e as Error).message}`); return empty; }
    // Les plus proches du point d'abord (centre de chaque dalle tiré de son identifiant).
    found.sort((a, b) => this.distanceTo(a.id, lon, lat) - this.distanceTo(b.id, lon, lat));
    // Manifestes préparés (32 dalles au plus avec une emprise, 8 sinon), les échecs étant écartés.
    const items = (await Promise.all(found.slice(0, box ? 32 : 8).map((t) => this.prepare(t).then((p) => p.manifest).catch((e: Error) => { this.logger.warn(`Dalle ${t.id} : ${e.message}`); return null; })))).filter(Boolean);
    // Renvoie les dalles.
    return { ...empty, items };
  // Fin de list.
  }

  /** Distance approchée (m) du centre d'une dalle à un point (degrés) ; infinie si l'identifiant est illisible. */
  // Méthode distanceTo : l'identifiant, la longitude et la latitude.
  private distanceTo(id: string, lon: number, lat: number): number {
    // Kilomètres de la dalle.
    const km = tileKmFromId(id);
    // Illisible : infinie.
    if (!km) return Infinity;
    // Centre de la dalle en degrés.
    const c = lambert93ToWgs84(km.x * 1000 + 500, km.y * 1000 - 500);
    // Distance approchée.
    return Math.hypot((c.lon - lon) * Math.cos(lat * (Math.PI / 180)), c.lat - lat) * 111_195;
  // Fin de distanceTo.
  }

  /** Prépare une dalle (en-tête, hiérarchie, manifeste), une seule fois. */
  // Méthode prepare : la dalle trouvée dans le WFS.
  private prepare(t: IgnLidarTile): Promise<PreparedTile> {
    // Déjà préparée ou en cours : la même promesse.
    const known = this.tiles.get(t.id);
    // Trouvée.
    if (known) return known;
    // Plafond atteint : la plus ancienne sort.
    if (this.tiles.size >= MAX_MANIFESTS) this.tiles.delete(this.tiles.keys().next().value as string);
    // Préparation (début).
    const job = (async () => {
      // En-tête LAS et VLR « copc info ».
      const info = parseCopcHeader(await this.fetchBytes(t.url, [0, COPC_HEADER_BYTES]));
      // Seul le format de point 6 (celui du LiDAR HD) est décodé.
      if (info.pointFormat !== 6) throw new Error(`format de point ${info.pointFormat} non pris en charge`);
      // Entrées de la hiérarchie, page par page.
      const entries = new Map<string, CopcEntry>();
      // Pages à lire : la racine.
      const pages: [number, number][] = [[info.rootOffset, info.rootSize]];
      // Tant qu'il reste des pages (100 au plus) (début).
      for (let i = 0; pages.length && i < 100; i++) {
        // Page suivante.
        const [off, size] = pages.shift() as [number, number];
        // Pour chaque entrée lue : une page à lire, ou un nœud avec des points.
        for (const e of parseHierarchyPage(await this.fetchBytes(t.url, [off, off + size]))) { if (e.count === -1) pages.push([e.offset, e.size]); else if (e.count > 0) entries.set(e.key, e); }
      // Fin des pages.
      }
      // Sans nœud : erreur.
      if (!entries.size) throw new Error('hiérarchie COPC vide');
      // Coin et côté du cube racine (m).
      const minX = info.cx - info.half, minY = info.cy - info.half, minZ = info.cz - info.half, side = 2 * info.half;
      // Calage : centre de l'emprise, bas du cube, cap de la grille.
      const g = lambert93ToWgs84(info.cx, info.cy);
      // Nom affiché : le numéro de la dalle.
      const km = tileKmFromId(t.id);
      // Manifeste public (début).
      const manifest = {
        // Identifiant, nom et nom IGN de la dalle.
        id: t.id, name: km ? `LiDAR HD ${km.x}-${km.y}` : t.id, tile: t.url.split('/').pop()?.split('.')[0] ?? t.id,
        // Source, licence, date du relevé et système.
        source: 'IGN – LiDAR HD (Géoplateforme, en direct)', license: 'Licence Ouverte 2.0 (Etalab)', acquired: t.acquired ?? '', crs: 'EPSG:2154 — RGF93 / Lambert-93, altitudes NGF-IGN69',
        // Points (annoncés par l'IGN, sinon la somme des nœuds), format, pas et écart des points de la racine.
        points: t.points ?? [...entries.values()].reduce((s, e) => s + e.count, 0), format: 1, step: LIDAR_STEP, spacing: info.spacing,
        // Emprise : le cube racine, et l'altitude maximale des points.
        bounds: { minX, minY, minZ, maxX: minX + side, maxY: minY + side, maxZ: Math.max(minZ + 1, info.maxZ) },
        // Calage GPS.
        anchor: { lat: g.lat, lon: g.lon, alt: minZ, heading: gridNorthHeading(info.cx, info.cy) },
        // Nœuds : clé, nombre de points annoncé, taille du bloc et version.
        nodes: [...entries.values()].map((e) => ({ k: e.key, n: e.count, b: e.size, h: NODE_VERSION })),
        // Origine, modèle d'adresse des nœuds et orthophoto à draper.
        storage: 'ign', nodeUrl: `/api/v1/lidar/${t.id}/{k}?v={h}`, imagery: LIDAR_IMAGERY,
      // Fin du manifeste.
      };
      // Renvoie la dalle préparée.
      return { manifest, url: t.url, info, entries };
    // Fin de la préparation.
    })();
    // Échec : la dalle est oubliée (nouvel essai à la demande suivante).
    job.catch(() => this.tiles.delete(t.id));
    // Garde la préparation.
    this.tiles.set(t.id, job);
    // La renvoie.
    return job;
  // Fin de prepare.
  }

  /** Retrouve une dalle d'après son identifiant (redémarrage du serveur : nouvelle recherche dans le WFS). */
  // Méthode tileById : l'identifiant.
  private async tileById(id: string): Promise<PreparedTile> {
    // Déjà préparée : la renvoie.
    const known = this.tiles.get(id);
    // Trouvée.
    if (known) return known;
    // Kilomètres Lambert-93 de la dalle.
    const km = tileKmFromId(id);
    // Identifiant inconnu : 404.
    if (!km) throw new NotFoundException('Dalle LiDAR inconnue.');
    // Centre de la dalle (bord ouest + 500 m, bord nord − 500 m), en degrés.
    const c = lambert93ToWgs84(km.x * 1000 + 500, km.y * 1000 - 500);
    // Dalles du WFS au centre.
    const found = tilesFromWfs(JSON.parse((await this.fetchBytes(lidarWfsUrl(c.lon, c.lat, 100, this.layer))).toString('utf8')));
    // La bonne dalle.
    const t = found.find((f) => f.id === id);
    // Absente : 404.
    if (!t) throw new NotFoundException('Dalle LiDAR introuvable chez l’IGN.');
    // La prépare.
    return this.prepare(t);
  // Fin de tileById.
  }

  /** Attend une place de décodage, puis la libère à la fin. */
  // Méthode slot : la tâche à lancer.
  private async slot<T>(task: () => Promise<T>): Promise<T> {
    // Pas de place : attend la libération d'une place.
    if (this.running >= MAX_DECODES) await new Promise<void>((resolve) => this.waiting.push(resolve));
    // Une place prise.
    this.running++;
    // Lance la tâche (début).
    try { return await task(); }
    // Dans tous les cas : libère la place et réveille le suivant.
    finally { this.running--; this.waiting.shift()?.(); }
  // Fin de slot.
  }

  /** Fichier d'un nœud, converti et compressé en gzip. */
  // Méthode node : l'identifiant de la dalle et la clé du nœud.
  async node(tile: string, key: string): Promise<Buffer> {
    // Identifiant ou clé mal formés : 404.
    if (!isLidarTileId(tile) || !isLidarNodeKey(key)) throw new NotFoundException('Nœud LiDAR inconnu.');
    // Clé du cache.
    const ck = `${tile}/${key}`;
    // Déjà converti : renvoyé tout de suite.
    const hit = this.cache.get(ck);
    // Trouvé.
    if (hit) return hit;
    // Décodeur absent : 503.
    if (!this.available) throw new ServiceUnavailableException('Décodeur LAZ absent sur le serveur.');
    // La dalle.
    const t = await this.tileById(tile);
    // Le nœud.
    const e = t.entries.get(key);
    // Absent : 404.
    if (!e) throw new NotFoundException('Nœud LiDAR inconnu.');
    // Conversion, dans une place de décodage (début).
    const body = await this.slot(async () => {
      // Essai (début).
      try {
        // Bloc LAZ du nœud.
        const chunk = await this.fetchBytes(t.url, [e.offset, e.offset + e.size]);
        // Points décodés.
        const raw = await this.decode(chunk, e, t.info);
        // Côté du nœud et son coin (m).
        const side = (2 * t.info.half) / 2 ** e.level, minX = t.info.cx - t.info.half + e.x * side, minY = t.info.cy - t.info.half + e.y * side;
        // Conversion au format du navigateur.
        const { bytes } = encodeNode(raw, { scale: t.info.scale, offset: t.info.offset, minX, minY, z0: t.info.cz - t.info.half, step: LIDAR_STEP });
        // Compressé.
        return gzipSync(bytes, { level: 6 });
      // Échec : 502, l'IGN ou le décodage ont échoué.
      } catch (err) { this.logger.warn(`Nœud ${ck} : ${(err as Error).message}`); throw new BadGatewayException('Nuage LiDAR de l’IGN illisible pour ce nœud.'); }
    // Fin de la conversion.
    });
    // Gardé en mémoire.
    this.cache.set(ck, body);
    // Renvoyé.
    return body;
  // Fin de node.
  }

  /** Décode un bloc LAZ avec lazdec, dans un dossier temporaire supprimé ensuite. Renvoie 16 octets par point. */
  // Méthode decode : le bloc, son entrée et l'en-tête.
  private async decode(chunk: Buffer, e: CopcEntry, info: CopcInfo): Promise<Buffer> {
    // Dossier temporaire.
    const dir = await mkdtemp(join(tmpdir(), 'lidar-'));
    // Essai (début).
    try {
      // Fichiers : le bloc, la liste et la sortie.
      const laz = join(dir, 'chunk.laz'), list = join(dir, 'list.txt'), out = join(dir, 'points.bin');
      // Côté du nœud en unités brutes du fichier, et son coin (une unité de marge pour les arrondis).
      const side = (2 * info.half) / 2 ** e.level;
      // Unités brutes : (mètres − décalage) / échelle.
      const rawX = (m: number) => Math.floor((m - info.offset[0]) / info.scale[0]) - 1, rawY = (m: number) => Math.floor((m - info.offset[1]) / info.scale[1]) - 1, rawZ = (m: number) => Math.floor((m - info.offset[2]) / info.scale[2]) - 1;
      // Coin du nœud en unités brutes.
      const mx = rawX(info.cx - info.half + e.x * side), my = rawY(info.cy - info.half + e.y * side), mz = rawZ(info.cz - info.half + e.z * side);
      // Côté en unités brutes, avec marge.
      const s = Math.ceil(side / Math.min(...info.scale)) + 2;
      // Écrit le bloc.
      await writeFile(laz, chunk);
      // Écrit la liste : niveau, position (0 : le bloc est seul dans son fichier), taille, points, coin et côté.
      await writeFile(list, `${e.level} 0 ${e.size} ${e.count} ${mx} ${my} ${mz} ${s}\n`);
      // Lance lazdec ; un code de sortie non nul est toléré si tous les points sont là (points en bord de cube).
      await new Promise<void>((resolve) => execFile(this.lazdec, [laz, list, out], { timeout: 30_000 }, () => resolve()));
      // Points décodés.
      const raw = await readFile(out).catch(() => Buffer.alloc(0));
      // Nombre de points incorrect : erreur.
      if (raw.length !== e.count * LAZDEC_POINT_BYTES) throw new Error(`décodage incomplet (${raw.length / LAZDEC_POINT_BYTES}/${e.count} points)`);
      // Renvoie les points.
      return raw;
    // Dans tous les cas : supprime le dossier temporaire.
    } finally { await rm(dir, { recursive: true, force: true }); }
  // Fin de decode.
  }
// Fin du service.
}
