import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MERCURY_CONFIG, type MercuryConfig } from './mercury.config';
import type {
  CuratedLayer,
  LayerDetail,
  LayerSummary,
  ProviderDefinition,
  ProviderId,
  ProviderSummary,
} from './mercury.types';
import { buildTileUrl } from './tile-url';

const LUNASERV_ATTRIBUTION =
  'NASA/JHUAPL/Carnegie — MESSENGER MDIS (mosaïques globales), servi par ASU Lunaserv';
const USGS_ATTRIBUTION = 'USGS Astrogeology Science Center — MESSENGER / Mariner';
const TREK_ATTRIBUTION =
  'NASA/JHUAPL/Carnegie/ASU — MESSENGER MDIS · NASA Mercury Trek';
const OPM_ATTRIBUTION =
  'OpenPlanetaryMap (OPM) — données NASA/USGS, tuiles CARTO';
const QUICKMAP_ATTRIBUTION =
  'MESSENGER MDIS / DEM USGS Astrogeology — fond Mercury Basemap (ArcGIS)';

const MERCURY_CRS = 'IAU2000:19900';

function tileUrlTemplate(providerId: string, layerId: string): string {
  return `/api/v1/mercury/providers/${providerId}/layers/${layerId}/tile/{z}/{x}/{y}`;
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
export class MercuryCatalogService {
  private readonly providers: ProviderDefinition[];
  private readonly providerMap: Map<string, ProviderDefinition>;

  constructor(@Inject(MERCURY_CONFIG) config: MercuryConfig) {
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
        `Fournisseur de Mercure inconnu : ${providerId}`,
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
      sampleUpstreamUrl: buildTileUrl(provider, layer, layer.minZoom, 0, 0),
    };
  }
}

function buildProviders(config: MercuryConfig): ProviderDefinition[] {
  const usgsGetMap = `${config.usgsBaseUrl}?map=${config.usgsMap}`;
  const usgsCapabilities = `${usgsGetMap}&service=WMS&request=GetCapabilities`;
  const lunaservCapabilities = `${config.lunaservCapabilitiesUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

  const lunaservWms = {
    getMapUrl: config.lunaservGetMapUrl,
    version: '1.1.1' as const,
    srs: MERCURY_CRS,
    axisOrder: 'xy' as const,
  };

  const lunaservLayers: CuratedLayer[] = [
    {
      id: 'mdis-v8',
      title: 'MESSENGER MDIS — mosaïque globale v8 (2012)',
      description:
        'Mosaïque globale MESSENGER MDIS (NAC + WAC, filtre 750 nm) issue de la première année en orbite, version 8 de septembre 2012.',
      upstreamLayer: 'mercury_mdis_v8',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: MERCURY_CRS,
      minZoom: 0,
      maxZoom: config.lunaservMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LUNASERV_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      wms: lunaservWms,
    },
    {
      id: 'global-march2012',
      title: 'MESSENGER MDIS — mosaïque globale (mars 2012)',
      description:
        'Mosaïque globale MESSENGER couvrant les six premiers mois d’opérations orbitales.',
      upstreamLayer: 'mercury_global_march2012',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: MERCURY_CRS,
      minZoom: 0,
      maxZoom: config.lunaservMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LUNASERV_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      wms: lunaservWms,
    },
    {
      id: 'global-flyby',
      title: 'MESSENGER — mosaïque des survols',
      description:
        'Mosaïque construite à partir des images des trois survols de MESSENGER (2008–2009).',
      upstreamLayer: 'mercury_global_flyby',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: MERCURY_CRS,
      minZoom: 0,
      maxZoom: config.lunaservMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LUNASERV_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      wms: lunaservWms,
    },
    {
      id: 'day-night',
      title: 'Mercure — jour / nuit',
      description:
        'Composite jour/nuit du globe mercurien, utile pour les vues d’ensemble éclairées.',
      upstreamLayer: 'mercury_day_night',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: MERCURY_CRS,
      minZoom: 0,
      maxZoom: config.lunaservMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LUNASERV_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      wms: lunaservWms,
    },
    {
      id: 'nomenclature',
      title: 'Nomenclature mercurienne (calque)',
      description:
        'Calque transparent de la nomenclature IAU (cratères, dorsales, plaines), à superposer à un fond raster.',
      upstreamLayer: 'mercury_nomenclature',
      kind: 'wms',
      scheme: 'equirectangular',
      crs: MERCURY_CRS,
      minZoom: 0,
      maxZoom: config.lunaservMaxZoom,
      tileSize: 256,
      format: 'image/png',
      attribution: LUNASERV_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      wms: lunaservWms,
    },
  ];

  const usgsWms = {
    getMapUrl: usgsGetMap,
    version: '1.3.0' as const,
    srs: 'EPSG:4326',
    axisOrder: 'yx' as const,
  };

  const usgsLayers: CuratedLayer[] = [
    {
      id: 'messenger-v8',
      title: 'MESSENGER — mosaïque globale v8',
      description:
        'Mosaïque globale MESSENGER v8 rendue par le serveur WMS de l’USGS.',
      upstreamLayer: 'MESSENGER_v8',
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
      id: 'messenger-color',
      title: 'MESSENGER — mosaïque couleur',
      description:
        'Mosaïque couleur MESSENGER (filtres 1000, 750 et 430 nm) rendue par l’USGS.',
      upstreamLayer: 'MESSENGER_Color',
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
      id: 'messenger-mariner',
      title: 'MESSENGER + Mariner 10 — mosaïque combinée',
      description:
        'Mosaïque combinant les données MESSENGER et les images historiques de Mariner 10.',
      upstreamLayer: 'MESSENGER_Mariner',
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
      id: 'mariner',
      title: 'Mariner 10 — mosaïque globale',
      description:
        'Mosaïque globale issue des survols de Mariner 10 (1974–1975).',
      upstreamLayer: 'MARINER',
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
      id: 'messenger-may2013',
      title: 'MESSENGER — mosaïque globale (mai 2013)',
      description: 'Mosaïque globale MESSENGER de mai 2013.',
      upstreamLayer: 'MESSENGER_May2013',
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

  const demLayer: CuratedLayer = {
    id: 'usgs-dem-665m',
    title: 'MESSENGER / USGS — DEM global 665 m',
    description:
      'Modèle numérique d’élévation global de Mercure à 665 m/pixel, rendu à la demande par l’ImageServer ArcGIS de NASA Trek.',
    upstreamLayer: 'Mercury_Messenger_USGS_DEM_Global_665m_v2',
    kind: 'arcgis-image',
    scheme: 'equirectangular',
    crs: MERCURY_CRS,
    minZoom: 0,
    maxZoom: config.trekTerrainMaxZoom,
    tileSize: 256,
    format: 'image/jpeg',
    attribution: TREK_ATTRIBUTION,
    license: 'Données NASA/USGS ouvertes',
    arcgis: {
      exportImageUrl: `${config.trekImageServerBaseUrl}/mercury/Mercury_Messenger_USGS_DEM_Global_665m_v2/ImageServer/exportImage`,
      bboxSrs: '19900',
      imageSrs: '19900',
      format: 'jpg',
      interpolation: 'RSP_BilinearInterpolation',
    },
  };

  const trekWmtsLayer: CuratedLayer = {
    id: 'messenger-enhanced-color-665m',
    title: 'MESSENGER MDIS — couleur renforcée 665 m (Mercury Trek)',
    description:
      'Mosaïque globale MDIS en couleur renforcée, diffusée en WMTS par NASA Mercury Trek. Le relief est disponible séparément via le DEM Trek.',
    upstreamLayer:
      'Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m',
    kind: 'wmts',
    scheme: 'equirectangular',
    crs: MERCURY_CRS,
    minZoom: 0,
    maxZoom: config.trekWmtsMaxZoom,
    tileSize: 256,
    format: 'image/jpeg',
    attribution: TREK_ATTRIBUTION,
    license: 'Données NASA/USGS ouvertes — citation des auteurs souhaitée',
    wmts: {
      baseUrl: config.trekWmtsBaseUrl,
      style: 'default',
      matrixSet: 'default028mm',
      extension: 'jpg',
    },
  };

  const opmLayer: CuratedLayer = {
    id: 'mercury-basemap-v0-1',
    title: 'OPM Mercury Basemap v0.1',
    description:
      'Fond de carte communautaire OpenPlanetaryMap pour Mercure, en tuiles XYZ Web Mercator.',
    upstreamLayer: 'opm-mercury-basemap-v0-1',
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

  const quickmapLayer: CuratedLayer = {
    id: 'messenger-basemap',
    title: 'MESSENGER MDIS + relief — Mercury Basemap',
    description:
      'Fond global tuilé dérivé de la mosaïque couleur MDIS et du DEM MESSENGER/USGS 665 m. Service ArcGIS public inspiré des données de QuickMap, non affilié à l’USGS.',
    upstreamLayer: 'Mercury_Basemap',
    kind: 'xyz',
    scheme: 'equirectangular',
    crs: 'IAU_2015:19900',
    minZoom: 0,
    maxZoom: config.quickmapMaxZoom,
    tileSize: 256,
    format: 'image/jpeg',
    attribution: QUICKMAP_ATTRIBUTION,
    license: 'Données MESSENGER / USGS ouvertes ; service de tuiles tiers',
    xyz: {
      urlTemplate: config.quickmapTileUrl,
      tms: false,
      // Le cache ArcGIS commence à une matrice mondiale 1 × 1 alors que
      // notre grille équirectangulaire commence à 2 × 1.
      zoomOffset: 1,
    },
  };

  return [
    {
      id: 'mercury-lunaserv',
      name: 'ASU Lunaserv — MESSENGER',
      kind: 'wms',
      description:
        'Serveur WMS Lunaserv de l’université d’État de l’Arizona avec les mosaïques globales MESSENGER de Mercure.',
      docsUrl: 'https://wms.im-ldi.com/',
      attribution: LUNASERV_ATTRIBUTION,
      license: 'Données NASA ouvertes',
      requiresToken: false,
      capabilitiesUrl: lunaservCapabilities,
      notes: [
        'WMS 1.1.1 en IAU2000:19900 : BBOX en longitude, latitude.',
        'Couches mercuriennes préfixées par mercury_ dans les capacités du serveur.',
        'Le calque de nomenclature est transparent : prévoyez une composition côté client.',
      ],
      layers: lunaservLayers,
    },
    {
      id: 'usgs-astro-mercury',
      name: 'USGS Astrogeology WMS — Mercure',
      kind: 'wms',
      description:
        'Serveur WMS de l’USGS Astrogeology pour les mosaïques globales de Mercure (MESSENGER, Mariner 10).',
      docsUrl: 'https://astrowebmaps.wr.usgs.gov/',
      attribution: USGS_ATTRIBUTION,
      license: 'Domaine public (USGS)',
      requiresToken: false,
      capabilitiesUrl: usgsCapabilities,
      notes: [
        'WMS 1.3.0 en EPSG:4326 : l’ordre des axes de BBOX est latitude, longitude.',
        'Carte source : mercury_simp_cyl.map (projection cylindrique simple).',
      ],
      layers: usgsLayers,
    },
    {
      id: 'mercury-trek',
      name: 'NASA Mercury Trek — DEM',
      kind: 'arcgis-image',
      description:
        'Modèle numérique d’élévation global de Mercure servi par l’ArcGIS ImageServer de NASA Trek.',
      docsUrl: 'https://trek.nasa.gov/mercury/',
      attribution: TREK_ATTRIBUTION,
      license: 'Données NASA/USGS ouvertes',
      requiresToken: false,
      notes: [
        'Le raster est un DEM 16 bits : l’export JPEG est un nivellement en niveaux de gris, destiné au relief.',
        'Chaque tuile est découpée à la demande via exportImage, sans cache WMTS.',
        'Résolution native 665 m/pixel ; le zoom 8 dépasse légèrement la résolution source.',
      ],
      layers: [demLayer],
    },
    {
      id: 'mercury-trek-wmts',
      name: 'NASA Mercury Trek — WMTS MESSENGER',
      kind: 'wmts',
      description:
        'Mosaïque globale couleur renforcée MESSENGER MDIS, servie par le cache WMTS officiel NASA Mercury Trek.',
      docsUrl: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mercury',
      attribution: TREK_ATTRIBUTION,
      license: 'Données NASA/USGS ouvertes — citation des auteurs souhaitée',
      requiresToken: false,
      capabilitiesUrl: `${config.trekWmtsBaseUrl}/WMTSCapabilities.xml`,
      notes: [
        'Grille équirectangulaire 2:1 : 2 colonnes × 1 ligne au niveau 0.',
        'Mosaïque MDIS enhanced color à 665 m/pixel ; tuiles JPEG.',
        'Le DEM MESSENGER/USGS de 665 m reste exposé dans mercury-trek.',
      ],
      layers: [trekWmtsLayer],
    },
    {
      id: 'mercury-quickmap',
      name: 'MESSENGER / USGS — fond Mercury Basemap',
      kind: 'xyz',
      description:
        'Fond pré-rendu combinant la mosaïque couleur MDIS et le relief DEM MESSENGER/USGS, distribué par un cache ArcGIS tiers.',
      docsUrl:
        'https://tiles.arcgis.com/tiles/0xMt0kzpNJRZcyJb/arcgis/rest/services/Mercury_Basemap/MapServer',
      attribution: QUICKMAP_ATTRIBUTION,
      license: 'Données MESSENGER / USGS ouvertes ; service de tuiles tiers',
      requiresToken: false,
      notes: [
        'Le service ArcGIS est un fond non officiel dérivé de produits USGS Astropedia ; il n’est pas affilié à l’USGS.',
        'Cache en coordonnées mercuriennes (WKID 104974), origine −180°/180° ; le niveau source est décalé d’un cran par rapport à la grille du globe.',
        'Le DEM et la mosaïque sont pré-composés dans les tuiles ; pour utiliser les couches séparément, choisir le DEM Trek ou une mosaïque WMS.',
      ],
      layers: [quickmapLayer],
    },
    {
      id: 'opm-mercury',
      name: 'OpenPlanetaryMap (OPM) — Mercure',
      kind: 'xyz',
      description:
        'Tuiles XYZ du fond de carte mercurien OpenPlanetaryMap, en Web Mercator.',
      docsUrl:
        'http://openplanetarymap.org/basemaps/mercury/opm-mercury-basemap-v0-1-draft/',
      attribution: OPM_ATTRIBUTION,
      license: 'Voir OpenPlanetaryMap / CARTO',
      requiresToken: false,
      notes: [
        'OPM projette Mercure en Web Mercator : les tuiles ne sont pas en projection mercurienne.',
        'La résolution utile s’arrête autour du niveau 7.',
      ],
      layers: [opmLayer],
    },
  ];
}
