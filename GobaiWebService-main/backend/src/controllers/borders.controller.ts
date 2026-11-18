// Outils NestJS : Controller, Get (route), Header (en-tête de réponse).
import { Controller, Get, Header } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Forme de la réponse des frontières.
import { BordersDto } from '../dto/borders.dto';
// Service des frontières.
import { BordersService } from '../services/borders/borders.service';

// Rubrique « Frontières » de la documentation.
@ApiTags('Frontières')
// Routes sous /api/v1/borders.
@Controller('borders')
// Classe du contrôleur des frontières.
export class BordersController {
  // NestJS injecte le service des frontières ; corps du constructeur vide.
  constructor(private readonly borders: BordersService) {}

  // Route GET /api/v1/borders.
  @Get()
  // Cache public d'un jour (86 400 secondes) : ces données ne changent pas.
  @Header('Cache-Control', 'public, max-age=86400')
  // Ouvre la description de la route pour la documentation :
  @ApiOperation({
    // son titre ;
    summary: 'Frontières des pays et littoraux',
    // son texte.
    description: 'Frontières terrestres entre pays et littoraux (Natural Earth 1:50m), en polylignes longitude/latitude.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un BordersDto.
  @ApiOkResponse({ type: BordersDto })
  // Réponse 502 documentée : source des données injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Source des données injoignable.' })
  // Méthode all : renvoie une promesse des frontières.
  all(): Promise<BordersDto> {
    // Délègue au service, qui décode le fichier une fois puis le garde en mémoire.
    return this.borders.get();
  // Fin de all.
  }
// Fin du contrôleur.
}
