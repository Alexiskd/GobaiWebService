// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Contrôleur de l'assistant : la route /api/v1/assistant.
import { AssistantController } from '../controllers/assistant.controller';
// Service de l'assistant : appelle l'API Claude avec la clé gardée sur le serveur.
import { AssistantService } from '../services/assistant/assistant.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur de l'assistant.
  controllers: [AssistantController],
  // Services que le module fabrique :
  providers: [
    // AssistantService, construit par une fabrique qui ne lui passe que la partie « assistant » de la configuration (clé, modèle, limite par jour).
    { provide: AssistantService, inject: [APP_CONFIG], useFactory: (c: AppConfig) => new AssistantService(c.assistant) },
  // Fin de la liste des services.
  ],
// Fin de la déclaration.
})
// Classe du module de l'assistant, importée par le module racine.
export class AssistantModule {}
