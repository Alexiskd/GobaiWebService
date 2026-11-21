// Module du moteur chiffré.
import { Module } from '@nestjs/common';
// Contrôleur.
import { EngineController } from '../controllers/engine.controller';
// Service.
import { EngineService } from '../services/core/engine/engine.service';

// Déclaration du module.
@Module({ controllers: [EngineController], providers: [EngineService] })
export class EngineModule {}
