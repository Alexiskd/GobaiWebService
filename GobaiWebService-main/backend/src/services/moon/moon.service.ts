/**
 * Service unique du module Moon — regroupe tous les services :
 *   types, cache TTL, parsing OGC, inspection d'images, maths des tuiles,
 *   construction d'URL amont, configuration, service amont, catalogue,
 *   capacités, tuiles d'imagerie, santé, et le stockage
 *   PostgreSQL des tuiles géodésiques (mode tri/icosaèdre).
 */

// Buffer : le tampon d'octets de Node.
import { Buffer } from 'node:buffer';
// createHash : calcule une empreinte.
import { createHash } from 'node:crypto';
// createRequire : fabrique un « require » pour charger un module CommonJS.
import { createRequire } from 'node:module';
// Ouvre l'import des outils NestJS :
import {
  // erreur 502 ;
  BadGatewayException,
  // erreur 400 ;
  BadRequestException,
  // injection par jeton ;
  Inject,
  // service injectable ;
  Injectable,
  // journal ;
  Logger,
  // erreur 404 ;
  NotFoundException,
  // interface appelée à l'arrêt du module ;
  OnModuleDestroy,
  // erreur 503.
  ServiceUnavailableException,
// Fin de l'import.
} from '@nestjs/common';
// Pool : le groupe de connexions à PostgreSQL.
import { Pool } from 'pg';
// Fonctions de géodésie : normalisation d'un vecteur, plan de découpage en triangles, et le type d'un vecteur.
import { nz, triPlan, type Vec3 } from '../../geo/geodesy';

// ===========================================================================
// moon.types.ts — types partagés du module
// ===========================================================================

// Liste des identifiants des fournisseurs :
export const PROVIDER_IDS = [
  // NASA Moon Trek ;
  'moon-trek',
  // USGS Astrogeology ;
  'usgs-astro',
  // LROC Lunaserv ;
  'lroc-lunaserv',
  // OpenPlanetaryMap.
  'opm',
// Fin de la liste, figée.
] as const;

// Type ProviderId : un des identifiants de la liste.
export type ProviderId = (typeof PROVIDER_IDS)[number];
// Type ProviderKind : la nature d'un fournisseur, parmi
export type ProviderKind =
  // WMTS,
  | 'wmts'
  // WMS,
  | 'wms'
  // XYZ,
  | 'xyz'
  // ArcGIS ImageServer,
  | 'arcgis-image'
  // ou 3D Tiles.
  | '3d-tiles';
// Type TileScheme : plate carrée ou Web Mercator.
export type TileScheme = 'equirectangular' | 'web-mercator';
// Type AxisOrder : longitude d'abord (xy) ou latitude d'abord (yx).
export type AxisOrder = 'xy' | 'yx';

// Forme d'une emprise, en degrés.
export interface BBox {
  // west : le bord ouest.
  west: number;
  // south : le bord sud.
  south: number;
  // east : le bord est.
  east: number;
  // north : le bord nord.
  north: number;
// Fin de BBox.
}

// Forme d'une emprise projetée, en mètres.
export interface ProjectedBBox {
  // minX : le bord ouest.
  minX: number;
  // minY : le bord sud.
  minY: number;
  // maxX : le bord est.
  maxX: number;
  // maxY : le bord nord.
  maxY: number;
  // crs : la projection.
  crs: string;
// Fin de ProjectedBBox.
}

// Forme d'une source WMTS.
export interface WmtsSource {
  // baseUrl : l'adresse de base.
  baseUrl: string;
  // style : le style.
  style: string;
  // matrixSet : le jeu de tuiles.
  matrixSet: string;
  // extension : l'extension des fichiers.
  extension: 'jpg' | 'png' | 'webp';
// Fin de WmtsSource.
}

// Forme d'une source WMS.
export interface WmsSource {
  // getMapUrl : l'adresse des requêtes GetMap.
  getMapUrl: string;
  // version : la version du service.
  version: '1.1.1' | '1.3.0';
  // srs : la projection.
  srs: string;
  // axisOrder : l'ordre des axes de l'emprise.
  axisOrder: AxisOrder;
// Fin de WmsSource.
}

// Forme d'une source XYZ.
export interface XyzSource {
  // urlTemplate : le modèle d'adresse.
  urlTemplate: string;
  // tms : vrai si les lignes sont comptées depuis le bas.
  tms: boolean;
// Fin de XyzSource.
}

// Forme d'une source ArcGIS ImageServer.
export interface ArcgisImageSource {
  // exportImageUrl : l'adresse des requêtes d'export.
  exportImageUrl: string;
  // bboxSrs : la projection de l'emprise.
  bboxSrs: string;
  // imageSrs : la projection de l'image.
  imageSrs: string;
  // format : jpg ou png.
  format: 'jpg' | 'png';
  // interpolation : bilinéaire ou au plus proche voisin.
  interpolation: 'RSP_BilinearInterpolation' | 'RSP_NearestNeighbor';
// Fin de ArcgisImageSource.
}

// Forme d'une source 3D Tiles.
export interface Tiles3dSource {
  // assetId : le numéro du jeu de données.
  assetId: number;
// Fin de Tiles3dSource.
}

// Forme d'une couche du catalogue.
export interface CuratedLayer {
  // id : l'identifiant.
  id: string;
  // title : le titre.
  title: string;
  // description : la description.
  description: string;
  // upstreamLayer : le nom de la couche chez la source.
  upstreamLayer: string;
  // kind : la nature de sa source.
  kind: ProviderKind;
  // scheme : le découpage en tuiles.
  scheme: TileScheme | 'none';
  // crs : la projection.
  crs: string;
  // minZoom : le niveau minimal.
  minZoom: number;
  // maxZoom : le niveau maximal.
  maxZoom: number;
  // tileSize : la taille d'une tuile, en pixels.
  tileSize: number;
  // format : le format des images.
  format: string;
  // attribution : la mention à afficher.
  attribution: string;
  // license : la licence.
  license: string;
  // wmts : les réglages WMTS (facultatif).
  wmts?: WmtsSource;
  // wms : les réglages WMS (facultatif).
  wms?: WmsSource;
  // xyz : les réglages XYZ (facultatif).
  xyz?: XyzSource;
  // arcgis : les réglages ArcGIS ImageServer (facultatif).
  arcgis?: ArcgisImageSource;
  // tiles3d : les réglages 3D Tiles (facultatif).
  tiles3d?: Tiles3dSource;
// Fin de CuratedLayer.
}

// Forme de la définition d'un fournisseur.
export interface ProviderDefinition {
  // id : l'identifiant.
  id: ProviderId;
  // name : le nom.
  name: string;
  // kind : la nature (WMTS, WMS, XYZ, ArcGIS ImageServer ou 3D Tiles).
  kind: ProviderKind;
  // description : la description.
  description: string;
  // docsUrl : l'adresse de la documentation.
  docsUrl: string;
  // attribution : la mention à afficher.
  attribution: string;
  // license : la licence.
  license: string;
  // requiresToken : vrai si un jeton est demandé.
  requiresToken: boolean;
  // capabilitiesUrl : l'adresse du document de capacités.
  capabilitiesUrl?: string;
  // notes : les remarques.
  notes: string[];
  // layers : les couches.
  layers: CuratedLayer[];
// Fin de ProviderDefinition.
}

// Forme du résumé d'une couche.
export interface LayerSummary {
  // id : l'identifiant.
  id: string;
  // title : le titre.
  title: string;
  // kind : la nature (WMTS, WMS, XYZ, ArcGIS ImageServer ou 3D Tiles).
  kind: ProviderKind;
  // scheme : le découpage en tuiles.
  scheme: TileScheme | 'none';
  // crs : la projection.
  crs: string;
  // minZoom : le niveau minimal.
  minZoom: number;
  // maxZoom : le niveau maximal.
  maxZoom: number;
  // tileSize : la taille d'une tuile, en pixels.
  tileSize: number;
  // format : le format des images.
  format: string;
  // tileUrlTemplate : le modèle d'adresse des tuiles sur ce serveur.
  tileUrlTemplate: string;
// Fin de LayerSummary.
}

// Forme du résumé d'un fournisseur.
export interface ProviderSummary {
  // id : l'identifiant.
  id: ProviderId;
  // name : le nom.
  name: string;
  // kind : la nature (WMTS, WMS, XYZ, ArcGIS ImageServer ou 3D Tiles).
  kind: ProviderKind;
  // description : la description.
  description: string;
  // docsUrl : l'adresse de la documentation.
  docsUrl: string;
  // attribution : la mention à afficher.
  attribution: string;
  // license : la licence.
  license: string;
  // requiresToken : vrai si un jeton est demandé.
  requiresToken: boolean;
  // capabilitiesUrl : l'adresse du document de capacités.
  capabilitiesUrl: string | null;
  // notes : les remarques.
  notes: string[];
  // layers : les couches.
  layers: LayerSummary[];
// Fin de ProviderSummary.
}

// Forme du détail d'une couche : son résumé, plus les champs suivants.
export interface LayerDetail extends LayerSummary {
  // description : la description.
  description: string;
  // upstreamLayer : le nom de la couche chez la source.
  upstreamLayer: string;
  // attribution : la mention à afficher.
  attribution: string;
  // license : la licence.
  license: string;
  // tileMatrixSet : le jeu de tuiles.
  tileMatrixSet: string | null;
  // style : le style.
  style: string | null;
  // xyzTemplate : le modèle d'adresse XYZ.
  xyzTemplate: string | null;
  // tiles3dAssetId : le numéro du jeu 3D Tiles.
  tiles3dAssetId: number | null;
  // sampleUpstreamUrl : un exemple d'adresse chez la source.
  sampleUpstreamUrl: string | null;
// Fin de LayerDetail.
}

// Forme de la réponse d'une source.
export interface UpstreamInfo {
  // status : le code HTTP.
  status: number;
  // contentType : le type de contenu.
  contentType: string | null;
  // contentLength : la taille annoncée.
  contentLength: number | null;
  // etag : l'en-tête ETag.
  etag: string | null;
  // lastModified : la date de dernière modification.
  lastModified: string | null;
  // cacheControl : l'en-tête Cache-Control.
  cacheControl: string | null;
// Fin de UpstreamInfo.
}

// Forme des informations d'une image.
export interface ImageInfo {
  // format : le format : PNG ou JPEG.
  format: 'png' | 'jpeg';
  // width : la largeur.
  width: number;
  // height : la hauteur.
  height: number;
  // bytes : le poids en octets.
  bytes: number;
  // sha256 : l'empreinte SHA-256.
  sha256: string;
// Fin de ImageInfo.
}

// Forme de l'état du cache pour une tuile.
export interface TileCacheInfo {
  // hit : vrai si la tuile vient du cache.
  hit: boolean;
  // stale : vrai si elle est périmée.
  stale: boolean;
  // key : la clé du cache.
  key: string;
  // ttlMs : la durée de vie.
  ttlMs: number;
  // ageMs : l'âge.
  ageMs: number;
// Fin de TileCacheInfo.
}

// Forme de la fiche d'une tuile.
export interface TileModel {
  // provider : le fournisseur :
  provider: {
    // id : l'identifiant.
    id: ProviderId;
    // name : le nom.
    name: string;
    // kind : la nature (WMTS, WMS, XYZ, ArcGIS ImageServer ou 3D Tiles).
    kind: ProviderKind;
  // Fin de provider.
  };
  // layer : la couche :
  layer: {
    // id : l'identifiant.
    id: string;
    // title : le titre.
    title: string;
    // upstreamLayer : le nom de la couche chez la source.
    upstreamLayer: string;
  // Fin de layer.
  };
  // scheme : le découpage en tuiles.
  scheme: TileScheme;
  // crs : la projection.
  crs: string;
  // zoom : le niveau.
  zoom: number;
  // x : la colonne.
  x: number;
  // y : la ligne.
  y: number;
  // tileSize : la taille d'une tuile, en pixels.
  tileSize: number;
  // format : le format des images.
  format: string;
  // bbox : l'emprise.
  bbox: BBox;
  // projectedBBox : l'emprise projetée, ou null.
  projectedBBox: ProjectedBBox | null;
  // center : le centre.
  center: { lon: number; lat: number };
  // tileRange : la dernière colonne et la dernière ligne du niveau.
  tileRange: { maxX: number; maxY: number };
  // upstreamUrl : l'adresse chez la source.
  upstreamUrl: string;
  // proxyUrl : l'adresse sur ce serveur.
  proxyUrl: string;
  // attribution : la mention à afficher.
  attribution: string;
  // license : la licence.
  license: string;
  // fetchedAt : l'heure de la lecture.
  fetchedAt: string;
  // upstream : la réponse de la source, ou null.
  upstream: UpstreamInfo | null;
  // image : les informations de l'image, ou null.
  image: ImageInfo | null;
  // cache : l'état du cache, ou null.
  cache: TileCacheInfo | null;
// Fin de TileModel.
}

// Forme d'une tuile téléchargée.
export interface TileFetchResult {
  // model : la fiche de la tuile.
  model: TileModel;
  // buffer : les octets.
  buffer: Buffer;
  // contentType : le type de contenu.
  contentType: string;
  // etag : l'en-tête ETag.
  etag: string;
  // cacheHit : vrai si elle vient du cache.
  cacheHit: boolean;
  // cacheStale : vrai si elle est périmée.
  cacheStale: boolean;
  // ttlMs : la durée de vie.
  ttlMs: number;
// Fin de TileFetchResult.
}

// Forme de la couverture d'une emprise.
export interface CoverageResult {
  // provider : l'identifiant du fournisseur.
  provider: ProviderId;
  // layer : l'identifiant de la couche.
  layer: string;
  // scheme : le découpage en tuiles.
  scheme: TileScheme;
  // zoom : le niveau.
  zoom: number;
  // bbox : l'emprise.
  bbox: BBox;
  // range : la plage de tuiles :
  range: {
    // minX : la première colonne.
    minX: number;
    // maxX : la dernière colonne.
    maxX: number;
    // minY : la première ligne.
    minY: number;
    // maxY : la dernière ligne.
    maxY: number;
  // Fin de range.
  };
  // count : le nombre d'adresses rendues.
  count: number;
  // total : le nombre total de tuiles.
  total: number;
  // truncated : vrai si la liste est coupée.
  truncated: boolean;
  // urls : les adresses sur ce serveur.
  urls: string[];
  // upstreamUrls : les adresses chez la source.
  upstreamUrls: string[];
// Fin de CoverageResult.
}

// Forme du résumé d'une matrice de tuiles.
export interface WmtsTileMatrixSummary {
  // id : le nom de la matrice.
  id: string;
  // scaleDenominator : le dénominateur d'échelle.
  scaleDenominator: number | null;
  // topLeft : le coin haut gauche.
  topLeft: { lon: number; lat: number } | null;
  // matrixWidth : la largeur, en tuiles.
  matrixWidth: number | null;
  // matrixHeight : la hauteur, en tuiles.
  matrixHeight: number | null;
  // tileWidth : la largeur d'une tuile.
  tileWidth: number | null;
  // tileHeight : la hauteur d'une tuile.
  tileHeight: number | null;
// Fin de WmtsTileMatrixSummary.
}

// Forme du résumé d'un jeu de tuiles.
export interface WmtsTileMatrixSetSummary {
  // id : le nom du jeu.
  id: string;
  // matrices : ses matrices.
  matrices: WmtsTileMatrixSummary[];
// Fin de WmtsTileMatrixSetSummary.
}

// Forme d'une couche lue dans les capacités.
export interface CapabilitiesLayerSummary {
  // name : le nom de la couche.
  name: string;
  // title : son titre.
  title: string;
// Fin de CapabilitiesLayerSummary.
}

// Forme du résumé des capacités.
export interface CapabilitiesSummary {
  // provider : l'identifiant du fournisseur.
  provider: ProviderId;
  // kind : la nature (WMTS, WMS, XYZ, ArcGIS ImageServer ou 3D Tiles).
  kind: ProviderKind;
  // version : la version du service.
  version: string | null;
  // serviceTitle : le titre du service.
  serviceTitle: string | null;
  // fetchedAt : l'heure de la lecture.
  fetchedAt: string;
  // bytes : le poids en octets.
  bytes: number | null;
  // contentType : le type de contenu.
  contentType: string | null;
  // fetchMs : la durée du téléchargement.
  fetchMs: number | null;
  // formats : les formats.
  formats: string[];
  // crs : la projection.
  crs: string[];
  // bbox : l'emprise.
  bbox: BBox | null;
  // layers : les couches.
  layers: CapabilitiesLayerSummary[];
  // tileMatrixSets : les jeux de tuiles.
  tileMatrixSets: WmtsTileMatrixSetSummary[];
  // resourceUrlTemplate : le modèle d'adresse des tuiles.
  resourceUrlTemplate: string | null;
  // tilejson : un document TileJSON (facultatif).
  tilejson?: Record<string, unknown>;
  // note : une note (facultatif).
  note?: string;
// Fin de CapabilitiesSummary.
}

// Forme du résultat rendu pour les capacités.
export interface CapabilitiesResult {
  // summary : le résumé.
  summary: CapabilitiesSummary;
  // raw : le texte XML, ou null.
  raw: string | null;
// Fin de CapabilitiesResult.
}

// Forme de l'état de santé d'un fournisseur.
export interface HealthProviderResult {
  // provider : l'identifiant du fournisseur.
  provider: ProviderId;
  // kind : la nature (WMTS, WMS, XYZ, ArcGIS ImageServer ou 3D Tiles).
  kind: ProviderKind;
  // status : l'état : en service, dégradé, en panne ou non configuré.
  status: 'up' | 'degraded' | 'down' | 'not_configured';
  // httpStatus : le code HTTP, ou null.
  httpStatus: number | null;
  // latencyMs : la durée du test.
  latencyMs: number;
  // contentType : le type de contenu.
  contentType: string | null;
  // error : l'erreur, ou null.
  error: string | null;
// Fin de HealthProviderResult.
}

// Forme du rapport de santé.
export interface HealthReport {
  // checkedAt : l'heure du test.
  checkedAt: string;
  // summary : le nombre de fournisseurs par état :
  summary: {
    // up : en service.
    up: number;
    // degraded : dégradés.
    degraded: number;
    // down : en panne.
    down: number;
    // notConfigured : non configurés.
    notConfigured: number;
  // Fin de summary.
  };
  // providers : le résultat de chaque fournisseur.
  providers: HealthProviderResult[];
// Fin de HealthReport.
}

// ===========================================================================
// cache.ts — cache TTL avec LRU et stale-while-revalidate
// ===========================================================================

// Forme du résultat d'une lecture du cache.
export interface CacheLookup<T> {
  // value : la valeur.
  value: T;
  // hit : vrai si elle vient du cache.
  hit: boolean;
  // stale : vrai si elle est périmée mais encore servie.
  stale: boolean;
  // ageMs : son âge.
  ageMs: number;
  // ttlMs : sa durée de vie.
  ttlMs: number;
// Fin de CacheLookup.
}

// Forme d'une entrée du cache.
interface CacheEntry<T> {
  // value : la valeur.
  value: T;
  // storedAt : l'heure où elle a été rangée.
  storedAt: number;
// Fin de CacheEntry.
}

// Classe TtlCache : un cache à durée de vie.
export class TtlCache<T> {
  // Entrées, par clé.
  private readonly entries = new Map<string, CacheEntry<T>>();
  // Chargements en cours, par clé.
  private readonly inflight = new Map<string, Promise<T>>();

  // Constructeur ; ses paramètres :
  constructor(
    // le nombre maximal d'entrées ;
    private readonly maxEntries: number,
    // la durée de vie ;
    private readonly ttlMs: number,
    // la durée pendant laquelle une valeur périmée est encore servie (0 par défaut).
    private readonly staleMs = 0,
  // Corps du constructeur vide.
  ) {}

  // Accesseur size.
  get size(): number {
    // Nombre d'entrées.
    return this.entries.size;
  // Fin de size.
  }

  // Accesseur ttl.
  get ttl(): number {
    // Durée de vie.
    return this.ttlMs;
  // Fin de ttl.
  }

  // Méthode get.
  get(key: string): CacheLookup<T> | null {
    // Cherche l'entrée.
    const entry = this.entries.get(key);
    // Absente :
    if (!entry) {
      // null.
      return null;
    // Fin du cas.
    }

    // Âge de l'entrée.
    const ageMs = Date.now() - entry.storedAt;
    // Trop vieille, même pour être servie périmée :
    if (ageMs >= this.ttlMs + this.staleMs) {
      // la retire ;
      this.entries.delete(key);
      // null.
      return null;
    // Fin du cas.
    }

    // La retire,
    this.entries.delete(key);
    // et la remet : elle devient la plus récente.
    this.entries.set(key, entry);

    // Renvoie
    return {
      // la valeur ;
      value: entry.value,
      // « vient du cache » ;
      hit: true,
      // périmée si elle a dépassé sa durée de vie ;
      stale: ageMs >= this.ttlMs,
      // son âge ;
      ageMs,
      // la durée de vie.
      ttlMs: this.ttlMs,
    // Fin de l'objet.
    };
  // Fin de get.
  }

  // Méthode peek.
  peek(key: string): T | undefined {
    // La valeur seule, ou undefined.
    return this.get(key)?.value;
  // Fin de peek.
  }

  // Méthode set.
  set(key: string, value: T): void {
    // Retire l'ancienne entrée.
    this.entries.delete(key);
    // Range la nouvelle, avec l'heure.
    this.entries.set(key, { value, storedAt: Date.now() });
    // Retire les entrées en trop.
    this.evict();
  // Fin de set.
  }

  // Méthode getOrLoad ; ses paramètres :
  async getOrLoad(
    // la clé ;
    key: string,
    // la fonction qui charge la valeur.
    loader: () => Promise<T>,
  // Elle renvoie le résultat de la lecture.
  ): Promise<CacheLookup<T>> {
    // Lit le cache.
    const cached = this.get(key);
    // Trouvée :
    if (cached) {
      // si elle est périmée,
      if (cached.stale) {
        // la recharge en arrière-plan, sans attendre ni remonter l'erreur.
        void this.load(key, loader).catch(() => undefined);
      // Fin du cas.
      }
      // Renvoie la valeur du cache.
      return cached;
    // Fin du cas.
    }

    // Sinon charge la valeur.
    const value = await this.load(key, loader);
    // La renvoie, marquée « pas du cache ».
    return { value, hit: false, stale: false, ageMs: 0, ttlMs: this.ttlMs };
  // Fin de getOrLoad.
  }

  // Méthode delete.
  delete(key: string): boolean {
    // Retire une entrée ; vrai si elle existait.
    return this.entries.delete(key);
  // Fin de delete.
  }

  // Méthode clear.
  clear(): void {
    // Vide le cache.
    this.entries.clear();
  // Fin de clear.
  }

  // Méthode privée load.
  private load(key: string, loader: () => Promise<T>): Promise<T> {
    // Cherche un chargement en cours.
    const pending = this.inflight.get(key);
    // Trouvé :
    if (pending) {
      // le renvoie.
      return pending;
    // Fin du cas.
    }

    // Lance le chargement ;
    const task = loader()
      // quand il réussit :
      .then((value) => {
        // range la valeur ;
        this.set(key, value);
        // la rend.
        return value;
      // Fin du traitement.
      })
      // Dans tous les cas :
      .finally(() => {
        // si c'est toujours ce chargement qui est inscrit,
        if (this.inflight.get(key) === task) {
          // le retire de la liste.
          this.inflight.delete(key);
        // Fin du cas.
        }
      // Fin du traitement.
      });
    // L'inscrit dans la liste.
    this.inflight.set(key, task);
    // Renvoie la promesse.
    return task;
  // Fin de load.
  }

  // Méthode privée evict.
  private evict(): void {
    // Tant qu'il y a trop d'entrées :
    while (this.entries.size > this.maxEntries) {
      // clé de la plus ancienne ;
      const oldest = this.entries.keys().next();
      // aucune :
      if (oldest.done) {
        // fin.
        return;
      // Fin du cas.
      }
      // La retire.
      this.entries.delete(oldest.value);
    // Fin de la boucle.
    }
  // Fin de evict.
  }
// Fin de la classe.
}

// ===========================================================================
// capabilities.parser.ts — parsing GetCapabilities OGC (WMS / WMTS)
// ===========================================================================

// Classe CapabilitiesParseError : l'erreur de lecture d'un document de capacités.
export class CapabilitiesParseError extends Error {
  // Constructeur : le message.
  constructor(message: string) {
    // Le passe à Error.
    super(message);
    // Fixe le nom de l'erreur.
    this.name = 'CapabilitiesParseError';
  // Fin du constructeur.
  }
// Fin de la classe.
}

// Forme des capacités lues.
export interface ParsedCapabilities {
  // version : la version du service.
  version: string | null;
  // serviceTitle : son titre.
  serviceTitle: string | null;
  // formats : les formats.
  formats: string[];
  // crs : les projections.
  crs: string[];
  // bbox : l'emprise.
  bbox: BBox | null;
  // layers : les couches.
  layers: CapabilitiesLayerSummary[];
  // tileMatrixSets : les jeux de tuiles.
  tileMatrixSets: WmtsTileMatrixSetSummary[];
  // resourceUrlTemplate : le modèle d'adresse des tuiles.
  resourceUrlTemplate: string | null;
// Fin de ParsedCapabilities.
}

// Forme d'un bloc XML.
interface XmlBlock {
  // attrs : le texte de ses attributs.
  attrs: string;
  // inner : son contenu.
  inner: string;
// Fin de XmlBlock.
}

// Les cinq entités XML de base :
const XML_ENTITIES: Record<string, string> = {
  // amp : « & » ;
  amp: '&',
  // lt : « < » ;
  lt: '<',
  // gt : « > » ;
  gt: '>',
  // quot : le guillemet double ;
  quot: '"',
  // apos : l'apostrophe.
  apos: "'",
// Fin de la table.
};

// Nombre maximal de couches listées : 500.
const MAX_LISTED_LAYERS = 500;
// Nombre maximal de projections listées : 32.
const MAX_LISTED_CRS = 32;
// Nombre maximal de formats listés : 16.
const MAX_LISTED_FORMATS = 16;
// Nombre maximal de jeux de tuiles : 12.
const MAX_TILE_MATRIX_SETS = 12;
// Nombre maximal de matrices par jeu : 30.
const MAX_TILE_MATRICES = 30;

// Fonction parseCapabilities : lit un document de capacités WMS ou WMTS.
export function parseCapabilities(xml: string): ParsedCapabilities {
  // Document vide :
  if (!xml || xml.trim().length === 0) {
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // avec ce message.
      'Le service amont a renvoyé un document vide.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Retire les commentaires XML.
  xml = xml.replace(/<!--[\s\S]*?-->/g, '');

  // Début du document, sans espaces et en minuscules.
  const head = xml.slice(0, 1024).trimStart().toLowerCase();
  // Si c'est du HTML :
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // avec ce message.
      'Le service amont a renvoyé du HTML au lieu d’un document OGC XML.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Si le document porte une balise ServiceException :
  if (/<(?:(?:[\w.-]+):)?ServiceException\b/i.test(xml)) {
    // son texte ;
    const detail = firstText(xml, 'ServiceException');
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // selon qu'il y a un texte :
      detail
        // avec ce texte,
        ? `Le service amont a renvoyé une exception OGC : ${detail}`
        // ou sans.
        : 'Le service amont a renvoyé une exception OGC.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Si le document
  if (
    // n'a aucune des trois balises racines attendues
    !/<(?:(?:[\w.-]+):)?(?:WMS_Capabilities|WMT_MS_Capabilities|Capabilities)\b/i.test(
      // (cherchées dans le document) ;
      xml,
    // fin de la recherche ;
    )
  // alors :
  ) {
    // erreur de lecture,
    throw new CapabilitiesParseError(
      // avec ce message.
      'La réponse amont ne ressemble pas à un document GetCapabilities OGC.',
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Renvoie
  return {
    // la version ;
    version: parseVersion(xml),
    // le titre du service ;
    serviceTitle: parseServiceTitle(xml),
    // les formats, sans doublons, 16 au plus ;
    formats: dedupe(collectTexts(xml, 'Format')).slice(0, MAX_LISTED_FORMATS),
    // les projections ;
    crs: collectCrs(xml),
    // l'emprise ;
    bbox: parseBBox(xml),
    // les couches ;
    layers: parseLayers(xml),
    // les jeux de tuiles ;
    tileMatrixSets: parseTileMatrixSets(xml),
    // le modèle d'adresse des tuiles.
    resourceUrlTemplate: parseResourceUrlTemplate(xml),
  // Fin de l'objet.
  };
// Fin de parseCapabilities.
}

// Fonction parseVersion.
function parseVersion(xml: string): string | null {
  // Balise racine,
  const root =
    // cherchée avec ses attributs
    /<(?:(?:[\w.-]+):)?(?:WMS_Capabilities|WMT_MS_Capabilities|Capabilities)\b([^>]*)>/i.exec(
      // dans le document.
      xml,
    // Fin de la recherche.
    );
  // Renvoie son attribut « version », ou null.
  return root ? readAttr(root[1], 'version') : null;
// Fin de parseVersion.
}

// Fonction parseServiceTitle.
function parseServiceTitle(xml: string): string | null {
  // Bloc du service :
  const block =
    // ServiceIdentification (WMTS),
    findBlocks(xml, 'ServiceIdentification')[0] ??
    // sinon Service (WMS).
    findBlocks(xml, 'Service')[0];
  // Renvoie son titre, ou null.
  return block ? firstText(block.inner, 'Title') : null;
// Fin de parseServiceTitle.
}

// Fonction collectCrs.
function collectCrs(xml: string): string[] {
  // Valeurs réunies :
  const values = [
    // celles des balises CRS,
    ...collectTexts(xml, 'CRS'),
    // SRS,
    ...collectTexts(xml, 'SRS'),
    // et SupportedCRS ;
    ...collectTexts(xml, 'SupportedCRS'),
  // fin de la liste ;
  ]
    // coupées aux espaces,
    .flatMap((value) => value.split(/\s+/))
    // sans espaces aux bords,
    .map((value) => value.trim())
    // sans valeurs vides.
    .filter((value) => value.length > 0);

  // Renvoie les valeurs sans doublons, 32 au plus.
  return [...new Set(values)].slice(0, MAX_LISTED_CRS);
// Fin de collectCrs.
}

// Fonction parseBBox.
function parseBBox(xml: string): BBox | null {
  // Premier essai : le bloc EX_GeographicBoundingBox (WMS 1.3.0).
  const geographic = findBlocks(xml, 'EX_GeographicBoundingBox')[0];
  // S'il existe :
  if (geographic) {
    // bord ouest ;
    const west = readNumber(firstText(geographic.inner, 'westBoundLongitude'));
    // bord sud ;
    const south = readNumber(firstText(geographic.inner, 'southBoundLatitude'));
    // bord est ;
    const east = readNumber(firstText(geographic.inner, 'eastBoundLongitude'));
    // bord nord.
    const north = readNumber(firstText(geographic.inner, 'northBoundLatitude'));

    // Si les quatre sont lus,
    if (west !== null && south !== null && east !== null && north !== null) {
      // renvoie l'emprise.
      return { west, south, east, north };
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Deuxième essai : le bloc LatLonBoundingBox (WMS 1.1.1).
  const latLon = findBlocks(xml, 'LatLonBoundingBox')[0];
  // S'il existe :
  if (latLon) {
    // bord ouest, lu dans l'attribut minx ;
    const west = readNumber(readAttr(latLon.attrs, 'minx'));
    // bord sud, dans miny ;
    const south = readNumber(readAttr(latLon.attrs, 'miny'));
    // bord est, dans maxx ;
    const east = readNumber(readAttr(latLon.attrs, 'maxx'));
    // bord nord, dans maxy.
    const north = readNumber(readAttr(latLon.attrs, 'maxy'));

    // Si les quatre sont lus,
    if (west !== null && south !== null && east !== null && north !== null) {
      // renvoie l'emprise.
      return { west, south, east, north };
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Troisième essai : le bloc WGS84BoundingBox (WMTS).
  const wgs84 = findBlocks(xml, 'WGS84BoundingBox')[0];
  // S'il existe :
  if (wgs84) {
    // coin bas gauche ;
    const lower = readNumbers(firstText(wgs84.inner, 'LowerCorner'));
    // coin haut droit.
    const upper = readNumbers(firstText(wgs84.inner, 'UpperCorner'));

    // Si chacun a deux nombres,
    if (lower.length >= 2 && upper.length >= 2) {
      // renvoie
      return {
        // l'ouest ;
        west: lower[0],
        // le sud ;
        south: lower[1],
        // l'est ;
        east: upper[0],
        // le nord.
        north: upper[1],
      // Fin de l'objet.
      };
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Aucune emprise : null.
  return null;
// Fin de parseBBox.
}

// Fonction parseLayers.
function parseLayers(xml: string): CapabilitiesLayerSummary[] {
  // Toutes les balises ouvrantes Layer ;
  const starts = [...xml.matchAll(/<(?:(?:[\w.-]+):)?Layer\b[^>]*>/gi)].map(
    // pour chacune, on garde :
    (match) => ({
      // sa position ;
      index: match.index,
      // la position de sa fin.
      end: (match.index ?? 0) + match[0].length,
    // Fin de l'objet.
    }),
  // Fin de la liste.
  );

  // Couches retenues.
  const layers: CapabilitiesLayerSummary[] = [];
  // Noms déjà vus.
  const seen = new Set<string>();

  // Pour chaque balise Layer :
  for (let index = 0; index < starts.length; index += 1) {
    // la balise ;
    const start = starts[index];
    // fin de son segment :
    const end =
      // le début de la balise Layer suivante, ou la fin du document ;
      index + 1 < starts.length ? starts[index + 1].index : xml.length;
    // le segment ;
    const segment = xml.slice(start.end, end);
    // le même, sans
    const cleaned = segment.replace(
      // ses blocs Style
      /<(?:[\w.-]+:)?Style\b[\s\S]*?<\/(?:[\w.-]+:)?Style>/gi,
      // (ils ont aussi des noms).
      '',
    // Fin du nettoyage.
    );

    // Nom de la couche : la balise Name, sinon Identifier.
    const name = firstText(cleaned, 'Name') ?? firstText(cleaned, 'Identifier');
    // Pas de nom, ou nom déjà vu :
    if (!name || seen.has(name)) {
      // couche suivante.
      continue;
    // Fin du cas.
    }

    // Note le nom.
    seen.add(name);
    // Ajoute la couche, avec son titre ou, à défaut, son nom.
    layers.push({ name, title: firstText(cleaned, 'Title') ?? name });

    // 500 couches atteintes :
    if (layers.length >= MAX_LISTED_LAYERS) {
      // on s'arrête.
      break;
    // Fin du cas.
    }
  // Fin de la boucle.
  }

  // Renvoie les couches.
  return layers;
// Fin de parseLayers.
}

// Fonction parseTileMatrixSets.
function parseTileMatrixSets(xml: string): WmtsTileMatrixSetSummary[] {
  // Jeux retenus.
  const sets: WmtsTileMatrixSetSummary[] = [];
  // Noms déjà vus.
  const seen = new Set<string>();

  // Pour chaque bloc TileMatrixSet :
  for (const block of findBlocks(xml, 'TileMatrixSet')) {
    // son nom ;
    const id = firstText(block.inner, 'Identifier');
    // pas de nom, ou nom déjà vu :
    if (!id || seen.has(id)) {
      // bloc suivant.
      continue;
    // Fin du cas.
    }

    // Ses matrices : les blocs TileMatrix,
    const matrices = findBlocks(block.inner, 'TileMatrix')
      // 30 au plus,
      .slice(0, MAX_TILE_MATRICES)
      // chacun lu,
      .map((matrix) => parseTileMatrix(matrix.inner))
      // sans ceux qui sont illisibles.
      .filter((matrix): matrix is WmtsTileMatrixSummary => matrix !== null);

    // Aucune matrice :
    if (matrices.length === 0) {
      // bloc suivant.
      continue;
    // Fin du cas.
    }

    // Note le nom.
    seen.add(id);
    // Ajoute le jeu.
    sets.push({ id, matrices });

    // 12 jeux atteints :
    if (sets.length >= MAX_TILE_MATRIX_SETS) {
      // on s'arrête.
      break;
    // Fin du cas.
    }
  // Fin de la boucle.
  }

  // Renvoie les jeux.
  return sets;
// Fin de parseTileMatrixSets.
}

// Fonction parseTileMatrix.
function parseTileMatrix(inner: string): WmtsTileMatrixSummary | null {
  // Nom de la matrice.
  const id = firstText(inner, 'Identifier');
  // Pas de nom :
  if (!id) {
    // null.
    return null;
  // Fin du cas.
  }

  // Renvoie
  return {
    // le nom ;
    id,
    // le dénominateur d'échelle ;
    scaleDenominator: readNumber(firstText(inner, 'ScaleDenominator')),
    // le coin haut gauche ;
    topLeft: readTopLeftCorner(firstText(inner, 'TopLeftCorner')),
    // la largeur, en tuiles ;
    matrixWidth: readInteger(firstText(inner, 'MatrixWidth')),
    // la hauteur, en tuiles ;
    matrixHeight: readInteger(firstText(inner, 'MatrixHeight')),
    // la largeur d'une tuile ;
    tileWidth: readInteger(firstText(inner, 'TileWidth')),
    // la hauteur d'une tuile.
    tileHeight: readInteger(firstText(inner, 'TileHeight')),
  // Fin de l'objet.
  };
// Fin de parseTileMatrix.
}

// Fonction parseResourceUrlTemplate.
function parseResourceUrlTemplate(xml: string): string | null {
  // Pour chaque bloc ResourceURL :
  for (const block of findBlocks(xml, 'ResourceURL')) {
    // son attribut « template » ;
    const template = readAttr(block.attrs, 'template');
    // s'il existe,
    if (template) {
      // le renvoie.
      return template;
    // Fin du cas.
    }
  // Fin de la boucle.
  }
  // Aucun : null.
  return null;
// Fin de parseResourceUrlTemplate.
}

// Fonction readTopLeftCorner ; son paramètre :
function readTopLeftCorner(
  // le texte du coin.
  value: string | null,
// Elle renvoie une longitude et une latitude, ou null.
): { lon: number; lat: number } | null {
  // Nombres du texte.
  const numbers = readNumbers(value);
  // Moins de deux :
  if (numbers.length < 2) {
    // null.
    return null;
  // Fin du cas.
  }

  // Les deux premiers nombres.
  let [first, second] = numbers;
  // Si le premier tient dans une latitude et pas le second,
  if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
    // les échange : le document donnait la latitude d'abord.
    [first, second] = [second, first];
  // Fin du cas.
  }

  // Renvoie la longitude puis la latitude.
  return { lon: first, lat: second };
// Fin de readTopLeftCorner.
}

// Fonction findBlocks : les blocs d'une balise, avec ou sans préfixe.
function findBlocks(xml: string, name: string): XmlBlock[] {
  // Expression régulière
  const pattern = new RegExp(
    // qui prend les attributs, puis une balise fermée sur elle-même ou un contenu jusqu'à la balise de fin ;
    `<(?:(?:[\\w.-]+):)?${name}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:(?:[\\w.-]+):)?${name}\\s*>)`,
    // sur tout le texte, sans tenir compte de la casse.
    'gi',
  // Fin de l'expression.
  );

  // Pour chaque bloc trouvé, renvoie
  return [...xml.matchAll(pattern)].map((match) => ({
    // ses attributs,
    attrs: match[1] ?? '',
    // et son contenu.
    inner: match[2] ?? '',
  // Fin de la liste.
  }));
// Fin de findBlocks.
}

// Fonction firstText : le texte de la première balise de ce nom.
function firstText(xml: string, name: string): string | null {
  // Premier bloc.
  const block = findBlocks(xml, name)[0];
  // Son texte, ou null.
  return block ? textOf(block.inner) : null;
// Fin de firstText.
}

// Fonction collectTexts : les textes de toutes les balises de ce nom.
function collectTexts(xml: string, name: string): string[] {
  // Tous les blocs,
  return findBlocks(xml, name)
    // leur texte,
    .map((block) => textOf(block.inner))
    // sans les vides.
    .filter((value): value is string => value !== null);
// Fin de collectTexts.
}

// Fonction textOf : le texte d'un contenu.
function textOf(inner: string): string | null {
  // Remplace les balises par des espaces et décode les entités ;
  const text = decodeXml(inner.replace(/<[^>]*>/g, ' '))
    // réduit les espaces multiples ;
    .replace(/\s+/g, ' ')
    // retire ceux des bords.
    .trim();
  // Renvoie le texte, ou null s'il est vide.
  return text.length > 0 ? text : null;
// Fin de textOf.
}

// Fonction readAttr : la valeur d'un attribut.
function readAttr(attrs: string, name: string): string | null {
  // Expression régulière
  const pattern = new RegExp(
    // qui cherche le nom, un « = », puis une valeur entre guillemets doubles ou simples ;
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
    // sans tenir compte de la casse.
    'i',
  // Fin de l'expression.
  );
  // Cherche dans les attributs.
  const match = pattern.exec(attrs);
  // Rien trouvé :
  if (!match) {
    // null.
    return null;
  // Fin du cas.
  }

  // Valeur décodée, sans espaces aux bords.
  const value = decodeXml(match[1] ?? match[2] ?? '').trim();
  // La renvoie, ou null si elle est vide.
  return value.length > 0 ? value : null;
// Fin de readAttr.
}

// Fonction decodeXml : décode les entités XML.
export function decodeXml(value: string): string {
  // Remplace
  return value.replace(
    // chaque entité (numérique en hexadécimal, numérique en décimal, ou nommée)
    /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    // par le résultat de cette fonction :
    (match, entity: string) => {
      // essaie :
      try {
        // entité en hexadécimal :
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
          // le caractère de ce code ;
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        // fin du cas.
        }
        // Entité en décimal :
        if (entity.startsWith('#')) {
          // le caractère de ce code ;
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        // fin du cas.
        }
        // Entité nommée : sa valeur dans la table, sinon le texte tel quel.
        return XML_ENTITIES[entity] ?? match;
      // En cas d'échec (code impossible) :
      } catch {
        // le texte tel quel.
        return match;
      // Fin du cas.
      }
    // Fin de la fonction.
    },
  // Fin du remplacement.
  );
// Fin de decodeXml.
}

// Fonction readNumbers : les nombres d'un texte.
function readNumbers(value: string | null): number[] {
  // Texte absent :
  if (!value) {
    // liste vide.
    return [];
  // Fin du cas.
  }

  // Renvoie le texte,
  return value
    // coupé aux espaces et aux virgules,
    .split(/[\s,]+/)
    // chaque morceau converti en nombre,
    .map((part) => Number(part))
    // sans ceux qui ne sont pas des nombres finis.
    .filter((part) => Number.isFinite(part));
// Fin de readNumbers.
}

// Fonction readNumber : un nombre, ou null.
function readNumber(value: string | null): number | null {
  // Texte absent :
  if (value === null) {
    // null.
    return null;
  // Fin du cas.
  }
  // Le convertit.
  const parsed = Number(value);
  // Le renvoie s'il est fini, sinon null.
  return Number.isFinite(parsed) ? parsed : null;
// Fin de readNumber.
}

// Fonction readInteger : un entier, ou null.
function readInteger(value: string | null): number | null {
  // Lit le nombre.
  const parsed = readNumber(value);
  // Le renvoie s'il est entier, sinon null.
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
// Fin de readInteger.
}

// Fonction dedupe.
function dedupe(values: string[]): string[] {
  // Renvoie les valeurs sans doublons.
  return [...new Set(values)];
// Fin de dedupe.
}

// ===========================================================================
// image.ts — SHA-256, ETag, inspection PNG / JPEG
// ===========================================================================

// Les huit premiers octets de tout fichier PNG :
const PNG_SIGNATURE = Buffer.from([
  // leurs valeurs.
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
// Fin de la signature.
]);
// Marqueurs JPEG qui annoncent les dimensions de l'image :
const SOF_MARKERS = new Set([
  // leurs valeurs.
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
// Fin de la liste.
]);

// Fonction sha256Hex.
export function sha256Hex(buffer: Buffer): string {
  // Empreinte SHA-256 du tampon, en hexadécimal.
  return createHash('sha256').update(buffer).digest('hex');
// Fin de sha256Hex.
}

// Fonction etagFromSha.
export function etagFromSha(sha256: string): string {
  // L'en-tête ETag : « sha256-<empreinte> », entre guillemets.
  return `"sha256-${sha256}"`;
// Fin de etagFromSha.
}

// Fonction inspectImage.
export function inspectImage(buffer: Buffer): ImageInfo | null {
  // Essaie de lire un PNG.
  const png = readPng(buffer);
  // Si c'en est un :
  if (png) {
    // renvoie
    return {
      // le format PNG ;
      format: 'png',
      // la largeur ;
      width: png.width,
      // la hauteur ;
      height: png.height,
      // le poids en octets ;
      bytes: buffer.length,
      // l'empreinte.
      sha256: sha256Hex(buffer),
    // Fin de l'objet.
    };
  // Fin du cas.
  }

  // Essaie de lire un JPEG.
  const jpeg = readJpeg(buffer);
  // Si c'en est un :
  if (jpeg) {
    // renvoie
    return {
      // le format JPEG ;
      format: 'jpeg',
      // la largeur ;
      width: jpeg.width,
      // la hauteur ;
      height: jpeg.height,
      // le poids en octets ;
      bytes: buffer.length,
      // l'empreinte.
      sha256: sha256Hex(buffer),
    // Fin de l'objet.
    };
  // Fin du cas.
  }

  // Ni l'un ni l'autre : null.
  return null;
// Fin de inspectImage.
}

// Fonction readPng.
function readPng(buffer: Buffer): { width: number; height: number } | null {
  // Moins de 24 octets, ou mauvaise signature :
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    // null.
    return null;
  // Fin du cas.
  }

  // Renvoie
  return {
    // la largeur, lue à l'octet 16 ;
    width: buffer.readUInt32BE(16),
    // la hauteur, lue à l'octet 20.
    height: buffer.readUInt32BE(20),
  // Fin de l'objet.
  };
// Fin de readPng.
}

// Fonction readJpeg.
function readJpeg(buffer: Buffer): { width: number; height: number } | null {
  // Moins de 4 octets, ou pas FF D8 au début :
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    // null.
    return null;
  // Fin du cas.
  }

  // Position de lecture, après la signature.
  let offset = 2;
  // Tant qu'il reste 4 octets :
  while (offset + 4 <= buffer.length) {
    // si l'octet n'est pas FF :
    if (buffer[offset] !== 0xff) {
      // avance d'un octet,
      offset += 1;
      // et recommence.
      continue;
    // Fin du cas.
    }

    // Marqueur : l'octet suivant.
    const marker = buffer[offset + 1];
    // Si c'est encore FF (remplissage) :
    if (marker === 0xff) {
      // avance d'un octet,
      offset += 1;
      // et recommence.
      continue;
    // Fin du cas.
    }

    // Si le marqueur est
    if (
      // le début d'image,
      marker === 0xd8 ||
      // le marqueur 01,
      marker === 0x01 ||
      // ou un marqueur de reprise
      (marker >= 0xd0 && marker <= 0xd7)
    // (ils n'ont pas de longueur) :
    ) {
      // avance de 2 octets,
      offset += 2;
      // et recommence.
      continue;
    // Fin du cas.
    }

    // Fin d'image ou début des données :
    if (marker === 0xd9 || marker === 0xda) {
      // null, les dimensions n'ont pas été trouvées.
      return null;
    // Fin du cas.
    }

    // Longueur du segment.
    const length = buffer.readUInt16BE(offset + 2);
    // Longueur impossible :
    if (length < 2) {
      // null.
      return null;
    // Fin du cas.
    }

    // Si le marqueur annonce les dimensions :
    if (SOF_MARKERS.has(marker)) {
      // segment coupé :
      if (offset + 9 > buffer.length) {
        // null.
        return null;
      // Fin du cas.
      }
      // Renvoie
      return {
        // la hauteur ;
        height: buffer.readUInt16BE(offset + 5),
        // la largeur.
        width: buffer.readUInt16BE(offset + 7),
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Passe au segment suivant.
    offset += 2 + length;
  // Fin de la boucle.
  }

  // Rien trouvé : null.
  return null;
// Fin de readJpeg.
}

// ===========================================================================
// tile-math.ts — grilles, bbox et projections des tuiles
// ===========================================================================

// Latitude maximale du Web Mercator.
export const MAX_MERCATOR_LAT = 85.05112878;
// Rayon utilisé par le Web Mercator, en mètres.
export const EARTH_RADIUS_M = 6_378_137;

// Tour complet en longitude : 360°.
const FULL_LON_SPAN = 360;
// Étendue en latitude : 180°.
const FULL_LAT_SPAN = 180;

// Forme d'une grille de tuiles.
export interface TileGrid {
  // columns : nombre de colonnes.
  columns: number;
  // rows : nombre de lignes.
  rows: number;
// Fin de TileGrid.
}

// Forme de la position d'une tuile.
export interface TileIndex {
  // x : colonne.
  x: number;
  // y : ligne.
  y: number;
// Fin de TileIndex.
}

// Forme d'une plage de tuiles.
export interface TileIndexRange {
  // minX : première colonne.
  minX: number;
  // maxX : dernière colonne.
  maxX: number;
  // minY : première ligne.
  minY: number;
  // maxY : dernière ligne.
  maxY: number;
// Fin de TileIndexRange.
}

// Forme des bornes de zoom d'une couche.
export interface TileCoordinateCheck {
  // minZoom : niveau minimal.
  minZoom: number;
  // maxZoom : niveau maximal.
  maxZoom: number;
// Fin de TileCoordinateCheck.
}

// Fonction normalizeLon : ramène une longitude entre −180° et 180°.
export function normalizeLon(lon: number): number {
  // Valeur non finie :
  if (!Number.isFinite(lon)) {
    // 0.
    return 0;
  // Fin du cas.
  }

  // Ramène la valeur dans l'intervalle, par deux modulos.
  let value = ((((lon + 180) % 360) + 360) % 360) - 180;
  // Si elle tombe sur −180 alors que la longitude était positive,
  if (Object.is(value, -180) && lon > 0) {
    // on garde 180.
    value = 180;
  // Fin du cas.
  }
  // Renvoie la valeur.
  return value;
// Fin de normalizeLon.
}

// Fonction clampLat : borne une latitude.
export function clampLat(lat: number, scheme: TileScheme): number {
  // Valeur non finie :
  if (!Number.isFinite(lat)) {
    // 0.
    return 0;
  // Fin du cas.
  }

  // Limite : celle du Web Mercator, ou 90°.
  const limit = scheme === 'web-mercator' ? MAX_MERCATOR_LAT : 90;
  // Renvoie la latitude bornée.
  return Math.min(Math.max(lat, -limit), limit);
// Fin de clampLat.
}

// Fonction tileGrid : la grille d'un niveau.
export function tileGrid(scheme: TileScheme, zoom: number): TileGrid {
  // En Web Mercator :
  if (scheme === 'web-mercator') {
    // côté de 2^zoom tuiles ;
    const side = 2 ** zoom;
    // autant de colonnes que de lignes.
    return { columns: side, rows: side };
  // Fin du cas.
  }

  // Sinon (plate carrée) : 2^(zoom+1) colonnes et 2^zoom lignes.
  return { columns: 2 ** (zoom + 1), rows: 2 ** zoom };
// Fin de tileGrid.
}

// Fonction tileBBox ; ses paramètres :
export function tileBBox(
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'emprise de la tuile, en degrés.
): BBox {
  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);

  // En Web Mercator :
  if (scheme === 'web-mercator') {
    // largeur d'une tuile, en degrés ;
    const lonSpan = FULL_LON_SPAN / grid.columns;
    // tour du monde, en mètres ;
    const world = 2 * Math.PI * EARTH_RADIUS_M;
    // hauteur d'une tuile, en mètres.
    const span = world / grid.rows;

    // Bord ouest.
    const west = -180 + x * lonSpan;
    // Bord nord, en mètres.
    const northY = Math.PI * EARTH_RADIUS_M - y * span;
    // Bord sud, en mètres.
    const southY = Math.PI * EARTH_RADIUS_M - (y + 1) * span;

    // Renvoie
    return {
      // l'ouest ;
      west,
      // l'est ;
      east: west + lonSpan,
      // le nord, converti en latitude ;
      north: mercatorToLat(northY),
      // le sud, converti en latitude.
      south: mercatorToLat(southY),
    // Fin de l'objet.
    };
  // Fin du cas.
  }

  // Sinon : largeur d'une tuile, en degrés ;
  const lonSpan = FULL_LON_SPAN / grid.columns;
  // hauteur d'une tuile, en degrés ;
  const latSpan = FULL_LAT_SPAN / grid.rows;
  // bord ouest ;
  const west = -180 + x * lonSpan;
  // bord nord.
  const north = 90 - y * latSpan;

  // Renvoie
  return {
    // l'ouest ;
    west,
    // l'est ;
    east: west + lonSpan,
    // le nord ;
    north,
    // le sud.
    south: north - latSpan,
  // Fin de l'objet.
  };
// Fin de tileBBox.
}

// Fonction tileCenter ; ses paramètres :
export function tileCenter(
  // le découpage ;
  scheme: TileScheme,
  // l'emprise.
  bbox: BBox,
// Elle renvoie la longitude et la latitude du centre.
): { lon: number; lat: number } {
  // Longitude : le milieu, à 6 décimales.
  const lon = round((bbox.west + bbox.east) / 2, 6);
  // Latitude :
  const lat =
    // en Web Mercator,
    scheme === 'web-mercator'
      // la latitude
      ? mercatorToLat(
          // du milieu calculé en mètres ;
          (latToMercatorY(bbox.north) + latToMercatorY(bbox.south)) / 2,
        // fin du calcul ;
        )
      // sinon le milieu, à 6 décimales.
      : round((bbox.south + bbox.north) / 2, 6);

  // Renvoie le centre.
  return { lon, lat };
// Fin de tileCenter.
}

// Fonction tileFromLonLat ; ses paramètres :
export function tileFromLonLat(
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la longitude ;
  lon: number,
  // la latitude.
  lat: number,
// Elle renvoie la tuile qui contient ce point.
): TileIndex {
  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);
  // Longitude ramenée entre −180° et 180°.
  const safeLon = normalizeLon(lon);
  // Latitude bornée.
  const safeLat = clampLat(lat, scheme);

  // Colonne.
  const x = Math.floor(((safeLon + 180) / FULL_LON_SPAN) * grid.columns);

  // Ligne.
  let y: number;
  // En Web Mercator :
  if (scheme === 'web-mercator') {
    // sinus de la latitude ;
    const sin = Math.sin((safeLat * Math.PI) / 180);
    // ligne :
    y = Math.floor(
      // formule du Web Mercator.
      ((1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2) * grid.rows,
    // Fin du calcul.
    );
  // Sinon :
  } else {
    // ligne : part de la distance au pôle Nord.
    y = Math.floor(((90 - safeLat) / FULL_LAT_SPAN) * grid.rows);
  // Fin du choix.
  }

  // Renvoie
  return {
    // la colonne, gardée dans la grille ;
    x: clampIndex(x, grid.columns),
    // la ligne, gardée dans la grille.
    y: clampIndex(y, grid.rows),
  // Fin de l'objet.
  };
// Fin de tileFromLonLat.
}

// Fonction tilesForBBox ; ses paramètres :
export function tilesForBBox(
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // l'emprise.
  bbox: BBox,
// Elle renvoie la plage de tuiles qui la couvre.
): TileIndexRange {
  // Emprise bornée.
  const safe = clampBBox(bbox, scheme);
  // Tuile du coin nord-ouest.
  const topLeft = tileFromLonLat(scheme, zoom, safe.west, safe.north);
  // Tuile du coin sud-est.
  const bottomRight = tileFromLonLat(scheme, zoom, safe.east, safe.south);
  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);

  // Première colonne.
  const minX = Math.min(topLeft.x, bottomRight.x);
  // Dernière colonne.
  const maxX = Math.max(topLeft.x, bottomRight.x);
  // Première ligne.
  const minY = Math.min(topLeft.y, bottomRight.y);
  // Dernière ligne.
  const maxY = Math.max(topLeft.y, bottomRight.y);

  // Renvoie
  return {
    // la première colonne, gardée dans la grille ;
    minX: clampIndex(minX, grid.columns),
    // la dernière colonne ;
    maxX: clampIndex(maxX, grid.columns),
    // la première ligne ;
    minY: clampIndex(minY, grid.rows),
    // la dernière ligne.
    maxY: clampIndex(maxY, grid.rows),
  // Fin de l'objet.
  };
// Fin de tilesForBBox.
}

// Fonction clampBBox : borne une emprise.
export function clampBBox(bbox: BBox, scheme: TileScheme): BBox {
  // Ouest, entre −180° et 180°.
  let west = Math.min(Math.max(bbox.west, -180), 180);
  // Est, entre −180° et 180°.
  let east = Math.min(Math.max(bbox.east, -180), 180);

  // S'ils sont inversés,
  if (west > east) {
    // les échange.
    [west, east] = [east, west];
  // Fin du cas.
  }

  // Limite en latitude : celle du Web Mercator, ou 90°.
  const southLimit = scheme === 'web-mercator' ? MAX_MERCATOR_LAT : 90;
  // Sud, borné.
  let south = Math.min(Math.max(bbox.south, -southLimit), southLimit);
  // Nord, borné.
  let north = Math.min(Math.max(bbox.north, -southLimit), southLimit);

  // S'ils sont inversés,
  if (south > north) {
    // les échange.
    [south, north] = [north, south];
  // Fin du cas.
  }

  // Renvoie l'emprise.
  return { west, south, east, north };
// Fin de clampBBox.
}

// Fonction projectBBox ; ses paramètres :
export function projectBBox(
  // le découpage ;
  scheme: TileScheme,
  // l'emprise ;
  bbox: BBox,
  // la projection.
  crs: string,
// Elle renvoie l'emprise en mètres, ou null.
): ProjectedBBox | null {
  // Hors Web Mercator :
  if (scheme !== 'web-mercator') {
    // null.
    return null;
  // Fin du cas.
  }

  // Emprise bornée.
  const safe = clampBBox(bbox, scheme);

  // Renvoie
  return {
    // le bord ouest en mètres, à 3 décimales ;
    minX: round(lonToMercatorX(safe.west), 3),
    // le bord sud ;
    minY: round(latToMercatorY(safe.south), 3),
    // le bord est ;
    maxX: round(lonToMercatorX(safe.east), 3),
    // le bord nord ;
    maxY: round(latToMercatorY(safe.north), 3),
    // la projection.
    crs,
  // Fin de l'objet.
  };
// Fin de projectBBox.
}

// Fonction validateTileCoordinates ; ses paramètres :
export function validateTileCoordinates(
  // le fournisseur ;
  provider: string,
  // la couche ;
  layer: string,
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne ;
  y: number,
  // les bornes de zoom.
  bounds: TileCoordinateCheck,
// Elle renvoie un message d'erreur, ou null si tout est valide.
): string | null {
  // Niveau non entier :
  if (!Number.isInteger(zoom)) {
    // message.
    return 'Le niveau de zoom doit être un entier.';
  // Fin du cas.
  }

  // Niveau hors des bornes :
  if (zoom < bounds.minZoom || zoom > bounds.maxZoom) {
    // message, avec la plage permise.
    return `Zoom ${zoom} hors plage pour ${provider}/${layer} (${bounds.minZoom}–${bounds.maxZoom}).`;
  // Fin du cas.
  }

  // Colonne ou ligne non entière :
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    // message.
    return 'Les indices de tuile x et y doivent être des entiers.';
  // Fin du cas.
  }

  // Grille du niveau.
  const grid = tileGrid(scheme, zoom);
  // Tuile hors de la grille :
  if (x < 0 || x >= grid.columns || y < 0 || y >= grid.rows) {
    // message, avec la taille de la grille.
    return `Tuile ${zoom}/${x}/${y} hors du quadrillage ${grid.columns}×${grid.rows}.`;
  // Fin du cas.
  }

  // Tout est valide : null.
  return null;
// Fin de validateTileCoordinates.
}

// Fonction lonToMercatorX.
export function lonToMercatorX(lon: number): number {
  // Longitude en mètres.
  return (lon * Math.PI * EARTH_RADIUS_M) / 180;
// Fin de lonToMercatorX.
}

// Fonction latToMercatorY.
export function latToMercatorY(lat: number): number {
  // Latitude bornée à celle du Web Mercator.
  const safe = Math.min(Math.max(lat, -MAX_MERCATOR_LAT), MAX_MERCATOR_LAT);
  // En radians.
  const rad = (safe * Math.PI) / 180;
  // Formule du Web Mercator, en mètres.
  return EARTH_RADIUS_M * Math.log(Math.tan(Math.PI / 4 + rad / 2));
// Fin de latToMercatorY.
}

// Fonction mercatorToLat.
export function mercatorToLat(y: number): number {
  // Latitude, en degrés :
  const value =
    // formule inverse du Web Mercator,
    (2 * Math.atan(Math.exp(y / EARTH_RADIUS_M)) - Math.PI / 2) *
    // convertie des radians en degrés.
    (180 / Math.PI);
  // La renvoie à 6 décimales.
  return round(value, 6);
// Fin de mercatorToLat.
}

// Fonction clampIndex.
function clampIndex(value: number, size: number): number {
  // Garde la valeur entre 0 et la taille moins 1.
  return Math.min(Math.max(value, 0), Math.max(size - 1, 0));
// Fin de clampIndex.
}

// Fonction round.
function round(value: number, digits: number): number {
  // Puissance de 10 du nombre de décimales.
  const factor = 10 ** digits;
  // Arrondi.
  const rounded = Math.round(value * factor) / factor;
  // Renvoie 0 plutôt que −0.
  return Object.is(rounded, -0) ? 0 : rounded;
// Fin de round.
}

// ===========================================================================
// tile-url.ts — construction des URL amont (WMTS, WMS, XYZ, ArcGIS)
// ===========================================================================

// Fonction buildTileUrl ; ses paramètres :
export function buildTileUrl(
  // le fournisseur ;
  provider: ProviderDefinition,
  // la couche ;
  layer: CuratedLayer,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la tuile chez la source.
): string {
  // Couche sans tuiles 2D :
  if (layer.scheme === 'none') {
    // erreur,
    throw new Error(
      // avec ce message.
      `${provider.id}/${layer.id} est un jeu 3D Tiles : aucune tuile 2D à construire.`,
    // Fin de l'erreur.
    );
  // Fin du cas.
  }

  // Couche WMTS :
  if (layer.kind === 'wmts' && layer.wmts) {
    // renvoie, joints par des « / »,
    return [
      // l'adresse de base,
      layer.wmts.baseUrl,
      // le style,
      layer.wmts.style,
      // le jeu de tuiles,
      layer.wmts.matrixSet,
      // le niveau,
      zoom,
      // la ligne,
      y,
      // et la colonne avec l'extension.
      `${x}.${layer.wmts.extension}`,
    // Fin de l'adresse.
    ].join('/');
  // Fin du cas.
  }

  // Couche ArcGIS ImageServer :
  if (layer.kind === 'arcgis-image' && layer.arcgis) {
    // renvoie l'adresse de la requête d'export.
    return buildArcgisExportUrl(layer, layer.scheme, zoom, x, y);
  // Fin du cas.
  }

  // Couche WMS :
  if (layer.kind === 'wms' && layer.wms) {
    // renvoie l'adresse de la requête GetMap.
    return buildWmsGetMapUrl(layer, layer.scheme, zoom, x, y);
  // Fin du cas.
  }

  // Couche XYZ :
  if (layer.kind === 'xyz' && layer.xyz) {
    // grille du niveau ;
    const grid = tileGrid(layer.scheme, zoom);
    // ligne : comptée depuis le bas si la source est en TMS, sinon telle quelle.
    const tileY = layer.xyz.tms ? grid.rows - 1 - y : y;

    // Renvoie le modèle d'adresse,
    return layer.xyz.urlTemplate
      // avec le niveau,
      .replaceAll('{z}', String(zoom))
      // la colonne,
      .replaceAll('{x}', String(x))
      // et la ligne.
      .replaceAll('{y}', String(tileY));
  // Fin du cas.
  }

  // Aucun cas : erreur,
  throw new Error(
    // avec ce message.
    `Aucune source de tuiles configurée pour ${provider.id}/${layer.id}.`,
  // Fin de l'erreur.
  );
// Fin de buildTileUrl.
}

// Fonction buildProxyUrl ; ses paramètres :
export function buildProxyUrl(
  // le fournisseur ;
  provider: ProviderDefinition,
  // la couche ;
  layer: CuratedLayer,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la tuile sur ce serveur.
): string {
  // Le chemin de l'API de la Lune, avec le fournisseur, la couche et la tuile.
  return `/api/v1/moon/providers/${provider.id}/layers/${layer.id}/tile/${zoom}/${x}/${y}`;
// Fin de buildProxyUrl.
}

// Fonction buildArcgisExportUrl ; ses paramètres :
function buildArcgisExportUrl(
  // la couche ;
  layer: CuratedLayer,
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la requête d'export.
): string {
  // Réglages ArcGIS de la couche.
  const arcgis = layer.arcgis;
  // Absents :
  if (!arcgis) {
    // erreur.
    throw new Error(`Configuration ArcGIS ImageServer manquante pour ${layer.id}.`);
  // Fin du cas.
  }

  // Emprise de la tuile.
  const bbox = tileBBox(scheme, zoom, x, y);
  // Paramètres de la requête :
  const params = new URLSearchParams({
    // l'emprise : ouest, sud, est, nord,
    bbox: [bbox.west, bbox.south, bbox.east, bbox.north]
      // chaque nombre mis en forme,
      .map(formatNumber)
      // séparés par des virgules ;
      .join(','),
    // la projection de l'emprise ;
    bboxSR: arcgis.bboxSrs,
    // la projection de l'image ;
    imageSR: arcgis.imageSrs,
    // la taille de l'image ;
    size: `${layer.tileSize},${layer.tileSize}`,
    // le format ;
    format: arcgis.format,
    // l'interpolation ;
    interpolation: arcgis.interpolation,
    // la réponse en image.
    f: 'image',
  // Fin des paramètres.
  });

  // Renvoie l'adresse d'export suivie des paramètres.
  return `${arcgis.exportImageUrl}?${params.toString()}`;
// Fin de buildArcgisExportUrl.
}

// Fonction buildWmsGetMapUrl ; ses paramètres :
function buildWmsGetMapUrl(
  // la couche ;
  layer: CuratedLayer,
  // le découpage ;
  scheme: TileScheme,
  // le niveau ;
  zoom: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie l'adresse de la requête.
): string {
  // Réglages WMS de la couche.
  const wms = layer.wms;
  // Absents :
  if (!wms) {
    // erreur.
    throw new Error(`Configuration WMS manquante pour ${layer.id}.`);
  // Fin du cas.
  }

  // Emprise de la tuile.
  const bbox = tileBBox(scheme, zoom, x, y);
  // Paramètres de la requête :
  const params = new URLSearchParams({
    // le service WMS ;
    SERVICE: 'WMS',
    // sa version ;
    VERSION: wms.version,
    // la requête GetMap ;
    REQUEST: 'GetMap',
    // la couche de la source ;
    LAYERS: layer.upstreamLayer,
    // aucun style ;
    STYLES: '',
    // la largeur ;
    WIDTH: String(layer.tileSize),
    // la hauteur ;
    HEIGHT: String(layer.tileSize),
    // le format ;
    FORMAT: layer.format,
    // le fond transparent.
    TRANSPARENT: 'TRUE',
  // Fin des paramètres.
  });

  // En version 1.3.0 :
  if (wms.version === '1.3.0') {
    // la projection s'appelle CRS ;
    params.set('CRS', wms.srs);
  // sinon
  } else {
    // elle s'appelle SRS.
    params.set('SRS', wms.srs);
  // Fin du choix.
  }

  // Ordre des bords de l'emprise :
  const axes =
    // si la source attend la latitude d'abord :
    wms.axisOrder === 'yx'
      // sud, ouest, nord, est ;
      ? [bbox.south, bbox.west, bbox.north, bbox.east]
      // sinon : ouest, sud, est, nord.
      : [bbox.west, bbox.south, bbox.east, bbox.north];
  // Ajoute l'emprise, les nombres séparés par des virgules.
  params.set('BBOX', axes.map(formatNumber).join(','));

  // Séparateur : « & » si l'adresse a déjà un « ? », sinon « ? ».
  const separator = wms.getMapUrl.includes('?') ? '&' : '?';
  // Renvoie l'adresse suivie des paramètres.
  return `${wms.getMapUrl}${separator}${params.toString()}`;
// Fin de buildWmsGetMapUrl.
}

// Fonction formatNumber.
function formatNumber(value: number): string {
  // Arrondit à 8 décimales et retire les zéros de fin.
  return String(Number(value.toFixed(8)));
// Fin de formatNumber.
}

// ===========================================================================
// moon.config.ts — configuration par variables d'environnement
// ===========================================================================

// Jeton d'injection de la configuration de la Lune.
export const MOON_CONFIG = Symbol('MOON_CONFIG');

// Forme de la configuration de la Lune.
export interface MoonConfig {
  // trekBaseUrl : adresse des tuiles de NASA Trek.
  trekBaseUrl: string;
  // trekProduct : produit Trek.
  trekProduct: string;
  // trekStyle : style Trek.
  trekStyle: string;
  // trekMatrixSet : jeu de tuiles Trek.
  trekMatrixSet: string;
  // trekMaxZoom : niveau maximal de Trek.
  trekMaxZoom: number;
  // trekImageServerBaseUrl : adresse des services ArcGIS de NASA Trek.
  trekImageServerBaseUrl: string;
  // trekTerrainMaxZoom : niveau maximal du relief de Trek.
  trekTerrainMaxZoom: number;
  // usgsBaseUrl : adresse du service de l'USGS.
  usgsBaseUrl: string;
  // usgsMap : carte de l'USGS.
  usgsMap: string;
  // usgsMaxZoom : niveau maximal de l'USGS.
  usgsMaxZoom: number;
  // lrocCapabilitiesUrl : adresse des capacités de LROC Lunaserv.
  lrocCapabilitiesUrl: string;
  // lrocGetMapUrl : adresse de ses requêtes GetMap.
  lrocGetMapUrl: string;
  // lrocMaxZoom : son niveau maximal.
  lrocMaxZoom: number;
  // opmTileUrl : modèle d'adresse des tuiles OpenPlanetaryMap.
  opmTileUrl: string;
  // opmMaxZoom : leur niveau maximal.
  opmMaxZoom: number;
  // httpTimeoutMs : délai maximal d'un appel.
  httpTimeoutMs: number;
  // healthTimeoutMs : délai maximal d'un test de santé.
  healthTimeoutMs: number;
  // userAgent : en-tête User-Agent envoyé aux sources.
  userAgent: string;
  // tileCacheEntries : nombre de tuiles gardées en cache.
  tileCacheEntries: number;
  // tileCacheTtlMs : durée de vie d'une tuile en cache.
  tileCacheTtlMs: number;
  // capabilitiesCacheTtlMs : durée de vie des capacités en cache.
  capabilitiesCacheTtlMs: number;
  // maxUpstreamBytes : taille maximale d'une réponse d'une source.
  maxUpstreamBytes: number;
// Fin de MoonConfig.
}

// Fonction readString ; ses paramètres :
function readString(
  // l'environnement ;
  env: NodeJS.ProcessEnv,
  // le nom de la variable ;
  name: string,
  // la valeur par défaut.
  fallback: string,
// Elle renvoie un texte.
): string {
  // Valeur de la variable, sans ses espaces.
  const value = env[name]?.trim();
  // La renvoie si elle n'est pas vide, sinon la valeur par défaut.
  return value ? value : fallback;
// Fin de readString.
}

// Fonction readInt ; ses paramètres :
function readInt(
  // l'environnement ;
  env: NodeJS.ProcessEnv,
  // le nom de la variable ;
  name: string,
  // la valeur par défaut ;
  fallback: number,
  // le minimum ;
  min: number,
  // le maximum.
  max: number,
// Elle renvoie un nombre.
): number {
  // Valeur de la variable, sans ses espaces.
  const raw = env[name]?.trim();
  // Vide :
  if (!raw) {
    // la valeur par défaut.
    return fallback;
  // Fin du cas.
  }

  // La convertit en nombre.
  const value = Number(raw);
  // Pas un entier, ou hors des bornes :
  if (!Number.isInteger(value) || value < min || value > max) {
    // la valeur par défaut.
    return fallback;
  // Fin du cas.
  }

  // Renvoie le nombre.
  return value;
// Fin de readInt.
}

// Fonction loadMoonConfig ; son paramètre :
export function loadMoonConfig(
  // l'environnement, celui du processus par défaut.
  env: NodeJS.ProcessEnv = process.env,
// Elle renvoie la configuration.
): MoonConfig {
  // Renvoie :
  return {
    // l'adresse de NASA Trek, lue
    trekBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_TREK_BASE_URL',
      // avec cette valeur par défaut ;
      'https://trek.nasa.gov/tiles/Moon/EQ',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // Le produit Trek, lu
    trekProduct: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_TREK_PRODUCT',
      // par défaut la mosaïque LRO WAC à 303 pixels par degré.
      'LRO_WAC_Mosaic_Global_303ppd_v02',
    // Fin de la lecture.
    ),
    // Le style Trek, « default » par défaut.
    trekStyle: readString(env, 'MOON_TREK_STYLE', 'default'),
    // Le jeu de tuiles Trek.
    trekMatrixSet: readString(env, 'MOON_TREK_MATRIX_SET', 'default028mm'),
    // Le niveau maximal de Trek : 8 par défaut, de 0 à 14.
    trekMaxZoom: readInt(env, 'MOON_TREK_MAX_ZOOM', 8, 0, 14),
    // L'adresse des services ArcGIS de NASA Trek, lue
    trekImageServerBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_TREK_IMAGESERVER_BASE_URL',
      // avec cette valeur par défaut ;
      'https://trek.nasa.gov/moon/trekarcgis/rest/services',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // Le niveau maximal du relief de Trek : 8 par défaut, de 0 à 14.
    trekTerrainMaxZoom: readInt(env, 'MOON_TREK_TERRAIN_MAX_ZOOM', 8, 0, 14),
    // L'adresse de l'USGS, lue
    usgsBaseUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_USGS_BASE_URL',
      // avec cette valeur par défaut ;
      'https://planetarymaps.usgs.gov/cgi-bin/mapserv',
    // les barres finales sont retirées.
    ).replace(/\/+$/, ''),
    // La carte de l'USGS.
    usgsMap: readString(env, 'MOON_USGS_MAP', '/maps/earth/moon_simp_cyl.map'),
    // Le niveau maximal de l'USGS : 7 par défaut, de 0 à 12.
    usgsMaxZoom: readInt(env, 'MOON_USGS_MAX_ZOOM', 7, 0, 12),
    // L'adresse des capacités de LROC Lunaserv, lue
    lrocCapabilitiesUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_LROC_CAPABILITIES_URL',
      // avec cette valeur par défaut.
      'https://wms.im-ldi.com/lunaserv/wms',
    // Fin de la lecture.
    ),
    // L'adresse des requêtes GetMap de LROC Lunaserv, lue
    lrocGetMapUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_LROC_GETMAP_URL',
      // avec cette valeur par défaut.
      'https://wms.im-ldi.com/',
    // Fin de la lecture.
    ),
    // Le niveau maximal de LROC Lunaserv : 7 par défaut, de 0 à 12.
    lrocMaxZoom: readInt(env, 'MOON_LROC_MAX_ZOOM', 7, 0, 12),
    // Le modèle d'adresse OpenPlanetaryMap, lu
    opmTileUrl: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_OPM_TILE_URL',
      // avec cette valeur par défaut.
      'https://cartocdn-gusc.global.ssl.fastly.net/opmbuilder/api/v1/map/named/opm-moon-basemap-v0-1/all/{z}/{x}/{y}.png',
    // Fin de la lecture.
    ),
    // Le niveau maximal d'OpenPlanetaryMap : 7 par défaut, de 0 à 14.
    opmMaxZoom: readInt(env, 'MOON_OPM_MAX_ZOOM', 7, 0, 14),
    // Le délai d'un appel : 20 s par défaut, de 1 s à 120 s.
    httpTimeoutMs: readInt(env, 'MOON_HTTP_TIMEOUT_MS', 20_000, 1_000, 120_000),
    // Le délai d'un test de santé, lu
    healthTimeoutMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_HEALTH_TIMEOUT_MS',
      // 10 s par défaut,
      10_000,
      // 1 s au moins,
      1_000,
      // 60 s au plus.
      60_000,
    // Fin de la lecture.
    ),
    // L'en-tête User-Agent, lu
    userAgent: readString(
      // dans l'environnement,
      env,
      // sous ce nom,
      'MOON_USER_AGENT',
      // avec cette valeur par défaut.
      'space-backend-moon/1.0 (+https://nestjs.com)',
    // Fin de la lecture.
    ),
    // Le nombre de tuiles en cache, lu
    tileCacheEntries: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_TILE_CACHE_ENTRIES',
      // 1 024 par défaut,
      1_024,
      // 1 au moins,
      1,
      // 8 192 au plus.
      8_192,
    // Fin de la lecture.
    ),
    // La durée de vie d'une tuile, lue
    tileCacheTtlMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_TILE_CACHE_TTL_MS',
      // un jour par défaut,
      86_400_000,
      // 1 s au moins,
      1_000,
      // 30 jours au plus.
      30 * 86_400_000,
    // Fin de la lecture.
    ),
    // La durée de vie des capacités, lue
    capabilitiesCacheTtlMs: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_CAPABILITIES_CACHE_TTL_MS',
      // une heure par défaut,
      3_600_000,
      // 1 s au moins,
      1_000,
      // 7 jours au plus.
      7 * 86_400_000,
    // Fin de la lecture.
    ),
    // La taille maximale d'une réponse, lue
    maxUpstreamBytes: readInt(
      // dans l'environnement,
      env,
      // sous ce nom ;
      'MOON_MAX_UPSTREAM_BYTES',
      // 8 Mo par défaut,
      8_000_000,
      // 1 ko au moins,
      1_024,
      // 64 Mo au plus.
      64_000_000,
    // Fin de la lecture.
    ),
  // Fin de l'objet.
  };
// Fin de loadMoonConfig.
}

// ===========================================================================
// upstream.service.ts — requêtes vers les services amont (NASA, USGS…)
// ===========================================================================

// Forme des options d'un appel.
export interface UpstreamRequestOptions {
  // timeoutMs : délai maximal (facultatif).
  timeoutMs?: number;
  // maxBytes : taille maximale de la réponse (facultatif).
  maxBytes?: number;
  // accept : en-tête Accept (facultatif).
  accept?: string;
  // headers : autres en-têtes (facultatif).
  headers?: Record<string, string>;
// Fin de UpstreamRequestOptions.
}

// Forme d'une réponse.
export interface UpstreamResponse {
  // url : l'adresse appelée.
  url: string;
  // status : le code HTTP.
  status: number;
  // contentType : le type de contenu.
  contentType: string | null;
  // contentLength : la taille annoncée.
  contentLength: number | null;
  // etag : l'en-tête ETag.
  etag: string | null;
  // lastModified : la date de dernière modification.
  lastModified: string | null;
  // cacheControl : l'en-tête Cache-Control.
  cacheControl: string | null;
  // buffer : les octets.
  buffer: Buffer;
  // bytes : leur nombre.
  bytes: number;
  // durationMs : la durée de la lecture.
  durationMs: number;
// Fin de UpstreamResponse.
}

// Forme d'une réponse JSON : une réponse, plus
export interface UpstreamJsonResponse<T> extends UpstreamResponse {
  // data : les données lues.
  data: T;
// Fin de UpstreamJsonResponse.
}

// Forme du résultat d'un test.
export interface UpstreamProbe {
  // url : l'adresse testée.
  url: string;
  // status : le code HTTP, ou null.
  status: number | null;
  // ok : réussi ou non.
  ok: boolean;
  // contentType : le type de contenu.
  contentType: string | null;
  // latencyMs : la durée du test.
  latencyMs: number;
  // error : l'erreur, ou null.
  error: string | null;
// Fin de UpstreamProbe.
}

// Forme des options d'un test.
export interface UpstreamProbeOptions {
  // timeoutMs : délai maximal (facultatif).
  timeoutMs?: number;
  // accept : en-tête Accept (facultatif).
  accept?: string;
  // headers : autres en-têtes (facultatif).
  headers?: Record<string, string>;
// Fin de UpstreamProbeOptions.
}

// Classe MoonUpstreamError : l'erreur d'un serveur source.
export class MoonUpstreamError extends Error {
  // Constructeur ; ses paramètres :
  constructor(
    // le message ;
    message: string,
    // le code HTTP, gardé ;
    readonly status: number,
    // l'adresse, gardée.
    readonly url: string,
  // Corps du constructeur :
  ) {
    // passe le message à Error ;
    super(message);
    // fixe le nom de l'erreur.
    this.name = 'MoonUpstreamError';
  // Fin du constructeur.
  }
// Fin de la classe.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des appels aux serveurs sources de la Lune.
export class MoonUpstreamService {
  // Constructeur : la configuration, demandée par son jeton.
  constructor(@Inject(MOON_CONFIG) private readonly config: MoonConfig) {}

  // Méthode fetchBinary ; ses paramètres :
  async fetchBinary(
    // l'adresse ;
    url: string,
    // les options, vides par défaut.
    options: UpstreamRequestOptions = {},
  // Elle renvoie la réponse.
  ): Promise<UpstreamResponse> {
    // Envoie la requête.
    const response = await this.request(url, options);
    // Lit le corps et renvoie la réponse.
    return this.readBody(response, url, options);
  // Fin de fetchBinary.
  }

  // Méthode fetchText ; ses paramètres :
  async fetchText(
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamRequestOptions = {},
  // Elle renvoie la réponse, plus son texte.
  ): Promise<UpstreamResponse & { text: string }> {
    // Télécharge les octets.
    const result = await this.fetchBinary(url, options);
    // Y ajoute le texte, lu en UTF-8.
    return { ...result, text: result.buffer.toString('utf8') };
  // Fin de fetchText.
  }

  // Méthode fetchJson ; ses paramètres :
  async fetchJson<T>(
    // l'adresse ;
    url: string,
    // les options, avec un jeton d'accès facultatif.
    options: UpstreamRequestOptions & { token?: string } = {},
  // Elle renvoie la réponse, plus ses données.
  ): Promise<UpstreamJsonResponse<T>> {
    // Copie des en-têtes.
    const headers = { ...options.headers };
    // S'il y a un jeton,
    if (options.token) {
      // ajoute l'en-tête Authorization.
      headers.Authorization = `Bearer ${options.token}`;
    // Fin du cas.
    }

    // Télécharge les octets, avec
    const result = await this.fetchBinary(url, {
      // les options,
      ...options,
      // les en-têtes,
      headers,
      // et l'en-tête Accept, JSON par défaut.
      accept: options.accept ?? 'application/json',
    // Fin du téléchargement.
    });

    // Essaie
    try {
      // de lire le JSON ;
      const data = JSON.parse(result.buffer.toString('utf8')) as T;
      // et de le renvoyer avec la réponse.
      return { ...result, data };
    // En cas d'échec :
    } catch {
      // erreur de serveur source,
      throw new MoonUpstreamError(
        // avec ce message,
        'La réponse amont n’est pas un JSON valide.',
        // le code 502,
        502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
  // Fin de fetchJson.
  }

  // Méthode probe ; ses paramètres :
  async probe(
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamProbeOptions = {},
  // Elle renvoie le résultat du test.
  ): Promise<UpstreamProbe> {
    // Délai : celui des options, sinon celui des tests de santé.
    const timeoutMs = options.timeoutMs ?? this.config.healthTimeoutMs;
    // Heure de départ.
    const startedAt = Date.now();

    // Essaie :
    try {
      // appelle l'adresse,
      const response = await fetch(url, {
        // en GET,
        method: 'GET',
        // en suivant les redirections,
        redirect: 'follow',
        // avec abandon au bout du délai,
        signal: AbortSignal.timeout(timeoutMs),
        // et ces en-têtes :
        headers: {
          // le User-Agent de la configuration,
          'user-agent': this.config.userAgent,
          // l'en-tête Accept, « tout » par défaut,
          accept: options.accept ?? '*/*',
          // et ceux des options.
          ...options.headers,
        // Fin des en-têtes.
        },
      // Fin de l'appel.
      });

      // Abandonne la lecture du corps.
      await response.body?.cancel();

      // Renvoie
      return {
        // l'adresse ;
        url,
        // le code HTTP ;
        status: response.status,
        // réussi ou non ;
        ok: response.ok,
        // le type de contenu ;
        contentType: normalizeHeader(response.headers.get('content-type')),
        // la durée ;
        latencyMs: Date.now() - startedAt,
        // l'erreur : aucune si c'est réussi, sinon « HTTP <code> ».
        error: response.ok ? null : `HTTP ${response.status}`,
      // Fin de l'objet.
      };
    // En cas d'échec :
    } catch (error) {
      // renvoie
      return {
        // l'adresse ;
        url,
        // pas de code ;
        status: null,
        // non réussi ;
        ok: false,
        // pas de type de contenu ;
        contentType: null,
        // la durée ;
        latencyMs: Date.now() - startedAt,
        // la description de l'erreur.
        error: describeFetchError(error),
      // Fin de l'objet.
      };
    // Fin du cas.
    }
  // Fin de probe.
  }

  // Méthode privée request ; ses paramètres :
  private async request(
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamRequestOptions,
  // Elle renvoie la réponse HTTP.
  ): Promise<Response> {
    // Délai : celui des options, sinon celui de la configuration.
    const timeoutMs = options.timeoutMs ?? this.config.httpTimeoutMs;

    // Réponse HTTP.
    let response: Response;
    // Essaie :
    try {
      // appelle l'adresse,
      response = await fetch(url, {
        // en GET,
        method: 'GET',
        // en suivant les redirections,
        redirect: 'follow',
        // avec abandon au bout du délai,
        signal: AbortSignal.timeout(timeoutMs),
        // et ces en-têtes :
        headers: {
          // le User-Agent de la configuration,
          'user-agent': this.config.userAgent,
          // l'en-tête Accept, « tout » par défaut,
          accept: options.accept ?? '*/*',
          // et ceux des options.
          ...options.headers,
        // Fin des en-têtes.
        },
      // Fin de l'appel.
      });
    // En cas d'échec :
    } catch (error) {
      // erreur de serveur source,
      throw new MoonUpstreamError(
        // avec la description de l'erreur,
        `Requête amont impossible : ${describeFetchError(error)}`,
        // le code 504 si le délai est dépassé, sinon 502,
        error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Réponse en erreur :
    if (!response.ok) {
      // abandonne la lecture du corps ;
      await response.body?.cancel();
      // erreur de serveur source,
      throw new MoonUpstreamError(
        // avec le code reçu dans le message,
        `Le service amont a répondu HTTP ${response.status}.`,
        // ce même code,
        response.status,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Renvoie la réponse.
    return response;
  // Fin de request.
  }

  // Méthode privée readBody ; ses paramètres :
  private async readBody(
    // la réponse HTTP ;
    response: Response,
    // l'adresse ;
    url: string,
    // les options.
    options: UpstreamRequestOptions,
  // Elle renvoie la réponse lue.
  ): Promise<UpstreamResponse> {
    // Taille maximale : celle des options, sinon celle de la configuration.
    const maxBytes = options.maxBytes ?? this.config.maxUpstreamBytes;
    // Taille annoncée,
    const contentLength = readContentLength(
      // lue dans l'en-tête Content-Length.
      response.headers.get('content-length'),
    // Fin de la lecture.
    );

    // Taille annoncée trop grande :
    if (contentLength !== null && contentLength > maxBytes) {
      // abandonne la lecture du corps ;
      await response.body?.cancel();
      // erreur de serveur source,
      throw new MoonUpstreamError(
        // « Réponse amont trop volumineuse »,
        `Réponse amont trop volumineuse (${contentLength} octets, limite ${maxBytes}).`,
        // le code 502,
        502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Heure de départ.
    const startedAt = Date.now();
    // Lit les octets.
    const buffer = Buffer.from(await response.arrayBuffer());
    // Durée de la lecture.
    const durationMs = Date.now() - startedAt;

    // Taille réelle trop grande :
    if (buffer.length > maxBytes) {
      // erreur de serveur source,
      throw new MoonUpstreamError(
        // « Réponse amont trop volumineuse »,
        `Réponse amont trop volumineuse (${buffer.length} octets, limite ${maxBytes}).`,
        // le code 502,
        502,
        // et l'adresse.
        url,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Renvoie
    return {
      // l'adresse ;
      url,
      // le code HTTP ;
      status: response.status,
      // le type de contenu ;
      contentType: normalizeHeader(response.headers.get('content-type')),
      // la taille annoncée ;
      contentLength,
      // l'ETag ;
      etag: normalizeHeader(response.headers.get('etag')),
      // la date de dernière modification ;
      lastModified: normalizeHeader(response.headers.get('last-modified')),
      // l'en-tête Cache-Control ;
      cacheControl: normalizeHeader(response.headers.get('cache-control')),
      // les octets ;
      buffer,
      // leur nombre ;
      bytes: buffer.length,
      // la durée de la lecture.
      durationMs,
    // Fin de l'objet.
    };
  // Fin de readBody.
  }
// Fin du service.
}

// Fonction normalizeHeader.
function normalizeHeader(value: string | null): string | null {
  // Valeur absente :
  if (!value) {
    // null.
    return null;
  // Fin du cas.
  }
  // Retire les espaces des bords.
  const trimmed = value.trim();
  // La renvoie, ou null si elle est vide.
  return trimmed.length > 0 ? trimmed : null;
// Fin de normalizeHeader.
}

// Fonction readContentLength.
function readContentLength(value: string | null): number | null {
  // Valeur absente :
  if (!value) {
    // null.
    return null;
  // Fin du cas.
  }

  // La lit comme un entier.
  const parsed = Number.parseInt(value, 10);
  // Le renvoie s'il est fini et positif ou nul, sinon null.
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
// Fin de readContentLength.
}

// Fonction describeFetchError.
function describeFetchError(error: unknown): string {
  // Si c'est une erreur :
  if (error instanceof Error) {
    // délai dépassé ou abandon :
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      // « délai d'attente dépassé ».
      return 'délai d’attente dépassé';
    // Fin du cas.
    }
    // Sinon son message.
    return error.message;
  // Fin du cas.
  }

  // Sinon son texte.
  return String(error);
// Fin de describeFetchError.
}

// ===========================================================================
// moon-catalog.service.ts — catalogue des fournisseurs et couches lunaires
// (reconstruit : le fichier d'origine n'était plus disponible)
// ===========================================================================

/**
 * Construit les définitions des fournisseurs à partir de la configuration.
 * Chaque couche décrit sa source amont (WMTS, WMS, XYZ, ArcGIS ou 3D Tiles) ;
 * les URL réelles sont construites par buildTileUrl().
 */
// Fonction buildProviders : construit les fournisseurs à partir de la configuration.
export function buildProviders(config: MoonConfig): ProviderDefinition[] {
  // Mention de NASA Moon Trek :
  const trekAttribution =
    // son texte.
    'NASA/JPL-Caltech — Moon Trek (https://trek.nasa.gov/moon/)';
  // Mention de l'USGS :
  const usgsAttribution =
    // son texte.
    'USGS Astrogeology Science Center (https://astrogeology.usgs.gov/)';
  // Mention de LROC Lunaserv.
  const lrocAttribution = 'LROC/Arizona State University — LunaServ WMS';
  // Mention d'OpenPlanetaryMap.
  const opmAttribution = 'OpenPlanetaryMap — basemap lunaire communautaire';

  // Fonds de carte supplémentaires des mêmes serveurs WMS, ajoutés à la suite des fonds NASA Moon Trek.
  // Fonction usgsExtra : fabrique une couche de plus pour l'USGS, à partir de son identifiant, de son titre, de sa description et de son nom chez la source :
  const usgsExtra = (id: string, title: string, description: string, upstreamLayer: string): CuratedLayer => ({
    // son identifiant ;
    id,
    // son titre ;
    title,
    // sa description ;
    description,
    // son nom chez la source ;
    upstreamLayer,
    // sa nature, WMS ;
    kind: 'wms',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, EPSG:4326 ;
    crs: 'EPSG:4326',
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.usgsMaxZoom,
    // des tuiles de 256 pixels ;
    tileSize: 256,
    // le format PNG ;
    format: 'image/png',
    // sa mention ;
    attribution: usgsAttribution,
    // sa licence ;
    license: 'Domaine public (USGS)',
    // ses réglages WMS :
    wms: {
      // l'adresse des requêtes GetMap, avec la carte de l'USGS ;
      getMapUrl: `${config.usgsBaseUrl}?map=${config.usgsMap}`,
      // la version 1.1.1 ;
      version: '1.1.1',
      // la projection EPSG:4326 ;
      srs: 'EPSG:4326',
      // la longitude d'abord dans l'emprise.
      axisOrder: 'xy',
    // Fin des réglages.
    },
  // Fin de usgsExtra.
  });
  // Fonction lrocExtra : fabrique une couche de plus pour LROC Lunaserv, de la même façon :
  const lrocExtra = (id: string, title: string, description: string, upstreamLayer: string): CuratedLayer => ({
    // son identifiant ;
    id,
    // son titre ;
    title,
    // sa description ;
    description,
    // son nom chez la source ;
    upstreamLayer,
    // sa nature, WMS ;
    kind: 'wms',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, IAU2000:30100 (la Lune) ;
    crs: 'IAU2000:30100',
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.lrocMaxZoom,
    // des tuiles de 256 pixels ;
    tileSize: 256,
    // le format PNG ;
    format: 'image/png',
    // sa mention ;
    attribution: lrocAttribution,
    // sa licence ;
    license: 'Usage libre avec attribution',
    // ses réglages WMS :
    wms: {
      // l'adresse des requêtes GetMap ;
      getMapUrl: config.lrocGetMapUrl,
      // la version 1.3.0 ;
      version: '1.3.0',
      // la projection de la Lune ;
      srs: 'IAU2000:30100',
      // la longitude d'abord dans l'emprise.
      axisOrder: 'xy',
    // Fin des réglages.
    },
  // Fin de lrocExtra.
  });

  // Renvoie les quatre fournisseurs :
  return [
    // premier fournisseur :
    {
      // son identifiant, « moon-trek » ;
      id: 'moon-trek',
      // son nom ;
      name: 'NASA Moon Trek (WMTS)',
      // sa nature, WMTS ;
      kind: 'wmts',
      // sa description :
      description:
        // son texte ;
        'Mosaïques lunaires du portail NASA Moon Trek (LRO WAC, DEM), servies en WMTS REST.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://trek.nasa.gov/moon/',
      // sa mention ;
      attribution: trekAttribution,
      // sa licence ;
      license: 'Domaine public (NASA)',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // pas de document de capacités standard ;
        'Service WMTS REST de Moon Trek : pas de GetCapabilities standard.',
        // le produit et les niveaux, pris dans la configuration.
        `Produit : ${config.trekProduct} ; niveaux 0 à ${config.trekMaxZoom}.`,
      // Fin des remarques.
      ],
      // Ses couches :
      layers: [
        // première couche :
        {
          // son identifiant, « wac-mosaic » ;
          id: 'wac-mosaic',
          // son titre ;
          title: 'Mosaïque LRO WAC globale (303 px/degré)',
          // sa description :
          description:
            // son texte ;
            'Mosaïque globale en couleurs naturelles de la caméra grand angle de LRO.',
          // son nom chez la source : le produit Trek ;
          upstreamLayer: config.trekProduct,
          // sa nature, WMTS ;
          kind: 'wmts',
          // son découpage, plate carrée ;
          scheme: 'equirectangular',
          // sa projection, celle de la Lune ;
          crs: 'IAU2000:30100',
          // son niveau minimal, 0 ;
          minZoom: 0,
          // son niveau maximal, pris dans la configuration ;
          maxZoom: config.trekMaxZoom,
          // des tuiles de 256 pixels ;
          tileSize: 256,
          // le format JPEG ;
          format: 'image/jpeg',
          // sa mention ;
          attribution: trekAttribution,
          // sa licence ;
          license: 'Domaine public (NASA)',
          // ses réglages WMTS :
          wmts: {
            // l'adresse de base ;
            baseUrl: config.trekBaseUrl,
            // le style ;
            style: config.trekStyle,
            // le jeu de tuiles ;
            matrixSet: config.trekMatrixSet,
            // l'extension jpg.
            extension: 'jpg',
          // Fin des réglages.
          },
        // Fin de la première couche.
        },
        // Seconde couche :
        {
          // son identifiant, « dem-terrain » ;
          id: 'dem-terrain',
          // son titre ;
          title: 'Modèle numérique de terrain (DEM)',
          // sa description :
          description:
            // son texte ;
            'Altitudes lunaires (LOLA) via l’ImageServer ArcGIS de Moon Trek.',
          // son nom chez la source ;
          upstreamLayer: 'Moon_TREK_dem',
          // sa nature, ArcGIS ImageServer ;
          kind: 'arcgis-image',
          // son découpage, plate carrée ;
          scheme: 'equirectangular',
          // sa projection, celle de la Lune ;
          crs: 'IAU2000:30100',
          // son niveau minimal, 0 ;
          minZoom: 0,
          // son niveau maximal, pris dans la configuration ;
          maxZoom: config.trekTerrainMaxZoom,
          // des tuiles de 256 pixels ;
          tileSize: 256,
          // le format PNG ;
          format: 'image/png',
          // sa mention ;
          attribution: trekAttribution,
          // sa licence ;
          license: 'Domaine public (NASA)',
          // ses réglages ArcGIS ImageServer :
          arcgis: {
            // l'adresse des requêtes d'export ;
            exportImageUrl: `${config.trekImageServerBaseUrl}/Moon_TREK_dem/ImageServer/export`,
            // la projection de l'emprise ;
            bboxSrs: 'IAU2000:30100',
            // la projection de l'image ;
            imageSrs: 'IAU2000:30100',
            // le format png ;
            format: 'png',
            // l'interpolation bilinéaire.
            interpolation: 'RSP_BilinearInterpolation',
          // Fin des réglages.
          },
        // Fin de la seconde couche.
        },
      // Fin des couches.
      ],
    // Fin du premier fournisseur.
    },
    // Deuxième fournisseur :
    {
      // son identifiant, « usgs-astro » ;
      id: 'usgs-astro',
      // son nom ;
      name: 'USGS Astrogeology (WMS)',
      // sa nature, WMS ;
      kind: 'wms',
      // sa description :
      description:
        // son texte ;
        'Cartes lunaires équirectangulaires du serveur WMS de l’USGS Astrogeology.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://planetarymaps.usgs.gov/',
      // sa mention ;
      attribution: usgsAttribution,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // sans jeton ;
      requiresToken: false,
      // l'adresse de ses capacités, en WMS 1.1.1 ;
      capabilitiesUrl: `${config.usgsBaseUrl}?map=${config.usgsMap}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`,
      // ses remarques :
      notes: [
        // les cartes passent par le fichier .map de la Lune ;
        'GetMap via mapserv avec le fichier .map dédié à la Lune.',
        // les niveaux, pris dans la configuration.
        `Niveaux 0 à ${config.usgsMaxZoom}.`,
      // Fin des remarques.
      ],
      // Ses couches :
      layers: [
        // première couche :
        {
          // son identifiant, « lroc-lola-clrshade » ;
          id: 'lroc-lola-clrshade',
          // son titre ;
          title: 'Lune — ombrage coloré LRO LOLA (128 px/degré)',
          // sa description :
          description:
            // son texte ;
            'Carte globale équirectangulaire : ombrage coloré des altimètres LOLA.',
          // son nom chez la source ;
          upstreamLayer: 'Lunar_LRO_LOLA_ClrShade_Global_128ppd',
          // sa nature, WMS ;
          kind: 'wms',
          // son découpage, plate carrée ;
          scheme: 'equirectangular',
          // sa projection, EPSG:4326 ;
          crs: 'EPSG:4326',
          // son niveau minimal, 0 ;
          minZoom: 0,
          // son niveau maximal, pris dans la configuration ;
          maxZoom: config.usgsMaxZoom,
          // des tuiles de 256 pixels ;
          tileSize: 256,
          // le format PNG ;
          format: 'image/png',
          // sa mention ;
          attribution: usgsAttribution,
          // sa licence ;
          license: 'Domaine public (USGS)',
          // ses réglages WMS :
          wms: {
            // l'adresse des requêtes GetMap, avec la carte de l'USGS ;
            getMapUrl: `${config.usgsBaseUrl}?map=${config.usgsMap}`,
            // la version 1.1.1 ;
            version: '1.1.1',
            // la projection EPSG:4326 ;
            srs: 'EPSG:4326',
            // la longitude d'abord dans l'emprise.
            axisOrder: 'xy',
          // Fin des réglages.
          },
        // Fin de la première couche.
        },
        // Couche de plus : la mosaïque LRO WAC.
        usgsExtra('lroc-wac', 'LRO WAC — mosaïque globale', 'Mosaïque globale LROC WAC rendue par le serveur WMS de l’USGS.', 'LROC_WAC'),
        // Couche de plus : le relief ombré LOLA en couleur.
        usgsExtra('lola-color', 'LOLA — relief ombré couleur', 'Relief ombré coloré issu de l’altimètre laser LOLA (LRO).', 'LOLA_color'),
        // Couche de plus : le relief ombré LOLA en gris.
        usgsExtra('lola-bw', 'LOLA — relief ombré niveaux de gris', 'Relief ombré LOLA en niveaux de gris.', 'LOLA_bw'),
        // Couche de plus : la mosaïque Clementine UV/VIS.
        usgsExtra('clementine-uvvis', 'Clementine UV/VIS — mosaïque globale v2', 'Mosaïque globale Clementine 750 nm (UV/VIS), version 2.', 'uv_v2'),
        // Couche de plus : l'ortho-mosaïque de Kaguya.
        usgsExtra('kaguya-tc', 'Kaguya — ortho-mosaïque Terrain Camera', 'Ortho-mosaïque de la Terrain Camera de la mission japonaise Kaguya (SELENE).', 'KaguyaTC_Ortho'),
      // Fin des couches.
      ],
    // Fin du deuxième fournisseur.
    },
    // Troisième fournisseur :
    {
      // son identifiant, « lroc-lunaserv » ;
      id: 'lroc-lunaserv',
      // son nom ;
      name: 'LROC LunaServ (WMS 1.3.0)',
      // sa nature, WMS ;
      kind: 'wms',
      // sa description :
      description:
        // son texte ;
        'Service WMS de l’imagerie LROC opéré par l’Arizona State University.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://wms.im-ldi.com/lunaserv/wms',
      // sa mention ;
      attribution: lrocAttribution,
      // sa licence ;
      license: 'Usage libre avec attribution',
      // sans jeton ;
      requiresToken: false,
      // l'adresse de ses capacités, en WMS 1.3.0 ;
      capabilitiesUrl: `${config.lrocCapabilitiesUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`,
      // ses remarques :
      notes: [
        // l'ordre des axes de l'emprise suit la projection ;
        'WMS 1.3.0 : l’ordre des axes du BBOX suit la convention CRS.',
        // les niveaux, pris dans la configuration.
        `Niveaux 0 à ${config.lrocMaxZoom}.`,
      // Fin des remarques.
      ],
      // Ses couches :
      layers: [
        // première couche :
        {
          // son identifiant, « wac-wmosaic » ;
          id: 'wac-wmosaic',
          // son titre ;
          title: 'WAC Mosaic (Wide Angle Camera)',
          // sa description :
          description:
            // son texte ;
            'Mosaïque globale de la caméra grand angle de LRO, en projection simple cylindrique.',
          // son nom chez la source ;
          upstreamLayer: 'lroc_wmosaic',
          // sa nature, WMS ;
          kind: 'wms',
          // son découpage, plate carrée ;
          scheme: 'equirectangular',
          // sa projection, celle de la Lune ;
          crs: 'IAU2000:30100',
          // son niveau minimal, 0 ;
          minZoom: 0,
          // son niveau maximal, pris dans la configuration ;
          maxZoom: config.lrocMaxZoom,
          // des tuiles de 256 pixels ;
          tileSize: 256,
          // le format PNG ;
          format: 'image/png',
          // sa mention ;
          attribution: lrocAttribution,
          // sa licence ;
          license: 'Usage libre avec attribution',
          // ses réglages WMS :
          wms: {
            // l'adresse des requêtes GetMap ;
            getMapUrl: config.lrocGetMapUrl,
            // la version 1.3.0 ;
            version: '1.3.0',
            // la projection de la Lune ;
            srs: 'IAU2000:30100',
            // la longitude d'abord dans l'emprise.
            axisOrder: 'xy',
          // Fin des réglages.
          },
        // Fin de la première couche.
        },
        // Couche de plus : la mosaïque globale LROC WAC.
        lrocExtra('luna-wac-global', 'LROC WAC — mosaïque globale (LunaServ)', 'Mosaïque globale LROC WAC servie par LunaServ (ASU).', 'luna_wac_global'),
        // Couche de plus : le composite couleur LROC WAC.
        lrocExtra('luna-wac-color', 'LROC WAC — composite couleur', 'Composite couleur LROC WAC.', 'luna_wac_color_composite'),
        // Couche de plus : le relief ombré LROC WAC.
        lrocExtra('luna-wac-hillshade', 'LROC WAC — relief ombré (DTM)', 'Relief ombré dérivé du modèle numérique de terrain LROC WAC.', 'luna_wac_dtm_hillshade'),
      // Fin des couches.
      ],
    // Fin du troisième fournisseur.
    },
    // Quatrième fournisseur :
    {
      // son identifiant, « opm » ;
      id: 'opm',
      // son nom ;
      name: 'OpenPlanetaryMap — Lune (XYZ)',
      // sa nature, XYZ ;
      kind: 'xyz',
      // sa description :
      description:
        // son texte ;
        'Basemap lunaire communautaire OpenPlanetaryMap, servie en tuiles XYZ Web Mercator.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://www.openplanetarymap.org/',
      // sa mention ;
      attribution: opmAttribution,
      // sa licence ;
      license: 'ODbL (OpenPlanetaryMap)',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // tuiles XYZ en Web Mercator ;
        'XYZ en Web Mercator (EPSG:3857), compatibles avec les bibliothèques web standard.',
        // les niveaux, pris dans la configuration.
        `Niveaux 0 à ${config.opmMaxZoom}.`,
      // Fin des remarques.
      ],
      // Ses couches :
      layers: [
        // une seule couche :
        {
          // son identifiant, « basemap » ;
          id: 'basemap',
          // son titre ;
          title: 'OPM Moon Basemap v0.1',
          // sa description :
          description:
            // son texte ;
            'Basemap lunaire en couleurs naturelles, dérivée des données LRO/WAC.',
          // son nom chez la source ;
          upstreamLayer: 'opm-moon-basemap-v0-1',
          // sa nature, XYZ ;
          kind: 'xyz',
          // son découpage, Web Mercator ;
          scheme: 'web-mercator',
          // sa projection, EPSG:3857 ;
          crs: 'EPSG:3857',
          // son niveau minimal, 0 ;
          minZoom: 0,
          // son niveau maximal, pris dans la configuration ;
          maxZoom: config.opmMaxZoom,
          // des tuiles de 256 pixels ;
          tileSize: 256,
          // le format PNG ;
          format: 'image/png',
          // sa mention ;
          attribution: opmAttribution,
          // sa licence ;
          license: 'ODbL (OpenPlanetaryMap)',
          // ses réglages XYZ :
          xyz: {
            // le modèle d'adresse, pris dans la configuration ;
            urlTemplate: config.opmTileUrl,
            // lignes comptées depuis le haut.
            tms: false,
          // Fin des réglages.
          },
        // Fin de la couche.
        },
      // Fin des couches.
      ],
    // Fin du quatrième fournisseur.
    },
  // Fin de la liste.
  ];
// Fin de buildProviders.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du catalogue de la Lune.
export class MoonCatalogService {
  // Liste des fournisseurs, en lecture seule.
  private readonly providers: readonly ProviderDefinition[];

  // Constructeur : la configuration, demandée par son jeton.
  constructor(@Inject(MOON_CONFIG) config: MoonConfig) {
    // Construit la liste des fournisseurs.
    this.providers = buildProviders(config);
  // Fin du constructeur.
  }

  /** Définitions complètes (lecture seule) de tous les fournisseurs. */
  // Méthode listProviders.
  listProviders(): readonly ProviderDefinition[] {
    // Renvoie tous les fournisseurs.
    return this.providers;
  // Fin de listProviders.
  }

  // Méthode getProvider.
  getProvider(providerId: string): ProviderDefinition {
    // Cherche le fournisseur qui porte cet identifiant.
    const provider = this.providers.find((entry) => entry.id === providerId);
    // Introuvable :
    if (!provider) {
      // erreur 404,
      throw new NotFoundException(
        // avec son identifiant et la liste
        `Fournisseur lunaire inconnu : ${providerId} (attendus : ${this.providers
          // des identifiants
          .map((entry) => entry.id)
          // attendus.
          .join(', ')}).`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Le renvoie.
    return provider;
  // Fin de getProvider.
  }

  // Méthode getLayer ; ses paramètres :
  getLayer(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche.
    layerId: string,
  // Elle renvoie le fournisseur et la couche.
  ): { provider: ProviderDefinition; layer: CuratedLayer } {
    // Fournisseur.
    const provider = this.getProvider(providerId);
    // Couche qui porte cet identifiant.
    const layer = provider.layers.find((entry) => entry.id === layerId);
    // Introuvable :
    if (!layer) {
      // erreur 404,
      throw new NotFoundException(
        // avec les deux identifiants et la liste
        `Couche inconnue : ${layerId} sur ${providerId} (attendues : ${provider.layers
          // des couches
          .map((entry) => entry.id)
          // attendues.
          .join(', ')}).`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Renvoie le fournisseur et la couche.
    return { provider, layer };
  // Fin de getLayer.
  }

  // Méthode listSummaries.
  listSummaries(): ProviderSummary[] {
    // Le résumé de chaque fournisseur.
    return this.providers.map((provider) => this.summarizeProvider(provider));
  // Fin de listSummaries.
  }

  // Méthode getProviderSummary.
  getProviderSummary(providerId: string): ProviderSummary {
    // Le résumé d'un fournisseur.
    return this.summarizeProvider(this.getProvider(providerId));
  // Fin de getProviderSummary.
  }

  // Méthode summarizeProvider : le résumé d'un fournisseur.
  summarizeProvider(provider: ProviderDefinition): ProviderSummary {
    // Renvoie
    return {
      // son identifiant ;
      id: provider.id,
      // son nom ;
      name: provider.name,
      // sa nature ;
      kind: provider.kind,
      // sa description ;
      description: provider.description,
      // l'adresse de sa documentation ;
      docsUrl: provider.docsUrl,
      // sa mention ;
      attribution: provider.attribution,
      // sa licence ;
      license: provider.license,
      // s'il demande un jeton ;
      requiresToken: provider.requiresToken,
      // l'adresse de ses capacités, ou null ;
      capabilitiesUrl: provider.capabilitiesUrl ?? null,
      // une copie de ses remarques ;
      notes: [...provider.notes],
      // le résumé de chacune de ses couches :
      layers: provider.layers.map((layer) =>
        // calculé par summarizeLayer.
        this.summarizeLayer(provider, layer),
      // Fin des couches.
      ),
    // Fin de l'objet.
    };
  // Fin de summarizeProvider.
  }

  // Méthode summarizeLayer ; ses paramètres :
  summarizeLayer(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la couche.
    layer: CuratedLayer,
  // Elle renvoie le résumé de la couche.
  ): LayerSummary {
    // Renvoie
    return {
      // son identifiant ;
      id: layer.id,
      // son titre ;
      title: layer.title,
      // sa nature ;
      kind: layer.kind,
      // son découpage ;
      scheme: layer.scheme,
      // sa projection ;
      crs: layer.crs,
      // son niveau minimal ;
      minZoom: layer.minZoom,
      // son niveau maximal ;
      maxZoom: layer.maxZoom,
      // la taille de ses tuiles ;
      tileSize: layer.tileSize,
      // son format ;
      format: layer.format,
      // son modèle d'adresse sur ce serveur.
      tileUrlTemplate: `/api/v1/moon/providers/${provider.id}/layers/${layer.id}/tile/{z}/{x}/{y}`,
    // Fin de l'objet.
    };
  // Fin de summarizeLayer.
  }

  // Méthode describeLayer : le détail d'une couche.
  describeLayer(providerId: string, layerId: string): LayerDetail {
    // Fournisseur et couche.
    const { provider, layer } = this.getLayer(providerId, layerId);
    // Résumé de la couche.
    const summary = this.summarizeLayer(provider, layer);

    // Exemple d'adresse chez la source : aucun au départ.
    let sampleUpstreamUrl: string | null = null;
    // Si la couche a des tuiles 2D :
    if (layer.scheme !== 'none') {
      // essaie
      try {
        // de construire l'adresse,
        sampleUpstreamUrl = buildTileUrl(
          // pour ce fournisseur,
          provider,
          // cette couche,
          layer,
          // à son niveau minimal,
          layer.minZoom,
          // colonne 0,
          0,
          // ligne 0.
          0,
        // Fin de la construction.
        );
      // En cas d'échec :
      } catch {
        // pas d'exemple.
        sampleUpstreamUrl = null;
      // Fin du cas.
      }
    // Fin du cas.
    }

    // Renvoie
    return {
      // le résumé ;
      ...summary,
      // sa description ;
      description: layer.description,
      // son nom chez la source ;
      upstreamLayer: layer.upstreamLayer,
      // sa mention ;
      attribution: layer.attribution,
      // sa licence ;
      license: layer.license,
      // son jeu de tuiles WMTS, ou null ;
      tileMatrixSet: layer.wmts?.matrixSet ?? null,
      // son style WMTS, ou null ;
      style: layer.wmts?.style ?? null,
      // son modèle d'adresse XYZ, ou null ;
      xyzTemplate: layer.xyz?.urlTemplate ?? null,
      // son numéro de jeu 3D Tiles, ou null ;
      tiles3dAssetId: layer.tiles3d?.assetId ?? null,
      // l'exemple d'adresse.
      sampleUpstreamUrl,
    // Fin de l'objet.
    };
  // Fin de describeLayer.
  }
// Fin du service.
}

// ===========================================================================
// capabilities.service.ts — GetCapabilities OGC, mis en cache
// (reconstruit : le fichier d'origine n'était plus disponible)
// ===========================================================================

// Forme des capacités gardées en cache.
interface CachedCapabilities {
  // summary : leur résumé.
  summary: CapabilitiesSummary;
  // raw : leur texte XML, ou null.
  raw: string | null;
// Fin de CachedCapabilities.
}

// Forme des options d'une demande.
export interface CapabilitiesOptions {
  // raw : rendre aussi le texte XML (facultatif).
  raw?: boolean;
  // refresh : relire la source sans passer par le cache (facultatif).
  refresh?: boolean;
// Fin de CapabilitiesOptions.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des capacités de la Lune.
export class MoonCapabilitiesService {
  // Cache des capacités.
  private readonly cache: TtlCache<CachedCapabilities>;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MOON_CONFIG) private readonly config: MoonConfig,
    // le catalogue ;
    private readonly catalog: MoonCatalogService,
    // le service des serveurs sources.
    private readonly upstream: MoonUpstreamService,
  // Corps du constructeur :
  ) {
    // crée le cache,
    this.cache = new TtlCache<CachedCapabilities>(
      // de 16 documents au plus,
      16,
      // avec la durée de vie de la configuration,
      config.capabilitiesCacheTtlMs,
      // et la même durée pendant laquelle un document périmé est encore servi.
      config.capabilitiesCacheTtlMs,
    // Fin de la création.
    );
  // Fin du constructeur.
  }

  // Méthode getCapabilities ; ses paramètres :
  async getCapabilities(
    // l'identifiant du fournisseur ;
    providerId: string,
    // les options, vides par défaut.
    options: CapabilitiesOptions = {},
  // Elle renvoie le résumé et, si demandé, le texte XML.
  ): Promise<CapabilitiesResult> {
    // Fournisseur demandé, pris dans le catalogue.
    const provider = this.catalog.getProvider(providerId);
    // Texte XML demandé ou non (non par défaut).
    const raw = options.raw ?? false;

    // Jeu 3D Tiles :
    if (provider.kind === '3d-tiles') {
      // renvoie un résumé fabriqué, avec une note, sans texte XML.
      return { summary: this.noteSummary(provider, 'Jeu 3D Tiles : pas de GetCapabilities OGC.'), raw: null };
    // Fin du cas.
    }

    // Adresse des capacités du fournisseur.
    const url = provider.capabilitiesUrl;
    // Aucune :
    if (!url) {
      // renvoie
      return {
        // un résumé fabriqué,
        summary: this.noteSummary(
          // pour ce fournisseur,
          provider,
          // avec cette note ;
          'Ce fournisseur ne publie pas de document GetCapabilities exploitable.',
        // fin du résumé ;
        ),
        // pas de texte XML.
        raw: null,
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Sans rafraîchissement demandé :
    if (!options.refresh) {
      // cherche dans le cache, sous une clé qui dépend du fournisseur et du texte XML demandé ou non ;
      const cached = this.cache.peek(`${provider.id}:${raw ? 'raw' : 'std'}`);
      // trouvé :
      if (cached) {
        // le renvoie.
        return { summary: cached.summary, raw: cached.raw };
      // Fin du cas.
      }
    // Fin du cas.
    }

    // Télécharge et lit le document.
    const fetched = await this.fetchAndParse(provider, url, raw);
    // Le range dans le cache.
    this.cache.set(`${provider.id}:${raw ? 'raw' : 'std'}`, fetched);
    // Le renvoie.
    return { summary: fetched.summary, raw: fetched.raw };
  // Fin de getCapabilities.
  }

  // Méthode privée fetchAndParse ; ses paramètres :
  private async fetchAndParse(
    // le fournisseur ;
    provider: ProviderDefinition,
    // l'adresse ;
    url: string,
    // garder le texte XML ou non.
    raw: boolean,
  // Elle renvoie les capacités.
  ): Promise<CachedCapabilities> {
    // Texte du document.
    let text: string;
    // Essaie
    try {
      // de le télécharger,
      const response = await this.upstream.fetchText(url, {
        // en demandant du XML ;
        accept: 'application/xml,text/xml,*/*',
      // fin du téléchargement ;
      });
      // garde le texte.
      text = response.text;
    // En cas d'échec :
    } catch (error) {
      // erreur 502,
      throw new BadGatewayException(
        // avec le fournisseur et
        `GetCapabilities indisponible pour ${provider.id} : ${
          // le message de l'erreur ;
          error instanceof Error ? error.message : String(error)
        // fin du message.
        }`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Résumé de base :
    const base: CapabilitiesSummary = {
      // l'identifiant du fournisseur ;
      provider: provider.id,
      // sa nature ;
      kind: provider.kind,
      // l'heure de la lecture ;
      fetchedAt: new Date().toISOString(),
      // aucun format ;
      formats: [],
      // aucune projection ;
      crs: [],
      // pas d'emprise ;
      bbox: null,
      // aucune couche ;
      layers: [],
      // aucun jeu de tuiles ;
      tileMatrixSets: [],
      // pas de version ;
      version: null,
      // pas de titre ;
      serviceTitle: null,
      // le poids du texte, en octets ;
      bytes: Buffer.byteLength(text),
      // le type de contenu XML ;
      contentType: 'application/xml',
      // pas de durée ;
      fetchMs: null,
      // pas de modèle d'adresse.
      resourceUrlTemplate: null,
    // Fin du résumé de base.
    };

    // Essaie
    try {
      // de lire le XML ;
      const parsed = parseCapabilities(text);
      // résumé complet :
      const summary: CapabilitiesSummary = {
        // le résumé de base, complété par
        ...base,
        // la version ;
        version: parsed.version,
        // le titre du service ;
        serviceTitle: parsed.serviceTitle,
        // les formats ;
        formats: parsed.formats,
        // les projections ;
        crs: parsed.crs,
        // l'emprise ;
        bbox: parsed.bbox,
        // les couches ;
        layers: parsed.layers,
        // les jeux de tuiles ;
        tileMatrixSets: parsed.tileMatrixSets,
        // le modèle d'adresse des tuiles.
        resourceUrlTemplate: parsed.resourceUrlTemplate,
      // Fin du résumé.
      };
      // Le renvoie, avec le texte XML s'il est demandé.
      return { summary, raw: raw ? text : null };
    // Si le XML est illisible :
    } catch (error) {
      // renvoie
      return {
        // un résumé :
        summary: {
          // le résumé de base,
          ...base,
          // avec une note qui porte
          note: `Document non parsable : ${
            // le message de l'erreur ;
            error instanceof Error ? error.message : String(error)
          // fin de la note.
          }`,
        // Fin du résumé.
        },
        // Et le texte XML s'il est demandé.
        raw: raw ? text : null,
      // Fin de l'objet.
      };
    // Fin du cas.
    }
  // Fin de fetchAndParse.
  }

  // Méthode privée noteSummary ; ses paramètres :
  private noteSummary(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la note.
    note: string,
  // Elle renvoie un résumé fabriqué.
  ): CapabilitiesSummary {
    // Renvoie
    return {
      // l'identifiant du fournisseur ;
      provider: provider.id,
      // sa nature ;
      kind: provider.kind,
      // pas de version ;
      version: null,
      // son nom comme titre ;
      serviceTitle: provider.name,
      // l'heure courante ;
      fetchedAt: new Date().toISOString(),
      // pas de poids ;
      bytes: null,
      // pas de type de contenu ;
      contentType: null,
      // pas de durée ;
      fetchMs: null,
      // aucun format ;
      formats: [],
      // aucune projection ;
      crs: [],
      // pas d'emprise ;
      bbox: null,
      // les couches du catalogue, chacune avec
      layers: provider.layers.map((layer) => ({
        // son identifiant comme nom,
        name: layer.id,
        // et son titre.
        title: layer.title,
      // Fin des couches.
      })),
      // Aucun jeu de tuiles.
      tileMatrixSets: [],
      // Pas de modèle d'adresse.
      resourceUrlTemplate: null,
      // La note.
      note,
    // Fin de l'objet.
    };
  // Fin de noteSummary.
  }
// Fin du service.
}

// ===========================================================================
// moon-imagery-tile.service.ts — tuiles d'imagerie 2D (cache TTL inclus)
// ===========================================================================

// Forme d'une tuile gardée en cache.
interface CachedTile {
  // buffer : ses octets.
  buffer: Buffer;
  // contentType : son type de contenu.
  contentType: string;
  // upstream : la réponse de la source.
  upstream: UpstreamResponse;
  // image : les informations de l'image, ou null.
  image: ImageInfo | null;
  // sha256 : son empreinte.
  sha256: string;
  // etag : son ETag.
  etag: string;
  // fetchedAt : l'heure du téléchargement.
  fetchedAt: string;
// Fin de CachedTile.
}

// Forme des options d'une couverture.
export interface CoverageOptions {
  // bbox : l'emprise (facultatif).
  bbox?: BBox;
  // zoom : le niveau (facultatif).
  zoom?: number;
  // limit : le nombre maximal d'adresses (facultatif).
  limit?: number;
// Fin de CoverageOptions.
}

// Forme des champs variables d'une fiche de tuile.
interface ModelExtras {
  // fetchedAt : l'heure.
  fetchedAt: string;
  // upstream : la réponse de la source, ou null.
  upstream: UpstreamInfo | null;
  // image : les informations de l'image, ou null.
  image: ImageInfo | null;
  // cache : l'état du cache, ou null.
  cache: TileCacheInfo | null;
// Fin de ModelExtras.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des tuiles de la Lune.
export class MoonTileService {
  // Cache des tuiles.
  private readonly cache: TtlCache<CachedTile>;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MOON_CONFIG) config: MoonConfig,
    // le catalogue ;
    private readonly catalog: MoonCatalogService,
    // le service des appels aux sources.
    private readonly upstream: MoonUpstreamService,
  // Corps du constructeur :
  ) {
    // Les tuiles restent servies une semaine après le TTL pendant que la
    // version fraîche se recharge en arrière-plan (stale-while-revalidate).
    // crée le cache, avec
    this.cache = new TtlCache<CachedTile>(
      // le nombre de tuiles de la configuration,
      config.tileCacheEntries,
      // leur durée de vie,
      config.tileCacheTtlMs,
      // et sept fois cette durée pendant laquelle une tuile périmée est encore servie.
      config.tileCacheTtlMs * 7,
    // Fin de la création.
    );
  // Fin du constructeur.
  }

  // Méthode getTile ; ses paramètres :
  async getTile(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie la tuile téléchargée.
  ): Promise<TileFetchResult> {
    // Vérifie la demande ; rend le fournisseur et la couche.
    const { provider, layer } = this.prepare(providerId, layerId, zoom, x, y);
    // Clé du cache.
    const key = this.cacheKey(provider, layer, zoom, x, y);
    // Adresse de la tuile chez la source.
    const upstreamUrl = buildTileUrl(provider, layer, zoom, x, y);

    // Résultat de la lecture du cache.
    let lookup: CacheLookup<CachedTile>;
    // Essaie :
    try {
      // prend la tuile du cache, ou la charge ainsi :
      lookup = await this.cache.getOrLoad(key, async () => {
        // la télécharge,
        const response = await this.upstream.fetchBinary(upstreamUrl, {
          // en demandant le format de la couche ;
          accept: layer.format,
        // fin du téléchargement ;
        });
        // lit les informations de l'image ;
        const image = inspectImage(response.buffer);
        // son empreinte, celle de l'image ou calculée.
        const sha256 = image?.sha256 ?? sha256Hex(response.buffer);

        // Rend
        return {
          // les octets ;
          buffer: response.buffer,
          // le type de contenu :
          contentType:
            // celui de la réponse,
            response.contentType ??
            // sinon celui de l'image, sinon le format de la couche ;
            (image ? `image/${image.format}` : layer.format),
          // la réponse de la source ;
          upstream: response,
          // les informations de l'image ;
          image,
          // l'empreinte ;
          sha256,
          // l'ETag ;
          etag: etagFromSha(sha256),
          // l'heure du téléchargement.
          fetchedAt: new Date().toISOString(),
        // Fin de l'objet.
        };
      // Fin du chargement.
      });
    // En cas d'échec :
    } catch (error) {
      // relance l'erreur, traduite en erreur HTTP.
      throw this.toHttpError(error);
    // Fin du cas.
    }

    // Tuile lue.
    const cached = lookup.value;
    // Fiche de la tuile, avec
    const model = this.buildModel(provider, layer, zoom, x, y, {
      // l'heure du téléchargement,
      fetchedAt: cached.fetchedAt,
      // la réponse de la source,
      upstream: toUpstreamInfo(cached.upstream),
      // les informations de l'image,
      image: cached.image,
      // et l'état du cache :
      cache: {
        // vient-elle du cache ?
        hit: lookup.hit,
        // est-elle périmée ?
        stale: lookup.stale,
        // sa clé ;
        key,
        // sa durée de vie ;
        ttlMs: lookup.ttlMs,
        // son âge.
        ageMs: lookup.ageMs,
      // Fin de l'état du cache.
      },
    // Fin de la fiche.
    });

    // Renvoie
    return {
      // la fiche ;
      model,
      // les octets ;
      buffer: cached.buffer,
      // le type de contenu ;
      contentType: cached.contentType,
      // l'ETag ;
      etag: cached.etag,
      // si elle vient du cache ;
      cacheHit: lookup.hit,
      // si elle est périmée ;
      cacheStale: lookup.stale,
      // sa durée de vie.
      ttlMs: lookup.ttlMs,
    // Fin de l'objet.
    };
  // Fin de getTile.
  }

  // Méthode describeTile ; ses paramètres :
  async describeTile(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne ;
    y: number,
    // télécharger la tuile ou non (non par défaut).
    fetch = false,
  // Elle renvoie la fiche de la tuile.
  ): Promise<TileModel> {
    // S'il faut la télécharger :
    if (fetch) {
      // renvoie la fiche de la tuile téléchargée.
      return (await this.getTile(providerId, layerId, zoom, x, y)).model;
    // Fin du cas.
    }

    // Vérifie la demande ; rend le fournisseur et la couche.
    const { provider, layer } = this.prepare(providerId, layerId, zoom, x, y);
    // Renvoie la fiche, avec
    return this.buildModel(provider, layer, zoom, x, y, {
      // l'heure courante,
      fetchedAt: new Date().toISOString(),
      // pas de réponse de la source,
      upstream: null,
      // pas d'image,
      image: null,
      // pas d'état du cache.
      cache: null,
    // Fin de la fiche.
    });
  // Fin de describeTile.
  }

  // Méthode getTileAt ; ses paramètres :
  async getTileAt(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // la longitude ;
    lon: number,
    // la latitude ;
    lat: number,
    // le niveau (facultatif) ;
    zoom?: number,
    // télécharger la tuile ou non.
    fetch = false,
  // Elle renvoie la fiche de la tuile qui contient ce point.
  ): Promise<TileModel> {
    // Longitude ou latitude non finie :
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      // erreur 400,
      throw new BadRequestException(
        // avec ce message.
        'Les coordonnées lon et lat doivent être des nombres finis.',
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Fournisseur et couche du catalogue.
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);
    // Vérifie que la couche a des tuiles 2D.
    assertTileLayer(provider, layer);

    // Niveau : celui demandé, sinon le plus fin de la couche.
    const targetZoom = zoom ?? layer.maxZoom;
    // Vérifie le niveau.
    assertZoom(provider.id, layer.id, targetZoom, layer.minZoom, layer.maxZoom);

    // Tuile qui contient le point.
    const index = tileFromLonLat(layer.scheme, targetZoom, lon, lat);
    // Renvoie sa fiche, pour
    return this.describeTile(
      // ce fournisseur,
      provider.id,
      // cette couche,
      layer.id,
      // ce niveau,
      targetZoom,
      // cette colonne,
      index.x,
      // cette ligne,
      index.y,
      // avec ou sans téléchargement.
      fetch,
    // Fin de l'appel.
    );
  // Fin de getTileAt.
  }

  // Méthode coverage ; ses paramètres :
  coverage(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // les options, vides par défaut.
    options: CoverageOptions = {},
  // Elle renvoie la couverture.
  ): CoverageResult {
    // Fournisseur et couche du catalogue.
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);
    // Vérifie que la couche a des tuiles 2D.
    assertTileLayer(provider, layer);

    // Niveau : celui demandé, sinon 3, sans dépasser celui de la couche.
    const zoom = options.zoom ?? Math.min(3, layer.maxZoom);
    // Vérifie le niveau.
    assertZoom(provider.id, layer.id, zoom, layer.minZoom, layer.maxZoom);

    // Emprise bornée :
    const bbox = clampBBox(
      // celle demandée, sinon le monde entier,
      options.bbox ?? { west: -180, south: -90, east: 180, north: 90 },
      // pour le découpage de la couche.
      layer.scheme,
    // Fin du calcul.
    );
    // Plage de tuiles de l'emprise.
    const range = tilesForBBox(layer.scheme, zoom, bbox);
    // Nombre maximal d'adresses : 64 par défaut, de 1 à 512.
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 64), 1), 512);
    // Nombre total de tuiles de la plage.
    const total = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);

    // Adresses sur ce serveur.
    const urls: string[] = [];
    // Adresses chez la source.
    const upstreamUrls: string[] = [];

    // Pour chaque ligne, tant que la limite n'est pas atteinte,
    for (let y = range.minY; y <= range.maxY && urls.length < limit; y += 1) {
      // et chaque colonne :
      for (let x = range.minX; x <= range.maxX && urls.length < limit; x += 1) {
        // ajoute l'adresse sur ce serveur ;
        urls.push(buildProxyUrl(provider, layer, zoom, x, y));
        // ajoute l'adresse chez la source.
        upstreamUrls.push(buildTileUrl(provider, layer, zoom, x, y));
      // Fin des colonnes.
      }
    // Fin des lignes.
    }

    // Renvoie
    return {
      // le fournisseur ;
      provider: provider.id,
      // la couche ;
      layer: layer.id,
      // le découpage ;
      scheme: layer.scheme,
      // le niveau ;
      zoom,
      // l'emprise ;
      bbox,
      // la plage ;
      range,
      // le nombre d'adresses rendues ;
      count: urls.length,
      // le nombre total de tuiles ;
      total,
      // si la liste est coupée ;
      truncated: urls.length < total,
      // les adresses sur ce serveur ;
      urls,
      // les adresses chez la source.
      upstreamUrls,
    // Fin de l'objet.
    };
  // Fin de coverage.
  }

  // Méthode privée prepare ; ses paramètres :
  private prepare(
    // l'identifiant du fournisseur ;
    providerId: string,
    // celui de la couche ;
    layerId: string,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie
  ): {
    // le fournisseur,
    provider: ProviderDefinition;
    // et la couche, dont le découpage est connu.
    layer: CuratedLayer & { scheme: TileScheme };
  // Fin du type.
  } {
    // Fournisseur et couche du catalogue.
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);
    // Vérifie que la couche a des tuiles 2D.
    assertTileLayer(provider, layer);

    // Vérifie la tuile, avec
    const problem = validateTileCoordinates(
      // le fournisseur,
      provider.id,
      // la couche,
      layer.id,
      // le découpage,
      layer.scheme,
      // le niveau,
      zoom,
      // la colonne,
      x,
      // la ligne,
      y,
      // et les niveaux de la couche.
      { minZoom: layer.minZoom, maxZoom: layer.maxZoom },
    // Fin de la vérification.
    );

    // S'il y a un problème :
    if (problem) {
      // erreur 400, avec son message.
      throw new BadRequestException(problem);
    // Fin du cas.
    }

    // Renvoie le fournisseur et la couche.
    return { provider, layer };
  // Fin de prepare.
  }

  // Méthode privée buildModel ; ses paramètres :
  private buildModel(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la couche ;
    layer: CuratedLayer & { scheme: TileScheme },
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne ;
    y: number,
    // les champs variables.
    extras: ModelExtras,
  // Elle renvoie la fiche de la tuile.
  ): TileModel {
    // Emprise de la tuile.
    const bbox = tileBBox(layer.scheme, zoom, x, y);
    // Grille du niveau.
    const grid = tileGrid(layer.scheme, zoom);

    // Renvoie
    return {
      // le fournisseur :
      provider: {
        // son identifiant,
        id: provider.id,
        // son nom,
        name: provider.name,
        // sa nature.
        kind: provider.kind,
      // Fin du fournisseur.
      },
      // La couche :
      layer: {
        // son identifiant,
        id: layer.id,
        // son titre,
        title: layer.title,
        // son nom chez la source.
        upstreamLayer: layer.upstreamLayer,
      // Fin de la couche.
      },
      // Le découpage.
      scheme: layer.scheme,
      // La projection.
      crs: layer.crs,
      // Le niveau.
      zoom,
      // La colonne.
      x,
      // La ligne.
      y,
      // La taille d'une tuile.
      tileSize: layer.tileSize,
      // Le format.
      format: layer.format,
      // L'emprise.
      bbox,
      // L'emprise projetée.
      projectedBBox: projectBBox(layer.scheme, bbox, layer.crs),
      // Le centre.
      center: tileCenter(layer.scheme, bbox),
      // La dernière colonne et la dernière ligne du niveau.
      tileRange: { maxX: grid.columns - 1, maxY: grid.rows - 1 },
      // L'adresse chez la source.
      upstreamUrl: buildTileUrl(provider, layer, zoom, x, y),
      // L'adresse sur ce serveur.
      proxyUrl: buildProxyUrl(provider, layer, zoom, x, y),
      // La mention.
      attribution: layer.attribution,
      // La licence.
      license: layer.license,
      // L'heure.
      fetchedAt: extras.fetchedAt,
      // La réponse de la source.
      upstream: extras.upstream,
      // Les informations de l'image.
      image: extras.image,
      // L'état du cache.
      cache: extras.cache,
    // Fin de l'objet.
    };
  // Fin de buildModel.
  }

  // Méthode privée cacheKey ; ses paramètres :
  private cacheKey(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la couche ;
    layer: CuratedLayer,
    // le niveau ;
    zoom: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie la clé du cache.
  ): string {
    // « fournisseur:couche:niveau:colonne:ligne ».
    return `${provider.id}:${layer.id}:${zoom}:${x}:${y}`;
  // Fin de cacheKey.
  }

  // Méthode privée toHttpError.
  private toHttpError(error: unknown): Error {
    // Erreur d'une source :
    if (error instanceof MoonUpstreamError) {
      // code 404 :
      if (error.status === 404) {
        // erreur 404,
        return new NotFoundException(
          // avec ce message.
          'La tuile demandée n’existe pas sur le service amont (404).',
        // Fin de l'erreur.
        );
      // Fin du cas.
      }
      // Autre code : erreur 502.
      return new BadGatewayException(`Tuile indisponible : ${error.message}`);
    // Fin du cas.
    }

    // Sinon l'erreur telle quelle, ou une erreur faite de son texte.
    return error instanceof Error ? error : new Error(String(error));
  // Fin de toHttpError.
  }
// Fin du service.
}

// Fonction assertTileLayer ; ses paramètres :
function assertTileLayer(
  // le fournisseur ;
  provider: ProviderDefinition,
  // la couche.
  layer: CuratedLayer,
// Si elle ne lève pas d'erreur, la couche a un découpage connu.
): asserts layer is CuratedLayer & { scheme: TileScheme } {
  // Couche sans tuiles 2D :
  if (layer.scheme === 'none' || layer.kind === '3d-tiles') {
    // erreur 400,
    throw new BadRequestException(
      // avec ce message.
      `${provider.id}/${layer.id} est un jeu 3D Tiles : aucune tuile 2D n’est servie.`,
    // Fin de l'erreur.
    );
  // Fin du cas.
  }
// Fin de assertTileLayer.
}

// Fonction assertZoom ; ses paramètres :
function assertZoom(
  // l'identifiant du fournisseur ;
  providerId: string,
  // celui de la couche ;
  layerId: string,
  // le niveau ;
  zoom: number,
  // le niveau minimal ;
  minZoom: number,
  // le niveau maximal.
  maxZoom: number,
// Elle ne renvoie rien.
): void {
  // Niveau non entier ou hors des bornes :
  if (!Number.isInteger(zoom) || zoom < minZoom || zoom > maxZoom) {
    // erreur 400,
    throw new BadRequestException(
      // avec la plage permise.
      `Zoom ${zoom} hors plage pour ${providerId}/${layerId} (${minZoom}–${maxZoom}).`,
    // Fin de l'erreur.
    );
  // Fin du cas.
  }
// Fin de assertZoom.
}

// Fonction toUpstreamInfo.
function toUpstreamInfo(response: UpstreamResponse): UpstreamInfo {
  // Renvoie
  return {
    // le code HTTP ;
    status: response.status,
    // le type de contenu ;
    contentType: response.contentType,
    // la taille annoncée ;
    contentLength: response.contentLength,
    // l'ETag ;
    etag: response.etag,
    // la date de dernière modification ;
    lastModified: response.lastModified,
    // l'en-tête Cache-Control.
    cacheControl: response.cacheControl,
  // Fin de l'objet.
  };
// Fin de toUpstreamInfo.
}

// ===========================================================================
// moon-upstream-health.service.ts — santé des services amont
// ===========================================================================

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de santé de la Lune.
export class MoonHealthService {
  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(MOON_CONFIG) private readonly config: MoonConfig,
    // le catalogue ;
    private readonly catalog: MoonCatalogService,
    // le service des serveurs sources.
    private readonly upstream: MoonUpstreamService,
  // Corps du constructeur vide.
  ) {}

  // Méthode check : le rapport de santé.
  async check(): Promise<HealthReport> {
    // Attend tous les tests, lancés en même temps :
    const providers = await Promise.all(
      // depuis le catalogue,
      this.catalog
        // la liste des fournisseurs ;
        .listProviders()
        // un test par fournisseur.
        .map((provider) => this.checkProvider(provider)),
    // Fin de l'attente.
    );

    // Compteurs par état, à zéro.
    const summary = { up: 0, degraded: 0, down: 0, notConfigured: 0 };
    // Pour chaque résultat :
    for (const provider of providers) {
      // en service :
      if (provider.status === 'up') {
        // un de plus ;
        summary.up += 1;
      // dégradé :
      } else if (provider.status === 'degraded') {
        // un de plus ;
        summary.degraded += 1;
      // en panne :
      } else if (provider.status === 'down') {
        // un de plus ;
        summary.down += 1;
      // sinon (non configuré) :
      } else {
        // un de plus.
        summary.notConfigured += 1;
      // Fin du choix.
      }
    // Fin de la boucle.
    }

    // Renvoie
    return {
      // l'heure du test, en ISO 8601 ;
      checkedAt: new Date().toISOString(),
      // les compteurs ;
      summary,
      // les résultats.
      providers,
    // Fin de l'objet.
    };
  // Fin de check.
  }

  // Méthode privée checkProvider ; son paramètre :
  private async checkProvider(
    // le fournisseur.
    provider: ProviderDefinition,
  // Elle renvoie son résultat.
  ): Promise<HealthProviderResult> {
    // Première couche qui a des tuiles 2D.
    const layer = provider.layers.find((entry) => entry.scheme !== 'none');
    // Aucune :
    if (!layer || layer.scheme === 'none') {
      // renvoie
      return {
        // l'identifiant du fournisseur ;
        provider: provider.id,
        // sa nature ;
        kind: provider.kind,
        // l'état « en panne » ;
        status: 'down',
        // pas de code HTTP ;
        httpStatus: null,
        // latence nulle ;
        latencyMs: 0,
        // pas de type de contenu ;
        contentType: null,
        // le message d'erreur.
        error: 'Aucune couche 2D configurée.',
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Adresse de la première tuile de la couche, à son niveau minimal.
    const url = buildTileUrl(provider, layer, layer.minZoom, 0, 0);
    // Teste cette adresse, en demandant le format de la couche.
    const probe = await this.upstream.probe(url, { accept: layer.format });
    // Renvoie le résultat mis en forme.
    return toHealthResult(provider.id, provider.kind, probe);
  // Fin de checkProvider.
  }
// Fin du service.
}

// Fonction toHealthResult ; ses paramètres :
function toHealthResult(
  // l'identifiant du fournisseur ;
  provider: HealthProviderResult['provider'],
  // sa nature ;
  kind: HealthProviderResult['kind'],
  // le test.
  probe: UpstreamProbe,
// Elle renvoie un résultat.
): HealthProviderResult {
  // État à déterminer.
  let status: HealthProviderResult['status'];
  // Test réussi :
  if (probe.ok) {
    // en service.
    status = 'up';
  // Sinon, si le code est
  } else if (
    // 401,
    probe.status === 401 ||
    // 403,
    probe.status === 403 ||
    // ou 429
    probe.status === 429
  // (accès refusé ou trop de demandes) :
  ) {
    // dégradé.
    status = 'degraded';
  // Sinon :
  } else {
    // en panne.
    status = 'down';
  // Fin du choix.
  }

  // Renvoie
  return {
    // le fournisseur ;
    provider,
    // sa nature ;
    kind,
    // son état ;
    status,
    // le code HTTP ;
    httpStatus: probe.status,
    // la latence ;
    latencyMs: probe.latencyMs,
    // le type de contenu ;
    contentType: probe.contentType,
    // l'erreur.
    error: probe.error,
  // Fin de l'objet.
  };
// Fin de toHealthResult.
}

// ===========================================================================
// moon-db.service.ts — stockage PostgreSQL des tuiles géodésiques (tri) et Trek
// ===========================================================================
/*
 * Service moon-db — tout-en-un :
 *
 *  1. Indexation géodésique des tuiles triangulaires (icosaèdre, grille n×n
 *     puis divisions par 4), même schéma que triPlan() de geo/geodesy.
 *  2. Téléchargement et stockage PostgreSQL des tuiles NASA Trek (WMTS).
 *  3. Préchargement complet de la mosaïque Trek en arrière-plan.
 *  4. Composition à la demande des tuiles tri depuis le stockage local.
 *
 * Identifiant d'une tuile tri : f{face}-{i}-{j}-{u|d}-{digits}
 *   face   : 0..19 — face de l'icosaèdre
 *   i, j   : position dans la grille racine n×n de la face
 *   u | d  : triangle "up" ou "down" de la cellule
 *   digits : suite de 0..3, un chiffre par subdivision (niveau = length)
 *
 * Convention géodésique identique à geo/geodesy : +y = pôle Nord,
 * longitude 0 sur +z, donc lon = atan2(x, z) et lat = asin(y).
 */


// ---------------------------------------------------------------------------
// Plan géodésique de la Lune (mode tri)
// ---------------------------------------------------------------------------

// Rayon de la Lune, en mètres.
const MOON_RADIUS_M = 1_737_400;
// Plan de découpage de la Lune en triangles.
export const MOON_TRI_PLAN = triPlan(MOON_RADIUS_M, 'Lune');
// Nombre de cellules par côté de la grille de départ d'une face.
const ROOT_GRID_N = MOON_TRI_PLAN.n;

// Forme d'une emprise en longitude et latitude.
export interface BBoxLonLat {
  // west : le bord ouest.
  west: number;
  // south : le bord sud.
  south: number;
  // east : le bord est.
  east: number;
  // north : le bord nord.
  north: number;
  /** vrai si la tuile chevauche l'antiméridien (west > east en degrés bruts) */
  // antimeridian : vrai si la tuile passe par la longitude 180°.
  antimeridian: boolean;
// Fin de BBoxLonLat.
}

// Forme d'une tuile triangulaire.
export interface TriTile {
  // id : son identifiant.
  id: string;
  // face : le numéro de sa face de l'icosaèdre.
  face: number;
  // i : sa première position dans la grille de la face.
  i: number;
  // j : sa seconde position.
  j: number;
  // up : vrai pour le triangle « pointe en haut » de la cellule.
  up: boolean;
  // digits : la suite de ses divisions.
  digits: string;
  // level : son niveau (le nombre de divisions).
  level: number;
  // corners : ses trois coins, en 3D.
  corners: [Vec3, Vec3, Vec3];
  // bbox : son emprise.
  bbox: BBoxLonLat;
  // center : son centre.
  center: { lon: number; lat: number };
// Fin de TriTile.
}

// Nombre d'or.
const PHI = (1 + Math.sqrt(5)) / 2;

// Les douze sommets de l'icosaèdre, avant normalisation :
const RAW_VERTICES: ReadonlyArray<[number, number, number]> = [
  // les quatre du plan xy ;
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  // les quatre du plan yz ;
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  // les quatre du plan xz.
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
// Fin de la liste.
];

// Les mêmes sommets, ramenés sur la sphère de rayon 1.
const VERTICES: Vec3[] = RAW_VERTICES.map(([x, y, z]) => nz([x, y, z]));

/** 20 faces de l'icosaèdre (mêmes triplets que three.js IcosahedronGeometry). */
// Les vingt faces, chacune donnée par trois numéros de sommets :
const FACES: ReadonlyArray<readonly [number, number, number]> = [
  // les cinq faces autour du sommet 0 ;
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  // les cinq faces voisines ;
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  // les cinq faces autour du sommet 3 ;
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  // les cinq faces voisines.
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
// Fin de la liste.
];

// Fonction mid : le milieu de deux points,
const mid = (a: Vec3, b: Vec3): Vec3 =>
  // ramené sur la sphère.
  nz([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);

/** Coordonnées barycentriques sur une face, projetées sur la sphère. */
// Fonction bary : le point de coordonnées (u, v) sur une face.
const bary = (a: Vec3, b: Vec3, c: Vec3, u: number, v: number): Vec3 => {
  // Troisième coordonnée : ce qui reste.
  const w = 1 - u - v;
  // Renvoie, ramené sur la sphère,
  return nz([
    // le x pondéré des trois coins,
    w * a[0] + u * b[0] + v * c[0],
    // le y pondéré,
    w * a[1] + u * b[1] + v * c[1],
    // le z pondéré.
    w * a[2] + u * b[2] + v * c[2],
  // Fin du point.
  ]);
// Fin de bary.
};

// Fonction vecToLonLat : d'un point 3D vers une longitude et une latitude.
export function vecToLonLat(v: Vec3): { lon: number; lat: number } {
  // Latitude : l'arc sinus de y, en degrés.
  const lat = (Math.asin(Math.max(-1, Math.min(1, v[1]))) * 180) / Math.PI;
  // Longitude : l'angle entre x et z, en degrés.
  const lon = (Math.atan2(v[0], v[2]) * 180) / Math.PI;
  // Renvoie les deux.
  return { lon, lat };
// Fin de vecToLonLat.
}

/** Division d'un triangle en 4 (milieux normalisés sur la sphère). */
// Fonction subdivide : un des quatre petits triangles d'un triangle.
function subdivide(corners: [Vec3, Vec3, Vec3], digit: number): [Vec3, Vec3, Vec3] {
  // Les trois coins.
  const [a, b, c] = corners;
  // Milieu du premier côté.
  const ab = mid(a, b);
  // Milieu du deuxième côté.
  const bc = mid(b, c);
  // Milieu du troisième côté.
  const ca = mid(c, a);
  // Selon le chiffre :
  switch (digit) {
    // 0 :
    case 0:
      // le triangle du premier coin ;
      return [a, ab, ca];
    // 1 :
    case 1:
      // celui du deuxième coin ;
      return [ab, b, bc];
    // 2 :
    case 2:
      // celui du troisième coin ;
      return [ca, bc, c];
    // sinon :
    default:
      // le triangle du milieu.
      return [ab, bc, ca];
  // Fin du choix.
  }
// Fin de subdivide.
}

// Forme d'un identifiant : f, la face, i, j, u ou d, puis jusqu'à 16 chiffres de 0 à 3.
const ID_PATTERN = /^f(\d{1,2})-(\d{1,2})-(\d{1,2})-([ud])-([0-3]{0,16})$/;

// Forme d'un identifiant lu.
export interface ParsedTriId {
  // face : la face.
  face: number;
  // i : la première position.
  i: number;
  // j : la seconde position.
  j: number;
  // up : pointe en haut ou non.
  up: boolean;
  // digits : la suite des divisions.
  digits: string;
// Fin de ParsedTriId.
}

// Fonction parseTriId : lit un identifiant.
export function parseTriId(id: string): ParsedTriId | null {
  // Le compare à la forme attendue.
  const match = ID_PATTERN.exec(id ?? '');
  // Forme inattendue :
  if (!match) {
    // null.
    return null;
  // Fin du cas.
  }
  // Renvoie
  return {
    // la face ;
    face: Number(match[1]),
    // la première position ;
    i: Number(match[2]),
    // la seconde position ;
    j: Number(match[3]),
    // pointe en haut si la lettre est « u » ;
    up: match[4] === 'u',
    // la suite des divisions.
    digits: match[5],
  // Fin de l'objet.
  };
// Fin de parseTriId.
}

/** Géométrie complète d'une tuile tri : coins 3D, bbox lon/lat, centre. */
// Fonction buildTriTile : la géométrie d'une tuile.
export function buildTriTile(id: string, rootGridN: number): TriTile | null {
  // Lit l'identifiant.
  const parsed = parseTriId(id);
  // Illisible :
  if (!parsed) {
    // null.
    return null;
  // Fin du cas.
  }

  // Ses cinq parties.
  const { face, i, j, up, digits } = parsed;
  // Face ou position hors des bornes :
  if (face >= FACES.length || i >= rootGridN || j >= rootGridN) {
    // null.
    return null;
  // Fin du cas.
  }
  // Cellule hors du triangle de la face :
  if (up ? i + j > rootGridN - 1 : i + j > rootGridN - 2) {
    // null.
    return null;
  // Fin du cas.
  }

  // Les trois sommets de la face.
  const [A, B, C] = FACES[face].map((k) => VERTICES[k]) as [Vec3, Vec3, Vec3];
  // Fonction point : le point de la grille de la face,
  const point = (u: number, v: number) =>
    // à la position (u, v).
    bary(A, B, C, u / rootGridN, v / rootGridN);

  // Les trois coins de la tuile.
  let corners: [Vec3, Vec3, Vec3];
  // Triangle pointe en haut :
  if (up) {
    // ses trois coins.
    corners = [point(i, j), point(i + 1, j), point(i, j + 1)];
  // Sinon :
  } else {
    // les trois coins du triangle pointe en bas.
    corners = [point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
  // Fin du choix.
  }

  // Pour chaque chiffre de la suite :
  for (const digit of digits) {
    // prend le petit triangle correspondant.
    corners = subdivide(corners, Number(digit));
  // Fin de la boucle.
  }

  // bbox échantillonnée : coins, milieux d'arêtes et centroïde
  // Centre du triangle, ramené sur la sphère :
  const centroid: Vec3 = nz([
    // la moyenne des x,
    (corners[0][0] + corners[1][0] + corners[2][0]) / 3,
    // celle des y,
    (corners[0][1] + corners[1][1] + corners[2][1]) / 3,
    // celle des z.
    (corners[0][2] + corners[1][2] + corners[2][2]) / 3,
  // Fin du centre.
  ]);
  // Points qui servent à mesurer l'emprise :
  const samples: Vec3[] = [
    // le premier coin,
    corners[0],
    // le deuxième,
    corners[1],
    // le troisième,
    corners[2],
    // le milieu du premier côté,
    mid(corners[0], corners[1]),
    // du deuxième,
    mid(corners[1], corners[2]),
    // du troisième,
    mid(corners[2], corners[0]),
    // et le centre.
    centroid,
  // Fin de la liste.
  ];
  // Les mêmes points, en longitude et latitude.
  const points = samples.map(vecToLonLat);

  // Bord sud : la plus petite latitude.
  const south = Math.min(...points.map((p) => p.lat));
  // Bord nord : la plus grande.
  const north = Math.max(...points.map((p) => p.lat));

  // Bord ouest : la plus petite longitude.
  let west = Math.min(...points.map((p) => p.lon));
  // Bord est : la plus grande.
  let east = Math.max(...points.map((p) => p.lon));
  // Par défaut, la tuile ne passe pas par 180°.
  let antimeridian = false;
  // Si elle paraît large de plus de 180° :
  if (east - west > 180) {
    // la tuile chevauche l'antiméridien : on décale les longitudes négatives
    // longitudes ramenées entre 0° et 360° ;
    const shifted = points.map((p) => (p.lon < 0 ? p.lon + 360 : p.lon));
    // plus petite ;
    const westShifted = Math.min(...shifted);
    // plus grande ;
    const eastShifted = Math.max(...shifted);
    // si l'emprise est plus étroite ainsi :
    if (eastShifted - westShifted < east - west) {
      // bord ouest, ramené entre −180° et 180° ;
      west = westShifted > 180 ? westShifted - 360 : westShifted;
      // bord est, de même ;
      east = eastShifted > 180 ? eastShifted - 360 : eastShifted;
      // elle passe par 180° si l'ouest dépasse l'est.
      antimeridian = west > east;
    // Fin du cas.
    }
  // Fin du cas.
  }

  // Renvoie
  return {
    // l'identifiant ;
    id,
    // la face ;
    face,
    // la première position ;
    i,
    // la seconde position ;
    j,
    // pointe en haut ou non ;
    up,
    // la suite des divisions ;
    digits,
    // le niveau ;
    level: digits.length,
    // les coins ;
    corners,
    // l'emprise ;
    bbox: { west, south, east, north, antimeridian },
    // le centre.
    center: vecToLonLat(centroid),
  // Fin de l'objet.
  };
// Fin de buildTriTile.
}

// ---------------------------------------------------------------------------
// Source amont NASA Trek (WMTS) — seule dépendance réseau
// ---------------------------------------------------------------------------

// Niveau maximal des tuiles de NASA Trek : 8.
export const TREK_MAX_ZOOM = 8;

// Adresse de base du produit Trek :
const TREK_BASE = `${(
  // MOON_TREK_BASE_URL, ou l'adresse officielle,
  process.env.MOON_TREK_BASE_URL ?? 'https://trek.nasa.gov/tiles/Moon/EQ'
// sans barres finales, puis MOON_TREK_PRODUCT ou la mosaïque LRO WAC, puis « 1.0.0 ».
).replace(/\/+$/, '')}/${process.env.MOON_TREK_PRODUCT ?? 'LRO_WAC_Mosaic_Global_303ppd_v02'}/1.0.0`;
// Style Trek : MOON_TREK_STYLE, ou « default ».
const TREK_STYLE = process.env.MOON_TREK_STYLE ?? 'default';
// Jeu de tuiles Trek : MOON_TREK_MATRIX_SET, ou « default028mm ».
const TREK_MATRIX_SET = process.env.MOON_TREK_MATRIX_SET ?? 'default028mm';

/** Format REST WMTS de Trek : .../{z}/{y}/{x}.jpg */
// Fonction buildTrekUrl : l'adresse d'une tuile Trek.
export function buildTrekUrl(z: number, x: number, y: number): string {
  // Base, style, jeu de tuiles, niveau, ligne, colonne, « .jpg ».
  return `${TREK_BASE}/${TREK_STYLE}/${TREK_MATRIX_SET}/${z}/${y}/${x}.jpg`;
// Fin de buildTrekUrl.
}


// Fonction sleep : attend un nombre de millisecondes.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Télécharge une tuile Trek ; null si 404 ou après 2 tentatives échouées. */
// Fonction fetchTrekTile ; ses paramètres :
export async function fetchTrekTile(
  // le niveau ;
  z: number,
  // la colonne ;
  x: number,
  // la ligne.
  y: number,
// Elle renvoie les octets de la tuile, ou null.
): Promise<Buffer | null> {
  // Deux essais au plus :
  for (let attempt = 0; attempt < 2; attempt += 1) {
    // essaie
    try {
      // de télécharger la tuile,
      const response = await fetch(buildTrekUrl(z, x, y), {
        // avec abandon au bout de 20 secondes,
        signal: AbortSignal.timeout(20_000),
        // et un en-tête User-Agent.
        headers: { 'user-agent': 'moon-db/1.0 (+https://trek.nasa.gov)' },
      // Fin de l'appel.
      });
      // Code 404 :
      if (response.status === 404) {
        // null.
        return null;
      // Fin du cas.
      }
      // Autre réponse en erreur :
      if (!response.ok) {
        // erreur.
        throw new Error(`HTTP ${response.status}`);
      // Fin du cas.
      }
      // Renvoie les octets.
      return Buffer.from(await response.arrayBuffer());
    // En cas d'échec :
    } catch {
      // au second essai :
      if (attempt === 1) {
        // null.
        return null;
      // Fin du cas.
      }
      // Attend une seconde.
      await sleep(1_000);
    // Fin du cas.
    }
  // Fin de la boucle.
  }
  // Sinon : null.
  return null;
// Fin de fetchTrekTile.
}

// ---------------------------------------------------------------------------
// Schéma PostgreSQL
// ---------------------------------------------------------------------------

// Schéma de la base : la table trek_tiles (tuiles Trek, par niveau, colonne et ligne), la table tri_tiles (tuiles triangulaires, par identifiant) et un index sur le niveau des tuiles triangulaires ; chaque tuile garde ses octets, son empreinte et sa date.
// Détail du texte SQL, ligne par ligne (les lignes d'une chaîne ne peuvent pas porter de commentaire) :
// ligne 1 : crée la table trek_tiles si elle n'existe pas (début) ;
// ligne 2 : z, le niveau de la tuile, petit entier obligatoire ;
// ligne 3 : x, la colonne, entier obligatoire ;
// ligne 4 : y, la ligne, entier obligatoire ;
// ligne 5 : content_type, le type de contenu, « image/jpeg » par défaut ;
// ligne 6 : bytes, les octets de l'image, obligatoires ;
// ligne 7 : sha256, l'empreinte de 64 caractères, obligatoire ;
// ligne 8 : fetched_at, la date de téléchargement, l'instant présent par défaut ;
// ligne 9 : clé primaire sur le niveau, la colonne et la ligne ;
// ligne 10 : fin de la table trek_tiles ;
// ligne 11 : crée la table tri_tiles si elle n'existe pas (début) ;
// ligne 12 : id, l'identifiant de la tuile triangulaire, clé primaire ;
// ligne 13 : level, le niveau, petit entier obligatoire ;
// ligne 14 : bbox, l'emprise, tableau de nombres obligatoire ;
// ligne 15 : content_type, le type de contenu, « image/jpeg » par défaut ;
// ligne 16 : bytes, les octets de l'image, obligatoires ;
// ligne 17 : sha256, l'empreinte de 64 caractères, obligatoire ;
// ligne 18 : source_zoom, le niveau des tuiles d'origine, obligatoire ;
// ligne 19 : fetched_at, la date de téléchargement, l'instant présent par défaut ;
// ligne 20 : fin de la table tri_tiles ;
// ligne 21 : crée l'index tri_tiles_level_idx sur le niveau, s'il n'existe pas ;
// ligne 22 : fin du texte.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS trek_tiles (
    z            SMALLINT     NOT NULL,
    x            INTEGER      NOT NULL,
    y            INTEGER      NOT NULL,
    content_type TEXT         NOT NULL DEFAULT 'image/jpeg',
    bytes        BYTEA        NOT NULL,
    sha256       CHAR(64)     NOT NULL,
    fetched_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (z, x, y)
  );
  CREATE TABLE IF NOT EXISTS tri_tiles (
    id           TEXT         NOT NULL PRIMARY KEY,
    level        SMALLINT     NOT NULL,
    bbox         DOUBLE PRECISION[] NOT NULL,
    content_type TEXT         NOT NULL DEFAULT 'image/jpeg',
    bytes        BYTEA        NOT NULL,
    sha256       CHAR(64)     NOT NULL,
    source_zoom  SMALLINT     NOT NULL,
    fetched_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS tri_tiles_level_idx ON tri_tiles (level);
`;

// ---------------------------------------------------------------------------
// Composition d'images (sharp, chargé comme dans les services mars/*)
// ---------------------------------------------------------------------------

// Forme d'une zone d'image.
interface SharpRegion {
  // left : son bord gauche.
  left: number;
  // top : son bord haut.
  top: number;
  // width : sa largeur.
  width: number;
  // height : sa hauteur.
  height: number;
// Fin de SharpRegion.
}

// Forme d'une image sharp, limitée à ce que ce service utilise.
interface SharpImage {
  // extract : découpe d'une zone.
  extract(region: SharpRegion): SharpImage;
  // resize : changement de taille.
  resize(w: number, h: number, options?: { fit?: string }): SharpImage;
  // jpeg : sortie en JPEG.
  jpeg(options?: { quality?: number }): SharpImage;
  // toBuffer : les octets.
  toBuffer(): Promise<Buffer>;
// Fin de SharpImage.
}

// Type SharpFactory : la fonction sharp, qui prend
type SharpFactory = (
  // en entrée
  input:
    // des octets,
    | Buffer
    // ou
    | {
        // une image à créer, avec
        create: {
          // sa largeur,
          width: number;
          // sa hauteur,
          height: number;
          // son nombre de canaux,
          channels: number;
          // et sa couleur de fond ;
          background: { r: number; g: number; b: number };
        // fin de l'image à créer ;
        };
      // fin de l'entrée ;
      },
// elle rend une image, qui a en plus
) => SharpImage & {
  // composite : pose d'images,
  composite(
    // chacune avec ses octets et sa position.
    layers: Array<{ input: Buffer; left: number; top: number }>,
  // Fin de composite.
  ): SharpImage;
// Fin du type.
};

// Charge la bibliothèque d'images sharp.
const sharp = createRequire(__filename)('sharp') as SharpFactory;

// Forme du résultat d'une tuile triangulaire.
export interface TriTileResult {
  // tile : sa géométrie.
  tile: TriTile;
  // bytes : ses octets.
  bytes: Buffer;
  // sha256 : son empreinte.
  sha256: string;
  // sourceZoom : le niveau Trek dont elle est tirée.
  sourceZoom: number;
  // cached : vrai si elle vient de la base.
  cached: boolean;
// Fin de TriTileResult.
}

// Forme de l'état du préchargement.
export interface PrefetchStatus {
  // running : en cours ou non.
  running: boolean;
  // minLevel : premier niveau.
  minLevel: number;
  // maxLevel : dernier niveau.
  maxLevel: number;
  // currentLevel : niveau en cours.
  currentLevel: number;
  // concurrency : nombre de téléchargements en même temps.
  concurrency: number;
  // done : tuiles téléchargées.
  done: number;
  // failed : tuiles en échec.
  failed: number;
  // total : tuiles à télécharger.
  total: number;
  // startedAt : heure de début.
  startedAt: string | null;
  // finishedAt : heure de fin.
  finishedAt: string | null;
  // lastError : dernière erreur.
  lastError: string | null;
// Fin de PrefetchStatus.
}

// ---------------------------------------------------------------------------
// Service unique : stockage + préchargement + tuiles tri
// ---------------------------------------------------------------------------

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de la base de la Lune ; elle est prévenue de l'arrêt du module.
export class MoonDbService implements OnModuleDestroy {
  // Journal au nom de la classe.
  private readonly logger = new Logger(MoonDbService.name);
  // Groupe de connexions à PostgreSQL : aucun au départ.
  private readonly pool: Pool | null = null;
  // Promesse de création du schéma : aucune au départ.
  private schemaReady: Promise<void> | null = null;

  // État du préchargement, au départ :
  prefetchStatus: PrefetchStatus = {
    // à l'arrêt ;
    running: false,
    // premier niveau 0 ;
    minLevel: 0,
    // dernier niveau 6 ;
    maxLevel: 6,
    // niveau en cours 0 ;
    currentLevel: 0,
    // 6 téléchargements en même temps ;
    concurrency: 6,
    // aucune tuile téléchargée ;
    done: 0,
    // aucun échec ;
    failed: 0,
    // aucune tuile à télécharger ;
    total: 0,
    // pas d'heure de début ;
    startedAt: null,
    // pas d'heure de fin ;
    finishedAt: null,
    // pas d'erreur.
    lastError: null,
  // Fin de l'état.
  };

  // Constructeur.
  constructor() {
    // Adresse de la base : DATABASE_URL.
    const url = process.env.DATABASE_URL?.trim();
    // Si elle est définie :
    if (url) {
      // crée le groupe de connexions, avec
      this.pool = new Pool({
        // cette adresse,
        connectionString: url,
        // Une seule instance backend : limiter le pool pour préserver le quota PostgreSQL partagé.
        // 2 connexions au plus,
        max: 2,
        // et le chiffrement : pour une base Render,
        ssl: url.includes('render.com')
          // sans vérifier le certificat ;
          ? { rejectUnauthorized: false }
          // sinon pas de réglage.
          : undefined,
      // Fin de la création.
      });
    // Sinon :
    } else {
      // un avertissement dans le journal.
      this.logger.warn('DATABASE_URL absent : stockage des tuiles désactivé.');
    // Fin du choix.
    }
  // Fin du constructeur.
  }

  // Accesseur available.
  get available(): boolean {
    // Vrai si la base est configurée.
    return this.pool !== null;
  // Fin de available.
  }

  // Méthode privée assertPool.
  private assertPool(): Pool {
    // Base non configurée :
    if (!this.pool) {
      // erreur 503,
      throw new ServiceUnavailableException(
        // avec ce message.
        'PostgreSQL non configuré : renseignez DATABASE_URL.',
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Renvoie le groupe de connexions.
    return this.pool;
  // Fin de assertPool.
  }

  // Méthode privée ready : la base, une fois son schéma créé.
  private async ready(): Promise<Pool> {
    // Groupe de connexions.
    const pool = this.assertPool();
    // Au premier appel :
    if (!this.schemaReady) {
      // lance la création du schéma.
      this.schemaReady = pool.query(SCHEMA).then(() => undefined);
    // Fin du cas.
    }
    // Attend qu'il soit créé.
    await this.schemaReady;
    // Renvoie le groupe de connexions.
    return pool;
  // Fin de ready.
  }

  // Méthode onModuleDestroy, appelée à l'arrêt du module.
  async onModuleDestroy(): Promise<void> {
    // Ferme les connexions.
    await this.pool?.end();
  // Fin de onModuleDestroy.
  }

  // ------------------------------------------------------- tuiles tri (géométrie)

  /** Géométrie d'une tuile (bbox, coins, centre) sans télécharger l'image. */
  // Méthode describeTri : la géométrie d'une tuile.
  describeTri(id: string): TriTile {
    // La calcule.
    const tile = buildTriTile(id, ROOT_GRID_N);
    // Identifiant illisible :
    if (!tile) {
      // erreur 400,
      throw new BadRequestException(
        // qui rappelle la forme attendue.
        `Identifiant de tuile invalide : ${id}. Format : f{face}-{i}-{j}-{u|d}-{digits}.`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Niveau au-delà du plan :
    if (tile.level > MOON_TRI_PLAN.maxLevel) {
      // erreur 400,
      throw new BadRequestException(
        // avec le niveau maximal.
        `Niveau ${tile.level} hors plan (maximum ${MOON_TRI_PLAN.maxLevel}).`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Renvoie la tuile.
    return tile;
  // Fin de describeTri.
  }

  /** Image d'une tuile tri : cache PostgreSQL → composition locale. */
  // Méthode getTriTile : l'image d'une tuile.
  async getTriTile(id: string): Promise<TriTileResult> {
    // Sa géométrie.
    const tile = this.describeTri(id);

    // La cherche dans la base.
    const stored = await this.getTri(id);
    // Trouvée :
    if (stored) {
      // renvoie
      return {
        // sa géométrie ;
        tile,
        // ses octets ;
        bytes: stored.bytes,
        // son empreinte ;
        sha256: stored.sha256,
        // son niveau Trek ;
        sourceZoom: stored.sourceZoom,
        // « vient de la base ».
        cached: true,
      // Fin de l'objet.
      };
    // Fin du cas.
    }

    // Niveau Trek adapté à son emprise.
    const sourceZoom = this.chooseZoom(tile.bbox);
    // Compose l'image.
    const bytes = await this.compose(tile, sourceZoom);
    // Rien à composer :
    if (!bytes) {
      // erreur 400,
      throw new BadRequestException(
        // avec ce message.
        `Impossible de composer la tuile ${id} (aucune donnée Trek disponible).`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // La range dans la base, avec
    const sha256 = await this.putTri(
      // son identifiant,
      id,
      // son niveau,
      tile.level,
      // son emprise,
      [tile.bbox.west, tile.bbox.south, tile.bbox.east, tile.bbox.north],
      // ses octets,
      bytes,
      // et son niveau Trek.
      sourceZoom,
    // Fin du rangement.
    );
    // Renvoie la tuile, marquée « pas de la base ».
    return { tile, bytes, sha256, sourceZoom, cached: false };
  // Fin de getTriTile.
  }

  /** Niveau Trek dont la résolution couvre la bbox de la tuile. */
  // Méthode privée chooseZoom.
  private chooseZoom(bbox: BBoxLonLat): number {
    // Largeur de l'emprise en longitude : si elle passe par 180°,
    const spanLon = bbox.antimeridian
      // 360° moins l'écart ;
      ? 360 - (bbox.west - bbox.east)
      // sinon l'est moins l'ouest.
      : bbox.east - bbox.west;
    // Niveau où une tuile Trek a à peu près cette largeur.
    const zoom = Math.ceil(Math.log2(360 / Math.max(spanLon, 1e-9))) - 1;
    // Le renvoie, gardé entre 0 et 8.
    return Math.min(Math.max(zoom, 0), TREK_MAX_ZOOM);
  // Fin de chooseZoom.
  }

  // Méthode privée compose ; ses paramètres :
  private async compose(
    // la tuile ;
    tile: TriTile,
    // le niveau Trek.
    z: number,
  // Elle renvoie une image JPEG, ou null.
  ): Promise<Buffer | null> {
    // Largeur de la mosaïque Trek à ce niveau, en pixels.
    const fullW = 2 ** (z + 1) * 256;
    // Sa hauteur.
    const fullH = 2 ** z * 256;
    // Fonction px : la colonne d'une longitude dans la mosaïque.
    const px = (lon: number) => Math.round(((lon + 180) / 360) * fullW);
    // Fonction py : la ligne d'une latitude.
    const py = (lat: number) => Math.round(((90 - lat) / 180) * fullH);

    // Haut de la zone, gardé dans la mosaïque.
    const top = Math.min(Math.max(py(Math.min(tile.bbox.north, 90)), 0), fullH);
    // Bas de la zone :
    const bottom = Math.min(
      // la ligne du bord sud, pas avant 0,
      Math.max(py(Math.max(tile.bbox.south, -90)), 0),
      // pas après la hauteur.
      fullH,
    // Fin du calcul.
    );
    // Hauteur de la zone, au moins 1 pixel.
    const height = Math.max(bottom - top, 1);

    // une ou deux bandes verticales (deux si chevauchement de l'antiméridien)
    // Bandes à prendre :
    const rects =
      // si la tuile passe par 180°,
      tile.bbox.antimeridian
        // deux bandes :
        ? [
            // de son bord ouest au bord droit de la mosaïque ;
            { x0: px(tile.bbox.west), w: Math.max(fullW - px(tile.bbox.west), 1) },
            // du bord gauche de la mosaïque à son bord est.
            { x0: 0, w: Math.max(px(tile.bbox.east), 1) },
          // Fin des deux bandes.
          ]
        // Sinon une seule bande :
        : [
            // la bande
            {
              // qui commence à son bord ouest, gardé dans la mosaïque,
              x0: Math.min(Math.max(px(tile.bbox.west), 0), fullW - 1),
              // et large de l'écart entre ses bords, au moins 1 pixel.
              w: Math.max(px(tile.bbox.east) - px(tile.bbox.west), 1),
            // Fin de la bande.
            },
          // Fin de la liste.
          ];

    // Largeur totale de la toile.
    const canvasWidth = rects.reduce((sum, rect) => sum + rect.w, 0);
    // Morceaux à poser.
    const layers: Array<{ input: Buffer; left: number; top: number }> = [];

    // Position horizontale de la bande en cours dans la toile.
    let rectOffset = 0;
    // Pour chaque bande :
    for (const rect of rects) {
      // première colonne de tuiles Trek ;
      const txMin = Math.max(Math.floor(rect.x0 / 256), 0);
      // dernière colonne :
      const txMax = Math.min(
        // celle du dernier pixel de la bande,
        Math.floor((rect.x0 + rect.w - 1) / 256),
        // sans dépasser la grille.
        2 ** (z + 1) - 1,
      // Fin du calcul.
      );
      // Première ligne de tuiles Trek.
      const tyMin = Math.max(Math.floor(top / 256), 0);
      // Dernière ligne, sans dépasser la grille.
      const tyMax = Math.min(Math.floor((top + height - 1) / 256), 2 ** z - 1);

      // Pour chaque ligne de tuiles,
      for (let ty = tyMin; ty <= tyMax; ty += 1) {
        // et chaque colonne :
        for (let tx = txMin; tx <= txMax; tx += 1) {
          // tuile Trek, de la base ou téléchargée ;
          const source = await this.localTrekTile(z, tx, ty);
          // absente :
          if (!source) {
            // tuile suivante.
            continue;
          // Fin du cas.
          }

          // Bord gauche de la partie commune à la tuile et à la bande.
          const overlapX0 = Math.max(tx * 256, rect.x0);
          // Son bord droit.
          const overlapX1 = Math.min(tx * 256 + 256, rect.x0 + rect.w);
          // Son bord haut.
          const overlapY0 = Math.max(ty * 256, top);
          // Son bord bas.
          const overlapY1 = Math.min(ty * 256 + 256, top + height);
          // Sa largeur.
          const width = overlapX1 - overlapX0;
          // Sa hauteur.
          const h = overlapY1 - overlapY0;
          // Partie vide :
          if (width <= 0 || h <= 0) {
            // tuile suivante.
            continue;
          // Fin du cas.
          }

          // Morceau : la tuile Trek,
          const cropped = await sharp(source)
            // dont on découpe
            .extract({
              // à partir de ce bord gauche,
              left: overlapX0 - tx * 256,
              // et de ce bord haut,
              top: overlapY0 - ty * 256,
              // cette largeur,
              width,
              // et cette hauteur ;
              height: h,
            // fin de la découpe ;
            })
            // en JPEG, qualité 95 ;
            .jpeg({ quality: 95 })
            // ses octets.
            .toBuffer();

          // Ajoute le morceau, avec
          layers.push({
            // ses octets,
            input: cropped,
            // sa position horizontale dans la toile,
            left: rectOffset + (overlapX0 - rect.x0),
            // et sa position verticale.
            top: overlapY0 - top,
          // Fin de l'ajout.
          });
        // Fin des colonnes.
        }
      // Fin des lignes.
      }
      // Passe à la bande suivante.
      rectOffset += rect.w;
    // Fin des bandes.
    }

    // Aucun morceau :
    if (layers.length === 0) {
      // null.
      return null;
    // Fin du cas.
    }

    // Mosaïque : crée une image,
    const mosaic = await sharp({
      // avec
      create: {
        // la largeur de la toile,
        width: canvasWidth,
        // la hauteur de la zone,
        height,
        // trois canaux,
        channels: 3,
        // et un fond noir ;
        background: { r: 0, g: 0, b: 0 },
      // fin des réglages ;
      },
    // fin de la création ;
    })
      // y pose les morceaux ;
      .composite(layers)
      // l'encode en JPEG, qualité 95 ;
      .jpeg({ quality: 95 })
      // ses octets.
      .toBuffer();

    // Reprend la mosaïque,
    return sharp(mosaic)
      // la ramène à 256 × 256 pixels,
      .resize(256, 256, { fit: 'fill' })
      // l'encode en JPEG, qualité 85,
      .jpeg({ quality: 85 })
      // et renvoie les octets.
      .toBuffer();
  // Fin de compose.
  }

  /** Tuile Trek depuis PostgreSQL, avec repli amont (et stockage) si absente. */
  // Méthode privée localTrekTile ; ses paramètres :
  private async localTrekTile(
    // le niveau ;
    z: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie les octets de la tuile, ou null.
  ): Promise<Buffer | null> {
    // La cherche dans la base.
    const stored = await this.getTrek(z, x, y);
    // Trouvée :
    if (stored) {
      // renvoie ses octets.
      return stored.bytes;
    // Fin du cas.
    }
    // Sinon la télécharge.
    const fetched = await fetchTrekTile(z, x, y);
    // Si elle existe,
    if (fetched) {
      // la range dans la base.
      await this.putTrek(z, x, y, fetched);
    // Fin du cas.
    }
    // Renvoie les octets, ou null.
    return fetched;
  // Fin de localTrekTile.
  }

  // ------------------------------------------------------- stockage PostgreSQL

  // Méthode getTrek ; ses paramètres :
  async getTrek(
    // le niveau ;
    z: number,
    // la colonne ;
    x: number,
    // la ligne.
    y: number,
  // Elle renvoie les octets et la date de la tuile, ou null.
  ): Promise<{ bytes: Buffer; fetchedAt: Date } | null> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    const result = await pool.query(
      // les octets et la date de la tuile Trek à ces coordonnées ;
      'SELECT bytes, fetched_at FROM trek_tiles WHERE z = $1 AND x = $2 AND y = $3',
      // ses trois valeurs.
      [z, x, y],
    // Fin de la requête.
    );
    // Aucune ligne :
    if (result.rowCount === 0) {
      // null.
      return null;
    // Fin du cas.
    }
    // Renvoie
    return {
      // les octets ;
      bytes: result.rows[0].bytes as Buffer,
      // la date.
      fetchedAt: new Date(result.rows[0].fetched_at),
    // Fin de l'objet.
    };
  // Fin de getTrek.
  }

  // Méthode putTrek : range une tuile Trek.
  async putTrek(z: number, x: number, y: number, bytes: Buffer): Promise<void> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    await pool.query(
      // ajoute la tuile avec ses coordonnées, ses octets et son empreinte ; si elle existe déjà, ne fait rien ;
      // ligne 2 du texte : les cinq valeurs, passées en paramètres ;
      // ligne 3 du texte : en cas de conflit sur le niveau, la colonne et la ligne, ne rien faire ;
      `INSERT INTO trek_tiles (z, x, y, bytes, sha256)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (z, x, y) DO NOTHING`,
      // ses cinq valeurs.
      [z, x, y, bytes, sha256Hex(bytes)],
    // Fin de la requête.
    );
  // Fin de putTrek.
  }

  // Méthode existingTrekKeys : les tuiles Trek déjà dans la base à un niveau.
  async existingTrekKeys(z: number): Promise<Set<string>> {
    // Base prête.
    const pool = await this.ready();
    // Requête : les colonnes et les lignes des tuiles de ce niveau.
    const result = await pool.query('SELECT x, y FROM trek_tiles WHERE z = $1', [z]);
    // Renvoie l'ensemble des clés « colonne:ligne ».
    return new Set(result.rows.map((row) => `${row.x}:${row.y}`));
  // Fin de existingTrekKeys.
  }

  // Méthode getTri ; son paramètre :
  async getTri(
    // l'identifiant.
    id: string,
  // Elle renvoie, ou null :
  ): Promise<{
    // le niveau ;
    level: number;
    // l'emprise ;
    bbox: number[];
    // les octets ;
    bytes: Buffer;
    // l'empreinte ;
    sha256: string;
    // le niveau Trek.
    sourceZoom: number;
  // Fin du type.
  } | null> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    const result = await pool.query(
      // ces cinq colonnes de la tuile triangulaire qui porte cet identifiant ;
      'SELECT level, bbox, bytes, sha256, source_zoom FROM tri_tiles WHERE id = $1',
      // sa valeur.
      [id],
    // Fin de la requête.
    );
    // Aucune ligne :
    if (result.rowCount === 0) {
      // null.
      return null;
    // Fin du cas.
    }
    // Première ligne du résultat.
    const row = result.rows[0];
    // Renvoie
    return {
      // le niveau ;
      level: row.level as number,
      // l'emprise ;
      bbox: row.bbox as number[],
      // les octets ;
      bytes: row.bytes as Buffer,
      // l'empreinte ;
      sha256: row.sha256 as string,
      // le niveau Trek.
      sourceZoom: row.source_zoom as number,
    // Fin de l'objet.
    };
  // Fin de getTri.
  }

  // Méthode putTri ; ses paramètres :
  async putTri(
    // l'identifiant ;
    id: string,
    // le niveau ;
    level: number,
    // l'emprise ;
    bbox: number[],
    // les octets ;
    bytes: Buffer,
    // le niveau Trek.
    sourceZoom: number,
  // Elle renvoie l'empreinte.
  ): Promise<string> {
    // Base prête.
    const pool = await this.ready();
    // Empreinte des octets.
    const sha = sha256Hex(bytes);
    // Requête :
    await pool.query(
      // ajoute la tuile triangulaire avec ses six valeurs ; si elle existe déjà, ne fait rien ;
      // ligne 2 du texte : les six valeurs, passées en paramètres ;
      // ligne 3 du texte : en cas de conflit sur l'identifiant, ne rien faire ;
      `INSERT INTO tri_tiles (id, level, bbox, bytes, sha256, source_zoom)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      // ses six valeurs.
      [id, level, bbox, bytes, sha, sourceZoom],
    // Fin de la requête.
    );
    // Renvoie l'empreinte.
    return sha;
  // Fin de putTri.
  }

  // Méthode countTrek : le nombre de tuiles Trek, à un niveau ou en tout.
  async countTrek(level?: number): Promise<number> {
    // Base prête.
    const pool = await this.ready();
    // Résultat :
    const result =
      // sans niveau,
      level === undefined
        // le nombre de toutes les tuiles ;
        ? await pool.query('SELECT COUNT(*)::int AS n FROM trek_tiles')
        // sinon la requête
        : await pool.query(
            // qui compte celles de ce niveau,
            'SELECT COUNT(*)::int AS n FROM trek_tiles WHERE z = $1',
            // avec sa valeur.
            [level],
          // Fin de la requête.
          );
    // Renvoie le nombre.
    return result.rows[0].n as number;
  // Fin de countTrek.
  }

  // Méthode countTri : le nombre de tuiles triangulaires.
  async countTri(): Promise<number> {
    // Base prête.
    const pool = await this.ready();
    // Requête : leur nombre.
    const result = await pool.query('SELECT COUNT(*)::int AS n FROM tri_tiles');
    // Le renvoie.
    return result.rows[0].n as number;
  // Fin de countTri.
  }

  // Méthode dbSizeBytes : la taille de la base, en octets.
  async dbSizeBytes(): Promise<number> {
    // Base prête.
    const pool = await this.ready();
    // Requête :
    const result = await pool.query(
      // la taille de la base courante.
      'SELECT pg_database_size(current_database())::bigint AS size',
    // Fin de la requête.
    );
    // La renvoie, en nombre.
    return Number(result.rows[0].size);
  // Fin de dbSizeBytes.
  }

  // ------------------------------------------------------- préchargement Trek

  /** Lance le téléchargement complet de la mosaïque Trek en arrière-plan. */
  // Méthode startPrefetch ; son paramètre, facultatif :
  startPrefetch(request: {
    // le premier niveau ;
    minLevel?: number;
    // le dernier niveau ;
    maxLevel?: number;
    // le nombre de téléchargements en même temps.
    concurrency?: number;
  // Elle renvoie l'état du préchargement.
  } = {}): PrefetchStatus {
    // Déjà en cours :
    if (this.prefetchStatus.running) {
      // erreur 400.
      throw new BadRequestException('Un téléchargement est déjà en cours.');
    // Fin du cas.
    }

    // Premier niveau : 0 par défaut.
    const minLevel = Math.trunc(request.minLevel ?? 0);
    // Dernier niveau : 6 par défaut.
    const maxLevel = Math.trunc(request.maxLevel ?? 6);
    // Téléchargements en même temps :
    const concurrency = Math.min(
      // 6 par défaut, au moins 1,
      Math.max(Math.trunc(request.concurrency ?? 6), 1),
      // 16 au plus.
      16,
    // Fin du calcul.
    );

    // Niveaux hors des bornes ou inversés :
    if (minLevel < 0 || maxLevel > TREK_MAX_ZOOM || minLevel > maxLevel) {
      // erreur 400,
      throw new BadRequestException(
        // avec les bornes.
        `Niveaux invalides : 0 à ${TREK_MAX_ZOOM}, minLevel <= maxLevel.`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }

    // Nouvel état :
    this.prefetchStatus = {
      // en cours ;
      running: true,
      // premier niveau ;
      minLevel,
      // dernier niveau ;
      maxLevel,
      // niveau en cours : le premier ;
      currentLevel: minLevel,
      // téléchargements en même temps ;
      concurrency,
      // aucune tuile téléchargée ;
      done: 0,
      // aucun échec ;
      failed: 0,
      // aucune tuile à télécharger pour l'instant ;
      total: 0,
      // heure de début ;
      startedAt: new Date().toISOString(),
      // pas d'heure de fin ;
      finishedAt: null,
      // pas d'erreur.
      lastError: null,
    // Fin de l'état.
    };

    // Lance le préchargement sans l'attendre ; s'il échoue :
    void this.runPrefetch().catch((error: unknown) => {
      // garde l'erreur,
      this.prefetchStatus.lastError =
        // son message ou son texte ;
        error instanceof Error ? error.message : String(error);
      // marque l'arrêt ;
      this.prefetchStatus.running = false;
      // l'écrit dans le journal,
      this.logger.error(
        // avec l'erreur.
        `Préchargement interrompu : ${this.prefetchStatus.lastError}`,
      // Fin de l'écriture.
      );
    // Fin du cas.
    });

    // Renvoie l'état.
    return this.prefetchStatus;
  // Fin de startPrefetch.
  }

  // Méthode privée runPrefetch.
  private async runPrefetch(): Promise<void> {
    // État du préchargement.
    const status = this.prefetchStatus;

    // Pour chaque niveau, tant que le préchargement tourne :
    for (let z = status.minLevel; z <= status.maxLevel && status.running; z += 1) {
      // note le niveau en cours ;
      status.currentLevel = z;
      // nombre de colonnes ;
      const columns = 2 ** (z + 1);
      // nombre de lignes.
      const rows = 2 ** z;

      // Tuiles déjà dans la base.
      const existing = await this.existingTrekKeys(z);
      // File des tuiles à télécharger.
      const queue: Array<[number, number]> = [];
      // Pour chaque ligne,
      for (let y = 0; y < rows; y += 1) {
        // et chaque colonne :
        for (let x = 0; x < columns; x += 1) {
          // si la tuile n'est pas dans la base,
          if (!existing.has(`${x}:${y}`)) {
            // l'ajoute à la file.
            queue.push([x, y]);
          // Fin du cas.
          }
        // Fin des colonnes.
        }
      // Fin des lignes.
      }

      // Nombre de tuiles à télécharger.
      status.total = queue.length;
      // Remet à zéro les tuiles téléchargées,
      status.done = 0;
      // et les échecs.
      status.failed = 0;
      // Écrit dans le journal
      this.logger.log(
        // le niveau et le nombre de tuiles.
        `Niveau ${z}/${TREK_MAX_ZOOM} : ${queue.length} tuile(s) à télécharger.`,
      // Fin de l'écriture.
      );

      // Rang de la prochaine tuile.
      let cursor = 0;
      // Fonction worker : un ouvrier.
      const worker = async (): Promise<void> => {
        // Tant que le préchargement tourne :
        while (status.running) {
          // prend le rang suivant ;
          const index = cursor;
          // avance le rang ;
          cursor += 1;
          // plus de tuile :
          if (index >= queue.length) {
            // fin.
            return;
          // Fin du cas.
          }
          // Colonne et ligne de la tuile.
          const [x, y] = queue[index];
          // La télécharge.
          const bytes = await fetchTrekTile(z, x, y);
          // Si elle existe :
          if (bytes) {
            // la range dans la base ;
            await this.putTrek(z, x, y, bytes);
            // une tuile de plus.
            status.done += 1;
          // Sinon :
          } else {
            // un échec de plus.
            status.failed += 1;
          // Fin du choix.
          }
        // Fin de la boucle.
        }
      // Fin de worker.
      };

      // Lance les ouvriers et attend leur fin.
      await Promise.all(Array.from({ length: status.concurrency }, worker));
    // Fin des niveaux.
    }

    // Marque l'arrêt.
    status.running = false;
    // Note l'heure de fin.
    status.finishedAt = new Date().toISOString();
    // Écrit dans le journal
    this.logger.log(
      // le bilan.
      `Préchargement terminé : ${status.done} tuile(s), ${status.failed} échec(s).`,
    // Fin de l'écriture.
    );
  // Fin de runPrefetch.
  }
// Fin du service.
}
