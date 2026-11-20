// Contrôleur du domaine tuiles : couches, mentions, cartes NASA Trek, plan Earth et LiDAR HD.
import { Controller, Get, Param, Query } from '@nestjs/common';
import { TilesService } from './tiles.service';

@Controller()
export class TilesController {
  constructor(private readonly tiles: TilesService) {}

  @Get('/tiles/layers')
  layers() {
    return this.tiles.layers();
  }

  @Get('/tiles/layers/:id/attribution')
  attribution(
    @Param('id') id: string,
    @Query('zoom') zoom?: string,
    @Query('north') north?: string,
    @Query('south') south?: string,
    @Query('east') east?: string,
    @Query('west') west?: string,
  ) {
    return this.tiles.attribution(id);
  }

  @Get('/tiles/layers/:id')
  layer(@Param('id') id: string) {
    return this.tiles.layer(id);
  }

  @Get('/tiles/satellites/status')
  satelliteStatus() {
    return this.tiles.satelliteStatus();
  }

  @Get('/tiles/satellites/:body/layers')
  satelliteLayers(@Param('body') body: string) {
    return this.tiles.satelliteLayers();
  }

  @Get('/tiles/moon-blend/status')
  moonBlendStatus() {
    return this.tiles.moonBlendStatus();
  }

  @Get('/tiles/earth/plan')
  earthPlan() {
    return this.tiles.earthPlan();
  }

  @Get('/tiles/lidar-hd/cities')
  lidarCities() {
    return this.tiles.lidarCities();
  }
}
