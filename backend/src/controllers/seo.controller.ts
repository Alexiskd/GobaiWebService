// Outils NestJS : Controller, Get, Header.
import { Controller, Get, Header } from '@nestjs/common';
// Documentation OpenAPI.
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme d'une ligne de la réponse.
import { SeoTagDto } from '../dto/seo.dto';
// Service du balisage SEO (table seo_tags), déjà chargé en mémoire au démarrage.
import { SeoTagsService } from '../services/seo/seo-tags.service';

/** Routes de consultation du balisage SEO en base (table seo_tags) : titre, description, Open Graph, X/Twitter. */
// Rubrique « Référencement » de la documentation.
@ApiTags('Référencement')
// Routes sous /api/v1/seo.
@Controller('seo')
// Classe du contrôleur du balisage SEO.
export class SeoController {
  // Injection du service.
  constructor(private readonly seo: SeoTagsService) {}

  /** Toutes les balises de toutes les pages, triées par page puis par nom de balise. */
  // Route GET /api/v1/seo.
  @Get()
  // Jamais mise en cache : utile pour vérifier tout de suite une modification faite en base.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Balisage SEO de toutes les pages, trié par page (table seo_tags)' })
  @ApiOkResponse({ type: [SeoTagDto] })
  // Méthode list : renvoie toutes les lignes.
  list(): SeoTagDto[] {
    return this.seo.allTags();
  // Fin de list.
  }
// Fin du contrôleur.
}
