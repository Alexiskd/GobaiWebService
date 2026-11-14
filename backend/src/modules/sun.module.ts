// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur du Soleil : les routes /api/v1/sun.
import { SunController } from '../controllers/sun.controller';
// Service du Soleil : le point sous-solaire.
import { SunService } from '../services/sun/sun.service';
// Service de l'activité solaire en direct (NOAA : indice Kp, taches, vent solaire, éruptions).
import { SolarActivityService } from '../services/sun/solar-activity.service';
// Service des régions actives et des éruptions localisées (NOAA SWPC et NASA DONKI).
import { SolarRegionsService } from '../services/sun/solar-regions.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur du Soleil.
  controllers: [SunController],
  // Les trois services du module, construits directement par NestJS.
  providers: [SunService, SolarActivityService, SolarRegionsService],
  // Exporte SunService pour les modules qui importent celui-ci.
  exports: [SunService],
// Fin de la déclaration.
})
// Classe du module du Soleil, importée par le module racine.
export class SunModule {}
