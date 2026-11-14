// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur du globe Google : la route /api/v1/google-earth/config.
import { GoogleEarthController } from '../controllers/google-earth.controller';

// Ouvre la déclaration du module.
@Module({
  // Routes du module.
  controllers: [GoogleEarthController],
// Fin de la déclaration.
})
// Classe du module du globe Google, importée par le module racine.
export class GoogleEarthModule {}
