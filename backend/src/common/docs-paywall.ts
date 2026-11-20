/**
 * Verrou payant devant la documentation de l'API (/api/docs, Swagger UI, et /api/docs-json, son export JSON) :
 * elle détaille toutes les routes, y compris celles qu'on pourrait vouloir appeler sans payer. Même clé que les
 * exports (voir services/store/catalogue.ts) : le jeton JWT du produit « all » (« Tout le catalogue »), acheté sur
 * /api/v1/store. La consultation du site (gobaispace.com) n'est pas concernée : seule la documentation l'est.
 *
 * Swagger UI s'ouvre dans un navigateur, qui ne sait pas poser d'en-tête Authorization personnalisé sur une simple
 * navigation : le jeton est donc aussi accepté en paramètre d'adresse (« ?key=… »), en plus de l'en-tête Bearer
 * habituel des clients d'API.
 */
import type { NextFunction, Request, Response } from 'express';
// Site partenaire autorisé sans paiement : même règle que pour les exports.
import { isFreeOrigin } from './free-origins';
// Clé de signature des jetons d'accès, et émetteur/destinataire attendus.
import { accessSecret, JWT_AUDIENCE, JWT_ISSUER } from './jwt.guard';
// Vérification du jeton, et lecture d'un en-tête Bearer.
import { JwtError, bearerToken, verifyJwt } from './jwt';
// Droit « tout le catalogue », et la règle qui dit si un jeton le porte.
import { SCOPE_ALL, scopeAllows } from '../services/store/catalogue';

/** Jeton porté par la requête : en-tête Authorization, sinon le paramètre d'adresse « key ». */
function tokenFrom(req: Request): string | null {
  // En-tête Bearer, pour un client d'API.
  const header = bearerToken(req.headers.authorization);
  if (header) return header;
  // Paramètre d'adresse, pour une ouverture au navigateur.
  const key = (req.query as Record<string, unknown>).key;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
// Fin de tokenFrom.
}

/**
 * Middleware Express : laisse passer /api/docs et /api/docs-json seulement avec un jeton valide portant le droit
 * « all ». Toute autre adresse passe sans contrôle (ce n'est pas son rôle).
 */
export function docsPaywall(req: Request, res: Response, next: NextFunction): void {
  // Pas la documentation : rien à faire ici.
  if (!req.path.startsWith('/api/docs')) { next(); return; }
  // Site partenaire autorisé sans paiement.
  if (isFreeOrigin(req)) { next(); return; }
  // La clé de signature du serveur.
  const secret = accessSecret();
  // Sans clé configurée, aucun jeton ne peut être vérifié : mieux vaut fermer que laisser passer.
  if (!secret) { res.status(503).json({ error: 'Documentation indisponible : accès payant non configuré sur ce serveur.' }); return; }
  // Le jeton porté par la requête.
  const token = tokenFrom(req);
  // Aucun jeton : explique comment en obtenir un et comment le présenter à cette documentation précisément.
  if (!token) {
    res.status(401).json({
      error: 'Cette documentation est payante. Achetez la clé « Tout le catalogue » sur /api/v1/store/catalogue, '
        + 'puis ouvrez cette page avec ?key=<jeton>, ou envoyez-le en en-tête Authorization: Bearer.',
    });
    return;
  // Fin du cas sans jeton.
  }
  // Les droits du jeton.
  let claims;
  // Essaie de le vérifier.
  try {
    claims = verifyJwt(token, secret, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
  // Jeton refusé : le message dit pourquoi, sans rien révéler de la clé.
  } catch (e) {
    res.status(401).json({ error: e instanceof JwtError ? e.message : 'Jeton refusé.' });
    return;
  // Fin de l'essai.
  }
  // Le jeton ne porte pas le droit « all ».
  if (!scopeAllows(claims.scope as unknown[], SCOPE_ALL)) {
    res.status(403).json({ error: 'Ce jeton ne donne pas accès à la documentation (droit « all » requis).' });
    return;
  // Fin du contrôle.
  }
  // La requête passe.
  next();
// Fin de docsPaywall.
}
