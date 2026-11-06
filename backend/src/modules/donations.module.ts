import { Module } from '@nestjs/common';
import { APP_CONFIG } from './config.module';
import type { AppConfig } from '../common/configuration';
import { DonationsController } from '../controllers/donations.controller';
import { DonationLedgerService } from '../services/donations/donation-ledger.service';
import { DonationsService } from '../services/donations/donations.service';
import { PaypalOrdersService } from '../services/donations/paypal-orders.service';

@Module({
  controllers: [DonationsController],
  providers: [
    { provide: PaypalOrdersService, inject: [APP_CONFIG], useFactory: (c: AppConfig) => new PaypalOrdersService(c.donations.paypal) },
    { provide: DonationLedgerService, inject: [APP_CONFIG], useFactory: (c: AppConfig) => new DonationLedgerService(c.donations.ledgerFile) },
    {
      provide: DonationsService,
      inject: [APP_CONFIG, PaypalOrdersService, DonationLedgerService],
      useFactory: (c: AppConfig, paypal: PaypalOrdersService, ledger: DonationLedgerService) => new DonationsService(c.donations, paypal, ledger),
    },
  ],
})
export class DonationsModule {}
