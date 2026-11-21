// Outils NestJS : injection par jeton, service injectable, erreur 404.
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
// Jeton d'injection de la configuration de Mars, et son type.
import { MARS_CONFIG, type MarsConfig } from './mars.config';
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
} from './mars.types';
// Fonction qui construit l'adresse d'une tuile chez la source.
import { buildTileUrl } from './tile-url';

// Mention de NASA Mars Trek.
const NASA_ATTRIBUTION = 'NASA Mars Trek — Viking MDIM21 (NASA/GSFC/USGS)';
// Mention de l'USGS.
const USGS_ATTRIBUTION = 'USGS Astrogeology Science Center';
// Mention d'OpenPlanetaryMap :
const OPM_ATTRIBUTION =
  // son texte.
  'OpenPlanetaryMap (OPM) — données NASA/USGS, tuiles CARTO';
// Mention de la mosaïque CTX :
const CTX_ATTRIBUTION =
  // son texte.
  'Source: NASA/JPL/MSSS/Caltech Murray Lab/Esri — Global CTX Mosaic of Mars';
// Fournisseurs cachés dans les listes :
const HIDDEN_PROVIDER_IDS: ReadonlySet<ProviderId> = new Set([
  // l'USGS ;
  'usgs-astro-mars',
  // OpenPlanetaryMap.
  'opm-mars',
// Fin de la liste.
]);

// Fonction tileUrlTemplate.
function tileUrlTemplate(providerId: string, layerId: string): string {
  // Le modèle d'adresse des tuiles d'une couche sur ce serveur.
  return `/api/v1/mars/providers/${providerId}/layers/${layerId}/tile/{z}/{x}/{y}`;
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
// Classe du catalogue de Mars.
export class MarsCatalogService {
  // Liste des fournisseurs.
  private readonly providers: ProviderDefinition[];
  // Table des fournisseurs, par identifiant.
  private readonly providerMap: Map<string, ProviderDefinition>;

  // Constructeur : la configuration, demandée par son jeton.
  constructor(@Inject(MARS_CONFIG) config: MarsConfig) {
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
    // Renvoie les fournisseurs,
    return this.providers.filter(
      // sans ceux qui sont cachés.
      (provider) => !HIDDEN_PROVIDER_IDS.has(provider.id),
    // Fin du filtre.
    );
  // Fin de listProviders.
  }

  // Méthode listSummaries.
  listSummaries(): ProviderSummary[] {
    // Le résumé de chaque fournisseur listé.
    return this.listProviders().map((provider) => toProviderSummary(provider));
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
    // Cherche le fournisseur dans la table (les cachés y sont aussi).
    const provider = this.providerMap.get(providerId);
    // Introuvable :
    if (!provider) {
      // erreur 404,
      throw new NotFoundException(
        // avec son identifiant.
        `Fournisseur martien inconnu : ${providerId}`,
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
      // son numéro de jeu 3D Tiles, ou null ;
      tiles3dAssetId: layer.tiles3d?.assetId ?? null,
      // un exemple d'adresse chez la source :
      sampleUpstreamUrl:
        // pour une couche sans tuiles 2D,
        layer.scheme === 'none'
          // null ;
          ? null
          // sinon celle de sa première tuile, à son niveau minimal.
          : buildTileUrl(provider, layer, layer.minZoom, 0, 0),
    // Fin de l'objet.
    };
  // Fin de describeLayer.
  }
// Fin du service.
}

// Fonction buildProviders : construit les fournisseurs à partir de la configuration.
function buildProviders(config: MarsConfig): ProviderDefinition[] {
  // Adresse de base du produit chez NASA Trek.
  const trekBase = `${config.trekBaseUrl}/${config.trekProduct}/1.0.0`;
  // Adresse de ses capacités WMTS.
  const trekCapabilities = `${trekBase}/WMTSCapabilities.xml`;
  // Adresse des requêtes GetMap de l'USGS, avec sa carte.
  const usgsGetMap = `${config.usgsBaseUrl}?map=${config.usgsMap}`;
  // Adresse de ses capacités WMS.
  const usgsCapabilities = `${usgsGetMap}&service=WMS&request=GetCapabilities`;

  // Couche de NASA Trek :
  const wmtsLayer: CuratedLayer = {
    // son identifiant, « viking-mdim21 » ;
    id: 'viking-mdim21',
    // son titre ;
    title: 'Viking MDIM21 — mosaïque globale couleur',
    // sa description :
    description:
      // son texte ;
      'Mosaïque globale couleur Viking MDIM21 (232 m/px), diffusée par Mars Trek.',
    // son nom chez la source ;
    upstreamLayer: config.trekProduct,
    // sa nature, WMTS ;
    kind: 'wmts',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, EPSG:104905 ;
    crs: 'EPSG:104905',
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.trekMaxZoom,
    // des tuiles de 256 pixels ;
    tileSize: 256,
    // le format JPEG ;
    format: 'image/jpeg',
    // sa mention ;
    attribution: NASA_ATTRIBUTION,
    // sa licence ;
    license: 'Données NASA ouvertes',
    // ses réglages WMTS :
    wmts: {
      // l'adresse de base ;
      baseUrl: trekBase,
      // le style ;
      style: config.trekStyle,
      // le jeu de tuiles ;
      matrixSet: config.trekMatrixSet,
      // l'extension jpg.
      extension: 'jpg',
    // Fin des réglages.
    },
  // Fin de la couche.
  };

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

  // Les six couches de l'USGS :
  const usgsLayers: CuratedLayer[] = [
    // une couche :
    {
      // son identifiant, « mola-themis-blend » ;
      id: 'mola-themis-blend',
      // son titre ;
      title: 'MOLA + THEMIS — composition couleur',
      // sa description :
      description:
        // son texte ;
        'Composition de la topographie MOLA et de l’imagerie infrarouge THEMIS, fond de carte martien classique.',
      // son nom chez la source ;
      upstreamLayer: 'MOLA_THEMIS_blend',
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
      // son identifiant, « mdim21-color » ;
      id: 'mdim21-color',
      // son titre ;
      title: 'MDIM21 — mosaïque couleur',
      // sa description :
      description:
        // son texte ;
        'Mosaïque globale Viking MDIM21 en couleur, rendue par le serveur WMS de l’USGS.',
      // son nom chez la source ;
      upstreamLayer: 'MDIM21_color',
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
      // son identifiant, « mdim21 » ;
      id: 'mdim21',
      // son titre ;
      title: 'MDIM21 — mosaïque globale',
      // sa description ;
      description: 'Mosaïque globale Viking MDIM21 en niveaux de gris.',
      // son nom chez la source ;
      upstreamLayer: 'MDIM21',
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
      // son identifiant, « mola-color » ;
      id: 'mola-color',
      // son titre ;
      title: 'MOLA — relief ombré couleur',
      // sa description :
      description:
        // son texte ;
        'Relief ombré coloré issu de l’altimètre laser MOLA (Mars Global Surveyor).',
      // son nom chez la source ;
      upstreamLayer: 'MOLA_color',
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
      // son identifiant, « mola-bw » ;
      id: 'mola-bw',
      // son titre ;
      title: 'MOLA — relief ombré niveaux de gris',
      // sa description ;
      description: 'Relief ombré MOLA en niveaux de gris.',
      // son nom chez la source ;
      upstreamLayer: 'MOLA_bw',
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
      // son identifiant, « hrsc-mola-hillshade » ;
      id: 'hrsc-mola-hillshade',
      // son titre ;
      title: 'HRSC + MOLA — relief ombré',
      // sa description :
      description:
        // son texte ;
        'Relief ombré combinant la caméra stéréo HRSC (Mars Express) et l’altimétrie MOLA.',
      // son nom chez la source ;
      upstreamLayer: 'HRSC_MOLA_Blend_Hillshade',
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

  // Fond de carte d'OpenPlanetaryMap :
  const opmBasemap: CuratedLayer = {
    // son identifiant, « mars-basemap-v0-2 » ;
    id: 'mars-basemap-v0-2',
    // son titre ;
    title: 'OPM Mars Basemap v0.2',
    // sa description :
    description:
      // son texte ;
      'Fond de carte communautaire OpenPlanetaryMap combinant rasters et vecteurs martiens.',
    // son nom chez la source ;
    upstreamLayer: 'opm-mars-basemap-v0-2',
    // sa nature, XYZ ;
    kind: 'xyz',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, IAU_2015:49900 ;
    crs: 'IAU_2015:49900',
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
      // lignes comptées depuis le haut.
      tms: false,
    // fin des réglages.
    },
  // Fin de la couche.
  };

  // Relief ombré d'OpenPlanetaryMap :
  const opmHillshade: CuratedLayer = {
    // son identifiant, « mars-hillshade » ;
    id: 'mars-hillshade',
    // son titre ;
    title: 'OPM Mars Hillshade',
    // sa description :
    description:
      // son texte ;
      'Relief ombré martien OpenPlanetaryMap, à superposer au fond de carte.',
    // son nom chez la source ;
    upstreamLayer: 'opm-mars-hillshade',
    // sa nature, XYZ ;
    kind: 'xyz',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, IAU_2015:49900 ;
    crs: 'IAU_2015:49900',
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
      urlTemplate: config.opmHillshadeUrl,
      // lignes comptées depuis le haut.
      tms: false,
    // fin des réglages.
    },
  // Fin de la couche.
  };

  // Mosaïque CTX du Murray Lab :
  const ctxMosaic: CuratedLayer = {
    // son identifiant, « ctx-mosaic-v01 » ;
    id: 'ctx-mosaic-v01',
    // son titre ;
    title: 'Global CTX Mosaic — Murray Lab (Caltech)',
    // sa description :
    description:
      // son texte ;
      'Mosaïque globale de Mars à 5,0 m/px assemblée à partir de 86 571 images CTX (Mars Reconnaissance Orbiter) par le Murray Lab du California Institute of Technology.',
    // son nom chez la source ;
    upstreamLayer: 'OnMars/CTX1',
    // sa nature, XYZ ;
    kind: 'xyz',
    // son découpage, plate carrée ;
    scheme: 'equirectangular',
    // sa projection, IAU2000:49900 ;
    crs: 'IAU2000:49900',
    // son niveau minimal, 0 ;
    minZoom: 0,
    // son niveau maximal, pris dans la configuration ;
    maxZoom: config.ctxMaxZoom,
    // des tuiles de 512 pixels ;
    tileSize: 512,
    // le format JPEG ;
    format: 'image/jpeg',
    // sa mention ;
    attribution: CTX_ATTRIBUTION,
    // sa licence ;
    license: 'Libre avec attribution (NASA/JPL/MSSS/Caltech Murray Lab/Esri)',
    // ses réglages XYZ :
    xyz: {
      // le modèle d'adresse, pris dans la configuration ;
      urlTemplate: config.ctxTileUrl,
      // lignes comptées depuis le haut.
      tms: false,
    // fin des réglages.
    },
  // Fin de la couche.
  };

  // Renvoie les quatre fournisseurs :
  return [
    // un fournisseur :
    {
      // son identifiant, « mars-trek » ;
      id: 'mars-trek',
      // son nom ;
      name: 'NASA Mars Trek (Solar System Treks)',
      // sa nature, WMTS ;
      kind: 'wmts',
      // sa description :
      description:
        // son texte ;
        'Service WMTS officiel de la NASA pour les mosaïques martiennes.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars',
      // sa mention ;
      attribution: NASA_ATTRIBUTION,
      // sa licence ;
      license: 'Données NASA ouvertes',
      // sans jeton ;
      requiresToken: false,
      // l'adresse de ses capacités ;
      capabilitiesUrl: trekCapabilities,
      // ses remarques :
      notes: [
        // le tuilage : plate carrée 2:1, 2 tuiles en largeur au niveau 0 ;
        'Tuilage équirectangulaire 2:1, 2 tuiles en largeur au niveau 0.',
        // le produit Viking s'arrête au niveau 7 ;
        'Le produit Viking MDIM21 s’arrête au niveau 7 (256 tuiles en largeur).',
        // sa projection, EPSG:104905.
        'CRS EPSG:104905 (sphère Mars 2015).',
      // fin des remarques ;
      ],
      // sa couche.
      layers: [wmtsLayer],
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « usgs-astro-mars » ;
      id: 'usgs-astro-mars',
      // son nom ;
      name: 'USGS Astrogeology WMS — Mars',
      // sa nature, WMS ;
      kind: 'wms',
      // sa description :
      description:
        // son texte ;
        'Serveur WMS de l’USGS Astrogeology pour les couches martiennes globales.',
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
        // la carte utilisée ;
        'La carte utilisée est /maps/mars/mars_simp_cyl.map.',
        // les jeux de quads, qui ne sont pas proposés ici.
        'Les jeux de quads (Mars5M_Quads, Mars2M_Quads, Mars500K_Quads) sont indexés et ne sont pas exposés ici.',
      // fin des remarques ;
      ],
      // ses six couches.
      layers: usgsLayers,
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « opm-mars » ;
      id: 'opm-mars',
      // son nom ;
      name: 'OpenPlanetaryMap (OPM) — Mars',
      // sa nature, XYZ ;
      kind: 'xyz',
      // sa description :
      description:
        // son texte ;
        'Tuiles XYZ des fonds de carte martiens OpenPlanetaryMap, en projection équirectangulaire.',
      // l'adresse de sa documentation :
      docsUrl:
        // sa valeur ;
        'http://openplanetarymap.org/basemaps/mars/opm-mars-basemap-v0-2/',
      // sa mention ;
      attribution: OPM_ATTRIBUTION,
      // sa licence ;
      license: 'Voir OpenPlanetaryMap / CARTO',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // la pyramide : 2 × 1 tuiles au niveau 0 ;
        'Pyramide équirectangulaire 2:1 : 2×1 tuiles au niveau 0.',
        // la résolution utile s'arrête vers le niveau 6 ;
        'La résolution utile s’arrête autour du niveau 6.',
        // le serveur peut rendre une image hors de la pyramide ;
        'Le serveur CARTO peut renvoyer une image hors des limites réelles de la pyramide : validez la couverture côté client.',
        // sa projection de référence.
        'CRS de référence : IAU_2015:49900 (sphère Mars 2015).',
      // fin des remarques ;
      ],
      // ses deux couches.
      layers: [opmBasemap, opmHillshade],
    // fin du fournisseur.
    },
    // un fournisseur :
    {
      // son identifiant, « murray-lab » ;
      id: 'murray-lab',
      // son nom ;
      name: 'Murray Lab — Global CTX Mosaic (Caltech)',
      // sa nature, XYZ ;
      kind: 'xyz',
      // sa description :
      description:
        // son texte ;
        'Mosaïque CTX globale de Mars (5,7 térapixels, 5,0 m/px natif) du Murray Lab (Caltech), diffusée en tuiles ArcGIS.',
      // l'adresse de sa documentation ;
      docsUrl: 'https://murray-lab.caltech.edu/CTX/',
      // sa mention ;
      attribution: CTX_ATTRIBUTION,
      // sa licence ;
      license: 'Libre avec attribution (NASA/JPL/MSSS/Caltech Murray Lab/Esri)',
      // sans jeton ;
      requiresToken: false,
      // ses remarques :
      notes: [
        // la pyramide : tuiles de 512 pixels, ligne 0 au nord ;
        'Pyramide équirectangulaire 2:1 servie en tuiles de 512 px, origine -180°/90°, row 0 au nord.',
        // la couverture, et les tuiles vides qui répondent 404 ;
        'Couverture ~99,5 % entre 88°S et 88°N, répartie en 3 960 tuiles de 4°×4° (86 571 images CTX) ; certaines tuiles vides renvoient HTTP 404.',
        // le niveau 12 est le niveau natif ; les niveaux 13 à 17 répondent 400 ;
        'Le niveau 12 (~5,1 m/px à l’équateur) atteint la résolution native de la mosaïque ; les niveaux 13 à 17 annoncés par le service renvoient HTTP 400.',
        // JPEG pour les images, PNG transparent pour les tuiles sans données ;
        'Les tuiles d’imagerie sont renvoyées en JPEG (souvent en niveaux de gris) ; les tuiles sans données reviennent en PNG transparent — se fier à l’en-tête Content-Type.',
        // les tuiles d'origine restent téléchargeables ;
        'Les tuiles source 4°×4° (JPEG 2000) restent téléchargeables sur murray-lab.caltech.edu.',
        // sa projection de référence.
        'CRS de référence : WKID 104971 (GCS_Mars_2000_Sphere), exposé ici comme IAU2000:49900.',
      // fin des remarques ;
      ],
      // sa couche.
      layers: [ctxMosaic],
    // fin du fournisseur.
    },
  // Fin de la liste.
  ];
// Fin de buildProviders.
}
