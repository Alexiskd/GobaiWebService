import { Module } from '@nestjs/common';
import { APP_CONFIG } from './config.module';
import type { AppConfig } from '../common/configuration';
import { PlacesController } from '../controllers/places.controller';
import { PlacesService } from '../services/places/places.service';
import { CityLabelsService } from '../services/places/city-labels.service';

@Module({
  controllers: [PlacesController],
  providers: [
    { provide: PlacesService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new PlacesService(config) },
    { provide: CityLabelsService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new CityLabelsService(config) },
  ],
})
export class PlacesModule {}
