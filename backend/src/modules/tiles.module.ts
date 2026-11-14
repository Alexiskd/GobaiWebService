// Module : décorateur de NestJS ; OnApplicationBootstrap : interface d'un module qui agit une fois l'application prête.
import { Module, OnApplicationBootstrap } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Module de Mars : son catalogue et ses tuiles sont repris dans l'API de tuiles.
import { MarsModule } from './mars.module';
// Module de Mercure : idem.
import { MercuryModule } from './mercury.module';
// Module de la Lune : idem.
import { MoonModule } from './moon.module';
// Fournisseur de tuiles de la Terre : NASA GIBS.
import { GibsTileProvider } from '../services/map-tiles/providers/gibs-tile.provider';
// Fournisseur de tuiles de la Lune : NASA Moon Trek.
import { NasaTrekMoonProvider } from '../services/map-tiles/providers/nasa-trek-moon.provider';
// Fournisseur de tuiles de Mars : NASA Mars Trek.
import { NasaTrekMarsProvider } from '../services/map-tiles/providers/nasa-trek-mars.provider';
// Contrôleur des tuiles : les routes /api/v1/tiles.
import { TilesController } from '../controllers/tiles.controller';
// Jeton d'injection de la liste des fournisseurs, et service principal des tuiles.
import { TILE_PROVIDERS, TilesService } from '../services/map-tiles/map-imagery.service';
// Service de la texture en couleurs naturelles de la Lune, gardée sur le disque et relayée.
import { MoonColorService } from '../services/map-tiles/moon-color.service';
// Service du cache disque des tuiles de la Lune, avec préchargement et comblement des zones vides.
import { MoonTileCacheService } from '../services/map-tiles/moon-tile-cache.service';
// Service du modèle 3D de la Lune (GLB), téléchargé une fois et relayé.
import { MoonModelService } from '../services/map-tiles/moon-model.service';
// Service des modèles 3D des autres astres (GLB), sur le même principe.
import { BodyModelService } from '../services/map-tiles/body-model.service';
// Service qui expose les catalogues Lune, Mars et Mercure dans l'API de tuiles.
import { SpaceLayersService } from '../services/map-tiles/space-layers.service';
// Service des cartes des satellites naturels (NASA Trek, puis USGS en dernier recours).
import { SatelliteTilesService } from '../services/map-tiles/satellite-tiles.service';
// Service de l'imagerie de la Terre.
import { EarthImageryService } from '../services/map-tiles/earth-imagery.service';
// Service qui teste si un astre a une carte NASA Trek avant de l'afficher.
import { BodyAvailabilityService } from '../services/map-tiles/body-availability.service';
// Service des nuages réels de la Terre (Xweather), relayés avec un cache.
import { XweatherCloudsService } from '../services/map-tiles/xweather-clouds.service';
// Service des vents réels du moment (Open-Meteo).
import { EarthWindService } from '../services/map-tiles/earth-wind.service';
// Service de la couverture nuageuse du moment (Open-Meteo).
import { EarthCloudCoverService } from '../services/map-tiles/earth-cloud-cover.service';
// Module des éphémérides : ses services de positions sont utilisés par les tuiles.
import { EphemerisModule } from './ephemeris.module';

// Ouvre la déclaration du module.
@Module({
  // Modules importés : leurs services exportés deviennent injectables ici.
  imports: [MoonModule, MarsModule, MercuryModule, EphemerisModule],
  // Routes du module : celles du contrôleur des tuiles.
  controllers: [TilesController],
  // Services que le module fabrique :
  providers: [
    // d'abord la liste des fournisseurs de tuiles, décrite par l'objet qui suit ;
    {
      // elle est enregistrée sous le jeton TILE_PROVIDERS ;
      provide: TILE_PROVIDERS,
      // NestJS injecte la configuration dans la fabrique ;
      inject: [APP_CONFIG],
      // fabrique : rend un tableau de trois fournisseurs, chacun avec sa partie de la configuration :
      useFactory: (config: AppConfig) => [
        // GIBS pour la Terre (adresse de base config.tiles.gibs) ;
        new GibsTileProvider(config.tiles.gibs),
        // Moon Trek pour la Lune (config.tiles.moon) ;
        new NasaTrekMoonProvider(config.tiles.moon),
        // Mars Trek pour Mars (config.tiles.mars).
        new NasaTrekMarsProvider(config.tiles.mars),
      // Fin du tableau des fournisseurs.
      ],
    // Fin de la description de la liste des fournisseurs.
    },
    // Service principal des tuiles, construit directement par NestJS.
    TilesService,
    // Service des catalogues Lune, Mars et Mercure, construit directement par NestJS.
    SpaceLayersService,
    // Cartes des satellites : fabrique sans argument (paramètres par défaut du constructeur).
    { provide: SatelliteTilesService, useFactory: () => new SatelliteTilesService() },
    // Imagerie de la Terre : fabrique sans argument.
    { provide: EarthImageryService, useFactory: () => new EarthImageryService() },
    // Test de disponibilité des astres, construit directement par NestJS.
    BodyAvailabilityService,
    // Nuages Xweather : fabrique sans argument (les identifiants sont lus dans l'environnement par le service).
    { provide: XweatherCloudsService, useFactory: () => new XweatherCloudsService() },
    // Vents : fabrique sans argument.
    { provide: EarthWindService, useFactory: () => new EarthWindService() },
    // Couverture nuageuse : fabrique sans argument.
    { provide: EarthCloudCoverService, useFactory: () => new EarthCloudCoverService() },
    // Couleurs de la Lune : fabrique qui lui passe la configuration (adresse de l'image et adresses de secours).
    { provide: MoonColorService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new MoonColorService(config) },
    // Cache des tuiles de la Lune : fabrique qui lui passe la configuration (dossier du cache, niveaux à précharger).
    { provide: MoonTileCacheService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new MoonTileCacheService(config) },
    // Modèle 3D de la Lune : fabrique qui lui passe la configuration (adresse du modèle).
    { provide: MoonModelService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new MoonModelService(config) },
    // Modèles 3D des astres : fabrique qui lui passe la configuration.
    { provide: BodyModelService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new BodyModelService(config) },
  // Fin de la liste des services.
  ],
  // Le service des couches sert aussi aux exports payants (module de la boutique).
  exports: [TilesService],
// Fin de la déclaration.
})
// Classe du module des tuiles ; elle implémente OnApplicationBootstrap pour lancer des tâches au démarrage.
export class TilesModule implements OnApplicationBootstrap {
  // Constructeur : NestJS y injecte trois services, gardés en propriétés privées non modifiables.
  constructor(
    // Le cache des tuiles de la Lune, pour lancer son préchargement.
    private readonly moonTiles: MoonTileCacheService,
    // Les cartes des satellites, pour chercher leurs sources d'avance.
    private readonly satellites: SatelliteTilesService,
    // Le test de disponibilité des astres, pour le faire tourner d'avance.
    private readonly availability: BodyAvailabilityService,
  // Corps du constructeur vide : les trois propriétés sont créées par les paramètres eux-mêmes.
  ) {}

  /** Précharge la Lune en arrière-plan dès que le serveur est prêt (pas pendant les tests). */
  // Méthode appelée par NestJS une fois tous les modules initialisés ; elle ne renvoie rien.
  onApplicationBootstrap(): void {
    // Seulement hors des tests : ni NODE_ENV=test, ni identifiant de processus Jest.
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      // Lance le préchargement des tuiles de la Lune en arrière-plan, sans l'attendre.
      this.moonTiles.startBackgroundPrefetch();
      // Cartes des satellites sphériques (Jupiter à Pluton) : sources cherchées tout de suite, résultat dans le journal.
      // Lance la recherche des sources des cartes de satellites ; void indique que la promesse n'est volontairement pas attendue.
      void this.satellites.warmUp();
      // Test Horizons + Trek de chaque planète et satellite candidat : résultat dans le journal.
      // Lance le test de disponibilité de chaque astre, sans l'attendre non plus.
      void this.availability.warmUp();
    // Fin de la condition « hors tests ».
    }
  // Fin de onApplicationBootstrap.
  }
// Fin de la classe du module des tuiles.
}
