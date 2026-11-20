// Module du moteur chiffré.
import { Module } from '@nestjs/common';
// Contrôleur.
import { EngineController } from '../controllers/engine.controller';
// Service.
import { EngineService } from '../services/engine/engine.service';
// Module des sites externes autorisés en CORS : la clé du moteur s'ouvre aussi à eux.
import { OriginsModule } from './origins.module';

// Déclaration du module.
@Module({ imports: [OriginsModule], controllers: [EngineController], providers: [EngineService] })
export class EngineModule {}
