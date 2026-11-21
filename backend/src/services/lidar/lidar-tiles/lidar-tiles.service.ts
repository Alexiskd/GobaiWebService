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
import { gridNorthHeading, lambert93ToWgs84, wgs84ToLambert93 } from '../../content/contributions/lambert93';
// Fonctions et constantes des nuages LiDAR HD de l'IGN.
import {
  ByteCache, COPC_HEADER_BYTES, type CopcEntry, type CopcInfo, IGN_LIDAR_LAYER, type IgnLidarTile, LAZDEC_POINT_BYTES, LIDAR_IMAGERY, LIDAR_STEP,
  encodeNode, type LonLatBox, isLidarNodeKey, isLidarTileId, lidarWfsBboxUrl, lidarWfsUrl, parseCopcHeader, parseLidarBox, parseHierarchyPage, tileKmFromId, tilesFromWfs,
} from './lidar-tiles';
// Fonctions et constantes des nuages EPT du LiDAR HD de l'IGN (la méthodologie de la visionneuse officielle de l'IGN).
import {
  EPT_NODE_VERSION, EPT_TILE_DEPTH, type EptCell, type EptDalle, type EptEntry, type EptInfo, IGN_EPT_VPC_URL,
  cellBounds, cellsInBox, eptCellKey, eptDataUrl, eptHierarchyUrl, eptTileId, inCell, parseEptHierarchy, parseEptInfo, parseEptLazHeader, parseEptTileId, parseVpc, rekeyToEpt, rekeyToTile,
} from '../lidar-ept/lidar-ept';

/**
 * Nuages de points LiDAR HD de l'IGN, lus en direct (voir lidar-tiles.ts et lidar-ept.ts) : rien n'est stocké dans le
 * dépôt ni en base. Deux sources y répondent :
 *
 *  - la source EPT, celle de la visionneuse officielle de l'IGN (visionneuse-lidarhd.ign.fr) et la première essayée :
 *    l'index des dalles (index.vpc), puis, par cellule de 781 m du niveau 6 de l'octree, le ept.json de sa dalle et la
 *    page de hiérarchie de la cellule ; le nuage d'un nœud (ept-data/<clé>.laz, un seul bloc laszip) est décodé par
 *    tools/lidar/lazdec, compilé au build ;
 *  - le repli COPC : la couche WFS des métadonnées (adresses des nuages), l'en-tête et la hiérarchie COPC lus par
 *    requêtes partielles, puis le bloc LAZ d'un nœud, décodé de la même façon.
 *
 *  - list(lon, lat) : rend les manifestes des dalles autour du point, les plus proches d'abord, 64 au plus ;
 *  - node(dalle, nœud) : lit le seul nuage du nœud, le décode et le convertit au format compact du navigateur,
 *    compressé en gzip. Les nœuds servis restent en mémoire.
 */
/** Mémoire réservée aux nœuds déjà servis (le service gratuit de Render a 512 Mo en tout). */
// Taille du cache mémoire : 48 Mo.
const CACHE_BYTES = 48 * 1024 * 1024;
/** Dalles dont le manifeste est gardé en mémoire. */
// Nombre maximal de manifestes gardés : 128 (deux champs de caméra complets de 64 dalles).
const MAX_MANIFESTS = 128;
/** Décodages simultanés au plus (mémoire et processeur du serveur). */
// Deux décodages à la fois.
const MAX_DECODES = 2;
/** Délai maximal d'une requête vers l'IGN (ms). */
// 20 secondes.
const FETCH_TIMEOUT_MS = 20_000;
/** Version du format des nœuds servis : change l'adresse (cache du navigateur) si la conversion change. */
// Version « ign2 » : les nuages gardés par les navigateurs sous l'ancienne adresse ne sont plus jamais demandés.
const NODE_VERSION = 'ign2';
/** Source des dalles : « auto » (EPT d'abord, COPC en repli), « ept » (EPT seul) ou « copc » (l'ancien WFS seul). */
// La visionneuse officielle de l'IGN lit le jeu EPT : c'est la source par défaut (LIDAR_IGN_SOURCE).
const SOURCE = (process.env.LIDAR_IGN_SOURCE?.trim() || 'auto').toLowerCase();
/** L'index EPT des dalles, relu au plus toutes les 24 heures (LIDAR_IGN_EPT_VPC pour une autre adresse). */
// Adresse de l'index et durée de vie.
const VPC_URL = process.env.LIDAR_IGN_EPT_VPC?.trim() || IGN_EPT_VPC_URL;
const VPC_MAX_AGE_MS = 24 * 3600 * 1000;
/** Dalles EPT (cellules de 781 m) dont le manifeste est gardé en mémoire : 256, quatre champs de caméra de 64 dalles. */
// Taille du cache des dalles EPT.
const EPT_MAX_TILES = 256;
/** Dalles EPT préparées au plus à chaque recherche, comme les dalles COPC. */
// Dalles EPT rendues par la recherche : 64 (autant que le navigateur n'en garde).
const EPT_MAX_LIST = 64;

/** Dalle préparée : son manifeste public, l'adresse du nuage, l'en-tête COPC et les blocs de ses nœuds. */
interface PreparedTile { manifest: Record<string, unknown>; url: string; info: CopcInfo; entries: Map<string, CopcEntry> }

/** Dalle EPT préparée (le ept.json et la première page de sa hiérarchie) : celle des dalles du navigateur en sort. */
interface EptFrame { dalle: EptDalle; info: EptInfo; base: string; page: EptEntry[] }

/** Cellule de niveau 6 préparée : son manifeste public, sa dalle EPT, sa cellule et les nœuds à points de son arbre. */
interface EptPrepared { manifest: Record<string, unknown>; frame: EptFrame; cell: EptCell; entries: EptEntry[] }

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des nuages LiDAR HD de l'IGN.
export class LidarTilesService {
  // Journal préfixé par le nom de la classe.
  private readonly logger = new Logger(LidarTilesService.name);
  // Décodeur LAZ compilé au build (backend/tools/lidar/lazdec), calculé depuis l'emplacement du fichier compilé.
  private readonly lazdec = join(__dirname, '..', '..', '..', '..', 'tools', 'lidar', 'lazdec');
  // Couche WFS des métadonnées des dalles (remplaçable par LIDAR_IGN_WFS_LAYER).
  private readonly layer = process.env.LIDAR_IGN_WFS_LAYER?.trim() || IGN_LIDAR_LAYER;
  // Dalles préparées, par identifiant (les plus anciennes sortent au-delà du plafond).
  private readonly tiles = new Map<string, Promise<PreparedTile>>();
  // Cache mémoire des nœuds déjà convertis et compressés.
  private readonly cache = new ByteCache(CACHE_BYTES);
  // Index EPT des dalles de l'IGN (lues une fois, gardées 24 heures) et sa date de lecture.
  private vpcAt = 0;
  private vpcDalles: EptDalle[] = [];
  // ept.json et première page de la hiérarchie de chaque dalle EPT.
  private readonly eptFrames = new Map<string, Promise<EptFrame>>();
  // Dalles EPT (cellules de 781 m) préparées, par identifiant (les plus anciennes sortent au-delà du plafond).
  private readonly eptTiles = new Map<string, Promise<EptPrepared>>();

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
   * celles qui touchent cette emprise (le champ de la caméra et sa marge, 8 km de côté au plus, 64 dalles au plus), avec leurs
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
    // Source EPT (la méthodologie de la visionneuse officielle de l'IGN) : essayée d'abord, sauf si « copc ».
    if (SOURCE !== 'copc') {
      // Essai (début).
      try {
        // Les dalles EPT autour du point.
        const eptItems = await this.listEpt(lon, lat, r, box);
        // Trouvées : rendues comme réponse.
        if (eptItems.length) return { storage: 'ept', available: this.available, items: eptItems };
        // Aucune dalle EPT : la suite cherche dans le WFS si le repli est voulu.
      // Échec : journalisé, la suite cherche dans le WFS.
      } catch (e) { this.logger.warn(`EPT LiDAR HD : ${(e as Error).message}`); }
      // Sans repli demandé ; rien.
      if (SOURCE === 'ept') return empty;
    // Fin de la source EPT.
    }
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
    // Manifestes préparés (64 dalles au plus avec une emprise, 8 sinon), les échecs étant écartés.
    const items = (await Promise.all(found.slice(0, box ? 64 : 8).map((t) => this.prepare(t).then((p) => p.manifest).catch((e: Error) => { this.logger.warn(`Dalle ${t.id} : ${e.message}`); return null; })))).filter(Boolean);
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

  /**
   * ---------------- Source EPT : la méthodologie de la visionneuse officielle de l'IGN ----------------
   *
   * L'index des dalles (index.vpc) est lu une fois puis gardé 24 heures. Chaque dalle du navigateur est une cellule
   * du niveau 6 de l'octree EPT (781 m de côté, la taille des dalles COPC d'un kilomètre) : son manifeste est
   * construit depuis le ept.json de sa dalle EPT et la page de hiérarchie de la cellule (les nœuds y sont
   * renumérotés depuis son niveau, la racine devient « 0-0-0-0 »), son nuage de nœud est le fichier LAZ de ce nœud
   * dans l'arbre EPT (ept-data/<clé>.laz), décodé par le même lazdec et converti au même format compact.
   */

  // Méthode eptIndex : l'index EPT, lu au plus toutes les 24 heures.
  private async eptIndex(): Promise<EptDalle[]> {
    // L'heure de la dernière lecture.
    const now = Date.now();
    // Déjà lue et pas périmée : la garde.
    if (this.vpcDalles.length && now - this.vpcAt < VPC_MAX_AGE_MS) return this.vpcDalles;
    // Lit l'index et range ses dalles.
    this.vpcDalles = parseVpc(JSON.parse((await this.fetchBytes(VPC_URL)).toString('utf8')));
    // Date la lecture.
    this.vpcAt = now;
    // Renvoie les dalles.
    return this.vpcDalles;
  // Fin de eptIndex.
  }

  /** Une dalle EPT préparée : son ept.json et les entrées de la première page de sa hiérarchie (celles jusqu'au niveau 6). */
  // Méthode eptFrame : la dalle EPT, préparée une seule fois.
  private eptFrame(d: EptDalle): Promise<EptFrame> {
    // Déjà préparée ou en cours : la même promesse.
    const known = this.eptFrames.get(d.id);
    // Trouvée.
    if (known) return known;
    // Préparation (début).
    const job = (async () => {
      // Le ept.json de la dalle et sa première page de hiérarchie.
      const info = parseEptInfo(JSON.parse((await this.fetchBytes(d.eptUrl)).toString('utf8')));
      const page = parseEptHierarchy(JSON.parse((await this.fetchBytes(eptHierarchyUrl(d.base, `0-0-0-0`))).toString('utf8')));
      // Renvoie la dalle préparée.
      return { dalle: d, info, base: d.base, page };
    // Fin de la préparation.
    })();
    // Échec : la dalle est oubliée (nouvel essai à la demande suivante).
    job.catch(() => this.eptFrames.delete(d.id));
    // Garde la préparation.
    this.eptFrames.set(d.id, job);
    // La renvoie.
    return job;
  // Fin de eptFrame.
  }

  /**
   * Cellule d'une dalle EPT : son arbre (racine et descendants, renumérotés depuis son niveau) et ses points
   * réels. Les entrées de la première page suffisent quand la racine y porte ses points ; sinon la page de la
   * cellule, qui contient la suite de l'arbre (jusqu'au niveau le plus fin de la dalle), est lue.
   */
  // Méthode eptCellEntries : la dalle préparée et la cellule.
  private async eptCellEntries(frame: EptFrame, cell: EptCell): Promise<EptEntry[]> {
    // La clé de la cellule et sa racine dans la première page.
    const key = eptCellKey(cell);
    const root = frame.page.find((e) => e.key === key);
    // Racine inconnue de la dalle : aucune cellule.
    if (!root) return [];
    // La racine et sa suite dans la même page (les nœuds y portent leurs points).
    if (root.count >= 0) return frame.page.filter((e) => e.count > 0 && inCell(cell, e));
    // La racine marque la suite ailleurs : la page de la cellule contient l'arbre entier.
    const page = parseEptHierarchy(JSON.parse((await this.fetchBytes(eptHierarchyUrl(frame.base, key))).toString('utf8')));
    // Les nœuds à points de la page, dans la cellule (la racine comprise ; les suites éventuelles plus profondes sont écartées).
    return page.filter((e) => e.count > 0 && inCell(cell, e));
  // Fin de eptCellEntries.
  }

  /** Prépare une cellule de niveau 6 (manifeste, arbre renuméroté), une seule fois. */
  // Méthode eptPrepare : la dalle EPT et la cellule.
  private eptPrepare(d: EptDalle, cell: EptCell): Promise<EptPrepared> {
    // Identifiant de la dalle du navigateur.
    const id = eptTileId(d.code, cell);
    // Déjà préparée ou en cours : la même promesse.
    const known = this.eptTiles.get(id);
    // Trouvée.
    if (known) return known;
    // Plafond atteint : la plus ancienne sort.
    if (this.eptTiles.size >= EPT_MAX_TILES) this.eptTiles.delete(this.eptTiles.keys().next().value as string);
    // Préparation (début).
    const job = (async () => {
      // Le ept.json et la première page de la dalle.
      const frame = await this.eptFrame(d);
      // Les nœuds à points de la cellule, dans l'arbre EPT.
      const entries = await this.eptCellEntries(frame, cell);
      // Sans nœud : erreur (la cellule n'a pas de nuage).
      if (!entries.length) throw new Error('cellule sans points');
      // La racine de la dalle : la cellule elle-même.
      const root = entries.find((e) => e.level === EPT_TILE_DEPTH);
      // Sans racine : erreur.
      if (!root) throw new Error('cellule sans racine');
      // Les nœuds renumérotés depuis le niveau de la cellule, avec leurs points.
      const nodes = entries.map((e) => ({ k: rekeyToTile(e.key, cell), n: e.count, b: 2 * e.count, h: EPT_NODE_VERSION })).filter((n) => n.k);
      // Emprise de la cellule (un cube de 781 m de côté, en Lambert-93).
      const [minX, minY, minZ, maxX, maxY] = cellBounds(frame.info, cell);
      // Calage : centre de la cellule, bas du cube, cap de la grille.
      const g = lambert93ToWgs84((minX + maxX) / 2, (minY + maxY) / 2);
      // Écart des points de la racine : le côté de la cellule sur la densité de ses points.
      const spacing = Math.sqrt(((maxX - minX) * (maxY - minY)) / Math.max(1, root.count));
      // Manifeste public (début).
      const manifest = {
        // Identifiant, nom et clé EPT de la cellule.
        id, name: `LiDAR HD ${d.code.toUpperCase()} ${cell.x}-${cell.y}`, tile: eptCellKey(cell),
        // Source, licence et système.
        source: 'IGN – LiDAR HD EPT (Géoplateforme, en direct)', license: 'Licence Ouverte 2.0 (Etalab)', acquired: '', crs: 'EPSG:2154 — RGF93 / Lambert-93, altitudes NGF-IGN69',
        // Points de la cellule, format, pas et écart de ses points de racine.
        points: entries.reduce((s, e) => s + e.count, 0), format: 1, step: LIDAR_STEP, spacing,
        // Emprise : le cube de la cellule.
        bounds: { minX, minY, minZ, maxX, maxY, maxZ: minZ + (maxX - minX) },
        // Calage GPS.
        anchor: { lat: g.lat, lon: g.lon, alt: minZ, heading: gridNorthHeading((minX + maxX) / 2, (minY + maxY) / 2) },
        // Nœuds : clé, nombre de points, taille approximative et version.
        nodes, storage: 'ept', nodeUrl: `/api/v1/lidar/${id}/{k}?v={h}`, imagery: LIDAR_IMAGERY,
      // Fin du manifeste.
      };
      // Renvoie la cellule préparée.
      return { manifest, frame, cell, entries };
    // Fin de la préparation.
    })();
    // Échec : la cellule est oubliée (nouvel essai à la demande suivante).
    job.catch(() => this.eptTiles.delete(id));
    // Garde la préparation.
    this.eptTiles.set(id, job);
    // La renvoie.
    return job;
  // Fin de eptPrepare.
  }

  /**
   * Dalles EPT autour d'un point : les cellules de niveau 6 qui touchent l'emprise (ou le cercle du rayon), les
   * plus proches du point d'abord, 64 au plus, avec leurs manifestes. Lève une erreur si l'index EPT est illisible.
   */
  // Méthode listEpt : la longitude, la latitude, le rayon et l'emprise facultative.
  private async listEpt(lon: number, lat: number, r: number, box?: LonLatBox | null): Promise<unknown[]> {
    // L'index EPT des dalles (l'erreur de lecture remonte : le repli COPC prendra le relais).
    const dalles = await this.eptIndex();
    // Le point et l'emprise de recherche, en Lambert-93 (l'emprise : 8 km de côté au plus, comme le champ de la caméra).
    const c = wgs84ToLambert93(lat, lon);
    // Emprise X/Y de la recherche : les coins de l'emprise en degrés, convertis en Lambert-93, ou le cercle du rayon.
    const [wx0, wy0, wx1, wy1]: [number, number, number, number] = box
      // Les quatre coins de l'emprise de la caméra.
      ? (() => {
        // Coin sud-ouest et coin nord-est.
        const a = wgs84ToLambert93(box[1], box[0]), b = wgs84ToLambert93(box[3], box[2]);
        // L'emprise X/Y.
        return [Math.min(a.east, b.east), Math.min(a.north, b.north), Math.max(a.east, b.east), Math.max(a.north, b.north)] as [number, number, number, number];
      // Fin de l'emprise.
      })()
      // Le cercle du rayon autour du point.
      : [c.east - r, c.north - r, c.east + r, c.north + r];
    // Cellules candidates : celles des dalles EPT qui touchent l'emprise, avec l'adresse de leur dalle.
    const cells: { d: EptDalle; cell: EptCell; dist: number }[] = [];
    // Pour chaque dalle EPT qui touche l'emprise (début).
    for (const d of dalles) {
      // Hors de l'emprise en X/Y : suivante.
      if (d.bbox[0] > wx1 || d.bbox[3] < wx0 || d.bbox[1] > wy1 || d.bbox[4] < wy0) continue;
      // Le ept.json et la première page de la dalle (une erreur de dalle est écartée, sans casser la recherche).
      let frame: EptFrame;
      // Essai (début).
      try { frame = await this.eptFrame(d); }
      // Échec : journalisé, dalle suivante.
      catch (e) { this.logger.warn(`Dalle EPT ${d.id} : ${(e as Error).message}`); continue; }
      // Les cellules de la dalle dans l'emprise, gardées si la dalle EPT en parle (racine connue de sa hiérarchie).
      for (const cell of cellsInBox(frame.info, [wx0, wy0, wx1, wy1])) {
        // La racine de la cellule doit exister dans la première page (avec ou sans points).
        if (!frame.page.some((e) => e.key === eptCellKey(cell))) continue;
        // Le centre de la cellule en degrés, pour la distance au point.
        const [minX, minY, , maxX, maxY] = cellBounds(frame.info, cell);
        const g = lambert93ToWgs84((minX + maxX) / 2, (minY + maxY) / 2);
        // Distance approchée du centre de la cellule au point.
        const dist = Math.hypot((g.lon - lon) * Math.cos(lat * (Math.PI / 180)), g.lat - lat) * 111_195;
        // Garde la cellule candidate.
        cells.push({ d, cell, dist });
      // Fin des cellules de la dalle.
      }
    // Fin des dalles.
    }
    // Les plus proches d'abord, puis 64 au plus.
    cells.sort((a, b) => a.dist - b.dist);
    // Manifestes préparés (64 au plus), les échecs étant écartés.
    const items = (await Promise.all(cells.slice(0, EPT_MAX_LIST).map(({ d, cell }) => this.eptPrepare(d, cell).then((p) => p.manifest).catch((e: Error) => { this.logger.warn(`Dalle ${eptTileId(d.code, cell)} : ${e.message}`); return null; })))).filter(Boolean);
    // Renvoie les manifestes.
    return items;
  // Fin de listEpt.
  }

  /** Retrouve une dalle EPT (cellule de niveau 6) d'après son identifiant, même sans préparation récente. */
  // Méthode eptTileById : l'identifiant de la dalle EPT et sa cellule.
  private async eptTileById(id: string, cell: EptCell): Promise<EptPrepared> {
    // Déjà préparée : la renvoie.
    const known = this.eptTiles.get(id);
    // Trouvée.
    if (known) return known;
    // La dalle EPT de l'index.
    const d = (await this.eptIndex()).find((e) => e.id === id.slice(0, id.indexOf('-', 4)));
    // Inconnue : 404.
    if (!d) throw new NotFoundException('Dalle LiDAR EPT inconnue.');
    // La prépare.
    return this.eptPrepare(d, cell);
  // Fin de eptTileById.
  }

  /** Fichier d'un nœud d'une dalle EPT, lu, décodé et converti au format du navigateur, gzippé. */
  // Méthode eptNode : la dalle préparée, la clé du nœud du navigateur et son entrée.
  private async eptNode(p: EptPrepared, key: string): Promise<Buffer> {
    // La clé EPT du nœud.
    const ekey = rekeyToEpt(key, p.cell);
    // Illisible : 404.
    if (!ekey) throw new NotFoundException('Nœud LiDAR inconnu.');
    // L'entrée EPT du nœud.
    const e = p.entries.find((n) => n.key === ekey);
    // Absente : 404.
    if (!e) throw new NotFoundException('Nœud LiDAR inconnu.');
    // Sans points : vide, compressé.
    if (!e.count) return gzipSync(Buffer.alloc(0));
    // Conversion (début).
    const body = await this.slot(async () => {
      // Essai (début).
      try {
        // Le nuage du nœud (LAZ 1.4, un seul bloc laszip).
        const buf = await this.fetchBytes(eptDataUrl(p.frame.base, ekey));
        // En-tête du fichier : adresse des points, nombre et format.
        const h = parseEptLazHeader(buf);
        // Le nombre annoncé par la hiérarchie doit être celui du fichier.
        if (h.count !== e.count) throw new Error(`nombre de points divergent (${h.count}/${e.count})`);
        // Décodage, dans un dossier temporaire.
        const raw = await this.decodeEpt(buf, h.dataStart, e, p.frame.info);
        // La cellule de niveau 6 de la dalle : son coin bas (le bas de la dalle du navigateur, en Z).
        const [dMinX, , dMinZ] = cellBounds(p.frame.info, p.cell);
        // Côtés du cube racine de la dalle EPT, et côté du nœud (m).
        const rootX = p.frame.info.bounds[3] - dMinX, rootY = p.frame.info.bounds[4] - p.frame.info.bounds[1];
        const nodeX = rootX / 2 ** e.level, nodeY = rootY / 2 ** e.level;
        // Coin du nœud, en Lambert-93.
        const nMinX = p.frame.info.bounds[0] + e.x * nodeX, nMinY = p.frame.info.bounds[1] + e.y * nodeY;
        // Conversion au format du navigateur : X et Y depuis le coin du nœud, Z depuis le bas de la dalle.
        const { bytes } = encodeNode(raw, { scale: p.frame.info.scale, offset: p.frame.info.offset, minX: nMinX, minY: nMinY, z0: dMinZ, step: LIDAR_STEP });
        // Compressé.
        return gzipSync(bytes, { level: 6 });
      // Échec : 502, l'IGN ou le décodage ont échoué.
      } catch (err) { this.logger.warn(`Nœud EPT ${ekey} : ${(err as Error).message}`); throw new BadGatewayException('Nuage LiDAR de l’IGN illisible pour ce nœud.'); }
    // Fin de la conversion.
    });
    // Renvoie le fichier.
    return body;
  // Fin de eptNode.
  }

  /** Décode le nuage d'un nœud EPT (un seul bloc laszip du fichier, de l'adresse des points à la fin) avec lazdec. */
  // Méthode decodeEpt : le fichier du nœud, l'adresse des points, l'entrée EPT et le ept.json de la dalle.
  private async decodeEpt(buf: Buffer, dataStart: number, e: EptEntry, info: EptInfo): Promise<Buffer> {
    // Dossier temporaire.
    const dir = await mkdtemp(join(tmpdir(), 'lidar-'));
    // Essai (début).
    try {
      // Fichiers : le nuage, la liste et la sortie.
      const laz = join(dir, 'node.laz'), list = join(dir, 'list.txt'), out = join(dir, 'points.bin');
      // Côté du nœud et son coin (m), puis en unités brutes du fichier (une unité de marge pour les arrondis).
      const side = (info.bounds[3] - info.bounds[0]) / 2 ** e.level;
      const minX = info.bounds[0] + e.x * side, minY = info.bounds[1] + e.y * side, minZ = info.bounds[2] + e.z * side;
      const rawX = (m: number) => Math.floor((m - info.offset[0]) / info.scale[0]) - 1, rawY = (m: number) => Math.floor((m - info.offset[1]) / info.scale[1]) - 1, rawZ = (m: number) => Math.floor((m - info.offset[2]) / info.scale[2]) - 1;
      // Côté en unités brutes, avec marge.
      const s = Math.ceil(side / Math.min(...info.scale)) + 2;
      // Écrit le nuage (le fichier entier contient le bloc des points de ce nœud).
      await writeFile(laz, buf);
      // Écrit la liste : niveau, adresse du bloc, taille du bloc, points, coin et côté du nœud en unités brutes.
      await writeFile(list, `${e.level} ${dataStart} ${buf.length - dataStart} ${e.count} ${rawX(minX)} ${rawY(minY)} ${rawZ(minZ)} ${s}\n`);
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
  // Fin de decodeEpt.
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
    // Dalle EPT (la méthodologie de la visionneuse de l'IGN) : son nœud est décodé depuis le jeu EPT.
    const ept = parseEptTileId(tile);
    // Une dalle EPT (début).
    if (ept) {
      // La cellule préparée (404 si inconnue de l'index EPT).
      const p = await this.eptTileById(ept.dalle, ept.cell);
      // Le fichier du nœud, converti et gzippé.
      const body = await this.eptNode(p, key);
      // Gardé en mémoire.
      this.cache.set(ck, body);
      // Renvoyé.
      return body;
    // Fin de la dalle EPT.
    }
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
