/**
 * Sites partenaires autorisés à utiliser l'API sans payer : les routes payantes les laissent passer sans jeton, et ils
 * sont ajoutés aux origines CORS. Liste par défaut, plus la variable FREE_API_ORIGINS (séparées par des virgules).
 */
import type { Request } from 'express';

/** Sites partenaires autorisés à utiliser les routes payantes sans jeton (en plus de FREE_API_ORIGINS). */
export const FREE_API_ORIGINS_DEFAULT = ['https://baibai-qp76.onrender.com'];

/** Origine normalisée (schéma + hôte + port, en minuscules), ou null si l'adresse est illisible. */
export function normalizeOrigin(value: unknown): string | null {
  // Pas un texte : rien.
  if (typeof value !== 'string' || !value.trim()) return null;
  // Lit l'adresse ; seule l'origine est gardée.
  try { const u = new URL(value.trim()); return /^https?:$/.test(u.protocol) ? u.origin.toLowerCase() : null; } catch { return null; }
// Fin de normalizeOrigin.
}

/** Sites autorisés sans paiement : la liste par défaut plus FREE_API_ORIGINS (séparés par des virgules). */
export function freeApiOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  // Origines de la variable d'environnement.
  const extra = (env.FREE_API_ORIGINS ?? '').split(',');
  // Toutes, normalisées, sans doublon.
  return [...new Set([...FREE_API_ORIGINS_DEFAULT, ...extra].map(normalizeOrigin).filter((o): o is string => Boolean(o)))];
// Fin de freeApiOrigins.
}

/**
 * Vrai si la requête vient d'un site autorisé sans paiement : en-tête Origin, sinon Referer. Un navigateur ne laisse
 * pas une page modifier ces en-têtes ; un programme hors navigateur peut les imiter : c'est un accès de confiance.
 */
export function isFreeOrigin(req: Pick<Request, 'headers'>, env: NodeJS.ProcessEnv = process.env): boolean {
  // Origine déclarée par le navigateur, sinon celle de la page d'où vient la requête.
  const origin = normalizeOrigin(req.headers.origin) ?? normalizeOrigin(req.headers.referer);
  // Dans la liste : vrai.
  return Boolean(origin) && freeApiOrigins(env).includes(origin as string);
// Fin de isFreeOrigin.
}
