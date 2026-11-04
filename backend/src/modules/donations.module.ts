import { Module } from '@nestjs/common';
import { DonationsController } from '../controllers/donations.controller';

@Module({
  controllers: [DonationsController],
})
export class DonationsModule {}
