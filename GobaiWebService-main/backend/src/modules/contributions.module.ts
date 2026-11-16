// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des contributions : les routes /api/v1/contributions.
import { ContributionsController } from '../controllers/contributions.controller';
// Service des contributions : comptes, placements et votes.
import { ContributionsService } from '../services/contributions/contributions.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module.
  controllers: [ContributionsController],
  // Le service du module.
  providers: [ContributionsService],
  // Exporté : la boutique s'en sert pour reconnaître le compte connecté, qui est le même pour tout le site.
  exports: [ContributionsService],
// Fin de la déclaration.
})
// Classe du module des contributions, importée par le module racine.
export class ContributionsModule {}
