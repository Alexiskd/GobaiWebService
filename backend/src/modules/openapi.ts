import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Construit le document OpenAPI : source unique pour Swagger UI (/api/docs) et l'export JSON. */
export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('API Système solaire')
    .setDescription(
      [
        'Données du système solaire en direct : astres, éphémérides, villes, routes et **modèle de tuiles** de la Terre.',
        '',
        '**Conventions** : version dans l’URL (`/api/v1`), coordonnées en degrés (longitude Est positive, latitude Nord positive),',
        'dates en ISO 8601 (UTC), distances en unités astronomiques (UA), erreurs au format unique `ApiError`.',
        '',
        '**Tuiles** : schéma XYZ (Web Mercator, origine en haut à gauche), tuiles de 256 px. Une seule requête',
        '`GET /tiles/layers/{layerId}` renvoie un modèle d’URL prêt à l’emploi.',
      ].join('\n'),
    )
    .setVersion('2.0')
    .addTag('Astres', 'Soleil, planètes et Lune : tailles, rotation, éléments orbitaux.')
    .addTag('Éphémérides', 'Positions des planètes à un instant donné.')
    .addTag('Villes', 'Villes du globe avec recherche.')
    .addTag('Routes', 'Axes routiers principaux et étiquettes.')
    .addTag('Tuiles', 'Modèle de tuiles simplifié : couches, URL, coordonnées, attribution.')
    .addTag('Nuages de points', 'Fichiers COPC/LAS servis en HTTP Range pour le rendu LiDAR côté navigateur.')
    .addTag('Pair-à-pair', 'Signalisation WebRTC : relais des offres SDP et candidats ICE, sans données d’application.')
    .addTag('Service', 'Supervision.')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(app: INestApplication) {
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
    useGlobalPrefix: true, // → /api/docs
    jsonDocumentUrl: 'docs-json', // → /api/docs-json
    customSiteTitle: 'API Système solaire',
  });
}
