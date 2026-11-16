// Outils NestJS : Controller, Get (route), Query (paramètres après le « ? » de l'adresse).
import { Controller, Get, Query } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes de la page de résultats et des paramètres de recherche.
import { CitiesPageDto, FindCitiesQueryDto } from '../dto/cities.dto';
// Service des villes.
import { CitiesService } from '../services/cities/cities.service';

// Rubrique « Villes » de la documentation.
@ApiTags('Villes')
// Routes sous /api/v1/cities.
@Controller('cities')
// Classe du contrôleur des villes.
export class CitiesController {
  // NestJS injecte le service des villes ; corps du constructeur vide.
  constructor(private readonly cities: CitiesService) {}

  // Route GET /api/v1/cities.
  @Get()
  // Titre et description de la route.
  @ApiOperation({ summary: 'Lister ou rechercher des villes', description: 'Sans paramètre, renvoie toutes les villes.' })
  // Réponse 200 documentée : un CitiesPageDto.
  @ApiOkResponse({ type: CitiesPageDto })
  // Réponse 400 documentée : paramètres invalides.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Méthode find : reçoit tous les paramètres de requête, validés et convertis d'après FindCitiesQueryDto.
  find(@Query() query: FindCitiesQueryDto): CitiesPageDto {
    // Délègue la recherche au service.
    return this.cities.find(query);
  // Fin de find.
  }
// Fin du contrôleur.
}
