// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Service de mélange des couches de Mars.
import { MarsBlendService } from '../services/mars/mars-blend.service';
// Service de fusion des couches de Mars.
import { MarsFusionService } from '../services/mars/mars-fusion.service';
// Service des capacités des sources de Mars (ce que chaque source de tuiles sait servir).
import { MarsCapabilitiesService } from '../services/mars/capabilities.service';
// Service de santé des sources amont de Mars (joignables ou non).
import { MarsHealthService } from '../services/mars/mars-upstream-health.service';
// Jeton d'injection de la configuration de Mars et fonction qui la lit.
import { MARS_CONFIG, loadMarsConfig } from '../services/mars/mars.config';
// Service du catalogue des couches de Mars.
import { MarsCatalogService } from '../services/mars/mars-catalog.service';
// Contrôleur de Mars : les routes /api/v1/mars.
import { MarsController } from '../controllers/mars.controller';
// Service des tuiles d'imagerie de Mars.
import { MarsTileService } from '../services/mars/mars-imagery-tile.service';
// Service des appels aux sources amont de Mars.
import { MarsUpstreamService } from '../services/mars/upstream.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur de Mars.
  controllers: [MarsController],
  // Services que le module fabrique :
  providers: [
    // d'abord la configuration de Mars, décrite par l'objet qui suit ;
    {
      // elle est enregistrée sous le jeton MARS_CONFIG ;
      provide: MARS_CONFIG,
      // et lue une seule fois par cette fabrique.
      useFactory: () => loadMarsConfig(),
    // Fin de la description de la configuration.
    },
    // Catalogue des couches.
    MarsCatalogService,
    // Appels aux sources amont.
    MarsUpstreamService,
    // Capacités des sources.
    MarsCapabilitiesService,
    // Tuiles d'imagerie.
    MarsTileService,
    // Fusion des couches.
    MarsFusionService,
    // Mélange des couches.
    MarsBlendService,
    // Santé des sources amont.
    MarsHealthService,
  // Fin de la liste des services.
  ],
  // Services exportés, utilisables par les modules qui importent celui-ci (le module des tuiles) :
  exports: [
    // le catalogue ;
    MarsCatalogService,
    // les tuiles ;
    MarsTileService,
    // les capacités ;
    MarsCapabilitiesService,
    // le mélange ;
    MarsBlendService,
    // la fusion.
    MarsFusionService,
  // Fin de la liste des exports.
  ],
// Fin de la déclaration.
})
// Classe du module de Mars, importée par le module racine et par le module des tuiles.
export class MarsModule {}
