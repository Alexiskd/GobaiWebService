/**
 * CORS fermé par défaut : seule une origine connue, ou un site externe ajouté à la liste payante
 * (`allowed_origins`, après achat de l'article « cors-site »), reçoit l'en-tête Access-Control-Allow-Origin.
 * Les autres sites ne peuvent pas lire l'API depuis un navigateur. C'est la **seule** protection de l'API
 * pour un usage externe : aucun jeton n'est vérifié ici (voir services/store/allowed-origins.service.ts).
 */
// Type de la requête Express.
import type { Request } from 'express';
// Normalisation des origines.
import { normalizeOrigin } from './free-origins';

// Réponse CORS : origin vrai = l'origine de la requête est renvoyée, faux = aucun en-tête CORS.
type CorsAnswer = { origin: boolean };
// Fonction de rappel attendue par le paquet cors.
type CorsCallback = (err: Error | null, options: CorsAnswer) => void;

/**
 * Délégué CORS : décide requête par requête d'après la liste d'origines connues (sites Gobai, baibai,
 * CORS_ORIGIN) et `isAllowedOrigin`, qui consulte la liste payante (AllowedOriginsService.isAllowed,
 * en mémoire, chargée depuis la table `allowed_origins`).
 */
export function corsDelegate(allowed: string[], isAllowedOrigin: (origin: string) => boolean) {
  // Liste normalisée, pour comparer à l'identique.
  const list = new Set(allowed.map(normalizeOrigin).filter((o): o is string => Boolean(o)));
  // Fonction appelée par le paquet cors pour chaque requête.
  return (req: Request, callback: CorsCallback) => {
    // Origine déclarée par le navigateur.
    const origin = normalizeOrigin(req.headers.origin);
    // Origine connue (sites Gobai, baibai, CORS_ORIGIN) : autorisée.
    if (origin && list.has(origin)) return callback(null, { origin: true });
    // Pré-vérification OPTIONS d'un autre site : acceptée sans donnée (la vraie requête qui suit reste filtrée).
    if (origin && req.method === 'OPTIONS') return callback(null, { origin: true });
    // Autre site : autorisé seulement s'il a payé son ajout à la liste CORS ; sinon refusé (false).
    return callback(null, { origin: Boolean(origin) && isAllowedOrigin(origin) });
  // Fin du délégué.
  };
// Fin de corsDelegate.
}
