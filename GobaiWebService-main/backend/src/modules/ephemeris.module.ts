// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Service des orbites de la Lune et des satellites, calculées sur place par les lois de Kepler.
import { KeplerEphemerisService } from '../services/ephemeris/kepler-ephemeris.service';
// Service des prochaines phases de la Lune (U.S. Naval Observatory).
import { UsnoService } from '../services/ephemeris/usno.service';
// Contrôleur des éphémérides : les routes de positions.
import { EphemerisController } from '../controllers/ephemeris.controller';
// Service des positions des planètes à un instant donné.
import { EphemerisService } from '../services/ephemeris/planetary-positions.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur des éphémérides.
  controllers: [EphemerisController],
  // Services que le module fabrique :
  providers: [
    // EphemerisService, construit directement par NestJS.
    EphemerisService,
    // KeplerEphemerisService, construit par une fabrique sans argument (ses paramètres par défaut suffisent).
    { provide: KeplerEphemerisService, useFactory: () => new KeplerEphemerisService() },
    // UsnoService, construit par une fabrique qui lui passe la configuration (adresse de l'API de l'observatoire).
    { provide: UsnoService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new UsnoService(config) },
  // Fin de la liste des services.
  ],
  // Exporte les positions et les orbites de Kepler : le module des tuiles s'en sert.
  exports: [EphemerisService, KeplerEphemerisService],
// Fin de la déclaration.
})
// Classe du module des éphémérides, importée par le module racine et par le module des tuiles.
export class EphemerisModule {}
