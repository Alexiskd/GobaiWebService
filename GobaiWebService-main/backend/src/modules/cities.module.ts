// Décorateur Module de NestJS.
import { Module } from '@nestjs/common';
// Contrôleur des villes : les routes /api/v1/cities.
import { CitiesController } from '../controllers/cities.controller';
// Service des villes : la liste des villes du globe et la recherche.
import { CitiesService } from '../services/cities/cities.service';

// Déclare le module : un contrôleur et son service, utilisés seulement ici (rien n'est exporté).
@Module({ controllers: [CitiesController], providers: [CitiesService] })
// Classe du module des villes, importée par le module racine.
export class CitiesModule {}
