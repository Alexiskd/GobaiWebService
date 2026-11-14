// Contrôleur de vérification des clés d'export (validation cryptographique côté serveur).
import { ExportAccessController } from '../controllers/export-access.controller';

// Module de la galerie (photos et vidéos personnelles, stockées dans PostgreSQL).
import { GalleryModule } from './gallery.module';
// Module des dons par carte bancaire.
import { DonationsModule } from './donations.module';
// Décorateur Module de NestJS : il déclare ce qu'un module importe, expose et fournit.
import { Module } from '@nestjs/common';
// Jeton APP_GUARD : sert à enregistrer une garde appliquée à toutes les routes de l'application.
import { APP_GUARD } from '@nestjs/core';
// Limitation de débit : ThrottlerModule la configure, ThrottlerGuard la fait respecter sur chaque requête.
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
// Jeton d'injection de la configuration et module qui la fournit à toute l'application.
import { APP_CONFIG, ConfigModule } from './config.module';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Contrôleur de supervision : la route /api/health que Render interroge.
import { HealthController } from '../controllers/health.controller';
// Module des astres (Soleil, planètes, satellites : tailles, rotation, éléments orbitaux).
import { BodiesModule } from './bodies.module';
// Module des frontières des pays et des littoraux.
import { BordersModule } from './borders.module';
// Module World Atlas : les pays en TopoJSON, source des frontières.
import { WorldAtlasModule } from './world-atlas.module';
// Module de recherche de lieux et de noms de villes.
import { PlacesModule } from './places.module';
// Module des villes du globe.
import { CitiesModule } from './cities.module';
// Module des éphémérides : positions des planètes et des satellites.
import { EphemerisModule } from './ephemeris.module';
// Module des tuiles de carte (Terre, Lune, Mars, satellites, nuages, vent).
import { TilesModule } from './tiles.module';
// Module de la Lune : catalogue des couches et passerelle de tuiles.
import { MoonModule } from './moon.module';
// Module de Mars : catalogue des couches et passerelle de tuiles.
import { MarsModule } from './mars.module';
// Module de Mercure : catalogue des couches et passerelle de tuiles.
import { MercuryModule } from './mercury.module';
// Module du Soleil : point sous-solaire et activité solaire.
import { SunModule } from './sun.module';
// Module des volcans : volcans en éruption en direct (NASA EONET).
import { VolcanoesModule } from './volcanoes.module';
// Module du blocage des API externes : liste des API déconnectées.
import { ApisModule } from './apis.module';
// Module des contributions : comptes, placements LiDAR et votes.
import { ContributionsModule } from './contributions.module';
// Module de la boutique : catalogue payant, paiement Stripe et exports.
import { StoreModule } from './store.module';
// Module de l'assistant (API Claude, clé gardée côté serveur).
import { AssistantModule } from './assistant.module';
// Module des nuages de points LiDAR servis en fichiers (COPC/LAS).
import { PointCloudsModule } from './pointclouds.module';
// Module des dalles LiDAR en vrais points 3D.
import { LidarTilesModule } from './lidar-tiles.module';

// Ouvre la déclaration du module racine.
@Module({
  // Liste des modules importés : chacun apporte ses routes et ses services.
  imports: [
    // Configuration en premier : module global, son jeton APP_CONFIG est disponible partout.
    ConfigModule,
    // Limitation de débit par IP (réglable : THROTTLE_LIMIT / THROTTLE_TTL_SECONDS)
    // Configure la limitation de débit de façon asynchrone, parce que ses valeurs viennent de la configuration.
    ThrottlerModule.forRootAsync({
      // Demande à NestJS d'injecter la configuration dans la fabrique ci-dessous.
      inject: [APP_CONFIG],
      // Fabrique : une seule règle, « limit » requêtes au plus par adresse IP sur une fenêtre de « ttl » millisecondes.
      useFactory: (config: AppConfig) => [{ ttl: config.throttle.ttlMs, limit: config.throttle.limit }],
    // Fin de la configuration de la limitation de débit.
    }),
    // Routes des astres : /api/v1/bodies.
    BodiesModule,
    // Routes des éphémérides.
    EphemerisModule,
    // Routes des villes.
    CitiesModule,
    // Routes des tuiles : /api/v1/tiles.
    TilesModule,
    // Modules repris de l'app Space : catalogues et passerelles de tuiles Lune/Mars/Mercure, point sous-solaire.
    // Routes de la Lune.
    MoonModule,
    // Routes de Mars.
    MarsModule,
    // Routes de Mercure.
    MercuryModule,
    // Routes du Soleil.
    SunModule,
    // Routes des volcans en éruption : /api/v1/volcanoes.
    VolcanoesModule,
    // World Atlas (pays en TopoJSON), source des frontières : /api/v1/world-atlas
    // Routes de World Atlas, importé avant les frontières qui s'en servent.
    WorldAtlasModule,
    // Routes des frontières : /api/v1/borders.
    BordersModule,
    // Routes des dons : /api/v1/donations.
    DonationsModule,
    // Routes de recherche de lieux.
    PlacesModule,
    // Assistant de la fenêtre « Claude » (API Claude, clé côté serveur) : /api/v1/assistant
    // Routes de l'assistant.
    AssistantModule,
    // Nuages de points LiDAR (COPC/LAS) servis en HTTP Range pour le rendu côté navigateur.
    // Routes des nuages de points en fichiers.
    PointCloudsModule,
    // Collection personnelle de la galerie (photos et vidéos), stockée dans PostgreSQL : /api/v1/galerie
    // Routes de la galerie.
    GalleryModule,
    // Dalles LiDAR en vrais points 3D, stockées dans PostgreSQL : /api/v1/lidar
    // Routes des dalles LiDAR en points 3D.
    // Boutique des exports payants.
    StoreModule,
    // Contributions de placement LiDAR.
    ContributionsModule,
    // Blocage des API externes.
    ApisModule,
    LidarTilesModule,
  // Fin de la liste des modules importés.
  ],
  // Seul contrôleur déclaré directement par le module racine : la supervision.
  controllers: [HealthController, ExportAccessController],
  // Enregistre ThrottlerGuard comme garde globale : la limite de débit s'applique à toutes les routes.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
// Fin de la déclaration.
})
// Classe du module racine : vide, tout est dans le décorateur ; c'est elle que main.ts passe à NestFactory.
export class AppModule {}
