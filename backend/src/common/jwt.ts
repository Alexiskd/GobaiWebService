/**
 * Jetons JWT (RFC 7519), signés HS256 (RFC 7515), sans dépendance : un en-tête, une charge utile et une
 * signature, chacun encodé en base64url et séparés par un point.
 *
 *     base64url({"alg":"HS256","typ":"JWT"}) . base64url(charge) . base64url(HMAC-SHA256(les deux premiers))
 *
 * Le JWT est la façon standard de transporter des informations vérifiables entre deux parties : le serveur
 * signe, n'importe qui peut lire la charge, mais personne ne peut la modifier sans la clé. Rien n'est conservé
 * côté serveur — le jeton porte lui-même ce qu'il affirme, y compris sa date d'expiration.
 *
 * Attention : la charge est seulement **signée**, pas chiffrée. Elle est lisible par le porteur du jeton ;
 * on n'y met donc jamais de secret.
 *
 * Pièges écartés ici :
 *  - algorithme imposé : un jeton qui annonce `none`, `RS256` ou autre chose que `HS256` est refusé, sans quoi
 *    un attaquant choisirait lui-même comment sa signature est vérifiée (confusion d'algorithme) ;
 *  - signature comparée en temps constant, pour ne pas la deviner octet par octet ;
 *  - `exp` et `nbf` contrôlés avec une tolérance d'horloge ;
 *  - `iss` et `aud` contrôlés quand ils sont attendus, pour qu'un jeton émis pour un autre service soit refusé.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/** Algorithme accepté, et le seul signé. */
export const JWT_ALG = 'HS256';
/** Tolérance d'horloge entre le serveur qui signe et celui qui vérifie, en secondes. */
export const CLOCK_SKEW_S = 60;
/** Taille maximale d'un jeton accepté : au-delà, inutile de calculer quoi que ce soit. */
const MAX_TOKEN_LENGTH = 8192;

/** Les champs normalisés d'un JWT (RFC 7519, § 4.1), plus ceux que l'application ajoute. */
export interface JwtClaims {
  /** Émetteur du jeton. */
  iss?: string;
  /** Sujet : qui le jeton désigne. */
  sub?: string;
  /** Destinataire attendu. */
  aud?: string;
  /** Expiration, en secondes depuis l'epoch Unix. */
  exp?: number;
  /** Pas valable avant, en secondes. */
  nbf?: number;
  /** Date d'émission, en secondes. */
  iat?: number;
  /** Identifiant unique du jeton. */
  jti?: string;
  /** Tout autre champ propre à l'application (droits accordés, nom d'affichage…). */
  [claim: string]: unknown;
}

/** Options de signature. */
export interface SignOptions {
  /** Durée de vie, en secondes. */
  expiresInSeconds?: number;
  /** Émetteur inscrit dans `iss`. */
  issuer?: string;
  /** Destinataire inscrit dans `aud`. */
  audience?: string;
  /** Instant de référence, en millisecondes (pour les tests). */
  now?: number;
}

/** Options de vérification. */
export interface VerifyOptions {
  /** Émetteur exigé. */
  issuer?: string;
  /** Destinataire exigé. */
  audience?: string;
  /** Instant de référence, en millisecondes (pour les tests). */
  now?: number;
}

/** Refus d'un jeton : le message dit pourquoi, sans rien révéler de la clé. */
export class JwtError extends Error {
  // Constructeur : garde le message.
  constructor(message: string) {
    // Message transmis à Error.
    super(message);
    // Nom de l'erreur.
    this.name = 'JwtError';
  // Fin du constructeur.
  }
// Fin de JwtError.
}

/** Encode un objet en base64url, sans remplissage (RFC 7515, § 2). */
const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

/** Signature HMAC-SHA256 des deux premières parties. */
const sign = (data: string, secret: string): Buffer => createHmac('sha256', secret).update(data).digest();

/** Signe un JWT HS256. Les champs passés en options l'emportent sur ceux de la charge. */
export function signJwt(claims: JwtClaims, secret: string, options: SignOptions = {}): string {
  // Clé obligatoire : sans elle, le jeton ne protégerait rien.
  if (!secret) throw new JwtError('Clé de signature absente.');
  // Instant d'émission, en secondes.
  const iat = Math.floor((options.now ?? Date.now()) / 1000);
  // La charge complète : les champs de l'application, puis les champs normalisés.
  const payload: JwtClaims = {
    ...claims,
    iat,
    jti: claims.jti ?? randomUUID(),
    ...(options.issuer ? { iss: options.issuer } : {}),
    ...(options.audience ? { aud: options.audience } : {}),
    ...(options.expiresInSeconds ? { exp: iat + options.expiresInSeconds } : {}),
  };
  // En-tête et charge encodés.
  const data = `${encode({ alg: JWT_ALG, typ: 'JWT' })}.${encode(payload)}`;
  // Le jeton complet.
  return `${data}.${sign(data, secret).toString('base64url')}`;
// Fin de signJwt.
}

/**
 * Vérifie un JWT et rend ses champs. Lève JwtError si la forme, l'algorithme, la signature, les dates,
 * l'émetteur ou le destinataire ne conviennent pas.
 */
export function verifyJwt(token: unknown, secret: string, options: VerifyOptions = {}): JwtClaims {
  // Clé obligatoire.
  if (!secret) throw new JwtError('Clé de signature absente.');
  // Forme générale : un texte de taille raisonnable.
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) throw new JwtError('Jeton absent ou trop long.');
  // Trois parties séparées par des points.
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new JwtError('Jeton mal formé : trois parties attendues.');
  // L'en-tête, lu avant toute autre chose.
  let header: { alg?: unknown; typ?: unknown };
  // Essaie de le lire.
  try {
    // En-tête décodé.
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  // Illisible.
  } catch {
    // Refus.
    throw new JwtError('En-tête du jeton illisible.');
  // Fin de l'essai.
  }
  // Seul HS256 est accepté : accepter l'algorithme annoncé laisserait choisir « none ».
  if (header?.alg !== JWT_ALG) throw new JwtError(`Algorithme refusé : seul ${JWT_ALG} est accepté.`);
  // Signature attendue et signature reçue.
  const expected = sign(`${parts[0]}.${parts[1]}`, secret);
  const got = Buffer.from(parts[2], 'base64url');
  // Comparaison en temps constant ; une longueur différente suffit à refuser.
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new JwtError('Signature du jeton invalide.');
  // La charge, une fois la signature établie.
  let claims: JwtClaims;
  // Essaie de la lire.
  try {
    // Charge décodée.
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  // Illisible.
  } catch {
    // Refus.
    throw new JwtError('Charge du jeton illisible.');
  // Fin de l'essai.
  }
  // Un objet est attendu, pas un nombre ni un tableau.
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw new JwtError('Charge du jeton inattendue.');
  // Instant de référence, en secondes.
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  // Expiration, avec la tolérance d'horloge.
  if (claims.exp !== undefined) {
    // Nombre attendu.
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) throw new JwtError('Date d’expiration inattendue.');
    // Jeton périmé.
    if (now > claims.exp + CLOCK_SKEW_S) throw new JwtError('Jeton expiré.');
  // Fin du contrôle d'expiration.
  }
  // Date d'entrée en vigueur.
  if (claims.nbf !== undefined) {
    // Nombre attendu.
    if (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf)) throw new JwtError('Date d’entrée en vigueur inattendue.');
    // Jeton pas encore valable.
    if (now + CLOCK_SKEW_S < claims.nbf) throw new JwtError('Jeton pas encore valable.');
  // Fin du contrôle.
  }
  // Émetteur exigé.
  if (options.issuer && claims.iss !== options.issuer) throw new JwtError('Émetteur du jeton refusé.');
  // Destinataire exigé.
  if (options.audience && claims.aud !== options.audience) throw new JwtError('Destinataire du jeton refusé.');
  // Les champs du jeton.
  return claims;
// Fin de verifyJwt.
}

/** Jeton porté par un en-tête « Authorization: Bearer … », ou null. */
export function bearerToken(header: unknown): string | null {
  // Texte attendu.
  if (typeof header !== 'string') return null;
  // Préfixe attendu, insensible à la casse.
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  // Le jeton, ou rien.
  return m ? m[1] : null;
// Fin de bearerToken.
}

/** Charge d'un jeton **sans vérifier sa signature** : pour afficher une date d'expiration, jamais pour décider. */
export function decodeJwtUnsafe(token: unknown): JwtClaims | null {
  // Texte attendu, en trois parties.
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  // Essaie de lire la charge.
  try {
    // La charge, telle quelle.
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  // Illisible.
  } catch {
    // Rien.
    return null;
  // Fin de l'essai.
  }
// Fin de decodeJwtUnsafe.
}
