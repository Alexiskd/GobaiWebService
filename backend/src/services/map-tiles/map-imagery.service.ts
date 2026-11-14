// Outils NestJS : erreur 400, injection par jeton, service injectable, erreur 404, dépendance facultative.
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Types (effacés à la compilation) des réponses : localisation, liste des couches, sources.
import type { LocateDto, TileLayerListDto, AttributionDto } from '../../dto/tiles.dto';
// Fonctions et constantes du calcul des tuiles.
import { fillTemplate, gridSize, isValidTile, lonLatToTile, tileBounds, TILE_SIZE, MAX_LATITUDE } from './tile-math';
// Types (effacés à la compilation) d'une couche résolue, d'un fournisseur et d'une zone visible.
import type { ResolvedTileLayer, TileProvider, Viewport } from './providers/tile-provider';
// Fournisseur de la Terre : NASA GIBS.
import { GibsTileProvider } from './providers/gibs-tile.provider';
// Fournisseur de la Lune : NASA Moon Trek.
import { NasaTrekMoonProvider } from './providers/nasa-trek-moon.provider';
// Fournisseur de Mars : NASA Mars Trek.
import { NasaTrekMarsProvider } from './providers/nasa-trek-mars.provider';
// Service des catalogues Lune, Mars et Mercure.
import { SpaceLayersService } from './space-layers.service';
// Service de l'imagerie de la Terre (couche unique).
import { EarthImageryService } from './earth-imagery.service';
// Calques LiDAR HD de l'IGN : mention, liste et résolution.
import { LIDAR_HD_ATTRIBUTION, LIDAR_HD_CITY_ALTITUDE_M, lidarHdCities, lidarHdLayers, resolveLidarHd } from './lidar-hd';
// Service des cartes des satellites naturels.
import { SatelliteTilesService } from './satellite-tiles.service';
// Identifiant de la couche mélangée de Mars.
import { MARS_BLEND_LAYER_ID } from '../mars/mars-blend.service';
// Ouvre l'import de la fusion de Mars :
import {
  // fonction qui donne l'identifiant de couche d'un algorithme ;
  getMarsFusionLayerId,
  // liste des algorithmes de fusion.
  MARS_FUSION_ALGORITHM_INFO,
// Fin de l'import.
} from '../mars/mars-fusion.service';

// Jeton d'injection de la liste des fournisseurs.
export const TILE_PROVIDERS = 'TILE_PROVIDERS';

// Description de la couche mélangée de Mars :
const MARS_BLEND_LAYER = {
  // son identifiant ;
  id: MARS_BLEND_LAYER_ID,
  // son nom affiché ;
  label: 'Mars Viking + CTX — palette',
  // sa description, sur la ligne suivante :
  description:
    // le texte.
    'Fusion Viking MDIM21 (NASA Mars Trek) + Global CTX Mosaic (Murray Lab/Caltech), recolorée avec la palette Mars.',
  // nature : imagerie ;
  kind: 'imagery' as const,
  // fournisseur : Murray Lab ;
  provider: 'murray-lab' as const,
  // astre : Mars ;
  body: 'mars' as const,
  // projection géographique ;
  projection: 'equirectangular' as const,
  // zoom minimal 0 ;
  minZoom: 0,
  // zoom maximal 3 ;
  maxZoom: 3,
  // tuiles de 512 pixels ;
  tileSize: 512,
  // format PNG ;
  format: 'png' as const,
  // sans transparence ;
  transparent: false,
  // sans clé ;
  requiresKey: false,
  // vérifiée.
  experimental: false,
// Fin de la description.
};

// Une couche par algorithme de fusion de Mars :
const MARS_FUSION_LAYERS = MARS_FUSION_ALGORITHM_INFO.map((algorithm) => ({
  // son identifiant, tiré du nom court de l'algorithme ;
  id: getMarsFusionLayerId(algorithm.slug),
  // son nom affiché ;
  label: algorithm.label,
  // sa description ;
  description: algorithm.description,
  // nature : imagerie ;
  kind: 'imagery' as const,
  // fournisseur : Murray Lab ;
  provider: 'murray-lab' as const,
  // astre : Mars ;
  body: 'mars' as const,
  // projection géographique ;
  projection: 'equirectangular' as const,
  // zoom minimal 0 ;
  minZoom: 0,
  // zoom maximal 3 ;
  maxZoom: 3,
  // tuiles de 512 pixels ;
  tileSize: 512,
  // format PNG ;
  format: 'png' as const,
  // sans transparence ;
  transparent: false,
  // sans clé ;
  requiresKey: false,
  // vérifiée.
  experimental: false,
// Fin de la liste.
}));

/**
 * La Terre utilise NASA GIBS ; la Lune et Mars viennent de NASA Solar System Treks (Moon et Mars Trek). Vénus n'a plus de fond de carte.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service principal des tuiles.
export class TilesService {
  // Fournisseur de la Terre.
  private readonly gibs: TileProvider;
  // Fournisseur de la Lune.
  private readonly moon: TileProvider;
  // Fournisseur de Mars.
  private readonly mars: TileProvider;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // la liste des fournisseurs ;
    @Inject(TILE_PROVIDERS) providers: TileProvider[],
    // le service des catalogues, facultatif ;
    @Optional() private readonly space?: SpaceLayersService,
    // le service des satellites, facultatif ;
    @Optional() private readonly satellites?: SatelliteTilesService,
    // le service de l'imagerie de la Terre, facultatif.
    @Optional() private readonly earth?: EarthImageryService,
  // Corps du constructeur :
  ) {
    // GIBS : celui de la liste, sinon un nouveau ;
    this.gibs = providers.find((p) => p.id === 'gibs') ?? new GibsTileProvider(config.tiles.gibs);
    // Moon Trek : celui de la liste, sinon un nouveau ;
    this.moon = providers.find((p) => p.id === 'nasa-trek') ?? new NasaTrekMoonProvider(config.tiles.moon);
    // Mars Trek : celui de la liste, sinon un nouveau.
    this.mars = providers.find((p) => p.id === 'mars-trek') ?? new NasaTrekMarsProvider(config.tiles.mars);
  // Fin du constructeur.
  }

  /** Fond terrestre fixe : NASA GIBS, gratuit et sans clé. */
  // Méthode active : le fournisseur de la Terre en service.
  active(): { provider: TileProvider; fallback: boolean } {
    // Toujours GIBS, jamais un repli.
    return { provider: this.gibs, fallback: false };
  // Fin de active.
  }

  // Méthode list : toutes les couches.
  list(): TileLayerListDto {
    // Fournisseur actif.
    const { provider, fallback } = this.active();
    // Renvoie :
    return {
      // son identifiant, le repli, la taille des tuiles, et la recherche de lieux disponible ;
      provider: provider.id, fallback, tileSize: TILE_SIZE, placeSearch: true, // Photon (OpenStreetMap, sans clé)
      // Terre : une seule couche d'imagerie (earth-hd), qui inclut déjà NASA GIBS parmi ses sources ; GIBS n'est
      // listé seul que si le service de la couche unique est absent.
      // les couches : celles de GIBS seulement si la couche unique de la Terre est absente, puis la Lune, Mars, le mélange et les fusions de Mars, les catalogues, les satellites, la couche unique de la Terre et le LiDAR HD.
      layers: [...(this.earth ? [] : provider.layers()), ...this.moon.layers(), ...this.mars.layers(), MARS_BLEND_LAYER, ...MARS_FUSION_LAYERS, ...(this.space?.list() ?? []), ...(this.satellites?.layers() ?? []), ...(this.earth?.layers() ?? []), ...lidarHdLayers()],
    // Fin de l'objet.
    };
  // Fin de list.
  }

  // Méthode resolve : le modèle d'adresse d'une couche.
  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    // Si c'est la couche mélangée de Mars :
    if (layerId === MARS_BLEND_LAYER_ID) {
      // renvoie
      return {
        // sa description,
        ...MARS_BLEND_LAYER,
        // son modèle d'adresse, servi par ce serveur,
        urlTemplate: `/api/v1/tiles/${MARS_BLEND_LAYER_ID}/{z}/{x}/{y}`,
        // sans expiration,
        expiresAt: null,
        // et sa mention :
        attribution: {
          // le texte.
          text: 'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        // Fin de la mention.
        },
      // Fin de l'objet.
      };
    // Fin du cas.
    }
    // Cherche l'algorithme de fusion
    const fusionAlgorithm = MARS_FUSION_ALGORITHM_INFO.find(
      // dont la couche porte cet identifiant.
      (algorithm) => getMarsFusionLayerId(algorithm.slug) === layerId,
    // Fin de la recherche.
    );
    // Si c'est une couche de fusion :
    if (fusionAlgorithm) {
      // retrouve sa description
      const layer = MARS_FUSION_LAYERS.find(
        // par son identifiant
        (candidate) => candidate.id === layerId,
      // (le « ! » affirme qu'elle existe).
      )!;
      // Renvoie
      return {
        // sa description,
        ...layer,
        // son modèle d'adresse, avec le nom court de l'algorithme,
        urlTemplate: `/api/v1/tiles/mars-fusion/${fusionAlgorithm.slug}/{z}/{x}/{y}`,
        // sans expiration,
        expiresAt: null,
        // et sa mention :
        attribution: {
          // le texte.
          text: 'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        // Fin de la mention.
        },
      // Fin de l'objet.
      };
    // Fin du cas.
    }
    // Cherche la couche dans les catalogues.
    const spaceLayer = this.space?.resolve(layerId);
    // Trouvée : on la renvoie.
    if (spaceLayer) return spaceLayer;
    // Calques LiDAR HD de l'IGN (France) : tuiles WMTS chargées directement par le navigateur.
    // Cherche la couche parmi les calques LiDAR HD.
    const lidar = resolveLidarHd(layerId);
    // Trouvée : on la renvoie.
    if (lidar) return lidar;
    // Sinon demande au fournisseur de cette couche.
    return this.providerFor(layerId).resolve(layerId);
  // Fin de resolve.
  }

  /**
   * Villes de France où le LiDAR HD de l'IGN est proposé, avec l'altitude d'arrivée conseillée. L'app en fait la
   * liste de Paramètres : choisir une ville allume le calque et s'y rend.
   */
  // Méthode lidarCities : les villes et l'altitude d'arrivée.
  lidarCities() {
    // L'altitude d'arrivée conseillée et l'index des villes.
    return { altitudeM: LIDAR_HD_CITY_ALTITUDE_M, items: lidarHdCities() };
  // Fin de lidarCities.
  }

  // Méthode layer : la description d'une couche.
  async layer(layerId: string) {
    // La cherche parmi toutes les couches.
    const found = this.allLayers().find((l) => l.id === layerId);
    // Inconnue : erreur 404 qui liste les couches.
    if (!found) throw new NotFoundException(this.unknownLayer(layerId));
    // La renvoie.
    return found;
  // Fin de layer.
  }

  // Méthode attribution : la mention de sources pour une zone.
  async attribution(layerId: string, viewport: Viewport): Promise<AttributionDto> {
    // Bord nord au sud du bord sud : erreur 400.
    if (viewport.north < viewport.south) throw new BadRequestException('`north` doit être supérieur ou égal à `south`.');
    // Couche mélangée de Mars :
    if (layerId === MARS_BLEND_LAYER_ID) {
      // renvoie
      return {
        // sa mention,
        copyright:
          // le texte,
          'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        // et son fournisseur.
        provider: 'murray-lab',
      // Fin de l'objet.
      };
    // Fin du cas.
    }
    // Si
    if (
      // c'est une couche de fusion de Mars
      MARS_FUSION_LAYERS.some((layer) => layer.id === layerId)
    // :
    ) {
      // renvoie
      return {
        // sa mention,
        copyright:
          // le texte,
          'NASA Mars Trek — Viking MDIM21 ; Global CTX Mosaic — Murray Lab, Caltech',
        // et son fournisseur.
        provider: 'murray-lab',
      // Fin de l'objet.
      };
    // Fin du cas.
    }
    // Cherche la couche dans les catalogues.
    const spaceLayer = this.space?.resolve(layerId);
    // Trouvée : sa mention et son fournisseur.
    if (spaceLayer) return { copyright: spaceLayer.attribution.text, provider: spaceLayer.provider };
    // Calque LiDAR HD : la mention de l'IGN.
    if (resolveLidarHd(layerId)) return { copyright: LIDAR_HD_ATTRIBUTION, provider: 'ign-lidar-hd' };
    // Sinon, fournisseur de la couche.
    const provider = this.providerFor(layerId);
    // Lui demande la mention pour la zone.
    const copyright = await provider.attribution(layerId, viewport);
    // La renvoie avec l'identifiant du fournisseur.
    return { copyright, provider: provider.id };
  // Fin de attribution.
  }

  // Méthode locate : la tuile qui contient un point.
  async locate(lat: number, lon: number, zoom: number, layerId?: string): Promise<LocateDto> {
    // Si une couche est demandée et qu'elle n'est pas en Web Mercator :
    if (layerId && (await this.layer(layerId)).projection !== 'mercator') {
      // erreur 400.
      throw new BadRequestException(`« ${layerId} » n’est pas une couche Web Mercator de la Terre : \`locate\` ne s’applique pas.`);
    // Fin du cas.
    }
    // Coordonnées de la tuile.
    const { z, x, y } = lonLatToTile(lon, lat, zoom);
    // Réponse : la tuile, son emprise et la latitude maximale.
    const out: LocateDto = { z, x, y, bounds: tileBounds(z, x, y), maxLatitude: MAX_LATITUDE };
    // Avec une couche : ajoute l'adresse de la tuile.
    if (layerId) out.url = fillTemplate((await this.resolve(layerId)).urlTemplate, { z, x, y });
    // Renvoie la réponse.
    return out;
  // Fin de locate.
  }

  /** URL finale d'une tuile précise (pour la redirection). */
  // Méthode tileUrl : l'adresse d'une tuile précise.
  async tileUrl(layerId: string, z: number, x: number, y: number): Promise<string> {
    // Description de la couche.
    const info = await this.layer(layerId);
    // Zoom hors des limites de la couche :
    if (z < info.minZoom || z > info.maxZoom) {
      // erreur 400 qui donne les limites.
      throw new BadRequestException(`Zoom ${z} hors limites pour « ${layerId} » (${info.minZoom} à ${info.maxZoom}).`);
    // Fin du cas.
    }
    // Tuile hors de la grille :
    if (!isValidTile(z, x, y, info.projection)) {
      // taille de la grille à ce niveau ;
      const { cols, rows } = gridSize(z, info.projection);
      // erreur 400 qui donne les valeurs possibles.
      throw new BadRequestException(`Tuile ${z}/${x}/${y} inexistante : x doit être entre 0 et ${cols - 1}, y entre 0 et ${rows - 1}.`);
    // Fin du cas.
    }
    // Remplit le modèle d'adresse de la couche avec les coordonnées.
    return fillTemplate((await this.resolve(layerId)).urlTemplate, { z, x, y });
  // Fin de tileUrl.
  }

  // Méthode privée allLayers : toutes les couches connues.
  private allLayers() {
    // GIBS, la Lune, Mars, le mélange et les fusions, les catalogues, les satellites, la Terre et le LiDAR HD.
    return [...this.active().provider.layers(), ...this.moon.layers(), ...this.mars.layers(), MARS_BLEND_LAYER, ...MARS_FUSION_LAYERS, ...(this.space?.list() ?? []), ...(this.satellites?.layers() ?? []), ...(this.earth?.layers() ?? []), ...lidarHdLayers()];
  // Fin de allLayers.
  }

  /** Fournisseur qui sert cette couche : la Lune et Mars ont le leur, le reste va au fournisseur actif de la Terre. */
  // Méthode privée providerFor : le fournisseur d'une couche.
  private providerFor(layerId: string): TileProvider {
    // Une couche de la Lune : Moon Trek.
    if (this.moon.layers().some((l) => l.id === layerId)) return this.moon;
    // Une couche de Mars : Mars Trek.
    if (this.mars.layers().some((l) => l.id === layerId)) return this.mars;
    // Une couche de satellite : le service des satellites.
    if (this.satellites?.has(layerId)) return this.satellites;
    // Une couche de la Terre : le service de la Terre.
    if (this.earth?.has(layerId)) return this.earth;
    // Sinon le fournisseur actif.
    return this.active().provider;
  // Fin de providerFor.
  }

  // Méthode privée unknownLayer : le message « couche inconnue ».
  private unknownLayer(id: string): string {
    // Identifiants de toutes les couches, séparés par des virgules.
    const ids = this.allLayers().map((l) => l.id).join(', ');
    // Le message.
    return `Couche inconnue : « ${id} ». Couches disponibles : ${ids}.`;
  // Fin de unknownLayer.
  }
// Fin du service.
}
