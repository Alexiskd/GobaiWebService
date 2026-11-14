// Outils NestJS : décorateur de contrôleur, route GET et en-tête de réponse.
import { Controller, Get, Header } from '@nestjs/common';
// Service des volcans en éruption (NASA EONET).
import { VolcanoesService } from '../services/volcanoes/volcanoes.service';
// Décorateurs de documentation OpenAPI : étiquette du groupe et description des routes.
import { ApiOperation, ApiTags } from '@nestjs/swagger';

// Routes sous /api/v1/volcanoes.
// Groupe de la documentation : Volcans.
@ApiTags('Volcans')
@Controller('volcanoes')
// Classe du contrôleur des volcans.
export class VolcanoesController {
  // Constructeur : NestJS y injecte le service des volcans.
  constructor(private readonly volcanoesService: VolcanoesService) {}

  /** Volcans en éruption dans le monde, en direct : { source, generatedAt, volcanoes: [{ id, name, lon, lat, date, link }] }. */
  // Route GET /api/v1/volcanoes.
  @Get()
  // Ce que fait la route, pour la documentation de l'API.
  @ApiOperation({ summary: 'Volcans en éruption dans le monde, en direct', description: 'Source : NASA EONET. Renvoie `{ source, generatedAt, volcanoes: [{ id, name, lon, lat, date, link }] }`.' })
  // Cache public de 10 minutes.
  @Header('Cache-Control', 'public, max-age=600')
  // Méthode active.
  active() {
    // Délègue au service.
    return this.volcanoesService.active();
  // Fin de active.
  }
// Fin du contrôleur.
}
