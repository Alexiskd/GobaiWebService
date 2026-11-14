// Importe les décorateurs de NestJS : corps, contrôleur, méthodes, en-têtes, code de réponse et paramètres.
import { Body, Controller, Get, Header, Headers, HttpCode, Param, Post } from '@nestjs/common';
// Importe Throttle, la limite du nombre de requêtes.
import { Throttle } from '@nestjs/throttler';
// Importe les décorateurs de documentation Swagger.
import { ApiBadRequestResponse, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Importe ApiErrorDto, la forme d'une erreur de l'API.
import { ApiErrorDto } from '../dto/api-error.dto';
// Importe (début)
import {
  // les six formes de données des dons,
  CreateDonationDto, DonationCancelDto, DonationCaptureDto, DonationOrderDto, DonationOrderParamsDto, DonationStatusDto,
// depuis donations.dto.
} from '../dto/donations.dto';
// Importe DonationsService, le service des dons.
import { DonationsService } from '../services/donations/donations.service';

/**
 * Dons par carte bancaire (Stripe Checkout), sans objectif ni limite :
 *   1. `GET  donations/config`               → dons configurés ou non ;
 *   2. `POST donations/orders`               → crée la page de paiement Stripe (montant fixé par le serveur) ;
 *   3. `POST donations/orders/{id}/capture`  → au retour du donateur, confirme le paiement auprès de Stripe ;
 *      `POST donations/orders/{id}/cancel`   → le donateur a renoncé : ferme la page de paiement.
 */
// Rubrique « Dons » de la documentation.
@ApiTags('Dons')
// Contrôleur des routes /donations.
@Controller('donations')
// Déclare et exporte la classe DonationsController (début).
export class DonationsController {
  // Constructeur : reçoit le service des dons.
  constructor(private readonly donations: DonationsService) {}

  // Route GET /donations/config.
  @Get('config')
  // Réponse jamais mise en cache.
  @Header('Cache-Control', 'no-store')
  // Sa documentation.
  @ApiOperation({ summary: 'Configuration des dons', description: 'Dons configurés ou non, mode test ou production, devise et montant minimum.' })
  // Réponse 200 : l'état des dons.
  @ApiOkResponse({ type: DonationStatusDto })
  // status : renvoie l'état des dons (début).
  status(): DonationStatusDto {
    // Le demande au service.
    return this.donations.status();
  // Fin de status.
  }

  // Route POST /donations/orders.
  @Post('orders')
  // Code de réponse 201.
  @HttpCode(201)
  // 10 requêtes par minute au plus.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // Sa documentation.
  @ApiOperation({ summary: 'Créer un don', description: 'Crée la page de paiement Stripe et renvoie son adresse.' })
  // Réponse : l'identifiant et l'adresse de paiement.
  @ApiOkResponse({ type: DonationOrderDto })
  // Réponse 400 : erreur de l'API.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // createOrder : reçoit le montant et l'origine du navigateur (début).
  createOrder(@Body() body: CreateDonationDto, @Headers('origin') origin?: string): Promise<DonationOrderDto> {
    // Crée le don.
    return this.donations.createOrder(body.amount, origin);
  // Fin de createOrder.
  }

  // Route POST /donations/orders/:id/capture.
  @Post('orders/:id/capture')
  // Code de réponse 200.
  @HttpCode(200)
  // 10 requêtes par minute au plus.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // Sa documentation.
  @ApiOperation({ summary: 'Confirmer un don payé', description: 'Vérifie auprès de Stripe que le paiement a abouti.' })
  // Réponse 200 : l'état et le montant.
  @ApiOkResponse({ type: DonationCaptureDto })
  // Réponse 409 : paiement non abouti.
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Paiement non abouti : rien n’est prélevé.' })
  // capture : reçoit l'identifiant de la session (début).
  capture(@Param() p: DonationOrderParamsDto): Promise<DonationCaptureDto> {
    // Confirme le don.
    return this.donations.capture(p.id);
  // Fin de capture.
  }

  // Route POST /donations/orders/:id/cancel.
  @Post('orders/:id/cancel')
  // Code de réponse 200.
  @HttpCode(200)
  // 10 requêtes par minute au plus.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  // Sa documentation.
  @ApiOperation({ summary: 'Abandonner un don', description: 'Ferme la page de paiement Stripe encore ouverte.' })
  // Réponse 200 : l'état.
  @ApiOkResponse({ type: DonationCancelDto })
  // cancel : reçoit l'identifiant de la session (début).
  cancel(@Param() p: DonationOrderParamsDto): Promise<DonationCancelDto> {
    // Abandonne le don.
    return this.donations.cancel(p.id);
  // Fin de cancel.
  }
// Fin de la classe DonationsController.
}
