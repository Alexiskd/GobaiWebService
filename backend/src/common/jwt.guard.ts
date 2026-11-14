/**
 * Protection des routes payantes par jeton JWT.
 *
 * Une route marquée `@RequiresScope('body:mars')` exige un en-tête `Authorization: Bearer <jeton>` dont la
 * charge porte ce droit dans son champ `scope`. Le jeton est émis par le serveur après paiement (voir
 * services/store) : il est signé, daté, et personne ne peut y ajouter un droit sans la clé.
 *
 * Le droit demandé peut dépendre du chemin : `@RequiresScope((req) => \`body:${req.params.body}\`)`.
 */
import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtError, bearerToken, verifyJwt } from './jwt';
import { scopeAllows } from '../services/store/catalogue';

/** Clé des métadonnées posées par le décorateur. */
export const SCOPE_KEY = 'gobai:requiredScope';

/** Droit exigé : une chaîne, ou une fonction qui la tire de la requête. */
export type ScopeRule = string | ((req: Request) => string);

/** Marque une route comme payante et dit quel droit elle exige. */
export const RequiresScope = (rule: ScopeRule) => SetMetadata(SCOPE_KEY, rule);

/** Émetteur inscrit dans les jetons, et destinataire attendu. */
export const JWT_ISSUER = 'gobai.space';
export const JWT_AUDIENCE = 'gobai-api';

/** Clé de signature des jetons d'accès : la même que celle des sessions du site. */
export const accessSecret = (env: NodeJS.ProcessEnv = process.env): string => env.SESSION_SECRET?.trim() || '';

// Garde injectable par NestJS.
@Injectable()
// Classe du garde des routes payantes.
export class ScopeGuard implements CanActivate {
  // Constructeur : NestJS y injecte le lecteur de métadonnées.
  constructor(private readonly reflector: Reflector) {}

  // canActivate : la requête a-t-elle le droit d'aller plus loin ?
  canActivate(context: ExecutionContext): boolean {
    // Le droit exigé par la route, s'il y en a un.
    const rule = this.reflector.get<ScopeRule | undefined>(SCOPE_KEY, context.getHandler());
    // Route libre : rien à vérifier.
    if (!rule) return true;
    // La requête.
    const req = context.switchToHttp().getRequest<Request>();
    // Le droit attendu pour cette requête.
    const needed = typeof rule === 'function' ? rule(req) : rule;
    // La clé de signature du serveur.
    const secret = accessSecret();
    // Sans clé configurée, aucun jeton ne peut être vérifié : mieux vaut fermer que laisser passer.
    if (!secret) throw new ServiceUnavailableException('Les accès payants ne sont pas configurés sur ce serveur.');
    // Le jeton porté par la requête.
    const token = bearerToken(req.headers.authorization);
    // Aucun jeton : la route dit comment en obtenir un.
    if (!token) throw new UnauthorizedException('Cette route demande un jeton d’accès. Achetez-en un sur /api/v1/store/catalogue.');
    // Les droits du jeton.
    let claims;
    // Essaie de le vérifier.
    try {
      // Vérification complète : algorithme, signature, dates, émetteur et destinataire.
      claims = verifyJwt(token, secret, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    // Jeton refusé : le message dit pourquoi, sans rien révéler de la clé.
    } catch (e) {
      // Erreur attendue.
      if (e instanceof JwtError) throw new UnauthorizedException(e.message);
      // Autre erreur : laissée remonter.
      throw e;
    // Fin de l'essai.
    }
    // Le jeton ne porte pas le droit demandé.
    if (!scopeAllows(claims.scope as unknown[], needed)) {
      // Refus, en nommant le droit manquant.
      throw new ForbiddenException(`Ce jeton ne donne pas accès à « ${needed} ».`);
    // Fin du contrôle.
    }
    // Les droits sont rangés sur la requête, pour la suite du traitement.
    (req as Request & { jwt?: unknown }).jwt = claims;
    // La requête passe.
    return true;
  // Fin de canActivate.
  }
// Fin du garde.
}
