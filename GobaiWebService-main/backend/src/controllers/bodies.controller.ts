// Outils NestJS : Controller, Get (route), Param (paramètre de l'adresse).
import { Controller, Get, Param } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes de la liste des astres, du listing d'affichage et d'une planète.
import { BodiesDto, BodyListingDto, PlanetDto } from '../dto/bodies.dto';
// Service du catalogue des astres.
import { BodiesService } from '../services/bodies/bodies.service';

// Rubrique « Astres » de la documentation.
@ApiTags('Astres')
// Routes sous /api/v1/bodies.
@Controller('bodies')
// Classe du contrôleur des astres.
export class BodiesController {
  // NestJS injecte le service des astres ; corps du constructeur vide.
  constructor(private readonly bodies: BodiesService) {}

  // Route GET /api/v1/bodies.
  @Get()
  // Titre et description de la route.
  @ApiOperation({ summary: 'Tous les astres', description: 'Soleil, Lune et les 8 planètes, avec leurs paramètres physiques et orbitaux.' })
  // Réponse 200 documentée : un BodiesDto.
  @ApiOkResponse({ type: BodiesDto })
  // Méthode all : renvoie tous les astres.
  all(): BodiesDto {
    // Délègue au service.
    return this.bodies.all();
  // Fin de all.
  }

  // Route GET /api/v1/bodies/listing, déclarée avant « planets/:name ».
  @Get('listing')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Listing d’affichage des astres',
    // début de son texte ;
    description: 'Les planètes, naines comprises, chacune portant ses satellites naturels, du plus proche au plus '
      // suite du texte ;
      + 'lointain. Allégé par rapport à GET /bodies (ni éléments képlériens, ni codes Horizons) et déjà rapproché : '
      // fin du texte.
      + 'l’interface affiche cette réponse telle quelle, sans embarquer de table d’astres.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un BodyListingDto.
  @ApiOkResponse({ type: BodyListingDto })
  // Méthode listing : renvoie la liste d'affichage.
  listing(): BodyListingDto {
    // Délègue au service.
    return this.bodies.listing();
  // Fin de listing.
  }

  // Route GET /api/v1/bodies/planets/:name ; « :name » est une partie variable de l'adresse.
  @Get('planets/:name')
  // Titre et description de la route.
  @ApiOperation({ summary: 'Une planète', description: 'Le nom est insensible à la casse et aux accents (`venus`, `TERRE`).' })
  // Documente le paramètre name, avec un exemple.
  @ApiParam({ name: 'name', example: 'venus' })
  // Réponse 200 documentée : un PlanetDto.
  @ApiOkResponse({ type: PlanetDto })
  // Réponse 404 documentée : planète inconnue.
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Planète inconnue.' })
  // Méthode planet : reçoit la valeur de « :name » dans la variable name.
  planet(@Param('name') name: string): PlanetDto {
    // Délègue au service, qui lève l'erreur 404 si le nom est inconnu.
    return this.bodies.planet(name);
  // Fin de planet.
  }
// Fin du contrôleur.
}
