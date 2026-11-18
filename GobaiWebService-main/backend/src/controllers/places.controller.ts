// Outils NestJS : Controller, Get, Header, Query.
import { Controller, Get, Header, Query } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes des noms de villes, des paramètres de recherche et des résultats.
import { CityLabelsDto, FindPlacesQueryDto, PlacesDto } from '../dto/places.dto';
// Service des noms de villes (Natural Earth).
import { CityLabelsService } from '../services/places/city-labels.service';
// Service de recherche de lieux (Photon).
import { PlacesService } from '../services/places/places.service';

// Rubrique « Lieux » de la documentation.
@ApiTags('Lieux')
// Routes sous /api/v1/places.
@Controller('places')
// Classe du contrôleur des lieux.
export class PlacesController {
  // NestJS injecte les deux services ; corps du constructeur vide.
  constructor(private readonly places: PlacesService, private readonly labels: CityLabelsService) {}

  // Route GET /api/v1/places/labels.
  @Get('labels')
  // Cache public d'un jour.
  @Header('Cache-Control', 'public, max-age=86400')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Noms des villes du monde entier',
    // son texte.
    description: 'Natural Earth (≈ 7 300 villes, domaine public), triées par population, avec le nom dans l’écriture locale quand elle est disponible. À afficher par-dessus n’importe quel fond.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un CityLabelsDto.
  @ApiOkResponse({ type: CityLabelsDto })
  // Réponse 502 documentée : fichier des villes illisible.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode cityLabels : renvoie une promesse des noms de villes.
  cityLabels(): Promise<CityLabelsDto> {
    // Délègue au service des noms.
    return this.labels.get();
  // Fin de cityLabels.
  }

  // Route GET /api/v1/places.
  @Get()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Rechercher un lieu dans le monde entier',
    // début de son texte ;
    description: 'Villes et lieux du monde entier : Photon '
      // suite du texte ;
      + '(OpenStreetMap, sans clé) limité aux localités habitées (ville, bourg, village, hameau, quartier), '
      // fin du texte.
      + 'plus les adresses (rue, numéro) quand le texte ressemble à une adresse.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un PlacesDto.
  @ApiOkResponse({ type: PlacesDto })
  // Réponse 502 documentée : le géocodeur n'a pas répondu.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Méthode find : reçoit les paramètres de requête validés (texte cherché q, nombre de résultats limit).
  find(@Query() q: FindPlacesQueryDto): Promise<PlacesDto> {
    // Délègue la recherche au service.
    return this.places.find(q.q, q.limit);
  // Fin de find.
  }
// Fin du contrôleur.
}
