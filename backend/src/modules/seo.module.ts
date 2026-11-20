// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur du balisage SEO : la route /api/v1/seo.
import { SeoController } from '../controllers/seo.controller';
// Service du balisage SEO : la table seo_tags, stockée dans PostgreSQL.
import { SeoTagsService } from '../services/seo/seo-tags.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur du balisage SEO.
  controllers: [SeoController],
  // Service du module, construit directement par NestJS.
  providers: [SeoTagsService],
  // Exporté : main.ts le lit (app.get) pour fabriquer les pages des astres avec le bon balisage.
  exports: [SeoTagsService],
// Fin de la déclaration.
})
// Classe du module du balisage SEO, importée par le module racine.
export class SeoModule {}
