import { Body, Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBadRequestResponse, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorDto } from '../dto/api-error.dto';
import {
  CreateDonationDto, DonationCaptureDto, DonationOrderDto, DonationOrderParamsDto, DonationStatusDto,
} from '../dto/donations.dto';
import { DonationsService } from '../services/donations/donations.service';

/**
 * Dons PayPal plafonnés par mois civil :
 *   1. `GET  donations/config`               → état de la collecte du mois et identifiant client PayPal public ;
 *   2. `POST donations/orders`               → crée la commande PayPal (montant fixé par le serveur) ;
 *   3. `POST donations/orders/{id}/capture`  → encaisse après approbation du donateur.
 */
@ApiTags('Dons')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get('config')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'État des dons du mois', description: 'Plafond mensuel, montant collecté, reste et date de remise à zéro.' })
  @ApiOkResponse({ type: DonationStatusDto })
  status(): Promise<DonationStatusDto> {
    return this.donations.status();
  }

  @Post('orders')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Créer un don', description: 'Refusé (409) si le montant dépasse ce qu’il reste à collecter ce mois-ci.' })
  @ApiOkResponse({ type: DonationOrderDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Plafond mensuel atteint ou dépassé.' })
  createOrder(@Body() body: CreateDonationDto): Promise<DonationOrderDto> {
    return this.donations.createOrder(body.amount);
  }

  @Post('orders/:id/capture')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Encaisser un don approuvé' })
  @ApiOkResponse({ type: DonationCaptureDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Plafond atteint entre-temps : rien n’est prélevé.' })
  capture(@Param() p: DonationOrderParamsDto): Promise<DonationCaptureDto> {
    return this.donations.capture(p.id);
  }
}
