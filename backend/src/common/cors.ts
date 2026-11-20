/**
 * CORS fermé : seul le frontend de Gobai Space (les origines de `config.corsOrigins` : sites Gobai et CORS_ORIGIN)
 * reçoit l'en-tête Access-Control-Allow-Origin, pré-vérifications OPTIONS comprises. Aucun autre site ne peut lire
 * l'API depuis un navigateur.
 */
// Type de la requête Express.
import type { Request } from 'express';
// Normalisation des origines.
import { normalizeOrigin } from './free-origins';

// Réponse CORS : origin vrai = l'origine de la requête est renvoyée, faux = aucun en-tête CORS.
type CorsAnswer = { origin: boolean };
// Fonction de rappel attendue par le paquet cors.
type CorsCallback = (err: Error | null, options: CorsAnswer) => void;

/** Vrai si l'origine fait partie de la liste du frontend (comparaison sur l'origine normalisée). */
export function isFrontendOrigin(origin: unknown, allowed: readonly string[]): boolean {
  const o = normalizeOrigin(origin);
  return o !== null && allowed.some((a) => normalizeOrigin(a) === o);
}

/** Délégué CORS : autorise uniquement les origines du frontend. */
export function corsDelegate(allowed: string[]) {
  // Liste normalisée, pour comparer à l'identique.
  const list = new Set(allowed.map(normalizeOrigin).filter((o): o is string => Boolean(o)));
  // Fonction appelée par le paquet cors pour chaque requête.
  return (req: Request, callback: CorsCallback) => {
    // Origine déclarée par le navigateur, normalisée.
    const origin = normalizeOrigin(req.headers.origin);
    // Frontend : autorisé ; tout autre site (pré-vérification comprise) : refusé.
    return callback(null, { origin: origin !== null && list.has(origin) });
  // Fin du délégué.
  };
// Fin de corsDelegate.
}
