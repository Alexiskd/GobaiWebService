// Type (effacé à la compilation) du tampon d'octets de Node.
import type { Buffer } from 'node:buffer';

// Liste des identifiants des fournisseurs :
export const PROVIDER_IDS = [
  // NASA Mars Trek ;
  'mars-trek',
  // USGS Astrogeology ;
  'usgs-astro-mars',
  // OpenPlanetaryMap ;
  'opm-mars',
  // Murray Lab.
  'murray-lab',
// Fin de la liste, figée.
] as const;

// Type ProviderId : un des identifiants de la liste.
export type ProviderId = (typeof PROVIDER_IDS)[number];
// Type ProviderKind : la nature d'un fournisseur.
export type ProviderKind = 'wmts' | 'wms' | 'xyz' | '3d-tiles';
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
  // kind : la nature (WMTS, WMS, XYZ ou 3D Tiles).
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
  // kind : la nature (WMTS, WMS, XYZ ou 3D Tiles).
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
  // kind : la nature (WMTS, WMS, XYZ ou 3D Tiles).
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
    // kind : la nature (WMTS, WMS, XYZ ou 3D Tiles).
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
  // kind : la nature (WMTS, WMS, XYZ ou 3D Tiles).
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
  // kind : la nature (WMTS, WMS, XYZ ou 3D Tiles).
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
