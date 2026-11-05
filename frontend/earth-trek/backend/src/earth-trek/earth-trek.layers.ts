// Fonds d'imagerie de la Terre pour le « Trek de la Terre » : Esri World Imagery, Mapbox et Maxar (Vantor).
// Les clés restent sur le serveur : le navigateur ne voit que /api/v1/earth-trek/tiles/{couche}/{z}/{x}/{y}.
//
// Variables d'environnement :
//   ESRI_API_KEY            facultative : jeton ArcGIS Location Platform (sinon service public d'Esri)
//   EARTH_TREK_ESRI_PUBLIC  'false' pour interdire le service Esri sans jeton
//   MAPBOX_ACCESS_TOKEN     jeton Mapbox (pk.…)
//   MAXAR_API_KEY           clé Maxar Geospatial Platform (Vantor depuis octobre 2025)
//   MAXAR_API_BASE          défaut https://api.maxar.com
//   MAXAR_VIVID_FILTER      filtre CQL du fond Vivid, défaut productName LIKE 'VIVID%' OR productName='BASE_MOSAIC'

export type EarthTrekEnv = Partial<Record<
  'ESRI_API_KEY' | 'EARTH_TREK_ESRI_PUBLIC' | 'MAPBOX_ACCESS_TOKEN' | 'MAXAR_API_KEY' | 'MAXAR_API_BASE' | 'MAXAR_VIVID_FILTER',
  string
>>;

export type LayerKind = 'imagery' | 'hybrid';

export interface UpstreamRequest {
  url: string;
  headers?: Record<string, string>;
}

export interface EarthTrekLayerDef {
  id: string;
  label: string;
  description: string;
  provider: 'esri' | 'mapbox' | 'maxar';
  kind: LayerKind;
  minZoom: number;
  maxZoom: number;
  /** Pixels de l'image renvoyée (512 pour les tuiles « retina » sur la grille 256 classique). */
  tileSize: number;
  attribution: string;
  attributionUrl: string;
  experimental?: boolean;
  /** Message si la couche n'est pas utilisable avec cette configuration, sinon null. */
  missing(env: EarthTrekEnv): string | null;
  request(z: number, x: number, y: number, env: EarthTrekEnv): UpstreamRequest;
}

const maxarBase = (env: EarthTrekEnv) => (env.MAXAR_API_BASE || 'https://api.maxar.com').replace(/\/+$/, '');

/** GetTile WMTS (KVP) de la plateforme Maxar, grille Web Mercator : TileMatrix « EPSG:3857:z ». */
function maxarWmts(path: string, z: number, x: number, y: number, env: EarthTrekEnv, cql?: string): UpstreamRequest {
  const params = new URLSearchParams({
    service: 'WMTS',
    request: 'GetTile',
    version: '1.0.0',
    layer: 'Maxar:Imagery',
    styles: 'raster',
    tileMatrixSet: 'EPSG:3857',
    tileMatrix: `EPSG:3857:${z}`,
    tileCol: String(x),
    tileRow: String(y),
    format: 'image/jpeg',
  });
  if (cql) params.set('cql_filter', cql);
  // La clé passe par l'en-tête dédié, jamais dans une URL qui pourrait finir dans des journaux.
  return { url: `${maxarBase(env)}${path}?${params}`, headers: { 'maxar-api-key': env.MAXAR_API_KEY || '' } };
}

const ESRI_ATTRIBUTION = 'Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const MAPBOX_ATTRIBUTION = '© Mapbox © OpenStreetMap © Maxar';
const MAXAR_ATTRIBUTION = '© Vantor (Maxar)';

export const EARTH_TREK_LAYERS: EarthTrekLayerDef[] = [
  {
    id: 'esri-world-imagery',
    label: 'Esri World Imagery',
    description: 'Mosaïque mondiale haute résolution (Esri, Maxar, Earthstar Geographics)',
    provider: 'esri',
    kind: 'imagery',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    attribution: ESRI_ATTRIBUTION,
    attributionUrl: 'https://www.esri.com/',
    missing: (env) => (!env.ESRI_API_KEY && env.EARTH_TREK_ESRI_PUBLIC === 'false'
      ? 'Ajoutez ESRI_API_KEY (ArcGIS Location Platform) ou autorisez le service public.'
      : null),
    request: (z, x, y, env) => (env.ESRI_API_KEY
      ? { url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${encodeURIComponent(env.ESRI_API_KEY)}` }
      // Ordre Esri : ligne (y) puis colonne (x).
      : { url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` }),
  },
  {
    id: 'mapbox-satellite',
    label: 'Mapbox Satellite',
    description: 'Imagerie satellite et aérienne Mapbox, rendu haute densité',
    provider: 'mapbox',
    kind: 'imagery',
    minZoom: 0,
    maxZoom: 22,
    tileSize: 512,
    attribution: MAPBOX_ATTRIBUTION,
    attributionUrl: 'https://www.mapbox.com/about/maps/',
    missing: (env) => (env.MAPBOX_ACCESS_TOKEN ? null : 'Ajoutez MAPBOX_ACCESS_TOKEN.'),
    request: (z, x, y, env) => ({
      url: `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}@2x.jpg90?access_token=${encodeURIComponent(env.MAPBOX_ACCESS_TOKEN || '')}`,
    }),
  },
  {
    id: 'mapbox-satellite-streets',
    label: 'Mapbox Satellite Streets',
    description: 'Satellite Mapbox avec routes, lieux et frontières',
    provider: 'mapbox',
    kind: 'hybrid',
    minZoom: 0,
    maxZoom: 22,
    tileSize: 512,
    attribution: MAPBOX_ATTRIBUTION,
    attributionUrl: 'https://www.mapbox.com/about/maps/',
    missing: (env) => (env.MAPBOX_ACCESS_TOKEN ? null : 'Ajoutez MAPBOX_ACCESS_TOKEN.'),
    // Tuiles statiques de style, grille 256 (même z/x/y que les autres fonds), image 512 px avec @2x.
    request: (z, x, y, env) => ({
      url: `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/${z}/${x}/${y}@2x?access_token=${encodeURIComponent(env.MAPBOX_ACCESS_TOKEN || '')}`,
    }),
  },
  {
    id: 'maxar-vivid',
    label: 'Maxar Vivid',
    description: 'Fond Vivid Maxar (Vantor) : mosaïque sans nuages, 30 cm à 15 cm',
    provider: 'maxar',
    kind: 'imagery',
    minZoom: 0,
    maxZoom: 21,
    tileSize: 256,
    attribution: MAXAR_ATTRIBUTION,
    attributionUrl: 'https://developers.maxar.com/',
    missing: (env) => (env.MAXAR_API_KEY ? null : 'Ajoutez MAXAR_API_KEY (Maxar Geospatial Platform).'),
    request: (z, x, y, env) => maxarWmts('/basemaps/v1/ogc/gwc/service/wmts', z, x, y, env,
      env.MAXAR_VIVID_FILTER || "productName LIKE 'VIVID%' OR productName='BASE_MOSAIC'"),
  },
  {
    id: 'maxar-streaming',
    label: 'Maxar Streaming',
    description: 'Images Maxar (Vantor) les plus récentes disponibles, archive comprise',
    provider: 'maxar',
    kind: 'imagery',
    minZoom: 0,
    maxZoom: 21,
    tileSize: 256,
    experimental: true,
    attribution: MAXAR_ATTRIBUTION,
    attributionUrl: 'https://developers.maxar.com/',
    missing: (env) => (env.MAXAR_API_KEY ? null : 'Ajoutez MAXAR_API_KEY (Maxar Geospatial Platform).'),
    request: (z, x, y, env) => maxarWmts('/streaming/v1/ogc/gwc/service/wmts', z, x, y, env),
  },
];
