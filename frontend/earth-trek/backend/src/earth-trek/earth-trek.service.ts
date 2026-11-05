import { Injectable, Logger } from '@nestjs/common';
import { EarthTrekCore } from './earth-trek.core';

/** Service NestJS : le cœur testable, configuré par les variables d'environnement. */
@Injectable()
export class EarthTrekService extends EarthTrekCore {
  private readonly logger = new Logger('EarthTrek');

  constructor() {
    super(process.env, {
      cacheBytes: Number(process.env.EARTH_TREK_CACHE_MB || 256) * 1024 * 1024,
      routePrefix: process.env.EARTH_TREK_ROUTE_PREFIX || '/api/v1/earth-trek',
    });
    const ready = this.layers().filter((l) => l.available).map((l) => l.label);
    this.logger.log(`Fonds Terre disponibles : ${ready.join(', ') || 'aucun'}`);
  }
}
