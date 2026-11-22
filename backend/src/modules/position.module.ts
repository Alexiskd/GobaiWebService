// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Module de l'assistant : il exporte le service qui interroge le modèle de l'utilisateur.
import { AssistantModule } from './assistant.module';
// Contrôleur de position : les routes /api/v1/position.
import { PositionController } from '../controllers/position.controller';
// Assistant : fournit l'appel au modèle avec la clé de l'utilisateur.
import { AssistantService } from '../services/content/assistant/assistant.service';
// Service de position GPS et de temps de trajet.
import { PositionService } from '../services/locations/position/position.service';
import { TransportService } from '../services/locations/transport/transport.service';

// Ouvre la déclaration du module.
@Module({
  // Importe le module de l'assistant pour en recevoir le service.
  imports: [AssistantModule],
  // Routes du module : celles du contrôleur de position.
  controllers: [PositionController],
  // Services que le module fabrique : PositionService, construit avec le service de l'assistant.
  providers: [
    { provide: PositionService, inject: [AssistantService], useFactory: (a: AssistantService) => new PositionService(a) },
    // Vols et trains : clés lues dans l'environnement.
    { provide: TransportService, useFactory: () => new TransportService() },
  ],
// Fin de la déclaration.
})
// Classe du module de position, importée par le module racine.
export class PositionModule {}
