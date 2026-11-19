/**
 * CORS fermé par défaut : seule une origine connue, ou une requête qui porte un jeton d'accès payé, reçoit
 * l'en-tête Access-Control-Allow-Origin. Les autres sites ne peuvent pas lire l'API depuis un navigateur.
 */
// Type de la requête Express.
import type { Request } from 'express';
// Lecture et vérification des jetons.
import { bearerToken, verifyJwt } from './jwt';
// Émetteur, destinataire et clé des jetons d'accès.
import { JWT_AUDIENCE, JWT_ISSUER, accessSecret } from './jwt.guard';
// Normalisation des origines.
import { normalizeOrigin } from './free-origins';

// Réponse CORS : origin vrai = l'origine de la requête est renvoyée, faux = aucun en-tête CORS.
type CorsAnswer = { origin: boolean };
// Fonction de rappel attendue par le paquet cors.
type CorsCallback = (err: Error | null, options: CorsAnswer) => void;

/** Vrai si la requête porte un jeton d'accès valide (émis après paiement). */
export function hasPaidToken(req: Pick<Request, 'headers'>): boolean {
  // Clé de signature ; absente : aucun accès payant possible.
  const secret = accessSecret();
  // Pas de clé : faux.
  if (!secret) return false;
  // Jeton de l'en-tête Authorization.
  const token = bearerToken(req.headers.authorization);
  // Pas de jeton : faux.
  if (!token) return false;
  // Vérifie signature, date, émetteur et destinataire ; toute erreur = faux.
  try { verifyJwt(token, secret, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE }); return true; } catch { return false; }
// Fin de hasPaidToken.
}

/** Délégué CORS : décide requête par requête d'après la liste d'origines autorisées. */
export function corsDelegate(allowed: string[]) {
  // Liste normalisée, pour comparer à l'identique.
  const list = new Set(allowed.map(normalizeOrigin).filter((o): o is string => Boolean(o)));
  // Fonction appelée par le paquet cors pour chaque requête.
  return (req: Request, callback: CorsCallback) => {
    // Origine déclarée par le navigateur.
    const origin = normalizeOrigin(req.headers.origin);
    // Origine connue (sites Gobai, baibai, CORS_ORIGIN) : autorisée.
    if (origin && list.has(origin)) return callback(null, { origin: true });
    // Pré-vérification OPTIONS d'un autre site : acceptée sans donnée, pour que le navigateur puisse envoyer son jeton.
    if (origin && req.method === 'OPTIONS') return callback(null, { origin: true });
    // Autre site avec un jeton payé valide : autorisé ; sinon refusé (false).
    return callback(null, { origin: Boolean(origin) && hasPaidToken(req) });
  // Fin du délégué.
  };
// Fin de corsDelegate.
}
