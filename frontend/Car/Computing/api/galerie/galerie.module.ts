// Module du domaine galerie : le contrôle et le service de la collection personnelle.
import { Module } from '@nestjs/common';
import { GalerieController } from './galerie.controller';
import { GalerieService } from './galerie.service';

@Module({
  // Le contrôleur de la route /galerie.
  controllers: [GalerieController],
  // Le service PostgreSQL de la collection.
  providers: [GalerieService],
})
export class GalerieModule {}
