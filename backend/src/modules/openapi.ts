// Type (effacé à la compilation) d'une application NestJS.
import type { INestApplication } from '@nestjs/common';
// Constructeur du document OpenAPI et module Swagger.
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// Adresse publique du site.
import { SITE_URL } from '../services/data/body-pages';

/**
 * Groupes de la documentation, dans l'ordre où Swagger UI les affiche.
 * Chaque contrôleur porte l'étiquette de son groupe (`@ApiTags`) ; tout groupe employé doit figurer ici,
 * sinon il apparaît en bas de la page, sans explication.
 */
const TAGS: [string, string][] = [
  // Le système solaire.
  ['Astres', 'Soleil, planètes et Lune : tailles, rotation, éléments orbitaux.'],
  ['Éphémérides', 'Positions des planètes, de la Lune et des satellites naturels, calculées sur le serveur.'],
  ['Soleil', 'Point sous-solaire des globes et activité solaire en direct.'],
  ['Lune', 'Catalogue des couches de la Lune, passerelle de tuiles et stockage local.'],
  ['Mars', 'Catalogue des couches de Mars et passerelle de tuiles.'],
  ['Mercure', 'Catalogue des couches de Mercure et passerelle de tuiles.'],
  ['Volcans', 'Volcans en éruption dans le monde, en direct.'],
  // La carte de la Terre.
  ['Tuiles', 'Modèle de tuiles simplifié : couches, URL, coordonnées, attribution.'],
  ['LiDAR 3D', 'Dalles LiDAR servies en vrais points 3D, nœud par nœud.'],
  ['Nuages de points', 'Fichiers COPC/LAS servis en HTTP Range pour le rendu LiDAR côté navigateur.'],
  ['Frontières', 'Frontières des pays et littoraux.'],
  ['World Atlas', 'Pays en TopoJSON, source des frontières.'],
  ['Villes', 'Villes du globe avec recherche.'],
  ['Lieux', 'Recherche de lieux et noms de villes.'],
  // Les exports payants.
  ['Boutique', 'Catalogue des exports payants, paiement et jeton d’accès.'],
  ['Exports', 'Modèle 3D complet d’un astre, tuiles assemblées et calcul d’orbite ; jeton d’accès requis.'],
  // Le site.
  ['Contributions', 'Placements LiDAR proposés par les visiteurs, comptes et votes.'],
  ['Galerie', 'Photos et vidéos de la galerie.'],
  ['Assistant', 'Assistant de la barre d’outils.'],
  ['Dons', 'Dons par carte bancaire.'],
  // L'exploitation.
  ['API externes', 'API externes déconnectées sur le serveur.'],
  ['Service', 'Supervision.'],
];

/**
 * Construit le document OpenAPI : source unique pour Swagger UI (/api/docs) et l'export JSON (/api/docs-json).
 * `serverUrl` : adresse publique du service, proposée comme serveur des requêtes de la documentation.
 */
export function buildOpenApiDocument(app: INestApplication, serverUrl: string = SITE_URL) {
  // Description, étiquettes, serveur et schémas d'authentification.
  const builder = new DocumentBuilder()
    .setTitle('API Système solaire')
    .setDescription(
      [
        'Données du système solaire en direct : astres, éphémérides, villes, **modèle de tuiles** de la Terre,',
        'dalles LiDAR et contributions des visiteurs.',
        '',
        `Site : ${SITE_URL}/ · API : ${SITE_URL}/api/v1 · documentation : ${SITE_URL}/api/docs`,
        '',
        '**Conventions** : version dans l’URL (`/api/v1`), coordonnées en degrés (longitude Est positive, latitude',
        'Nord positive), dates en ISO 8601 (UTC), distances en unités astronomiques (UA), erreurs au format unique',
        '`ApiError`. Les routes de supervision (`/api/health`) ne portent pas de version.',
        '',
        '**Tuiles** : schéma XYZ (Web Mercator, origine en haut à gauche), tuiles de 256 px. Une seule requête',
        '`GET /tiles/layers/{layerId}` renvoie un modèle d’URL prêt à l’emploi.',
        '',
        '**Orbites** : les positions des planètes, de la Lune et des satellites sont calculées sur ce serveur, à',
        'partir d’éléments orbitaux versionnés dans le dépôt, sans appeler de service d’éphémérides. Chaque',
        'instantané porte son époque, son échelle de temps, son centre, son repère, ses unités et sa précision.',
        '',
        '**Authentification** : les contributions, l’administration des API externes et les exports payants en',
        'demandent une ; tout le reste est ouvert en lecture. Les exports se paient sur `/store` et s’ouvrent avec',
        'le jeton JWT obtenu, présenté dans l’en-tête `Authorization: Bearer`.',
      ].join('\n'),
    )
    .setVersion('2.1')
    .addServer(serverUrl, serverUrl === SITE_URL ? 'Site en ligne' : 'Ce serveur')
    // JWT de session : clients API externes en Bearer ; le site web utilise le cookie gobai_session HttpOnly.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT HS512 de session, valable 30 jours, pour les clients API externes. Le navigateur utilise un cookie HttpOnly.' },
      'session',
    )
    // Session du navigateur : cookie HttpOnly posé à la connexion.
    .addCookieAuth('gobai_session', { type: 'apiKey', in: 'cookie', description: 'Cookie de session HttpOnly posé par /contributions/session/login.' }, 'web-session')
    // Clé d'API achetée : le jeton JWT délivré par /store/orders/{id}/claim, qui ouvre les routes /export. Il
    // voyage dans le même en-tête que la session, mais ce n'est pas le même jeton : celui-ci porte les droits
    // payés et la date d'expiration de l'achat.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Clé d’API achetée dans la boutique : jeton JWT portant les droits payés. Obtenue par /store/orders/{id}/claim ou /store/licences.' },
      'cle-api',
    )
    // Clé d'administration : déconnecte une API externe sur le serveur.
    .addApiKey(
      { type: 'apiKey', name: 'x-admin-token', in: 'header', description: 'Clé d’administration du serveur (variable API_ADMIN_TOKEN).' },
      'admin-token',
    );
  // Déclare chaque groupe, dans l'ordre.
  for (const [name, description] of TAGS) builder.addTag(name, description);
  // Le document, construit à partir des décorateurs des contrôleurs.
  return SwaggerModule.createDocument(app, builder.build());
// Fin de buildOpenApiDocument.
}

/** Installe Swagger UI sur /api/docs et le document JSON sur /api/docs-json. */
export function setupOpenApi(app: INestApplication, serverUrl: string = SITE_URL) {
  // Installation.
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app, serverUrl), {
    useGlobalPrefix: true, // → /api/docs
    jsonDocumentUrl: 'docs-json', // → /api/docs-json
    customSiteTitle: 'API Système solaire',
    // Les groupes et les routes restent repliés à l'ouverture : la page compte une vingtaine de groupes.
    swaggerOptions: { docExpansion: 'none' },
  });
// Fin de setupOpenApi.
}
