// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Contrôleur des frontières : la route /api/v1/borders.
import { BordersController } from '../controllers/borders.controller';
// Service des frontières : décode le TopoJSON en polylignes et calcule le milieu de chaque pays.
import { BordersService } from '../services/borders/borders.service';
// Service World Atlas : fournit le TopoJSON des pays au service des frontières.
import { WorldAtlasService } from '../services/world-atlas/world-atlas.service';
// Module World Atlas, qui exporte ce service.
import { WorldAtlasModule } from './world-atlas.module';

// Ouvre la déclaration du module.
@Module({
  // Importe WorldAtlasModule pour pouvoir injecter son service ici.
  imports: [WorldAtlasModule],
  // Routes du module : celles du contrôleur des frontières.
  controllers: [BordersController],
  // Services que le module fabrique : un seul, décrit par l'objet qui suit.
  providers: [{
    // Le service fourni est BordersService.
    provide: BordersService,
    // NestJS injecte dans la fabrique la configuration et le service World Atlas, dans cet ordre.
    inject: [APP_CONFIG, WorldAtlasService],
    // Fabrique : construit BordersService avec ces deux dépendances.
    useFactory: (config: AppConfig, atlas: WorldAtlasService) => new BordersService(config, atlas),
  // Fin de la description du service et de la liste.
  }],
// Fin de la déclaration.
})
// Classe du module des frontières, importée par le module racine.
export class BordersModule {}
