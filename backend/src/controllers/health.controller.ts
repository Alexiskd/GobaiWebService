// Outils NestJS : Controller, Get, et VERSION_NEUTRAL pour une route sans numéro de version.
import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
// Décorateurs Swagger pour la documentation.
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
// SkipThrottle : dispense de la limite de débit.
import { SkipThrottle } from '@nestjs/throttler';
// Forme de la réponse de supervision.
import { HealthDto } from '../dto/health.dto';

// Rubrique « Service » de la documentation.
@ApiTags('Service')
// Pas de limite de débit : Render interroge cette route en continu.
@SkipThrottle()
// Route sans version : /api/health (et non /api/v1/health).
@Controller({ path: 'health', version: VERSION_NEUTRAL })
// Classe du contrôleur de supervision.
export class HealthController {
  // Route GET /api/health.
  @Get()
  // Ouvre la description de la route :
  @ApiOperation({
    // son titre ;
    summary: 'État du service',
    // son texte.
    description: 'À utiliser pour la supervision. Disponible sans version : `/api/health`.',
  // Fin de la description.
  })
  // Réponse 200 documentée : un HealthDto.
  @ApiOkResponse({ type: HealthDto })
  // Méthode check : renvoie l'état du service.
  check(): HealthDto {
    // Objet renvoyé :
    return {
      // statut fixe « ok » : si la route répond, le serveur tourne ;
      status: 'ok',
      // heure du serveur en ISO 8601 (UTC) ;
      time: new Date().toISOString(),
      // nombre de secondes depuis le démarrage du processus, arrondi ;
      uptimeSeconds: Math.round(process.uptime()),
      // Commit déployé (variable fournie par Render) : les pages ouvertes se rechargent quand il change.
      // identifiant du commit déployé, donné par Render (chaîne vide ailleurs).
      build: process.env.RENDER_GIT_COMMIT?.trim() || '',
    // Fin de l'objet.
    };
  // Fin de check.
  }
// Fin du contrôleur.
}
