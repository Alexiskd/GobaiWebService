// Contrôleur du domaine dons : configuration, commande Stripe, capture, abandon.
import { Controller, Get, HttpException, HttpStatus, Param, Post } from '@nestjs/common';
import { DonationsService } from './donations.service';

// Les écritures (paiement Stripe) restent désactivées : même contrat que le client.
const indisponible = () => {
  throw new HttpException('Fonction indisponible en mode statique', HttpStatus.SERVICE_UNAVAILABLE);
};

@Controller()
export class DonationsController {
  constructor(private readonly donations: DonationsService) {}

  @Get('/donations/config')
  config() {
    return this.donations.config();
  }

  @Post('/donations/orders')
  create() {
    indisponible();
  }

  @Post('/donations/orders/:id/capture')
  capture(@Param('id') id: string) {
    indisponible();
  }

  @Post('/donations/orders/:id/cancel')
  cancel(@Param('id') id: string) {
    indisponible();
  }
}
