// Outils NestJS : corps et en-tête de la requête, contrôleur, routes, en-tête de réponse, code de réponse.
import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Post } from '@nestjs/common';
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
import { ItineraryDto, MoonSitesDto, TicketsRequestDto, TripDto, TripRequestDto } from '../dto/position.dto';
// Service de position et de temps de trajet.
import { PositionService } from '../services/locations/position/position.service';
import { normalizePoint } from '../services/locations/position/position';
import { TicketsResult, TransportService } from '../services/locations/transport/transport.service';

/** En-tête de la clé d'API de l'utilisateur, le même que celui de l'assistant : jamais dans l'adresse ni dans le corps. */
const KEY_HEADER = 'x-assistant-key';

/**
 * Position GPS et temps de trajet entre deux positions de la Terre ou de la Lune. Aucun tracé d'itinéraire.
 *   1. `GET  position/lune`    → les sites d'alunissage Apollo, proposés comme positions sur la Lune ;
 *   2. `POST position/trajet`  → la durée du trajet A → B : 3 jours fixés entre la Terre et un site Apollo, sinon
 *      estimée par le modèle de l'utilisateur (Claude ou Mistral) avec SA clé ;
 *   3. `POST position/itineraire` → l'itinéraire A → B entre deux lieux de la Terre, en étapes (une par moyen de
 *      locomotion), au format JSON, par le modèle de l'utilisateur avec SA clé. Le frontend le modélise : 3D pour les
 *      véhicules volants, 2D pour ceux qui roulent, marchent ou naviguent.
 */
@ApiTags('Position')
@Controller('position')
export class PositionController {
  constructor(private readonly position: PositionService, private readonly transport: TransportService) {}

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

  @Post('itineraire')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiHeader({ name: KEY_HEADER, required: true, description: 'Clé d’API de l’utilisateur chez le fournisseur choisi ; gardée dans son navigateur, jamais sur le serveur.' })
  @ApiOperation({ summary: 'Itinéraire entre deux lieux de la Terre', description: 'Étapes validées (moyen de locomotion, points, durée, longueur), produites par le modèle de l’utilisateur avec sa clé. Deux lieux de la Terre seulement.' })
  @ApiOkResponse({ type: ItineraryDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Clé absente, invalide, révoquée ou expirée (`code` : invalid_key).' })
  @ApiResponse({ status: 402, type: ApiErrorDto, description: 'Pas de moyen de paiement ou plus de crédit (`code` : billing, `billingUrl`).' })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  itinerary(@Body() body: TripRequestDto, @Headers(KEY_HEADER) key: string): ReturnType<PositionService['itinerary']> {
    return this.position.itinerary(body.provider, key, body.a, body.b);
  }

  @Post('billets')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Vols et trains entre deux lieux de la Terre',
    description: 'Vols : prix récents d’Aviasales (Travelpayouts) entre les aéroports les plus proches, avec lien de réservation. '
      + 'Trains : horaires de l’API SNCF, avec lien vers SNCF Connect. Aucune clé à fournir : celles du serveur sont utilisées.',
  })
  @ApiOkResponse({ description: '{ date, flights: { status, offers | message, source }, trains: { status, offers | message, source } }' })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  tickets(@Body() body: TicketsRequestDto): Promise<TicketsResult> {
    const a = normalizePoint(body.a);
    const b = normalizePoint(body.b);
    if (!a || !b || a.body !== 'earth' || b.body !== 'earth') throw new BadRequestException('Vols et trains : deux lieux de la Terre attendus.');
    return this.transport.tickets(a, b, body.date);
  }
}
