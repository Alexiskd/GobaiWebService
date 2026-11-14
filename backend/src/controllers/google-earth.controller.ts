// Décorateurs de NestJS : contrôleur, route GET et en-tête de réponse.
import { Controller, Get, Header } from '@nestjs/common';
// Décorateurs de documentation Swagger.
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// Forme de la réponse.
import { GoogleEarthConfigDto } from '../dto/google-earth.dto';

/**
 * Globe Google (3D Maps de l'API Maps JavaScript) : la page /google-earth.html, affichée dans un iframe par l'app,
 * lit ici la clé de l'API Maps JavaScript. Une clé Maps JavaScript est publique par nature (elle part dans le
 * navigateur) : sa protection est la restriction par site (référents HTTP) réglée dans la console Google Cloud.
 * Clé dans la variable d'environnement GOOGLE_MAPS_API_KEY (API « Maps JavaScript » activée, facturation active).
 */
// Groupe de la documentation.
@ApiTags('Globe Google')
// Routes /api/v1/google-earth.
@Controller('google-earth')
// Classe du contrôleur.
export class GoogleEarthController {
  /** Configuration du globe Google : clé de l'API Maps JavaScript, ou indisponible. */
  // Route GET /api/v1/google-earth/config.
  @Get('config')
  // Jamais gardée en cache : une clé changée sur Render est prise tout de suite.
  @Header('Cache-Control', 'no-store')
  // Documentation : résumé.
  @ApiOperation({ summary: 'Clé de l’API Maps JavaScript du globe Google (3D Maps)' })
  // Documentation : réponse.
  @ApiOkResponse({ type: GoogleEarthConfigDto })
  // Méthode config (début).
  config(): GoogleEarthConfigDto {
    // Clé, sans espaces, ou vide.
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
    // Disponible si une clé est configurée ; la clé, sinon null.
    return { available: Boolean(key), key: key || null };
  // Fin de config.
  }
// Fin du contrôleur.
}
