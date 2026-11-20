// Contrats JSON des routes de dons (Stripe).
import { Injectable } from '@nestjs/common';

@Injectable()
export class DonationsService {
  // La configuration des dons : désactivés en mode statique.
  config() {
    return { enabled: false, currency: 'EUR', minAmount: 1 };
  }
}
