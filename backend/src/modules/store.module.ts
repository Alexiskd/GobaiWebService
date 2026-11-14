// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleurs de la boutique et des exports.
import { StoreController } from '../controllers/store.controller';
import { ExportController } from '../controllers/export.controller';
// Services : boutique, achats enregistrés, exports, assemblage des tuiles.
import { StoreService } from '../services/store/store.service';
import { LicencesService } from '../services/store/licences.service';
import { ExportService } from '../services/export/export.service';
import { MosaicService } from '../services/export/mosaic.service';
// Client Stripe, partagé avec les dons.
import { StripeCheckoutService } from '../services/donations/stripe-checkout.service';
// Module des tuiles, qui expose le service des couches.
import { TilesModule } from './tiles.module';
// Module des contributions, qui expose le service des comptes : un achat se fait depuis un compte connecté.
import { ContributionsModule } from './contributions.module';
// Configuration de l'application.
import { APP_CONFIG } from './config.module';
// Type de la configuration.
import type { AppConfig } from '../common/configuration';

// Ouvre la déclaration du module.
@Module({
  // Le module des tuiles fournit le service des couches, dont l'assemblage a besoin ; celui des contributions
  // fournit le service des comptes, qui reconnaît l'acheteur connecté.
  imports: [TilesModule, ContributionsModule],
  // Routes du module : la boutique et les exports.
  controllers: [StoreController, ExportController],
  // Services du module.
  providers: [
    // L'assemblage des tuiles et l'export.
    MosaicService,
    ExportService,
    // Le client Stripe, construit avec la configuration des paiements.
    { provide: StripeCheckoutService, useFactory: (config: AppConfig) => new StripeCheckoutService(config.donations.stripe), inject: [APP_CONFIG] },
    // Le registre des achats, puis la boutique.
    LicencesService,
    StoreService,
  // Fin des services.
  ],
// Fin de la déclaration.
})
// Classe du module de la boutique, importée par le module racine.
export class StoreModule {}
