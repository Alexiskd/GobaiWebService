// Importe le décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Importe APP_CONFIG, le jeton de la configuration.
import { APP_CONFIG } from './config.module';
// Importe le type AppConfig.
import type { AppConfig } from '../common/configuration';
// Importe le contrôleur des dons.
import { DonationsController } from '../controllers/donations.controller';
// Importe le service des dons.
import { DonationsService } from '../services/donations/donations.service';
// Importe le service de paiement Stripe.
import { StripeCheckoutService } from '../services/donations/stripe-checkout.service';

// Déclare le module (début).
@Module({
  // Son contrôleur.
  controllers: [DonationsController],
  // Ses services (début).
  providers: [
    // Le service Stripe, créé avec la configuration Stripe.
    { provide: StripeCheckoutService, inject: [APP_CONFIG], useFactory: (c: AppConfig) => new StripeCheckoutService(c.donations.stripe) },
    // Le service des dons (début) :
    {
      // son jeton,
      provide: DonationsService,
      // ce qu'il reçoit : la configuration et le service Stripe,
      inject: [APP_CONFIG, StripeCheckoutService],
      // sa création.
      useFactory: (c: AppConfig, stripe: StripeCheckoutService) => new DonationsService(c.donations, stripe),
    // Fin du service des dons.
    },
  // Fin des services.
  ],
// Fin de la déclaration.
})
// Déclare et exporte la classe DonationsModule.
export class DonationsModule {}
