// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Contrôleur des lieux : les routes de recherche et de noms de villes.
import { PlacesController } from '../controllers/places.controller';
// Service de recherche de villes et de lieux, interne (GeoNames embarqué, aucun service extérieur).
import { PlacesService } from '../services/locations/places/places.service';
// Service des noms de villes du monde (Natural Earth), avec le nom dans l'écriture locale.
import { CityLabelsService } from '../services/locations/places/city-labels.service';

// Ouvre la déclaration du module.
@Module({
  // Routes du module : celles du contrôleur des lieux.
  controllers: [PlacesController],
  // Services que le module fabrique :
  providers: [
    // PlacesService, le moteur de recherche interne (sans configuration) ;
    PlacesService,
    // CityLabelsService, construit de la même façon (la configuration donne le fichier des villes).
    { provide: CityLabelsService, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new CityLabelsService(config) },
  // Fin de la liste des services.
  ],
// Fin de la déclaration.
})
// Classe du module des lieux, importée par le module racine.
export class PlacesModule {}
