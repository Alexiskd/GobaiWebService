import { Module } from '@nestjs/common';
import { APP_CONFIG } from './config.module';
import type { AppConfig } from '../common/configuration';
import { BordersController } from '../controllers/borders.controller';
import { BordersService } from '../services/borders/borders.service';

@Module({
  controllers: [BordersController],
  providers: [{ provide: BordersService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new BordersService(config) }],
})
export class BordersModule {}
