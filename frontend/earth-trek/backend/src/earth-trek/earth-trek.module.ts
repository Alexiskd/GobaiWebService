import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { EarthTrekController } from './earth-trek.controller';
import { EarthTrekTilesMiddleware } from './earth-trek.middleware';
import { EarthTrekService } from './earth-trek.service';

/** Trek de la Terre : fonds Esri World Imagery, Mapbox et Maxar (Vantor) servis par le backend. */
@Module({
  controllers: [EarthTrekController],
  providers: [EarthTrekService],
  exports: [EarthTrekService],
})
export class EarthTrekModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Intercepte seulement les tuiles des fonds du Trek sur la route générique des tuiles ; le reste passe.
    consumer.apply(EarthTrekTilesMiddleware).forRoutes('*');
  }
}
