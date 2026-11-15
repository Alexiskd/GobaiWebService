// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur atmosphérique : les routes /api/v1/atmosphere.
import { AtmosphereController } from '../controllers/atmosphere.controller';
// Service du moteur atmosphérique (incendies, cyclones ; fournisseurs, caches, gestionnaire d'événements).
import { AtmosphereService } from '../services/atmosphere/atmosphere.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur atmosphérique.
  controllers: [AtmosphereController],
  // Le service du module, construit une seule fois par NestJS (ses caches sont partagés par toutes les requêtes).
  providers: [AtmosphereService],
// Fin de la déclaration.
})
// Classe du module atmosphérique, importée par le module racine.
export class AtmosphereModule {}
