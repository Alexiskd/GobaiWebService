/**
 * CORS de l'API : l'API est gratuite, tout site peut la lire depuis un navigateur.
 * Chaque requête reçoit l'en-tête Access-Control-Allow-Origin avec sa propre origine.
 */
// Type de la requête Express.
import type { Request } from 'express';

// Réponse CORS : origin vrai = l'origine de la requête est renvoyée, faux = aucun en-tête CORS.
type CorsAnswer = { origin: boolean };
// Fonction de rappel attendue par le paquet cors.
type CorsCallback = (err: Error | null, options: CorsAnswer) => void;

/**
 * Délégué CORS : API gratuite, toute origine est acceptée.
 * La liste `_allowed` (sites Gobai, baibai, CORS_ORIGIN) est gardée dans la signature pour ne rien changer chez l'appelant.
 */
export function corsDelegate(_allowed: string[]) {
  // Fonction appelée par le paquet cors pour chaque requête : toujours autorisée.
  return (_req: Request, callback: CorsCallback) => callback(null, { origin: true });
// Fin de corsDelegate.
}
