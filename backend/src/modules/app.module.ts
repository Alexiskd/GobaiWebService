import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, ConfigModule } from './config.module';
import type { AppConfig } from '../common/configuration';
import { HealthController } from '../controllers/health.controller';
import { BodiesModule } from './bodies.module';
import { BordersModule } from './borders.module';
import { PlacesModule } from './places.module';
import { CitiesModule } from './cities.module';
import { EphemerisModule } from './ephemeris.module';
import { RoadsModule } from './roads.module';
import { TilesModule } from './tiles.module';
import { DanuriModule } from './danuri.module';
import { MoonModule } from './moon.module';
import { MarsModule } from './mars.module';
import { MercuryModule } from './mercury.module';
import { SunModule } from './sun.module';
import { DonationsModule } from './donations.module';
import { PointCloudsModule } from './pointclouds.module';
import { ContributionsModule } from './contributions.module';

@Module({
  imports: [
    ConfigModule,
    // Limitation de débit par IP (réglable : THROTTLE_LIMIT / THROTTLE_TTL_SECONDS)
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [{ ttl: config.throttle.ttlMs, limit: config.throttle.limit }],
    }),
    BodiesModule,
    EphemerisModule,
    CitiesModule,
    RoadsModule,
    TilesModule,
    DanuriModule,
    // Modules repris de l'app Space : catalogues et passerelles de tuiles Lune/Mars/Mercure, point sous-solaire.
    MoonModule,
    MarsModule,
    MercuryModule,
    SunModule,
    BordersModule,
    PlacesModule,
    DonationsModule,
    // Nuages de points LiDAR (COPC/LAS) servis en HTTP Range pour le rendu côté navigateur.
    PointCloudsModule,
    ContributionsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
