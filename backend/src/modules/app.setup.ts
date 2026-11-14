// INestApplication : type de l'application ; ValidationPipe : validation automatique des entrées ; VersioningType : façons de versionner l'API.
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
// Type (effacé à la compilation) de l'objet de configuration.
import type { AppConfig } from '../common/configuration';
// Filtre qui met toutes les erreurs au même format de réponse.
import { HttpExceptionFilter } from '../common/http-exception.filter';

/** Réglages communs à l'application réelle, aux tests de bout en bout et à l'export OpenAPI. */
// Déclare configureApp : applique à une application les réglages communs, d'après la configuration.
export function configureApp(app: INestApplication, config: AppConfig) {
  // Toutes les routes sont préfixées par /api.
  app.setGlobalPrefix('api');
  // Version dans l'adresse (/api/v1/…) ; une route sans version déclarée prend la version 1.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // CORS : origines autorisées à appeler l'API depuis un navigateur (toutes en développement, la liste CORS_ORIGIN sinon).
  app.enableCors({ origin: config.corsOrigins });
  // Installe le filtre d'erreurs pour toute l'application.
  app.useGlobalFilters(new HttpExceptionFilter());
  // Installe un traitement appliqué à toutes les entrées (paramètres d'adresse, de requête, corps) :
  app.useGlobalPipes(
    // le ValidationPipe, qui vérifie chaque entrée contre sa classe DTO, avec trois options :
    new ValidationPipe({
      // transform : convertit les valeurs reçues en texte vers les types déclarés (nombres, booléens).
      transform: true, // convertit les paramètres de requête selon les DTO
      // whitelist : retire les champs qui ne sont pas déclarés dans le DTO.
      whitelist: true, // ignore les champs inconnus
      // forbidNonWhitelisted : au lieu de les retirer en silence, répond par une erreur 400 qui les nomme.
      forbidNonWhitelisted: true, // …et les refuse explicitement : erreur claire plutôt que silence
    // Fin des options du ValidationPipe.
    }),
  // Fin de l'appel à useGlobalPipes.
  );
// Fin de configureApp.
}
