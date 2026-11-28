import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MOON_CONFIG, MoonConfig } from './moon.config';
import { CuratedLayer, LayerDetail, LayerSummary, ProviderDefinition, ProviderSummary } from './moon.types';
import { buildTileUrl } from './tile-url';

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
      // la version 1.1.1 (seule acceptée par LunaServ en GetMap) ;
      version: '1.1.1',
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
            // l'adresse de base : dossier Trek de la Lune, produit et version 1.0.0 (comme Mars) ;
            baseUrl: `${config.trekBaseUrl}/${config.trekProduct}/1.0.0`,
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
      name: 'LROC LunaServ (WMS 1.1.1)',
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
      // l'adresse de ses capacités, en WMS 1.1.1 ;
      capabilitiesUrl: `${config.lrocCapabilitiesUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`,
      // ses remarques :
      notes: [
        // en 1.1.1, l'emprise suit la longitude d'abord ;
        'WMS 1.1.1 (le service LunaServ refuse la 1.3.0 en GetMap) : BBOX ouest,sud,est,nord.',
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
          // son nom chez la source (la couche « lroc_wmosaic » n'existe pas sur LunaServ : la mosaïque globale est « luna_wac_global ») ;
          upstreamLayer: 'luna_wac_global',
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
            // la version 1.1.1 (seule acceptée par LunaServ en GetMap) ;
            version: '1.1.1',
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
