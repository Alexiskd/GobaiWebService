// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des nuages de points : liste des fichiers et lecture par plages d'octets (HTTP Range).
import { PointCloudsController } from '../controllers/pointclouds.controller';
// Service des nuages de points : lit les fichiers COPC/LAS du dossier configuré.
import { PointCloudsService } from '../services/pointclouds/pointclouds.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur des nuages de points.
  controllers: [PointCloudsController],
  // Service du module, construit directement par NestJS.
  providers: [PointCloudsService],
// Fin de la déclaration.
})
// Classe du module des nuages de points, importée par le module racine.
export class PointCloudsModule {}
