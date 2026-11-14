// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur du blocage des API : les routes /api/v1/apis/blocked.
import { ApisController } from '../controllers/apis.controller';

// Ouvre la déclaration du module.
@Module({
  // Routes du module.
  controllers: [ApisController],
// Fin de la déclaration.
})
// Classe du module du blocage des API externes, importée par le module racine.
export class ApisModule {}
