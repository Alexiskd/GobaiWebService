// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des dalles LiDAR : les routes /api/v1/lidar.
import { LidarTilesController } from '../controllers/lidar-tiles.controller';
// Service des dalles LiDAR : manifestes et fichiers de nœuds, servis depuis PostgreSQL ou depuis le disque.
import { LidarTilesService } from '../services/lidar-tiles/lidar-tiles.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur des dalles LiDAR.
  controllers: [LidarTilesController],
  // Service du module, construit directement par NestJS.
  providers: [LidarTilesService],
// Fin de la déclaration.
})
// Classe du module des dalles LiDAR, importée par le module racine.
export class LidarTilesModule {}
