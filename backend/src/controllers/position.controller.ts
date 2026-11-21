// Outils NestJS : corps et en-tête de la requête, contrôleur, routes, en-tête de réponse, code de réponse.
import { Body, Controller, Get, Header, Headers, HttpCode, Post } from '@nestjs/common';
// Limite de débit propre à une route.
import { Throttle } from '@nestjs/throttler';
// Documentation Swagger.
import {
  ApiBadGatewayResponse, ApiBadRequestResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags,
  ApiTooManyRequestsResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
// Forme commune des erreurs.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes échangées.
import { MoonSitesDto, TripDto, TripRequestDto } from '../dto/position.dto';
// Service de position et de temps de trajet.
import { PositionService } from '../services/locations/position/position.service';

/** En-tête de la clé d'API de l'utilisateur, le même que celui de l'assistant : jamais dans l'adresse ni dans le corps. */
const KEY_HEADER = 'x-assistant-key';

/**
 * Position GPS et temps de trajet entre deux positions de la Terre ou de la Lune. Aucun tracé d'itinéraire.
 *   1. `GET  position/lune`    → les sites d'alunissage Apollo, proposés comme positions sur la Lune ;
 *   2. `POST position/trajet`  → la durée du trajet A → B : 3 jours fixés entre la Terre et un site Apollo, sinon
 *      estimée par le modèle de l'utilisateur (Claude ou Mistral) avec SA clé.
 */
@ApiTags('Position')
@Controller('position')
export class PositionController {
  constructor(private readonly position: PositionService) {}

  @Get('lune')
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: 'Sites d’alunissage Apollo', description: 'Les six sites des missions habitées Apollo, proposés comme positions sur la Lune.' })
  @ApiOkResponse({ type: MoonSitesDto })
  moon(): MoonSitesDto {
    return { items: this.position.moonSites() };
  }

  @Post('trajet')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiHeader({ name: KEY_HEADER, required: false, description: 'Clé d’API de l’utilisateur chez le fournisseur choisi. Inutile pour le trajet fixé Terre ↔ site Apollo ; gardée dans son navigateur, jamais sur le serveur.' })
  @ApiOperation({ summary: 'Temps de trajet entre deux positions', description: 'Durée seulement, sans tracé. Terre ↔ site Apollo : 3 jours fixés. Autres trajets : estimés par le modèle de l’utilisateur avec sa clé.' })
  @ApiOkResponse({ type: TripDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Clé absente, invalide, révoquée ou expirée (`code` : invalid_key).' })
  @ApiResponse({ status: 402, type: ApiErrorDto, description: 'Pas de moyen de paiement ou plus de crédit (`code` : billing, `billingUrl`).' })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  trip(@Body() body: TripRequestDto, @Headers(KEY_HEADER) key: string): ReturnType<PositionService['trip']> {
    return this.position.trip(body.provider, key, body.a, body.b);
  }
}
