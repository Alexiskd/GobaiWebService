// Contrôleur du domaine scène : frontières, lieux, éphémérides, Soleil, atmosphère, LiDAR, assistant.
import { Controller, Get } from '@nestjs/common';
import { SceneService } from './scene.service';

@Controller()
export class SceneController {
  constructor(private readonly scene: SceneService) {}

  @Get('/borders')
  borders() {
    return this.scene.borders();
  }

  @Get('/places')
  places() {
    return this.scene.places();
  }

  @Get('/places/labels')
  placeLabels() {
    return this.scene.placeLabels();
  }

  @Get('/pointclouds')
  pointClouds() {
    return this.scene.pointClouds();
  }

  @Get('/lidar')
  lidar() {
    return this.scene.lidar();
  }

  @Get('/ephemeris/moon')
  moonEphemeris() {
    return this.scene.moonEphemeris();
  }

  @Get('/ephemeris/satellites')
  satelliteEphemeris() {
    return this.scene.satelliteEphemeris();
  }

  @Get('/ephemeris/moon/phases')
  moonPhases() {
    return this.scene.moonPhases();
  }

  @Get('/sun/regions')
  sunRegions() {
    return this.scene.sunRegions();
  }

  @Get('/sun/activity')
  sunActivity() {
    return this.scene.sunActivity();
  }

  @Get('/volcanoes')
  volcanoes() {
    return this.scene.volcanoes();
  }

  // Les couches atmosphériques : incendies (et leur tuile), cyclones, foudre, radar, orages, aérosols, vents.
  @Get('/atmosphere/fires')
  atmosphereFires() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/fires/tiles/:tx/:ty')
  atmosphereFireTile() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/cyclones')
  atmosphereCyclones() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/lightning')
  atmosphereLightning() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/radar')
  atmosphereRadar() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/storms')
  atmosphereStorms() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/aerosols')
  atmosphereAerosols() {
    return this.scene.atmosphereFeed();
  }

  @Get('/atmosphere/winds')
  atmosphereWinds() {
    return this.scene.atmosphereFeed();
  }

  // La configuration de l'assistant.
  @Get('/assistant/config')
  assistantConfig() {
    return this.scene.assistantConfig();
  }}
