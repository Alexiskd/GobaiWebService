import { Module } from '@nestjs/common';
import { APP_CONFIG } from './config.module';
import type { AppConfig } from '../common/configuration';
import { DanuriController } from '../controllers/danuri.controller';
import { ShadowCamService } from '../services/shadowcam/shadowcam.service';

@Module({
  controllers: [DanuriController],
  providers: [{ provide: ShadowCamService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new ShadowCamService(config) }],
})
export class DanuriModule {}
