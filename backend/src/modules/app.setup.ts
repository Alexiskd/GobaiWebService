import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import type { AppConfig } from '../common/configuration';
import { HttpExceptionFilter } from '../common/http-exception.filter';

/** Réglages communs à l'application réelle, aux tests de bout en bout et à l'export OpenAPI. */
export function configureApp(app: INestApplication, config: AppConfig) {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({ origin: config.corsOrigins });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // convertit les paramètres de requête selon les DTO
      whitelist: true, // ignore les champs inconnus
      forbidNonWhitelisted: true, // …et les refuse explicitement : erreur claire plutôt que silence
    }),
  );
}
