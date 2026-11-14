// Outils NestJS : Controller, Get, Header.
import { Controller, Get, Header } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiBadGatewayResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme commune des réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Forme de la fiche de World Atlas.
import { WorldAtlasInfoDto } from '../dto/world-atlas.dto';
// Type (effacé à la compilation) d'un document TopoJSON.
import type { Topology } from '../services/world-atlas/topology';
// Service World Atlas.
import { WorldAtlasService } from '../services/world-atlas/world-atlas.service';

// Rubrique « World Atlas » de la documentation.
@ApiTags('World Atlas')
// Routes sous /api/v1/world-atlas.
@Controller('world-atlas')
// Classe du contrôleur World Atlas.
export class WorldAtlasController {
  // NestJS injecte le service ; corps du constructeur vide.
  constructor(private readonly atlas: WorldAtlasService) {}

  // Route GET /api/v1/world-atlas.
  @Get()
  // Cache public d'un jour.
  @Header('Cache-Control', 'public, max-age=86400')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Fiche de World Atlas',
    // son texte.
    description: 'Jeu de données des pays servi par l’API : source, nombre de pays et d’arcs, emprise.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un WorldAtlasInfoDto.
  @ApiOkResponse({ type: WorldAtlasInfoDto })
  // Réponse 502 documentée : source injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Source des données injoignable.' })
  // Méthode info : renvoie une promesse de la fiche.
  info(): Promise<WorldAtlasInfoDto> {
    // Délègue au service.
    return this.atlas.info();
  // Fin de info.
  }

  // Route GET /api/v1/world-atlas/countries.
  @Get('countries')
  // Cache public d'un jour.
  @Header('Cache-Control', 'public, max-age=86400')
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'Pays du monde en TopoJSON',
    // son texte, sur les deux lignes suivantes :
    description:
      // première moitié ;
      'Topologie des pays (objet `countries`, Natural Earth 1:50m, recette de world-atlas 2.0.2) : identifiant ISO 3166-1 ' +
      // seconde moitié.
      'numérique, nom, arcs partagés entre pays voisins. Les frontières déjà décodées sont dans `/borders`.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un objet TopoJSON.
  @ApiOkResponse({ schema: { type: 'object', description: 'Document TopoJSON (`type: "Topology"`).' } })
  // Réponse 502 documentée : source injoignable.
  @ApiBadGatewayResponse({ type: ApiErrorDto, description: 'Source des données injoignable.' })
  // Méthode countries : renvoie une promesse de la topologie des pays.
  countries(): Promise<Topology> {
    // Délègue au service, qui garde le fichier en mémoire.
    return this.atlas.countries();
  // Fin de countries.
  }
// Fin du contrôleur.
}
