// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des volcans : la route /api/v1/volcanoes.
import { VolcanoesController } from '../controllers/volcanoes.controller';
// Service des volcans en éruption (NASA EONET).
import { VolcanoesService } from '../services/volcanoes/volcanoes.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur des volcans.
  controllers: [VolcanoesController],
  // Le service du module, construit directement par NestJS.
  providers: [VolcanoesService],
// Fin de la déclaration.
})
// Classe du module des volcans, importée par le module racine.
export class VolcanoesModule {}
