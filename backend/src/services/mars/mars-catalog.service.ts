import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MARS_CONFIG, type MarsConfig } from './mars.config';
import type {
  CuratedLayer,
  LayerDetail,
  LayerSummary,
  ProviderDefinition,
  ProviderId,
  ProviderSummary,
} from './mars.types';
import { buildTileUrl } from './tile-url';

const NASA_ATTRIBUTION = 'NASA Mars Trek — Viking MDIM21 (NASA/GSFC/USGS)';
const USGS_ATTRIBUTION = 'USGS Astrogeology Science Center';
const OPM_ATTRIBUTION =
  'OpenPlanetaryMap (OPM) — données NASA/USGS, tuiles CARTO';
const CESIUM_ATTRIBUTION = 'Cesium ion — Cesium Mars (données NASA)';
const CTX_ATTRIBUTION =
  'Source: NASA/JPL/MSSS/Caltech Murray Lab/Esri — Global CTX Mosaic of Mars';
const HIDDEN_PROVIDER_IDS: ReadonlySet<ProviderId> = new Set([
  'usgs-astro-mars',
  'opm-mars',
]);

function tileUrlTemplate(providerId: string, layerId: string): string {
  return `/api/v1/mars/providers/${providerId}/layers/${layerId}/tile/{z}/{x}/{y}`;
}

function toLayerSummary(
  providerId: ProviderId,
  layer: CuratedLayer,
): LayerSummary {
  return {
    id: layer.id,
    title: layer.title,
    kind: layer.kind,
    scheme: layer.scheme,
    crs: layer.crs,
    minZoom: layer.minZoom,
    maxZoom: layer.maxZoom,
    tileSize: layer.tileSize,
    format: layer.format,
    tileUrlTemplate: tileUrlTemplate(providerId, layer.id),
  };
}

function toProviderSummary(provider: ProviderDefinition): ProviderSummary {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    description: provider.description,
    docsUrl: provider.docsUrl,
    attribution: provider.attribution,
    license: provider.license,
    requiresToken: provider.requiresToken,
    capabilitiesUrl: provider.capabilitiesUrl ?? null,
    notes: provider.notes,
    layers: provider.layers.map((layer) => toLayerSummary(provider.id, layer)),
  };
}

@Injectable()
export class MarsCatalogService {
  private readonly providers: ProviderDefinition[];
  private readonly providerMap: Map<string, ProviderDefinition>;

  constructor(@Inject(MARS_CONFIG) config: MarsConfig) {
    this.providers = buildProviders(config);
    this.providerMap = new Map(
      this.providers.map((provider) => [provider.id, provider]),
    );
  }

  listProviders(): ProviderDefinition[] {
    return this.providers.filter(
      (provider) => !HIDDEN_PROVIDER_IDS.has(provider.id),
    );
  }

  listSummaries(): ProviderSummary[] {
    return this.listProviders().map((provider) => toProviderSummary(provider));
  }

  getProviderSummary(providerId: string): ProviderSummary {
    return toProviderSummary(this.getProvider(providerId));
  }

  getProvider(providerId: string): ProviderDefinition {
    const provider = this.providerMap.get(providerId);
    if (!provider) {
      throw new NotFoundException(
        `Fournisseur martien inconnu : ${providerId}`,
      );
    }
    return provider;
  }

  getLayer(
    providerId: string,
    layerId: string,
  ): { provider: ProviderDefinition; layer: CuratedLayer } {
    const provider = this.getProvider(providerId);
    const layer = provider.layers.find((entry) => entry.id === layerId);
    if (!layer) {
      throw new NotFoundException(
        `Couche inconnue pour ${providerId} : ${layerId}`,
      );
    }
    return { provider, layer };
  }

  summarizeLayer(
    provider: ProviderDefinition,
    layer: CuratedLayer,
  ): LayerSummary {
    return toLayerSummary(provider.id, layer);
  }

  describeLayer(providerId: string, layerId: string): LayerDetail {
    const { provider, layer } = this.getLayer(providerId, layerId);

    return {
      ...toLayerSummary(provider.id, layer),
      description: layer.description,
      upstreamLayer: layer.upstreamLayer,
      attribution: layer.attribution,
      license: layer.license,
      tileMatrixSet: layer.wmts?.matrixSet ?? null,
      style: layer.wmts?.style ?? null,
      xyzTemplate: layer.xyz?.urlTemplate ?? null,
      tiles3dAssetId: layer.tiles3d?.assetId ?? null,
      sampleUpstreamUrl:
        layer.scheme === 'none'
          ? null
          : buildTileUrl(provider, layer, layer.minZoom, 0, 0),
    };
  }
}

function buildProviders(config: MarsConfig): ProviderDefinition[] {
  const trekBase = `${config.trekBaseUrl}/${config.trekProduct}/1.0.0`;
  const trekCapabilities = `${trekBase}/WMTSCapabilities.xml`;
  const usgsGetMap = `${config.usgsBaseUrl}?map=${config.usgsMap}`;
  const usgsCapabilities = `${usgsGetMap}&service=WMS&request=GetCapabilities`;

  const wmtsLayer: CuratedLayer = {
    id: 'viking-mdim21',
    title: 'Viking MDIM21 — mosaïque globale couleur',
    description:
      'Mosaïque globale couleur Viking MDIM21 (232 m/px), diffusée par Mars Trek.',
    upstreamLayer: config.trekProduct,
    kind: 'wmts',
    scheme: 'equirectangular',
    crs: 'EPSG:104905',
    minZoom: 0,
    maxZoom: config.trekMaxZoom,
    tileSize: 256,
    format: 'image/jpeg',
    attribution: NASA_ATTRIBUTION,
    license: 'Données NASA ouvertes',
    wmts: {
      baseUrl: trekBase,
      style: config.trekStyle,
      matrixSet: config.trekMatrixSet,
      extension: 'jpg',
    },
  };

  const usgsWms = {
    getMapUrl: usgsGetMap,
    version: '1.3.0' as const,
    srs: 'EPSG:4326',
    axisOrder: 'yx' as const,
  };

  const usgsLayers: CuratedLayer[] = [
    {
      id: 'mola-themis-blend',
      title: 'MOLA + THEMIS — composition couleur',
      description:
        'Composition de la topographie MOLA et de l’imagerie infrarouge THEMIS, fond de carte martien classique.',
      upstreamLayer: 'MOLA_THEMIS_blend',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'EPSG:4326',
      minZoom: 0,
      maxZoom: config.usgsMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      wms: usgsWms,
    },
    {
      id: 'mdim21-color',
      title: 'MDIM21 — mosaïque couleur',
      description:
        'Mosaïque globale Viking MDIM21 en couleur, rendue par le serveur WMS de l’USGS.',
      upstreamLayer: 'MDIM21_color',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'EPSG:4326',
      minZoom: 0,
      maxZoom: config.usgsMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      wms: usgsWms,
    },
    {
      id: 'mdim21',
      title: 'MDIM21 — mosaïque globale',
      description: 'Mosaïque globale Viking MDIM21 en niveaux de gris.',
      upstreamLayer: 'MDIM21',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'EPSG:4326',
      minZoom: 0,
      maxZoom: config.usgsMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      wms: usgsWms,
    },
    {
      id: 'mola-color',
      title: 'MOLA — relief ombré couleur',
      description:
        'Relief ombré coloré issu de l’altimètre laser MOLA (Mars Global Surveyor).',
      upstreamLayer: 'MOLA_color',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'EPSG:4326',
      minZoom: 0,
      maxZoom: config.usgsMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      wms: usgsWms,
    },
    {
      id: 'mola-bw',
      title: 'MOLA — relief ombré niveaux de gris',
      description: 'Relief ombré MOLA en niveaux de gris.',
      upstreamLayer: 'MOLA_bw',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'EPSG:4326',
      minZoom: 0,
      maxZoom: config.usgsMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      wms: usgsWms,
    },
    {
      id: 'hrsc-mola-hillshade',
      title: 'HRSC + MOLA — relief ombré',
      description:
        'Relief ombré combinant la caméra stéréo HRSC (Mars Express) et l’altimétrie MOLA.',
      upstreamLayer: 'HRSC_MOLA_Blend_Hillshade',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'EPSG:4326',
      minZoom: 0,
      maxZoom: config.usgsMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      wms: usgsWms,
    },
  ];

  const opmBasemap: CuratedLayer = {
    id: 'mars-basemap-v0-2',
    title: 'OPM Mars Basemap v0.2',
    description:
      'Fond de carte communautaire OpenPlanetaryMap combinant rasters et vecteurs martiens.',
    upstreamLayer: 'opm-mars-basemap-v0-2',
    kind: 'xyz',
    scheme: 'equirectangular',
    crs: 'IAU_2015:49900',
    minZoom: 0,
    maxZoom: config.opmMaxZoom,
    tileSize: 256,
    format: 'image/png',
    attribution: OPM_ATTRIBUTION,
    license: 'Voir OpenPlanetaryMap / CARTO',
    xyz: {
      urlTemplate: config.opmTileUrl,
      tms: false,
    },
  };

  const opmHillshade: CuratedLayer = {
    id: 'mars-hillshade',
    title: 'OPM Mars Hillshade',
    description:
      'Relief ombré martien OpenPlanetaryMap, à superposer au fond de carte.',
    upstreamLayer: 'opm-mars-hillshade',
    kind: 'xyz',
    scheme: 'equirectangular',
    crs: 'IAU_2015:49900',
    minZoom: 0,
    maxZoom: config.opmMaxZoom,
    tileSize: 256,
    format: 'image/png',
    attribution: OPM_ATTRIBUTION,
    license: 'Voir OpenPlanetaryMap / CARTO',
    xyz: {
      urlTemplate: config.opmHillshadeUrl,
      tms: false,
    },
  };

  const ctxMosaic: CuratedLayer = {
    id: 'ctx-mosaic-v01',
    title: 'Global CTX Mosaic — Murray Lab (Caltech)',
    description:
      'Mosaïque globale de Mars à 5,0 m/px assemblée à partir de 86 571 images CTX (Mars Reconnaissance Orbiter) par le Murray Lab du California Institute of Technology.',
    upstreamLayer: 'OnMars/CTX1',
    kind: 'xyz',
    scheme: 'equirectangular',
    crs: 'IAU2000:49900',
    minZoom: 0,
    maxZoom: config.ctxMaxZoom,
    tileSize: 512,
    format: 'image/jpeg',
    attribution: CTX_ATTRIBUTION,
    license: 'Libre avec attribution (NASA/JPL/MSSS/Caltech Murray Lab/Esri)',
    xyz: {
      urlTemplate: config.ctxTileUrl,
      tms: false,
    },
  };

  const cesiumLayer: CuratedLayer = {
    id: 'mars-terrain',
    title: 'Cesium Mars',
    description:
      'Jeu 3D Tiles global de Mars (imagerie et terrain), hébergé par Cesium ion.',
    upstreamLayer: 'Cesium Mars',
    kind: '3d-tiles',
    scheme: 'none',
    crs: 'IAU_2015:49901',
    minZoom: 0,
    maxZoom: 0,
    tileSize: 0,
    format: 'application/json',
    attribution: CESIUM_ATTRIBUTION,
    license: 'Cesium ion Terms of Service',
    tiles3d: { assetId: config.cesiumAssetId },
  };

  return [
    {
      id: 'mars-trek',
      name: 'NASA Mars Trek (Solar System Treks)',
      kind: 'wmts',
      description:
        'Service WMTS officiel de la NASA pour les mosaïques martiennes.',
      docsUrl: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars',
      attribution: NASA_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      requiresToken: false,
      capabilitiesUrl: trekCapabilities,
      notes: [
        'Tuilage équirectangulaire 2:1, 2 tuiles en largeur au niveau 0.',
        'Le produit Viking MDIM21 s’arrête au niveau 7 (256 tuiles en largeur).',
        'CRS EPSG:104905 (sphère Mars 2015).',
      ],
      layers: [wmtsLayer],
    },
    {
      id: 'usgs-astro-mars',
      name: 'USGS Astrogeology WMS — Mars',
      kind: 'wms',
      description:
        'Serveur WMS de l’USGS Astrogeology pour les couches martiennes globales.',
      docsUrl: 'https://astrowebmaps.wr.usgs.gov/',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      requiresToken: false,
      capabilitiesUrl: usgsCapabilities,
      notes: [
        'WMS 1.3.0 en EPSG:4326 : l’ordre des axes de BBOX est latitude, longitude.',
        'La carte utilisée est /maps/mars/mars_simp_cyl.map.',
        'Les jeux de quads (Mars5M_Quads, Mars2M_Quads, Mars500K_Quads) sont indexés et ne sont pas exposés ici.',
      ],
      layers: usgsLayers,
    },
    {
      id: 'opm-mars',
      name: 'OpenPlanetaryMap (OPM) — Mars',
      kind: 'xyz',
      description:
        'Tuiles XYZ des fonds de carte martiens OpenPlanetaryMap, en projection équirectangulaire.',
      docsUrl:
        'http://openplanetarymap.org/basemaps/mars/opm-mars-basemap-v0-2/',
      attribution: OPM_ATTRIBUTION,
      license: 'Voir OpenPlanetaryMap / CARTO',
      requiresToken: false,
      notes: [
        'Pyramide équirectangulaire 2:1 : 2×1 tuiles au niveau 0.',
        'La résolution utile s’arrête autour du niveau 6.',
        'Le serveur CARTO peut renvoyer une image hors des limites réelles de la pyramide : validez la couverture côté client.',
        'CRS de référence : IAU_2015:49900 (sphère Mars 2015).',
      ],
      layers: [opmBasemap, opmHillshade],
    },
    {
      id: 'murray-lab',
      name: 'Murray Lab — Global CTX Mosaic (Caltech)',
      kind: 'xyz',
      description:
        'Mosaïque CTX globale de Mars (5,7 térapixels, 5,0 m/px natif) du Murray Lab (Caltech), diffusée en tuiles ArcGIS.',
      docsUrl: 'https://murray-lab.caltech.edu/CTX/',
      attribution: CTX_ATTRIBUTION,
      license: 'Libre avec attribution (NASA/JPL/MSSS/Caltech Murray Lab/Esri)',
      requiresToken: false,
      notes: [
        'Pyramide équirectangulaire 2:1 servie en tuiles de 512 px, origine -180°/90°, row 0 au nord.',
        'Couverture ~99,5 % entre 88°S et 88°N, répartie en 3 960 tuiles de 4°×4° (86 571 images CTX) ; certaines tuiles vides renvoient HTTP 404.',
        'Le niveau 12 (~5,1 m/px à l’équateur) atteint la résolution native de la mosaïque ; les niveaux 13 à 17 annoncés par le service renvoient HTTP 400.',
        'Les tuiles d’imagerie sont renvoyées en JPEG (souvent en niveaux de gris) ; les tuiles sans données reviennent en PNG transparent — se fier à l’en-tête Content-Type.',
        'Les tuiles source 4°×4° (JPEG 2000) restent téléchargeables sur murray-lab.caltech.edu.',
        'CRS de référence : WKID 104971 (GCS_Mars_2000_Sphere), exposé ici comme IAU2000:49900.',
      ],
      layers: [ctxMosaic],
    },
    {
      id: 'cesium-mars',
      name: 'Cesium Mars (Cesium ion)',
      kind: '3d-tiles',
      description:
        'Jeu 3D Tiles global de Mars (imagerie et terrain), accessible via Cesium ion.',
      docsUrl: 'https://cesium.com/platform/cesium-ion/content/cesium-mars/',
      attribution: CESIUM_ATTRIBUTION,
      license: 'Cesium ion Terms of Service',
      requiresToken: true,
      notes: [
        'Nécessite CESIUM_ION_TOKEN pour interroger le jeu de tuiles.',
        'Imagerie globale ~232 m/px et terrain ~200 m ; Jezero 6 m/20 m, Gale 25 cm/1 m.',
        'Le rendu 3D doit être fait côté client avec CesiumJS et votre propre token.',
      ],
      layers: [cesiumLayer],
    },
  ];
}
