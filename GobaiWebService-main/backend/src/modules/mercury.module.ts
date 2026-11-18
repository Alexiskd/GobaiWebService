// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Service des capacités des sources de Mercure (ce que chaque source de tuiles sait servir).
import { MercuryCapabilitiesService } from '../services/mercury/capabilities.service';
// Service de santé des sources amont de Mercure (joignables ou non).
import { MercuryHealthService } from '../services/mercury/mercury-upstream-health.service';
// Jeton d'injection de la configuration de Mercure et fonction qui la lit.
import { MERCURY_CONFIG, loadMercuryConfig } from '../services/mercury/mercury.config';
// Service du catalogue des couches de Mercure.
import { MercuryCatalogService } from '../services/mercury/mercury-catalog.service';
// Contrôleur de Mercure : les routes /api/v1/mercury.
import { MercuryController } from '../controllers/mercury.controller';
// Service des tuiles de surface de Mercure.
import { MercuryTileService } from '../services/mercury/mercury-surface-tile.service';
// Service des appels aux sources amont de Mercure.
import { MercuryUpstreamService } from '../services/mercury/upstream.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur de Mercure.
  controllers: [MercuryController],
  // Services que le module fabrique :
  providers: [
    // d'abord la configuration de Mercure, décrite par l'objet qui suit ;
    {
      // elle est enregistrée sous le jeton MERCURY_CONFIG ;
      provide: MERCURY_CONFIG,
      // et lue une seule fois par cette fabrique.
      useFactory: () => loadMercuryConfig(),
    // Fin de la description de la configuration.
    },
    // Catalogue des couches.
    MercuryCatalogService,
    // Appels aux sources amont.
    MercuryUpstreamService,
    // Capacités des sources.
    MercuryCapabilitiesService,
    // Tuiles de surface.
    MercuryTileService,
    // Santé des sources amont.
    MercuryHealthService,
  // Fin de la liste des services.
  ],
  // Exporte le catalogue, les tuiles et les capacités pour le module des tuiles.
  exports: [MercuryCatalogService, MercuryTileService, MercuryCapabilitiesService],
// Fin de la déclaration.
})
// Classe du module de Mercure, importée par le module racine et par le module des tuiles.
export class MercuryModule {}
