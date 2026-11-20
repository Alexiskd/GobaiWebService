// Outils NestJS : erreur 400, corps et en-tête de la requête, contrôleur, routes, en-tête de réponse, code de réponse.
import { BadRequestException, Body, Controller, Get, Header, Headers, HttpCode, Post } from '@nestjs/common';
// Limite de débit propre à une route.
import { Throttle } from '@nestjs/throttler';
// Documentation Swagger.
import {
  ApiBadGatewayResponse, ApiBadRequestResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags,
  ApiTooManyRequestsResponse, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
// Forme commune des erreurs.
import { ApiErrorDto } from '../dto/api-error.dto';
// Formes échangées.
import { AssistantCatalogDto, AssistantReplyDto, AssistantRequestDto, AssistantSessionDto, AssistantSessionRequestDto } from '../dto/assistant.dto';
// Service de l'assistant (deux fournisseurs derrière une interface commune).
import { AssistantService } from '../services/assistant/assistant.service';

/** En-tête qui porte la clé d'API de l'utilisateur : jamais dans l'adresse ni dans le corps, jamais journalisé. */
const KEY_HEADER = 'x-assistant-key';
const KEY_DOC = { name: KEY_HEADER, required: true, description: 'Clé d’API de l’utilisateur chez le fournisseur choisi (Claude Platform ou Mistral). Gardée dans son navigateur, jamais sur le serveur.' };

/**
 * Assistant : l'utilisateur se connecte avec SA clé, chez Claude ou chez Mistral.
 *   1. `GET  assistant/config`   → fournisseurs proposés, modèle de chacun, pages de clé et de paiement ;
 *   2. `POST assistant/session`  → appel de test : clé valide et compte en état de payer ;
 *   3. `POST assistant/messages` → la conversation, avec la clé et le fournisseur de l'utilisateur.
 * Clé fausse ou révoquée : 401 `invalid_key`. Pas de moyen de paiement ou plus de crédit : 402 `billing`, avec la
 * page de paiement du fournisseur (`billingUrl`).
 */
@ApiTags('Assistant')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('config')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Fournisseurs de l’assistant', description: 'Claude et Mistral : modèle utilisé (le plus performant de chacun), page de création d’une clé, page de paiement.' })
  @ApiOkResponse({ type: AssistantCatalogDto })
  config(): AssistantCatalogDto {
    return this.assistant.catalog();
  }

  @Post('session')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiHeader(KEY_DOC)
  @ApiOperation({ summary: 'Se connecter à l’assistant', description: 'Appel de test (une réponse d’un seul jeton) chez le fournisseur choisi : la clé est-elle valide, le compte peut-il payer ? Rien n’est enregistré.' })
  @ApiOkResponse({ type: AssistantSessionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Clé invalide, révoquée ou expirée (`code` : invalid_key).' })
  @ApiResponse({ status: 402, type: ApiErrorDto, description: 'Pas de moyen de paiement ou plus de crédit (`code` : billing, `billingUrl`).' })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  session(@Body() body: AssistantSessionRequestDto, @Headers(KEY_HEADER) key: string): Promise<AssistantSessionDto> {
    return this.assistant.verify(body.provider, key);
  }

  @Post('messages')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiHeader(KEY_DOC)
  @ApiOperation({ summary: 'Poser une question à l’assistant', description: 'Relaie la conversation chez le fournisseur choisi, avec la clé de l’utilisateur ; renvoie la réponse et les actions sur l’interface.' })
  @ApiOkResponse({ type: AssistantReplyDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Clé invalide, révoquée ou expirée (`code` : invalid_key).' })
  @ApiResponse({ status: 402, type: ApiErrorDto, description: 'Pas de moyen de paiement ou plus de crédit (`code` : billing, `billingUrl`).' })
  @ApiTooManyRequestsResponse({ type: ApiErrorDto })
  @ApiBadGatewayResponse({ type: ApiErrorDto })
  reply(@Body() body: AssistantRequestDto, @Headers(KEY_HEADER) key: string): Promise<AssistantReplyDto> {
    // Messages nettoyés : texte sans espaces autour, messages vides retirés.
    const messages = body.messages.map((m) => ({ role: m.role, content: m.content.trim() })).filter((m) => m.content);
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      throw new BadRequestException('Le dernier message doit venir du visiteur.');
    }
    // Les deux API attendent une conversation qui commence par le visiteur.
    while (messages.length && messages[0].role !== 'user') messages.shift();
    return this.assistant.reply(body.provider, key, messages, body.elements ?? []);
  }
}
