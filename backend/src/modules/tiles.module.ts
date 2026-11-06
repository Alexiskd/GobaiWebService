import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_CONFIG } from './config.module';
import type { AppConfig } from '../common/configuration';
import { MarsModule } from './mars.module';
import { MercuryModule } from './mercury.module';
import { MoonModule } from './moon.module';
import { GibsTileProvider } from '../services/map-tiles/providers/gibs-tile.provider';
import { GoogleTileProvider } from '../services/map-tiles/providers/google-tile.provider';
import { NasaTrekMoonProvider } from '../services/map-tiles/providers/nasa-trek-moon.provider';
import { NasaTrekMarsProvider } from '../services/map-tiles/providers/nasa-trek-mars.provider';
import { NasaTrekVenusProvider } from '../services/map-tiles/providers/nasa-trek-venus.provider';
import { TilesController } from '../controllers/tiles.controller';
import { TILE_PROVIDERS, TilesService } from '../services/map-tiles/map-imagery.service';
import { MoonColorService } from '../services/map-tiles/moon-color.service';
import { MoonTileCacheService } from '../services/map-tiles/moon-tile-cache.service';
import { MoonModelService } from '../services/map-tiles/moon-model.service';
import { SpaceLayersService } from '../services/map-tiles/space-layers.service';

@Module({
  imports: [MoonModule, MarsModule, MercuryModule],
  controllers: [TilesController],
  providers: [
    {
      provide: TILE_PROVIDERS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        new GoogleTileProvider(config.tiles.google),
        new GibsTileProvider(config.tiles.gibs),
        new NasaTrekMoonProvider(config.tiles.moon),
        new NasaTrekMarsProvider(config.tiles.mars),
        new NasaTrekVenusProvider(config.tiles.venus),
      ],
    },
    TilesService,
    SpaceLayersService,
    { provide: MoonColorService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new MoonColorService(config) },
    { provide: MoonTileCacheService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new MoonTileCacheService(config) },
    { provide: MoonModelService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new MoonModelService(config) },
  ],
})
export class TilesModule implements OnApplicationBootstrap {
  constructor(private readonly moonTiles: MoonTileCacheService) {}

  /** Précharge la Lune en arrière-plan dès que le serveur est prêt (pas pendant les tests). */
  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) this.moonTiles.startBackgroundPrefetch();
  }
}
