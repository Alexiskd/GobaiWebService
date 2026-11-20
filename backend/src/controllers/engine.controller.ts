// Contrôleur du moteur chiffré : sert le script `body.js` (public) et la clé de déchiffrement (origines autorisées).
// Outils NestJS.
import { Controller, ForbiddenException, Get, Header, Inject, Req } from '@nestjs/common';
// Requête Express.
import type { Request } from 'express';
// Documentation OpenAPI.
import { ApiOperation, ApiTags } from '@nestjs/swagger';
// Service du moteur.
import { EngineService } from '../services/engine/engine.service';
// Configuration : les origines du frontend.
import { APP_CONFIG } from '../modules/config.module';
import type { AppConfig } from '../common/configuration';
// Test « cette origine est-elle le frontend ? ».
import { isFrontendOrigin } from '../common/cors';

// Routes sous /api/v1/engine.
@ApiTags('Moteur')
@Controller('engine')
export class EngineController {
  // Injection des services.
  constructor(private readonly engine: EngineService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  // GET /api/v1/engine/body.js : le script auto-déchiffrant, paramétrable, qui expose window.GobaiEngine. Public.
  @Get('body.js')
  @ApiOperation({ summary: 'Moteur 3D chiffré (script paramétrable)', description: 'Script JavaScript qui va chercher la clé puis déchiffre et expose window.GobaiEngine. La fabrique rend un objet 3D mutable (Soleil animé ou astre coloré), sans scène ni fond.' })
  // Type JavaScript, cache public : le script est identique à chaque démarrage.
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  bodyScript(): string {
    // Le script construit au démarrage.
    return this.engine.bodyScript();
  }

  // GET /api/v1/engine/key : la clé AES, servie au seul frontend (ou à un appel direct, sans origine).
  @Get('key')
  @ApiOperation({ summary: 'Clé de déchiffrement du moteur', description: 'Réservée au frontend de Gobai Space (origines CORS du serveur). Les autres sites reçoivent une erreur 403.' })
  // Jamais mise en cache partagée : la réponse dépend de l'origine.
  @Header('Cache-Control', 'no-store')
  key(@Req() req: Request): { key: string } {
    // Origine déclarée par le navigateur.
    const origin = req.headers.origin;
    // Autorisé : pas d'origine (appel serveur/direct) ou frontend ; tout autre site : refus.
    if (origin && !isFrontendOrigin(origin, this.config.corsOrigins)) throw new ForbiddenException('Le moteur n’est ouvert qu’au site Gobai Space.');
    // L'en-tête CORS du frontend est posé par le CORS global (voir common/cors.ts) : rien à ajouter ici.
    // La clé.
    return { key: this.engine.keyHex() };
  }
}
