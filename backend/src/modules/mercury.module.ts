import { Module } from '@nestjs/common';
import { MercuryCapabilitiesService } from '../services/mercury/capabilities.service';
import { MercuryHealthService } from '../services/mercury/mercury-upstream-health.service';
import { MERCURY_CONFIG, loadMercuryConfig } from '../services/mercury/mercury.config';
import { MercuryCatalogService } from '../services/mercury/mercury-catalog.service';
import { MercuryController } from '../controllers/mercury.controller';
import { MercuryTileService } from '../services/mercury/mercury-surface-tile.service';
import { MercuryUpstreamService } from '../services/mercury/upstream.service';

@Module({
  controllers: [MercuryController],
  providers: [
    {
      provide: MERCURY_CONFIG,
      useFactory: () => loadMercuryConfig(),
    },
    MercuryCatalogService,
    MercuryUpstreamService,
    MercuryCapabilitiesService,
    MercuryTileService,
    MercuryHealthService,
  ],
  exports: [MercuryCatalogService, MercuryTileService, MercuryCapabilitiesService],
})
export class MercuryModule {}
