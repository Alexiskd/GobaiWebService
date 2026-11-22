// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des contributions : les routes /api/v1/contributions.
import { ContributionsController } from '../controllers/contributions.controller';
// Service des contributions : comptes, placements et votes.
import { ContributionsService } from '../services/content/contributions/contributions.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module.
  controllers: [ContributionsController],
  // Le service du module.
  providers: [ContributionsService],
  // Exporté : le service des comptes, partagé avec les autres modules.
  exports: [ContributionsService],
// Fin de la déclaration.
})
// Classe du module des contributions, importée par le module racine.
export class ContributionsModule {}
