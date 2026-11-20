// Contrôleur du moteur chiffré : sert le script `body.js` (public) et la clé de déchiffrement (origines autorisées).
// Outils NestJS.
import { Controller, ForbiddenException, Get, Header, Req, Res } from '@nestjs/common';
// Requête et réponse Express.
import type { Request, Response } from 'express';
// Documentation OpenAPI.
import { ApiOperation, ApiTags } from '@nestjs/swagger';
// Service du moteur.
import { EngineService } from '../services/engine/engine.service';
// Origines autorisées sans paiement (sites Gobai, baibai, FREE_API_ORIGINS).
import { isFreeOrigin } from '../common/free-origins';
// Liste payante des sites externes autorisés en CORS (table allowed_origins).
import { AllowedOriginsService } from '../services/store/allowed-origins.service';

// Routes sous /api/v1/engine.
@ApiTags('Moteur')
@Controller('engine')
export class EngineController {
  // Injection des services.
  constructor(private readonly engine: EngineService, private readonly origins: AllowedOriginsService) {}

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

  // GET /api/v1/engine/key : la clé AES, servie aux seules origines autorisées (ou un site payant ajouté aux CORS, ou en appel direct sans origine).
  @Get('key')
  @ApiOperation({ summary: 'Clé de déchiffrement du moteur', description: 'Réservée aux origines autorisées (sites Gobai, baibai, FREE_API_ORIGINS) ou à un site externe ayant payé son ajout à la liste CORS (POST /store/cors-sites). Les autres reçoivent une erreur 403.' })
  // Jamais mise en cache partagée : la réponse dépend de l'origine.
  @Header('Cache-Control', 'no-store')
  key(@Req() req: Request, @Res({ passthrough: true }) res: Response): { key: string } {
    // Origine déclarée par le navigateur.
    const origin = req.headers.origin;
    // Autorisé : pas d'origine (appel serveur/direct), origine libre, ou site payant ajouté aux CORS.
    const allowed = !origin || isFreeOrigin(req) || this.origins.isAllowed(origin);
    // Sinon : refus.
    if (!allowed) throw new ForbiddenException('Le moteur n’est pas ouvert à cette origine. Achetez un accès sur /api/v1/store/catalogue ou demandez l’ajout de votre site.');
    // Écho de l'origine pour que le navigateur autorisé puisse lire la réponse (le CORS global le fait déjà pour les origines listées).
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    // La clé.
    return { key: this.engine.keyHex() };
  }
}
