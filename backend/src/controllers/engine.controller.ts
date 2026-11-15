// Contrôleur du moteur chiffré : sert le script `body.js` et la clé de déchiffrement, tous deux publics (API gratuite).
// Outils NestJS.
import { Controller, Get, Header, Req, Res } from '@nestjs/common';
// Requête et réponse Express.
import type { Request, Response } from 'express';
// Documentation OpenAPI.
import { ApiOperation, ApiTags } from '@nestjs/swagger';
// Service du moteur.
import { EngineService } from '../services/engine/engine.service';

// Routes sous /api/v1/engine.
@ApiTags('Moteur')
@Controller('engine')
export class EngineController {
  // Injection du service.
  constructor(private readonly engine: EngineService) {}

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

  // GET /api/v1/engine/key : la clé AES, servie à toute origine (API gratuite).
  @Get('key')
  @ApiOperation({ summary: 'Clé de déchiffrement du moteur', description: 'Publique : servie à toute origine, l’API est gratuite.' })
  // Jamais mise en cache partagée : la réponse dépend de l'origine.
  @Header('Cache-Control', 'no-store')
  key(@Req() req: Request, @Res({ passthrough: true }) res: Response): { key: string } {
    // Origine déclarée par le navigateur.
    const origin = req.headers.origin;
    // Écho de l'origine pour que le navigateur puisse lire la réponse (le CORS global le fait déjà).
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    // La clé.
    return { key: this.engine.keyHex() };
  }
}
