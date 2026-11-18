// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur de la Lune : les routes moon/… (passerelle de tuiles) et moon-db/… (stockage PostgreSQL).
import { MoonController } from '../controllers/moon.controller';
// Ouvre la liste de ce qui est importé du fichier unique des services de la Lune :
import {
  // la fonction qui lit la configuration de la Lune ;
  loadMoonConfig,
  // le jeton d'injection de cette configuration ;
  MOON_CONFIG,
  // le service des capacités des sources (ce que chaque source de tuiles sait servir) ;
  MoonCapabilitiesService,
  // le service du catalogue des couches ;
  MoonCatalogService,
  // le service de stockage dans PostgreSQL (tuiles gardées, préchargement) ;
  MoonDbService,
  // le service de santé des sources amont ;
  MoonHealthService,
  // le service des tuiles ;
  MoonTileService,
  // le service des appels aux sources amont.
  MoonUpstreamService,
// Fin de l'import : tous ces éléments viennent de moon.service.ts.
} from '../services/moon/moon.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur de la Lune.
  controllers: [MoonController],
  // Services que le module fabrique :
  providers: [
    // d'abord la configuration de la Lune, décrite par l'objet qui suit ;
    {
      // elle est enregistrée sous le jeton MOON_CONFIG ;
      provide: MOON_CONFIG,
      // et lue une seule fois par cette fabrique.
      useFactory: () => loadMoonConfig(),
    // Fin de la description de la configuration.
    },
    // Catalogue des couches.
    MoonCatalogService,
    // Appels aux sources amont.
    MoonUpstreamService,
    // Capacités des sources.
    MoonCapabilitiesService,
    // Tuiles.
    MoonTileService,
    // Santé des sources amont.
    MoonHealthService,
    // Stockage dans PostgreSQL.
    MoonDbService,
  // Fin de la liste des services.
  ],
  // Services exportés, utilisables par les modules qui importent celui-ci (le module des tuiles) :
  exports: [
    // le catalogue ;
    MoonCatalogService,
    // les tuiles ;
    MoonTileService,
    // les capacités ;
    MoonCapabilitiesService,
    // le stockage.
    MoonDbService,
  // Fin de la liste des exports.
  ],
// Fin de la déclaration.
})
// Classe du module de la Lune, importée par le module racine et par le module des tuiles.
export class MoonModule {}
