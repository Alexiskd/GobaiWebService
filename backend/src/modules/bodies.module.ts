// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des astres : les routes /api/v1/bodies.
import { BodiesController } from '../controllers/bodies.controller';
// Service des astres : le catalogue (tailles, rotation, éléments orbitaux).
import { BodiesService } from '../services/bodies/bodies.service';

// Déclare le module : un contrôleur, un service, et ce service exporté pour les modules qui importent celui-ci.
@Module({ controllers: [BodiesController], providers: [BodiesService], exports: [BodiesService] })
// Classe du module des astres, importée par le module racine.
export class BodiesModule {}
