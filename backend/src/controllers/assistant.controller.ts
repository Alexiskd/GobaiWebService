// Outils NestJS : BadRequestException (erreur 400), Body (corps de la requête), Controller, Get et Post (routes), Header (en-tête de réponse), HttpCode (code de réponse).
import { BadRequestException, Body, Controller, Get, Header, HttpCode, Post } from '@nestjs/common';
// Throttle : règle une limite de débit propre à une route, à la place de la limite générale.
import { Throttle } from '@nestjs/throttler';
// Décorateurs Swagger : ils décrivent la route et chacune de ses réponses possibles dans la documentation.
import { ApiBadGatewayResponse, ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
// Forme commune de toutes les réponses d'erreur.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes de la réponse de l'assistant, de la requête reçue et de l'état de configuration.
import { AssistantReplyDto, AssistantRequestDto, AssistantStatusDto } from '../dto/assistant.dto';
// Service qui appelle l'API Claude.
import { AssistantService } from '../services/assistant/assistant.service';

/**
 * Assistant de la fenêtre « Claude » :
 *   1. `GET  assistant/config`   → assistant configuré ou non (sans clé : fenêtre de démonstration) ;
 *   2. `POST assistant/messages` → envoie la conversation, renvoie la réponse. La clé reste sur le serveur.
 */
// Range ces routes sous la rubrique « Assistant » de la documentation.
@ApiTags('Assistant')
// Toutes les routes de cette classe commencent par /api/v1/assistant.
@Controller('assistant')
// Classe du contrôleur de l'assistant.
export class AssistantController {
  // NestJS injecte le service de l'assistant, gardé en propriété privée non modifiable ; le corps du constructeur est vide.
  constructor(private readonly assistant: AssistantService) {}

  // Route GET /api/v1/assistant/config.
  @Get('config')
  // no-store : la réponse n'est jamais mise en cache, l'état peut changer d'un déploiement à l'autre.
  @Header('Cache-Control', 'no-store')
  // Titre et description de la route dans la documentation.
  @ApiOperation({ summary: 'Configuration de l’assistant', description: 'Indique si l’API Claude est configurée sur le serveur.' })
  // Réponse 200 documentée : un AssistantStatusDto.
  @ApiOkResponse({ type: AssistantStatusDto })
  // Méthode status : renvoie l'état de configuration.
  status(): AssistantStatusDto {
    // Délègue au service : il sait si la clé de l'API est présente.
    return this.assistant.status();
  // Fin de status.
  }

  // Route POST /api/v1/assistant/messages.
  @Post('messages')
  // Répond 200 au lieu du 201 que NestJS met par défaut sur un POST : rien n'est créé.
  @HttpCode(200)
  // Par visiteur : 8 messages par minute. Un plafond quotidien pour tout le site s'ajoute dans le service.
  // Limite propre à cette route : 8 requêtes par fenêtre de 60 000 ms, par visiteur.
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  // Titre et description de la route dans la documentation.
  @ApiOperation({ summary: 'Poser une question à l’assistant', description: 'Relaie la conversation à l’API Claude (modèle Haiku) et renvoie la réponse.' })
  // Réponse 200 documentée : un AssistantReplyDto.
  @ApiOkResponse({ type: AssistantReplyDto })
  // Réponse 400 documentée : conversation invalide.
  @ApiBadRequestResponse({ type: ApiErrorDto })
  // Réponse 429 documentée : trop de messages.
  @ApiTooManyRequestsResponse({ type: ApiErrorDto, description: 'Trop de messages, ou limite quotidienne du site atteinte.' })
  // Réponse 502 documentée : l'API Claude a échoué.
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  // Réponse 503 documentée : assistant non configuré ou surchargé.
  @ApiServiceUnavailableResponse({ type: ApiErrorDto, description: 'Assistant non configuré ou surchargé.' })
  // Méthode reply : reçoit le corps déjà validé contre AssistantRequestDto et renvoie une promesse de réponse.
  reply(@Body() body: AssistantRequestDto): Promise<AssistantReplyDto> {
    // Garde de chaque message son rôle et son texte sans espaces autour, puis retire les messages devenus vides.
    const messages = body.messages.map((m) => ({ role: m.role, content: m.content.trim() })).filter((m) => m.content);
    // Si la liste est vide, ou si le dernier message ne vient pas du visiteur (rôle « user ») :
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      // erreur 400 avec ce message.
      throw new BadRequestException('Le dernier message doit venir du visiteur.');
    // Fin de la vérification.
    }
    // L'API attend une conversation qui commence par le visiteur.
    // Retire les premiers messages tant que la conversation ne commence pas par le visiteur.
    while (messages.length && messages[0].role !== 'user') messages.shift();
    // Transmet la conversation nettoyée et l'inventaire de l'écran au service, et renvoie sa promesse.
    return this.assistant.reply(messages, body.elements ?? []);
  // Fin de reply.
  }
// Fin du contrôleur.
}
