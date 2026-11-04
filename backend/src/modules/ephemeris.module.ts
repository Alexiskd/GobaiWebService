import { Module } from '@nestjs/common';
import { APP_CONFIG } from './config.module';
import type { AppConfig } from '../common/configuration';
import { HorizonsService } from '../services/ephemeris/horizons.service';
import { OrbitersService } from '../services/ephemeris/orbiters.service';
import { UsnoService } from '../services/ephemeris/usno.service';
import { EphemerisController } from '../controllers/ephemeris.controller';
import { EphemerisService } from '../services/ephemeris/planetary-positions.service';

@Module({
  controllers: [EphemerisController],
  providers: [
    EphemerisService,
    { provide: HorizonsService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new HorizonsService(config) },
    { provide: UsnoService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new UsnoService(config) },
    { provide: OrbitersService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new OrbitersService(config) },
  ],
  exports: [EphemerisService],
})
export class EphemerisModule {}
