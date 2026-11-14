// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur de la galerie : les routes /api/v1/galerie.
import { GalleryController } from '../controllers/gallery.controller';
// Service de la galerie : la collection de photos et de vidéos, stockée dans PostgreSQL.
import { GalleryService } from '../services/gallery/gallery.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur de la galerie.
  controllers: [GalleryController],
  // Service du module, construit directement par NestJS.
  providers: [GalleryService],
// Fin de la déclaration.
})
// Classe du module de la galerie, importée par le module racine.
export class GalleryModule {}
