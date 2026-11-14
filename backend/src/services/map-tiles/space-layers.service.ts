// Injectable : rend le service injectable par NestJS.
import { Injectable } from '@nestjs/common';
// Catalogue de Mars.
import { MarsCatalogService } from '../mars/mars-catalog.service';
// Catalogue de Mercure.
import { MercuryCatalogService } from '../mercury/mercury-catalog.service';
// Catalogue de la Lune.
import { MoonCatalogService } from '../moon/moon.service';
// Types (effacés à la compilation) d'un astre, d'une description de couche et d'une couche résolue.
import type { TileBody, TileLayerInfo, ResolvedTileLayer } from './providers/tile-provider';

// Nom court de chaque fournisseur, pour l'intitulé des couches :
const PROVIDER_LABEL: Record<string, string> = {
  // NASA Moon Trek ;
  'moon-trek': 'NASA Moon Trek',
  // USGS Astrogeology (Lune) ;
  'usgs-astro': 'USGS Astrogeology',
  // LROC Lunaserv ;
  'lroc-lunaserv': 'LROC Lunarserv',
  // USGS Astrogeology (Mars) ;
  'usgs-astro-mars': 'USGS Astrogeology',
  // OpenPlanetaryMap (Mars) ;
  'opm-mars': 'OpenPlanetaryMap',
  // Murray Lab ;
  'murray-lab': 'Caltech Murray Lab',
  // Lunaserv (Mercure) ;
  'mercury-lunaserv': 'ASU Lunaserv',
  // USGS Astrogeology (Mercure) ;
  'usgs-astro-mercury': 'USGS Astrogeology',
  // NASA Mercury Trek ;
  'mercury-trek': 'NASA Mercury Trek',
  // NASA Mercury Trek en WMTS ;
  'mercury-trek-wmts': 'NASA Mercury Trek',
  // Mercury QuickMap ;
  'mercury-quickmap': 'Mercury QuickMap',
  // OpenPlanetaryMap (Mercure).
  'opm-mercury': 'OpenPlanetaryMap',
// Fin de la table.
};

// Forme d'une couche adaptée à l'API de tuiles.
interface Adaptee {
  // info : sa description.
  info: TileLayerInfo;
  // urlTemplate : son modèle d'adresse.
  urlTemplate: string;
  // attribution : sa mention.
  attribution: string;
// Fin de Adaptee.
}

/**
 * Expose les catalogues Lune/Mars/Mercure de l'app Space (modules moon/mars/mercury) dans l'API de tuiles de Gobai.
 * Seules les couches en projection géographique sont reprises : mêmes grilles 2^(z+1) × 2^z que le moteur,
 * et tuiles servies par le proxy `/api/v1/<astre>/providers/...` (aucune clé, CORS inutile côté navigateur).
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des catalogues.
export class SpaceLayersService {
  // Couches adaptées, calculées au premier appel ; null avant.
  private adapted: Map<string, Adaptee> | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // le catalogue de la Lune ;
    private readonly moon: MoonCatalogService,
    // celui de Mars ;
    private readonly mars: MarsCatalogService,
    // celui de Mercure.
    private readonly mercury: MercuryCatalogService,
  // Corps du constructeur vide.
  ) {}

  // Méthode list.
  list(): TileLayerInfo[] {
    // La description de chaque couche adaptée.
    return [...this.getAdapted().values()].map((entry) => entry.info);
  // Fin de list.
  }

  // Méthode resolve : le modèle d'adresse d'une couche, ou null.
  resolve(layerId: string): ResolvedTileLayer | null {
    // Cherche la couche.
    const entry = this.getAdapted().get(layerId);
    // Inconnue : null.
    if (!entry) return null;
    // Sa description, son modèle d'adresse, pas d'expiration, sa mention.
    return { ...entry.info, urlTemplate: entry.urlTemplate, expiresAt: null, attribution: { text: entry.attribution } };
  // Fin de resolve.
  }

  // Méthode privée getAdapted.
  private getAdapted(): Map<string, Adaptee> {
    // Déjà calculées : on les rend.
    if (this.adapted) return this.adapted;
    // Table produite.
    const out = new Map<string, Adaptee>();
    // Les trois catalogues, chacun avec son astre ;
    const catalogs: Array<
      // type de chaque couple ;
      [TileBody, MoonCatalogService | MarsCatalogService | MercuryCatalogService]
    // valeur :
    > = [
      // la Lune ;
      ['moon', this.moon],
      // Mars ;
      ['mars', this.mars],
      // Mercure.
      ['mercury', this.mercury],
    // Fin de la liste.
    ];
    // Pour chaque catalogue,
    for (const [body, catalog] of catalogs) {
      // chacune de ses sources :
      for (const provider of catalog.listProviders()) {
        // une source qui exige un jeton est sautée.
        if (provider.requiresToken) continue;
        // Pour chacune de ses couches :
        for (const layer of provider.layers) {
          // 3D Tiles et Web Mercator : incompatibles avec les grilles du moteur (trous polaires).
          // une couche qui n'est pas en projection géographique est sautée ;
          if (layer.scheme !== 'equirectangular') continue;
          // Déjà fourni par la couche `mars-viking` de Gobai (même produit NASA).
          // la mosaïque Viking de Mars Trek aussi, déjà fournie ailleurs.
          if (body === 'mars' && provider.id === 'mars-trek' && layer.id === 'viking-mdim21') continue;
          // Identifiant : « space- », l'astre, la source et la couche.
          const id = `space-${body}-${provider.id}-${layer.id}`;
          // Calque de noms de lieux ?
          const overlay = layer.id.includes('nomenclature');
          // Couche de relief, d'après son nom ?
          const relief = /hillshade|shade|bw|dem/.test(layer.id);
          // Description de la couche :
          const info: TileLayerInfo = {
            // son identifiant ;
            id,
            // son intitulé : le titre de la couche et le nom court de la source ;
            label: `${layer.title} · ${PROVIDER_LABEL[provider.id] ?? provider.name}`,
            // sa description ;
            description: layer.description,
            // sa nature : calque, relief ou imagerie ;
            kind: overlay ? 'overlay' : relief ? 'relief' : 'imagery',
            // sa source ;
            provider: provider.id as TileLayerInfo['provider'],
            // son astre ;
            body,
            // projection géographique ;
            projection: 'equirectangular',
            // son zoom minimal ;
            minZoom: layer.minZoom,
            // son zoom maximal ;
            maxZoom: layer.maxZoom,
            // la taille de ses tuiles ;
            tileSize: layer.tileSize,
            // PNG ou JPEG, d'après son type de contenu ;
            format: layer.format === 'image/png' ? 'png' : 'jpeg',
            // transparente si c'est un calque ;
            transparent: overlay,
            // sans clé ;
            requiresKey: false,
            // vérifiée.
            experimental: false,
          // Fin de la description.
          };
          // Range la couche :
          out.set(id, {
            // sa description,
            info,
            // son modèle d'adresse, qui passe par la passerelle de l'astre,
            urlTemplate: `/api/v1/${body}/providers/${provider.id}/layers/${layer.id}/tile/{z}/{x}/{y}`,
            // et sa mention.
            attribution: layer.attribution,
          // Fin du rangement.
          });
        // Fin de la boucle des couches.
        }
      // Fin de la boucle des sources.
      }
    // Fin de la boucle des catalogues.
    }
    // Garde la table.
    this.adapted = out;
    // La renvoie.
    return out;
  // Fin de getAdapted.
  }
// Fin du service.
}
