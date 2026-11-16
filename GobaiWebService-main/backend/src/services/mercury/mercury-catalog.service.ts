// Outils NestJS : injection par jeton, service injectable, erreur 404.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
// Jeton d'injection de la configuration de Mercure, et son type.
import { MERCURY_CONFIG, type MercuryConfig } from './mercury.config';
// Ouvre l'import de six types (effacés à la compilation) :
import type {
  // une couche du catalogue ;
  CuratedLayer,
  // le détail d'une couche ;
  LayerDetail,
  // le résumé d'une couche ;
  LayerSummary,
  // la définition d'un fournisseur ;
  ProviderDefinition,
  // l'identifiant d'un fournisseur ;
  ProviderId,
  // le résumé d'un fournisseur.
  ProviderSummary,
// Fin de l'import.
} from './mercury.types';
// Fonction qui construit l'adresse d'une tuile chez la source.
import { buildTileUrl } from './tile-url';

// Mention de Lunaserv :
const LUNASERV_ATTRIBUTION =
  // son texte.
  'NASA/JHUAPL/Carnegie — MESSENGER MDIS (mosaïques globales), servi par ASU Lunaserv';
// Mention de l'USGS.
const USGS_ATTRIBUTION = 'USGS Astrogeology Science Center — MESSENGER / Mariner';
// Mention de NASA Mercury Trek :
const TREK_ATTRIBUTION =
  // son texte.
  'NASA/JHUAPL/Carnegie/ASU — MESSENGER MDIS · NASA Mercury Trek';
// Mention d'OpenPlanetaryMap :
const OPM_ATTRIBUTION =
  // son texte.
  'OpenPlanetaryMap (OPM) — données NASA/USGS, tuiles CARTO';
// Mention du fond Mercury Basemap :
const QUICKMAP_ATTRIBUTION =
  // son texte.
  'MESSENGER MDIS / DEM USGS Astrogeology — fond Mercury Basemap (ArcGIS)';

// Projection de Mercure.
const MERCURY_CRS = 'IAU2000:19900';

// Fonction tileUrlTemplate.
function tileUrlTemplate(providerId: string, layerId: string): string {
  // Le modèle d'adresse des tuiles d'une couche sur ce serveur.
  return `/api/v1/mercury/providers/${providerId}/layers/${layerId}/tile/{z}/{x}/{y}`;
// Fin de tileUrlTemplate.
}

// Fonction toLayerSummary ; ses paramètres :
function toLayerSummary(
  // l'identifiant du fournisseur ;
  providerId: ProviderId,
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
    tileUrlTemplate: tileUrlTemplate(providerId, layer.id),
  // Fin de l'objet.
  };
// Fin de toLayerSummary.
}

// Fonction toProviderSummary.
function toProviderSummary(provider: ProviderDefinition): ProviderSummary {
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
    // ses remarques ;
    notes: provider.notes,
    // le résumé de chacune de ses couches.
    layers: provider.layers.map((layer) => toLayerSummary(provider.id, layer)),
  // Fin de l'objet.
  };
// Fin de toProviderSummary.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du catalogue de Mercure.
export class MercuryCatalogService {
  // Liste des fournisseurs.
  private readonly providers: ProviderDefinition[];
  // Table des fournisseurs, par identifiant.
  private readonly providerMap: Map<string, ProviderDefinition>;

  // Constructeur : la configuration, demandée par son jeton.
  constructor(@Inject(MERCURY_CONFIG) config: MercuryConfig) {
    // Construit la liste des fournisseurs.
    this.providers = buildProviders(config);
    // Construit la table :
    this.providerMap = new Map(
      // une entrée par fournisseur.
      this.providers.map((provider) => [provider.id, provider]),
    // Fin de la table.
    );
  // Fin du constructeur.
  }

  // Méthode listProviders.
  listProviders(): ProviderDefinition[] {
    // Renvoie tous les fournisseurs.
    return this.providers;
  // Fin de listProviders.
  }

  // Méthode listSummaries.
  listSummaries(): ProviderSummary[] {
    // Le résumé de chaque fournisseur.
    return this.providers.map((provider) => toProviderSummary(provider));
  // Fin de listSummaries.
  }

  // Méthode getProviderSummary.
  getProviderSummary(providerId: string): ProviderSummary {
    // Le résumé d'un fournisseur.
    return toProviderSummary(this.getProvider(providerId));
  // Fin de getProviderSummary.
  }

  // Méthode getProvider.
  getProvider(providerId: string): ProviderDefinition {
    // Cherche le fournisseur dans la table.
    const provider = this.providerMap.get(providerId);
    // Introuvable :
    if (!provider) {
      // erreur 404,
      throw new NotFoundException(
        // avec son identifiant.
        `Fournisseur de Mercure inconnu : ${providerId}`,
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
        // avec les deux identifiants.
        `Couche inconnue pour ${providerId} : ${layerId}`,
      // Fin de l'erreur.
      );
    // Fin du cas.
    }
    // Renvoie le fournisseur et la couche.
    return { provider, layer };
  // Fin de getLayer.
  }

  // Méthode summarizeLayer ; ses paramètres :
  summarizeLayer(
    // le fournisseur ;
    provider: ProviderDefinition,
    // la couche.
    layer: CuratedLayer,
  // Elle renvoie le résumé de la couche.
  ): LayerSummary {
    // Le calcule.
    return toLayerSummary(provider.id, layer);
  // Fin de summarizeLayer.
  }

  // Méthode describeLayer : le détail d'une couche.
  describeLayer(providerId: string, layerId: string): LayerDetail {
    // Fournisseur et couche.
    const { provider, layer } = this.getLayer(providerId, layerId);

    // Renvoie
    return {
      // le résumé de la couche ;
      ...toLayerSummary(provider.id, layer),
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
      // un exemple d'adresse chez la source : celle de sa première tuile, à son niveau minimal.
      sampleUpstreamUrl: buildTileUrl(provider, layer, layer.minZoom, 0, 0),
    // Fin de l'objet.
    };
  // Fin de describeLayer.
  }
// Fin du service.
}

// Fonction buildProviders : construit les fournisseurs à partir de la configuration.
function buildProviders(config: MercuryConfig): ProviderDefinition[] {
  // Adresse des requêtes GetMap de l'USGS, avec sa carte.
  const usgsGetMap = `${config.usgsBaseUrl}?map=${config.usgsMap}`;
  // Adresse de ses capacités WMS.
  const usgsCapabilities = `${usgsGetMap}&service=WMS&request=GetCapabilities`;
  // Adresse des capacités WMS de Lunaserv.
  const lunaservCapabilities = `${config.lunaservCapabilitiesUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

  // Réglages WMS communs aux couches de Lunaserv :
  const lunaservWms = {
    // l'adresse des requêtes GetMap ;
    getMapUrl: config.lunaservGetMapUrl,
    // la version 1.1.1 ;
    version: '1.1.1' as const,
    // la projection de Mercure ;
    srs: MERCURY_CRS,
    // la longitude d'abord dans l'emprise.
    axisOrder: 'xy' as const,
  // Fin des réglages.
  };

  // Les cinq couches de Lunaserv :
  const lunaservLayers: CuratedLayer[] = [
    // une couche :
    {
      // son identifiant, « mdis-v8 » ;
      id: 'mdis-v8',
      // son titre ;
      title: 'MESSENGER MDIS — mosaïque globale v8 (2012)',
      // sa description :
      description:
        // son texte ;
        'Mosaïque globale MESSENGER MDIS (NAC + WAC, filtre 750 nm) issue de la première année en orbite, version 8 de septembre 2012.',
      // son nom chez la source ;
      upstreamLayer: 'mercury_mdis_v8',
      // sa nature, WMS ;
      kind: 'wms',
      // son découpage, plate carrée ;
      scheme: 'equirectangular',
      // sa projection, celle de Mercure ;
      crs: MERCURY_CRS,
      // son niveau minimal, 0 ;
      minZoom: 0,
      // son niveau maximal, pris dans la configuration ;
      maxZoom: config.lunaservMaxZoom,
      // des tuiles de 256 pixels ;
      tileSize: 256,
      // le format PNG ;
      format: 'image/png',
      // sa mention ;
      attribution: LUNASERV_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // ses réglages WMS, communs à Lunaserv.
      wms: lunaservWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « global-march2012 » ;
      id: 'global-march2012',
      // son titre ;
      title: 'MESSENGER MDIS — mosaïque globale (mars 2012)',
      // sa description :
      description:
        // son texte ;
        'Mosaïque globale MESSENGER couvrant les six premiers mois d’opérations orbitales.',
      // son nom chez la source ;
      upstreamLayer: 'mercury_global_march2012',
      // sa nature, WMS ;
      kind: 'wms',
      // son découpage, plate carrée ;
      scheme: 'equirectangular',
      // sa projection, celle de Mercure ;
      crs: MERCURY_CRS,
      // son niveau minimal, 0 ;
      minZoom: 0,
      // son niveau maximal, pris dans la configuration ;
      maxZoom: config.lunaservMaxZoom,
      // des tuiles de 256 pixels ;
      tileSize: 256,
      // le format PNG ;
      format: 'image/png',
      // sa mention ;
      attribution: LUNASERV_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // ses réglages WMS, communs à Lunaserv.
      wms: lunaservWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « global-flyby » ;
      id: 'global-flyby',
      // son titre ;
      title: 'MESSENGER — mosaïque des survols',
      // sa description :
      description:
        // son texte ;
        'Mosaïque construite à partir des images des trois survols de MESSENGER (2008–2009).',
      // son nom chez la source ;
      upstreamLayer: 'mercury_global_flyby',
      // sa nature, WMS ;
      kind: 'wms',
      // son découpage, plate carrée ;
      scheme: 'equirectangular',
      // sa projection, celle de Mercure ;
      crs: MERCURY_CRS,
      // son niveau minimal, 0 ;
      minZoom: 0,
      // son niveau maximal, pris dans la configuration ;
      maxZoom: config.lunaservMaxZoom,
      // des tuiles de 256 pixels ;
      tileSize: 256,
      // le format PNG ;
      format: 'image/png',
      // sa mention ;
      attribution: LUNASERV_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // ses réglages WMS, communs à Lunaserv.
      wms: lunaservWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « day-night » ;
      id: 'day-night',
      // son titre ;
      title: 'Mercure — jour / nuit',
      // sa description :
      description:
        // son texte ;
        'Composite jour/nuit du globe mercurien, utile pour les vues d’ensemble éclairées.',
      // son nom chez la source ;
      upstreamLayer: 'mercury_day_night',
      // sa nature, WMS ;
      kind: 'wms',
      // son découpage, plate carrée ;
      scheme: 'equirectangular',
      // sa projection, celle de Mercure ;
      crs: MERCURY_CRS,
      // son niveau minimal, 0 ;
      minZoom: 0,
      // son niveau maximal, pris dans la configuration ;
      maxZoom: config.lunaservMaxZoom,
      // des tuiles de 256 pixels ;
      tileSize: 256,
      // le format PNG ;
      format: 'image/png',
      // sa mention ;
      attribution: LUNASERV_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // ses réglages WMS, communs à Lunaserv.
      wms: lunaservWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « nomenclature » ;
      id: 'nomenclature',
      // son titre ;
      title: 'Nomenclature mercurienne (calque)',
      // sa description :
      description:
        // son texte ;
        'Calque transparent de la nomenclature IAU (cratères, dorsales, plaines), à superposer à un fond raster.',
      // son nom chez la source ;
      upstreamLayer: 'mercury_nomenclature',
      // sa nature, WMS ;
      kind: 'wms',
      // son découpage, plate carrée ;
      scheme: 'equirectangular',
      // sa projection, celle de Mercure ;
      crs: MERCURY_CRS,
      // son niveau minimal, 0 ;
      minZoom: 0,
      // son niveau maximal, pris dans la configuration ;
      maxZoom: config.lunaservMaxZoom,
      // des tuiles de 256 pixels ;
      tileSize: 256,
      // le format PNG ;
      format: 'image/png',
      // sa mention ;
      attribution: LUNASERV_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // ses réglages WMS, communs à Lunaserv.
      wms: lunaservWms,
    // fin de la couche.
    },
  // Fin des couches de Lunaserv.
  ];

  // Réglages WMS communs aux couches de l'USGS :
  const usgsWms = {
    // l'adresse des requêtes GetMap ;
    getMapUrl: usgsGetMap,
    // la version 1.3.0 ;
    version: '1.3.0' as const,
    // la projection EPSG:4326 ;
    srs: 'EPSG:4326',
    // la latitude d'abord dans l'emprise.
    axisOrder: 'yx' as const,
  // Fin des réglages.
  };

  // Les cinq couches de l'USGS :
  const usgsLayers: CuratedLayer[] = [
    // une couche :
    {
      // son identifiant, « messenger-v8 » ;
      id: 'messenger-v8',
      // son titre ;
      title: 'MESSENGER — mosaïque globale v8',
      // sa description :
      description:
        // son texte ;
        'Mosaïque globale MESSENGER v8 rendue par le serveur WMS de l’USGS.',
      // son nom chez la source ;
      upstreamLayer: 'MESSENGER_v8',
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
      attribution: USGS_ATTRIBUTION,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // ses réglages WMS, communs à l'USGS.
      wms: usgsWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « messenger-color » ;
      id: 'messenger-color',
      // son titre ;
      title: 'MESSENGER — mosaïque couleur',
      // sa description :
      description:
        // son texte ;
        'Mosaïque couleur MESSENGER (filtres 1000, 750 et 430 nm) rendue par l’USGS.',
      // son nom chez la source ;
      upstreamLayer: 'MESSENGER_Color',
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
      attribution: USGS_ATTRIBUTION,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // ses réglages WMS, communs à l'USGS.
      wms: usgsWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « messenger-mariner » ;
      id: 'messenger-mariner',
      // son titre ;
      title: 'MESSENGER + Mariner 10 — mosaïque combinée',
      // sa description :
      description:
        // son texte ;
        'Mosaïque combinant les données MESSENGER et les images historiques de Mariner 10.',
      // son nom chez la source ;
      upstreamLayer: 'MESSENGER_Mariner',
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
      attribution: USGS_ATTRIBUTION,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // ses réglages WMS, communs à l'USGS.
      wms: usgsWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « mariner » ;
      id: 'mariner',
      // son titre ;
      title: 'Mariner 10 — mosaïque globale',
      // sa description :
      description:
        // son texte ;
        'Mosaïque globale issue des survols de Mariner 10 (1974–1975).',
      // son nom chez la source ;
      upstreamLayer: 'MARINER',
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
      attribution: USGS_ATTRIBUTION,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // ses réglages WMS, communs à l'USGS.
      wms: usgsWms,
    // fin de la couche.
    },
    // une couche :
    {
      // son identifiant, « messenger-may2013 » ;
      id: 'messenger-may2013',
      // son titre ;
      title: 'MESSENGER — mosaïque globale (mai 2013)',
      // sa description ;
      description: 'Mosaïque globale MESSENGER de mai 2013.',
      // son nom chez la source ;
      upstreamLayer: 'MESSENGER_May2013',
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
      attribution: USGS_ATTRIBUTION,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // ses réglages WMS, communs à l'USGS.
      wms: usgsWms,
    // fin de la couche.
    },
  // Fin des couches de l'USGS.
  ];

  // Couche du relief de NASA Trek :
  const demLayer: CuratedLayer = {
    // son identifiant, « usgs-dem-665m » ;
    id: 'usgs-dem-665m',
    // son titre ;
    title: 'MESSENGER / USGS — DEM global 665 m',
    // sa description :
    description:
      // son texte ;
      'Modèle numérique d’élévation global de Mercure à 665 m/pixel, rendu à la demande par l’ImageServer ArcGIS de NASA Trek.',
    // son nom chez la source ;
    upstreamLayer: 'Mercury_Messenger_USGS_DEM_Global_665m_v2',
    // sa nature, ArcGIS ImageServer ;
    kind: 'arcgis-image',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, celle de Mercure ;
    crs: MERCURY_CRS,
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.trekTerrainMaxZoom,
    // des tuiles de 256 pixels ;
    tileSize: 256,
    // le format JPEG ;
    format: 'image/jpeg',
    // sa mention ;
    attribution: TREK_ATTRIBUTION,
    // sa licence ;
    license: 'Données NASA/USGS ouvertes',
    // ses réglages ArcGIS ImageServer :
    arcgis: {
      // l'adresse des requêtes d'export ;
      exportImageUrl: `${config.trekImageServerBaseUrl}/mercury/Mercury_Messenger_USGS_DEM_Global_665m_v2/ImageServer/exportImage`,
      // la projection de l'emprise ;
      bboxSrs: '19900',
      // la projection de l'image ;
      imageSrs: '19900',
      // le format jpg ;
      format: 'jpg',
      // l'interpolation bilinéaire.
      interpolation: 'RSP_BilinearInterpolation',
    // Fin des réglages.
    },
  // Fin de la couche.
  };

  // Couche WMTS de NASA Trek :
  const trekWmtsLayer: CuratedLayer = {
    // son identifiant, « messenger-enhanced-color-665m » ;
    id: 'messenger-enhanced-color-665m',
    // son titre ;
    title: 'MESSENGER MDIS — couleur renforcée 665 m (Mercury Trek)',
    // sa description :
    description:
      // son texte ;
      'Mosaïque globale MDIS en couleur renforcée, diffusée en WMTS par NASA Mercury Trek. Le relief est disponible séparément via le DEM Trek.',
    // son nom chez la source :
    upstreamLayer:
      // sa valeur ;
      'Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m',
    // sa nature, WMTS ;
    kind: 'wmts',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, celle de Mercure ;
    crs: MERCURY_CRS,
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.trekWmtsMaxZoom,
    // des tuiles de 256 pixels ;
    tileSize: 256,
    // le format JPEG ;
    format: 'image/jpeg',
    // sa mention ;
    attribution: TREK_ATTRIBUTION,
    // sa licence ;
    license: 'Données NASA/USGS ouvertes — citation des auteurs souhaitée',
    // ses réglages WMTS :
    wmts: {
      // l'adresse de base, prise dans la configuration ;
      baseUrl: config.trekWmtsBaseUrl,
      // le style ;
      style: 'default',
      // le jeu de tuiles ;
      matrixSet: 'default028mm',
      // l'extension jpg.
      extension: 'jpg',
    // Fin des réglages.
    },
  // Fin de la couche.
  };

  // Couche d'OpenPlanetaryMap :
  const opmLayer: CuratedLayer = {
    // son identifiant, « mercury-basemap-v0-1 » ;
    id: 'mercury-basemap-v0-1',
    // son titre ;
    title: 'OPM Mercury Basemap v0.1',
    // sa description :
    description:
      // son texte ;
      'Fond de carte communautaire OpenPlanetaryMap pour Mercure, en tuiles XYZ Web Mercator.',
    // son nom chez la source ;
    upstreamLayer: 'opm-mercury-basemap-v0-1',
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
    attribution: OPM_ATTRIBUTION,
    // sa licence ;
    license: 'Voir OpenPlanetaryMap / CARTO',
    // ses réglages XYZ :
    xyz: {
      // le modèle d'adresse, pris dans la configuration ;
      urlTemplate: config.opmTileUrl,
      // lignes comptées depuis le haut ;
      tms: false,
    // fin des réglages.
    },
  // Fin de la couche.
  };

  // Couche du fond Mercury Basemap :
  const quickmapLayer: CuratedLayer = {
    // son identifiant, « messenger-basemap » ;
    id: 'messenger-basemap',
    // son titre ;
    title: 'MESSENGER MDIS + relief — Mercury Basemap',
    // sa description :
    description:
      // son texte ;
      'Fond global tuilé dérivé de la mosaïque couleur MDIS et du DEM MESSENGER/USGS 665 m. Service ArcGIS public inspiré des données de QuickMap, non affilié à l’USGS.',
    // son nom chez la source ;
    upstreamLayer: 'Mercury_Basemap',
    // sa nature, XYZ ;
    kind: 'xyz',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, IAU_2015:19900 ;
    crs: 'IAU_2015:19900',
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.quickmapMaxZoom,
    // des tuiles de 256 pixels ;
    tileSize: 256,
    // le format JPEG ;
    format: 'image/jpeg',
    // sa mention ;
    attribution: QUICKMAP_ATTRIBUTION,
    // sa licence ;
    license: 'Données MESSENGER / USGS ouvertes ; service de tuiles tiers',
    // ses réglages XYZ :
    xyz: {
      // le modèle d'adresse, pris dans la configuration ;
      urlTemplate: config.quickmapTileUrl,
      // lignes comptées depuis le haut ;
      tms: false,
      // Le cache ArcGIS commence à une matrice mondiale 1 × 1 alors que
      // notre grille équirectangulaire commence à 2 × 1.
      // niveau de la source décalé de 1.
      zoomOffset: 1,
    // fin des réglages.
    },
  // Fin de la couche.
  };

  // Renvoie les six fournisseurs :
  return [
    // un fournisseur :
    {
      // son identifiant, « mercury-lunaserv » ;
      id: 'mercury-lunaserv',
      // son nom ;
      name: 'ASU Lunaserv — MESSENGER',
      // sa nature, WMS ;
      kind: 'wms',
      // sa description :
      description:
        // son texte ;
        'Serveur WMS Lunaserv de l’université d’État de l’Arizona avec les mosaïques globales MESSENGER de Mercure.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://wms.im-ldi.com/',
      // sa mention ;
      attribution: LUNASERV_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // sans jeton ;
      requiresToken: false,
      // l'adresse de ses capacités ;
      capabilitiesUrl: lunaservCapabilities,
      // ses remarques :
      notes: [
        // WMS 1.1.1 : la longitude d'abord dans l'emprise ;
        'WMS 1.1.1 en IAU2000:19900 : BBOX en longitude, latitude.',
        // les couches de Mercure portent le préfixe mercury_ ;
        'Couches mercuriennes préfixées par mercury_ dans les capacités du serveur.',
        // le calque de nomenclature est transparent.
        'Le calque de nomenclature est transparent : prévoyez une composition côté client.',
      // fin des remarques ;
      ],
      // ses cinq couches.
      layers: lunaservLayers,
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « usgs-astro-mercury » ;
      id: 'usgs-astro-mercury',
      // son nom ;
      name: 'USGS Astrogeology WMS — Mercure',
      // sa nature, WMS ;
      kind: 'wms',
      // sa description :
      description:
        // son texte ;
        'Serveur WMS de l’USGS Astrogeology pour les mosaïques globales de Mercure (MESSENGER, Mariner 10).',
      // l'adresse de sa documentation ;
      docsUrl: 'https://astrowebmaps.wr.usgs.gov/',
      // sa mention ;
      attribution: USGS_ATTRIBUTION,
      // sa licence ;
      license: 'Domaine public (USGS)',
      // sans jeton ;
      requiresToken: false,
      // l'adresse de ses capacités ;
      capabilitiesUrl: usgsCapabilities,
      // ses remarques :
      notes: [
        // l'ordre des axes de l'emprise en WMS 1.3.0 : latitude puis longitude ;
        'WMS 1.3.0 en EPSG:4326 : l’ordre des axes de BBOX est latitude, longitude.',
        // la carte source.
        'Carte source : mercury_simp_cyl.map (projection cylindrique simple).',
      // fin des remarques ;
      ],
      // ses cinq couches.
      layers: usgsLayers,
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « mercury-trek » ;
      id: 'mercury-trek',
      // son nom ;
      name: 'NASA Mercury Trek — DEM',
      // sa nature, ArcGIS ImageServer ;
      kind: 'arcgis-image',
      // sa description :
      description:
        // son texte ;
        'Modèle numérique d’élévation global de Mercure servi par l’ArcGIS ImageServer de NASA Trek.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://trek.nasa.gov/mercury/',
      // sa mention ;
      attribution: TREK_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA/USGS ouvertes',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // le relief est un raster 16 bits, exporté en gris ;
        'Le raster est un DEM 16 bits : l’export JPEG est un nivellement en niveaux de gris, destiné au relief.',
        // chaque tuile est découpée à la demande, sans cache ;
        'Chaque tuile est découpée à la demande via exportImage, sans cache WMTS.',
        // résolution native de 665 m par pixel.
        'Résolution native 665 m/pixel ; le zoom 8 dépasse légèrement la résolution source.',
      // fin des remarques ;
      ],
      // sa couche.
      layers: [demLayer],
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « mercury-trek-wmts » ;
      id: 'mercury-trek-wmts',
      // son nom ;
      name: 'NASA Mercury Trek — WMTS MESSENGER',
      // sa nature, WMTS ;
      kind: 'wmts',
      // sa description :
      description:
        // son texte ;
        'Mosaïque globale couleur renforcée MESSENGER MDIS, servie par le cache WMTS officiel NASA Mercury Trek.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mercury',
      // sa mention ;
      attribution: TREK_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA/USGS ouvertes — citation des auteurs souhaitée',
      // sans jeton ;
      requiresToken: false,
      // l'adresse de ses capacités ;
      capabilitiesUrl: `${config.trekWmtsBaseUrl}/WMTSCapabilities.xml`,
      // ses remarques :
      notes: [
        // la grille : 2 colonnes × 1 ligne au niveau 0 ;
        'Grille équirectangulaire 2:1 : 2 colonnes × 1 ligne au niveau 0.',
        // mosaïque à 665 m par pixel, en JPEG ;
        'Mosaïque MDIS enhanced color à 665 m/pixel ; tuiles JPEG.',
        // le relief reste proposé par mercury-trek.
        'Le DEM MESSENGER/USGS de 665 m reste exposé dans mercury-trek.',
      // fin des remarques ;
      ],
      // sa couche.
      layers: [trekWmtsLayer],
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « mercury-quickmap » ;
      id: 'mercury-quickmap',
      // son nom ;
      name: 'MESSENGER / USGS — fond Mercury Basemap',
      // sa nature, XYZ ;
      kind: 'xyz',
      // sa description :
      description:
        // son texte ;
        'Fond pré-rendu combinant la mosaïque couleur MDIS et le relief DEM MESSENGER/USGS, distribué par un cache ArcGIS tiers.',
      // l'adresse de sa documentation :
      docsUrl:
        // sa valeur ;
        'https://tiles.arcgis.com/tiles/0xMt0kzpNJRZcyJb/arcgis/rest/services/Mercury_Basemap/MapServer',
      // sa mention ;
      attribution: QUICKMAP_ATTRIBUTION,
      // sa licence ;
      license: 'Données MESSENGER / USGS ouvertes ; service de tuiles tiers',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // le service est un fond non officiel ;
        'Le service ArcGIS est un fond non officiel dérivé de produits USGS Astropedia ; il n’est pas affilié à l’USGS.',
        // son cache est décalé d'un niveau par rapport à la grille du globe ;
        'Cache en coordonnées mercuriennes (WKID 104974), origine −180°/180° ; le niveau source est décalé d’un cran par rapport à la grille du globe.',
        // relief et mosaïque sont déjà mêlés dans les tuiles.
        'Le DEM et la mosaïque sont pré-composés dans les tuiles ; pour utiliser les couches séparément, choisir le DEM Trek ou une mosaïque WMS.',
      // fin des remarques ;
      ],
      // sa couche.
      layers: [quickmapLayer],
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « opm-mercury » ;
      id: 'opm-mercury',
      // son nom ;
      name: 'OpenPlanetaryMap (OPM) — Mercure',
      // sa nature, XYZ ;
      kind: 'xyz',
      // sa description :
      description:
        // son texte ;
        'Tuiles XYZ du fond de carte mercurien OpenPlanetaryMap, en Web Mercator.',
      // l'adresse de sa documentation :
      docsUrl:
        // sa valeur ;
        'http://openplanetarymap.org/basemaps/mercury/opm-mercury-basemap-v0-1-draft/',
      // sa mention ;
      attribution: OPM_ATTRIBUTION,
      // sa licence ;
      license: 'Voir OpenPlanetaryMap / CARTO',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // les tuiles sont en Web Mercator, pas dans la projection de Mercure ;
        'OPM projette Mercure en Web Mercator : les tuiles ne sont pas en projection mercurienne.',
        // la résolution utile s'arrête vers le niveau 7.
        'La résolution utile s’arrête autour du niveau 7.',
      // fin des remarques ;
      ],
      // sa couche.
      layers: [opmLayer],
    // fin du fournisseur.
    },
  // Fin de la liste.
  ];
// Fin de buildProviders.
}
