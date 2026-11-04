import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MOON_CONFIG, type MoonConfig } from './moon.config';
import type {
  CuratedLayer,
  LayerDetail,
  LayerSummary,
  ProviderDefinition,
  ProviderId,
  ProviderSummary,
} from './moon.types';
import { buildTileUrl } from './tile-url';

const NASA_ATTRIBUTION =
  'NASA Moon Trek — LRO LROC WAC (NASA/GSFC/Arizona State University)';
const LOLA_ATTRIBUTION =
  'NASA Moon Trek — LRO LOLA / SLDEM (NASA/GSFC, MIT)';
const USGS_ATTRIBUTION = 'USGS Astrogeology Science Center';
const LROC_ATTRIBUTION = 'Arizona State University — LROC (NASA)';
const OPM_ATTRIBUTION =
  'OpenPlanetaryMap (OPM) — données NASA/OSM, tuiles CARTO';
const CESIUM_ATTRIBUTION =
  'Cesium ion — Cesium Moon Terrain (données NASA LRO)';

function tileUrlTemplate(providerId: string, layerId: string): string {
  return `/api/v1/moon/providers/${providerId}/layers/${layerId}/tile/{z}/{x}/{y}`;
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
export class MoonCatalogService {
  private readonly providers: ProviderDefinition[];
  private readonly providerMap: Map<string, ProviderDefinition>;

  constructor(@Inject(MOON_CONFIG) config: MoonConfig) {
    this.providers = buildProviders(config);
    this.providerMap = new Map(
      this.providers.map((provider) => [provider.id, provider]),
    );
  }

  listProviders(): ProviderDefinition[] {
    return this.providers;
  }

  listSummaries(): ProviderSummary[] {
    return this.providers.map((provider) => toProviderSummary(provider));
  }

  getProviderSummary(providerId: string): ProviderSummary {
    return toProviderSummary(this.getProvider(providerId));
  }

  getProvider(providerId: string): ProviderDefinition {
    const provider = this.providerMap.get(providerId);
    if (!provider) {
      throw new NotFoundException(
        `Fournisseur lunaire inconnu : ${providerId}`,
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

function buildProviders(config: MoonConfig): ProviderDefinition[] {
  const trekBase = `${config.trekBaseUrl}/${config.trekProduct}/1.0.0`;
  const trekCapabilities = `${trekBase}/WMTSCapabilities.xml`;
  const usgsGetMap = `${config.usgsBaseUrl}?map=${config.usgsMap}`;
  const usgsCapabilities = `${usgsGetMap}&service=WMS&request=GetCapabilities`;
  const lrocCapabilities = `${config.lrocCapabilitiesUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

  const wmtsLayer: CuratedLayer = {
    id: 'lro-wac-global',
    title: 'LRO WAC — mosaïque globale 303 ppd',
    description:
      'Mosaïque globale de la caméra grand angle de LRO (LROC WAC), 303 pixels par degré.',
    upstreamLayer: config.trekProduct,
    kind: 'wmts',
    scheme: 'equirectangular',
    crs: 'IAU2000:30100',
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

  const lolaProduct = 'LRO_LOLA_ClrShade_Global_256ppd_v06';
  const lolaTopoLayer: CuratedLayer = {
    id: 'lro-lola-color-shade',
    title: 'LOLA — topographie colorée 256 ppd',
    description:
      'Modèle d’élévation LOLA (LRO) coloré et estompé, couvrant les deux faces. Rendu à la demande par l’ArcGIS ImageServer de NASA Trek.',
    upstreamLayer: lolaProduct,
    kind: 'arcgis-image',
    scheme: 'equirectangular',
    crs: 'IAU2000:30100',
    minZoom: 0,
    maxZoom: config.trekTerrainMaxZoom,
    tileSize: 256,
    format: 'image/jpeg',
    attribution: LOLA_ATTRIBUTION,
    license: 'Données NASA ouvertes',
    arcgis: {
      exportImageUrl: `${config.trekImageServerBaseUrl}/${lolaProduct}/ImageServer/exportImage`,
      bboxSrs: '104903',
      imageSrs: '104903',
      format: 'jpg',
      interpolation: 'RSP_BilinearInterpolation',
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
      id: 'lroc-wac',
      title: 'LRO WAC — mosaïque globale',
      description:
        'Mosaïque globale LROC WAC rendue par le serveur WMS de l’USGS.',
      upstreamLayer: 'LROC_WAC',
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
      id: 'lola-color',
      title: 'LOLA — relief ombré couleur',
      description: 'Relief ombré coloré issu de l’altimètre laser LOLA (LRO).',
      upstreamLayer: 'LOLA_color',
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
      id: 'lola-bw',
      title: 'LOLA — relief ombré niveaux de gris',
      description: 'Relief ombré LOLA en niveaux de gris.',
      upstreamLayer: 'LOLA_bw',
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
      id: 'clementine-uvvis',
      title: 'Clementine UV/VIS — mosaïque globale v2',
      description: 'Mosaïque globale Clementine 750 nm (UV/VIS), version 2.',
      upstreamLayer: 'uv_v2',
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
      id: 'kaguya-tc',
      title: 'Kaguya — ortho-mosaïque Terrain Camera',
      description:
        'Ortho-mosaïque issue de la Terrain Camera de la mission japonaise Kaguya (SELENE).',
      upstreamLayer: 'KaguyaTC_Ortho',
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

  const lrocWms = {
    getMapUrl: config.lrocGetMapUrl,
    version: '1.1.1' as const,
    srs: 'IAU2000:30100',
    axisOrder: 'xy' as const,
  };

  const lrocLayers: CuratedLayer[] = [
    {
      id: 'luna-wac-global',
      title: 'LROC WAC — mosaïque globale',
      description: 'Mosaïque globale LROC WAC servie par Lunaserv (ASU).',
      upstreamLayer: 'luna_wac_global',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'IAU2000:30100',
      minZoom: 0,
      maxZoom: config.lrocMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LROC_ATTRIBUTION,
      license: 'Données NASA ouvertes (ASU/LROC)',
      wms: lrocWms,
    },
    {
      id: 'luna-wac-color',
      title: 'LROC WAC — composite couleur',
      description: 'Composite couleur LROC WAC.',
      upstreamLayer: 'luna_wac_color_composite',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'IAU2000:30100',
      minZoom: 0,
      maxZoom: config.lrocMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LROC_ATTRIBUTION,
      license: 'Données NASA ouvertes (ASU/LROC)',
      wms: lrocWms,
    },
    {
      id: 'luna-wac-hillshade',
      title: 'LROC WAC — relief ombré (DTM)',
      description:
        'Relief ombré dérivé du modèle numérique de terrain LROC WAC.',
      upstreamLayer: 'luna_wac_dtm_hillshade',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'IAU2000:30100',
      minZoom: 0,
      maxZoom: config.lrocMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LROC_ATTRIBUTION,
      license: 'Données NASA ouvertes (ASU/LROC)',
      wms: lrocWms,
    },
    {
      id: 'luna-nomenclature',
      title: 'Nomenclature lunaire (calque)',
      description:
        'Calque de nomenclature (noms de cratères, mers, etc.), transparent, à superposer à un fond raster.',
      upstreamLayer: 'luna_nomenclature',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: 'IAU2000:30100',
      minZoom: 0,
      maxZoom: config.lrocMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LROC_ATTRIBUTION,
      license: 'Données NASA ouvertes (ASU/LROC)',
      wms: lrocWms,
    },
  ];

  const opmLayer: CuratedLayer = {
    id: 'moon-basemap',
    title: 'OPM Moon Basemap v0.1',
    description:
      'Fond de carte communautaire OpenPlanetaryMap, en tuiles XYZ Web Mercator.',
    upstreamLayer: 'opm-moon-basemap-v0-1',
    kind: 'xyz',
    scheme: 'web-mercator',
    crs: 'EPSG:3857',
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

  const cesiumLayer: CuratedLayer = {
    id: 'moon-terrain',
    title: 'Cesium Moon Terrain',
    description:
      'Jeu 3D Tiles global du terrain lunaire (LRO/LOLA), hébergé par Cesium ion.',
    upstreamLayer: 'Cesium Moon Terrain',
    kind: '3d-tiles',
    scheme: 'none',
    crs: 'IAU_MOON',
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
      id: 'moon-trek',
      name: 'NASA Moon Trek (Solar System Treks)',
      kind: 'wmts',
      description:
        'Services de la NASA pour les mosaïques lunaires : cache WMTS LROC WAC et ImageServer topographique LOLA.',
      docsUrl: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon',
      attribution: NASA_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      requiresToken: false,
      capabilitiesUrl: trekCapabilities,
      notes: [
        'Tuilage équirectangulaire 2:1, 2 tuiles en largeur au niveau 0.',
        'Le niveau de zoom maximal dépend du produit ; la valeur par défaut est 8.',
        'La couche LOLA est calculée à la demande par exportImage, sans cache WMTS : chaque tuile est découpée dans le raster 256 ppd.',
      ],
      layers: [wmtsLayer, lolaTopoLayer],
    },
    {
      id: 'usgs-astro',
      name: 'USGS Astrogeology WMS',
      kind: 'wms',
      description:
        'Serveur WMS de l’USGS Astrogeology pour les couches lunaires globales.',
      docsUrl: 'https://astrowebmaps.wr.usgs.gov/',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      requiresToken: false,
      capabilitiesUrl: usgsCapabilities,
      notes: [
        'WMS 1.3.0 en EPSG:4326 : l’ordre des axes de BBOX est latitude, longitude.',
        'La carte polaire de l’USGS utilise un autre fichier .map et n’est pas exposée ici.',
      ],
      layers: usgsLayers,
    },
    {
      id: 'lroc-lunaserv',
      name: 'LROC Lunaserv (ASU)',
      kind: 'wms',
      description:
        'Serveur WMS Lunaserv de l’université d’État de l’Arizona, avec les produits LROC.',
      docsUrl: 'https://wms.im-ldi.com/',
      attribution: LROC_ATTRIBUTION,
      license: 'Données NASA ouvertes (ASU/LROC)',
      requiresToken: false,
      capabilitiesUrl: lrocCapabilities,
      notes: [
        'WMS 1.1.1 en IAU2000:30100 : BBOX en longitude, latitude.',
        'Le calque de nomenclature est transparent : prévoyez une composition côté client.',
        'Les capacités listent toutes les planètes servies ; les couches lunaires sont préfixées par luna_.',
      ],
      layers: lrocLayers,
    },
    {
      id: 'opm',
      name: 'OpenPlanetaryMap (OPM)',
      kind: 'xyz',
      description:
        'Tuiles XYZ du fond de carte lunaire OpenPlanetaryMap, en Web Mercator.',
      docsUrl:
        'http://openplanetarymap.org/basemaps/moon/opm-moon-basemap-v0-1/',
      attribution: OPM_ATTRIBUTION,
      license: 'Voir OpenPlanetaryMap / CARTO',
      requiresToken: false,
      notes: [
        'OPM projette la Lune en Web Mercator : les tuiles ne sont pas en projection lunaire.',
        'La résolution utile s’arrête autour du niveau 7.',
      ],
      layers: [opmLayer],
    },
    {
      id: 'cesium-moon',
      name: 'Cesium Moon Terrain (Cesium ion)',
      kind: '3d-tiles',
      description:
        'Jeu 3D Tiles global du terrain lunaire, accessible via Cesium ion.',
      docsUrl: 'https://cesium.com/platform/cesium-ion/content/cesium-moon/',
      attribution: CESIUM_ATTRIBUTION,
      license: 'Cesium ion Terms of Service',
      requiresToken: true,
      notes: [
        'Nécessite CESIUM_ION_TOKEN pour interroger le jeu de tuiles.',
        'Le rendu 3D doit être fait côté client avec CesiumJS et votre propre token.',
      ],
      layers: [cesiumLayer],
    },
  ];
}
