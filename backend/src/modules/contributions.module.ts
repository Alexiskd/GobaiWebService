import { Module } from '@nestjs/common';
import { ContributionsController } from '../controllers/contributions.controller';
import { P2PSignalingService } from '../services/contributions/p2p-signaling.service';

@Module({
  controllers: [ContributionsController],
  providers: [P2PSignalingService],
  exports: [P2PSignalingService],
})
export class ContributionsModule {}
