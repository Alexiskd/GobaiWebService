// Comparaison de secrets en temps constant, et empreinte SHA-256.
import { createHash, timingSafeEqual } from 'node:crypto';
// Outils NestJS : contrôleur, routes, corps, en-têtes et erreurs HTTP.
import { Body, Controller, ForbiddenException, Get, Header, Headers, Put, ServiceUnavailableException } from '@nestjs/common';
// Documentation OpenAPI.
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
// Listes des hôtes bloqués.
import { blockedHosts, envBlockedHosts, runtimeBlockedHosts, setRuntimeBlockedHosts } from '../common/api-blocklist';
// Formes des données échangées.
import { BlockedApisDto, SetBlockedApisDto } from '../dto/apis.dto';

// Empreinte d'un texte : deux empreintes ont toujours la même longueur, ce qu'exige timingSafeEqual.
const digest = (text: string) => createHash('sha256').update(text).digest();

// Routes sous /api/v1/apis.
@ApiTags('API externes')
@Controller('apis')
// Classe du contrôleur du blocage des API.
export class ApisController {
  // État courant, renvoyé par les deux routes.
  private state(): BlockedApisDto {
    // Les trois listes, et la présence d'une clé d'administration.
    return {
      hosts: blockedHosts(),
      permanent: envBlockedHosts(),
      runtime: runtimeBlockedHosts(),
      editable: Boolean(process.env.API_ADMIN_TOKEN?.trim()),
    };
  // Fin de state.
  }

  /** Hôtes des API externes déconnectées sur le serveur. */
  // Route GET /api/v1/apis/blocked.
  @Get('blocked')
  // Jamais mise en cache : l'état peut changer à tout moment.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'API externes déconnectées sur le serveur' })
  @ApiOkResponse({ type: BlockedApisDto })
  // Méthode blocked.
  blocked(): BlockedApisDto {
    // Renvoie l'état.
    return this.state();
  // Fin de blocked.
  }

  /** Remplace la liste d'exécution des API déconnectées. Réservé à qui détient la clé d'administration. */
  // Route PUT /api/v1/apis/blocked.
  @Put('blocked')
  // Jamais mise en cache.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Déconnecte ou reconnecte des API externes (clé d’administration requise)' })
  @ApiSecurity('admin-token')
  @ApiOkResponse({ type: BlockedApisDto })
  @ApiForbiddenResponse({ description: 'Clé d’administration absente ou fausse.' })
  // Méthode setBlocked.
  setBlocked(@Body() body: SetBlockedApisDto, @Headers('x-admin-token') token?: string): BlockedApisDto {
    // Clé attendue par le serveur.
    const expected = process.env.API_ADMIN_TOKEN?.trim();
    // Pas de clé configurée : la liste n'est pas modifiable à distance.
    if (!expected) throw new ServiceUnavailableException('Aucune clé d’administration n’est configurée sur le serveur (API_ADMIN_TOKEN).');
    // Clé reçue fausse ou absente : refus.
    if (!token || !timingSafeEqual(digest(token.trim()), digest(expected))) throw new ForbiddenException('Clé d’administration refusée.');
    // Remplace la liste d'exécution.
    setRuntimeBlockedHosts(body.hosts);
    // Renvoie le nouvel état.
    return this.state();
  // Fin de setBlocked.
  }
// Fin du contrôleur.
}
