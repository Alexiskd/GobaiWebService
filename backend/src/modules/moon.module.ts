import { Module } from '@nestjs/common';
import { MoonCapabilitiesService } from '../services/moon/capabilities.service';
import { MoonHealthService } from '../services/moon/moon-upstream-health.service';
import { MOON_CONFIG, loadMoonConfig } from '../services/moon/moon.config';
import { MoonCatalogService } from '../services/moon/moon-catalog.service';
import { MoonController } from '../controllers/moon.controller';
import { MoonTileService } from '../services/moon/moon-imagery-tile.service';
import { MoonTilesetService } from '../services/moon/moon-tileset-metadata.service';
import { MoonUpstreamService } from '../services/moon/upstream.service';

@Module({
  controllers: [MoonController],
  providers: [
    {
      provide: MOON_CONFIG,
      useFactory: () => loadMoonConfig(),
    },
    MoonCatalogService,
    MoonUpstreamService,
    MoonCapabilitiesService,
    MoonTileService,
    MoonTilesetService,
    MoonHealthService,
  ],
  exports: [MoonCatalogService, MoonTileService, MoonCapabilitiesService],
})
export class MoonModule {}
