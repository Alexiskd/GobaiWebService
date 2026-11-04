import { Module } from '@nestjs/common';
import { MarsBlendService } from '../services/mars/mars-blend.service';
import { MarsFusionService } from '../services/mars/mars-fusion.service';
import { MarsCapabilitiesService } from '../services/mars/capabilities.service';
import { MarsHealthService } from '../services/mars/mars-upstream-health.service';
import { MARS_CONFIG, loadMarsConfig } from '../services/mars/mars.config';
import { MarsCatalogService } from '../services/mars/mars-catalog.service';
import { MarsController } from '../controllers/mars.controller';
import { MarsTileService } from '../services/mars/mars-imagery-tile.service';
import { MarsTilesetService } from '../services/mars/mars-tileset-metadata.service';
import { MarsUpstreamService } from '../services/mars/upstream.service';

@Module({
  controllers: [MarsController],
  providers: [
    {
      provide: MARS_CONFIG,
      useFactory: () => loadMarsConfig(),
    },
    MarsCatalogService,
    MarsUpstreamService,
    MarsCapabilitiesService,
    MarsTileService,
    MarsFusionService,
    MarsTilesetService,
    MarsBlendService,
    MarsHealthService,
  ],
  exports: [
    MarsCatalogService,
    MarsTileService,
    MarsCapabilitiesService,
    MarsBlendService,
    MarsFusionService,
  ],
})
export class MarsModule {}
