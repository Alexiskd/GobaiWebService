// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Contrôleur World Atlas : les routes /api/v1/world-atlas.
import { WorldAtlasController } from '../controllers/world-atlas.controller';
// Service World Atlas : lit le TopoJSON des pays et sait le refabriquer.
import { WorldAtlasService } from '../services/world-atlas/world-atlas.service';

/** World Atlas (pays en TopoJSON) : /api/v1/world-atlas. Le service est partagé avec les frontières. */
// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur World Atlas.
  controllers: [WorldAtlasController],
  // Un seul service fourni : WorldAtlasService, construit par une fabrique qui lui passe la configuration.
  providers: [{ provide: WorldAtlasService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new WorldAtlasService(config) }],
  // Exporte le service : le module des frontières l'importe pour s'en servir.
  exports: [WorldAtlasService],
// Fin de la déclaration.
})
// Classe du module World Atlas, importée par le module racine et par le module des frontières.
export class WorldAtlasModule {}
