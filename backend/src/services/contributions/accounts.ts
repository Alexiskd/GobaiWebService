/**
 * Comptes des contributeurs : inscription et connexion par pseudonyme et mot de passe, sans adresse de courriel
 * et sans validation. Le serveur ne garde jamais le mot de passe : seulement une empreinte scrypt salée.
 * La session est un jeton signé (HMAC-SHA256) porté par l'en-tête `Authorization: Bearer …` : rien n'est
 * enregistré côté serveur, le jeton porte lui-même son compte et sa date d'expiration.
 *
 * Tout ici est pur et testable : le stockage est ailleurs (contributions.service.ts).
 */
import { createHmac, hkdfSync, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

/** Longueurs acceptées pour un pseudonyme. */
export const PSEUDONYM_MIN = 3;
export const PSEUDONYM_MAX = 24;
/** Longueurs acceptées pour un mot de passe. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
/** Durée de vie d'une session (30 jours, en secondes). */
export const SESSION_TTL_SECONDS = 30 * 24 * 3600;

/** Coût de scrypt : 16 384 tours, blocs de 8, une seule voie ; environ 30 ms par vérification. */
const SCRYPT = { N: 16_384, r: 8, p: 1, keyLength: 32 };

/** Refus d'un identifiant ou d'un mot de passe : le message est montré tel quel à la personne. */
export class AccountError extends Error {}

/**
 * Pseudonyme nettoyé : espaces des bords retirés, espaces intérieurs réduits à un seul.
 * Lettres (accents compris), chiffres, tiret, tiret bas et espace simple sont acceptés.
 */
export function normalizePseudonym(raw: unknown): string {
  // Texte attendu.
  if (typeof raw !== 'string') throw new AccountError('Pseudonyme manquant.');
  // Espaces réduits.
  const name = raw.trim().replace(/\s+/g, ' ');
  // Longueur.
  if (name.length < PSEUDONYM_MIN || name.length > PSEUDONYM_MAX) {
    throw new AccountError(`Le pseudonyme doit faire de ${PSEUDONYM_MIN} à ${PSEUDONYM_MAX} caractères.`);
  }
  // Caractères autorisés.
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) throw new AccountError('Le pseudonyme n’accepte que des lettres, des chiffres, l’espace, le tiret et le tiret bas.');
  // Le pseudonyme retenu.
  return name;
}

/** Clé d'unicité d'un pseudonyme : minuscules sans accent, pour que « Léa » et « lea » soient le même compte. */
export function pseudonymKey(name: string): string {
  // Décomposition Unicode, accents retirés, minuscules, espaces et tirets unifiés.
  return name.normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[ _-]+/g, '-');
}

/** Mot de passe accepté ? Aucune règle de composition : seule la longueur compte. */
export function checkPassword(raw: unknown): string {
  // Texte attendu.
  if (typeof raw !== 'string') throw new AccountError('Mot de passe manquant.');
  // Longueur.
  if (raw.length < PASSWORD_MIN || raw.length > PASSWORD_MAX) {
    throw new AccountError(`Le mot de passe doit faire de ${PASSWORD_MIN} à ${PASSWORD_MAX} caractères.`);
  }
  // Le mot de passe tel quel.
  return raw;
}

/** Empreinte d'un mot de passe : « scrypt$N$r$p$sel$empreinte », tout en base64url. */
export function hashPassword(password: string, salt: Buffer = randomBytes(16)): string {
  // Dérivation scrypt.
  const key = scryptSync(password, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  // Forme stockée.
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

/** Le mot de passe correspond-il à l'empreinte stockée ? Comparaison à temps constant. */
export function verifyPassword(password: string, stored: string): boolean {
  // Découpe la forme stockée.
  const parts = stored.split('$');
  // Cinq séparateurs attendus, et l'algorithme connu.
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  // Paramètres et sel.
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  // Paramètres plausibles (bornes larges, mais finies).
  if (![N, r, p].every((v) => Number.isInteger(v) && v > 0) || N > 1 << 20 || r > 64 || p > 16) return false;
  // Essaie la dérivation : un sel ou une empreinte illisible fait échouer la comparaison.
  try {
    // Sel et empreinte attendue.
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    // Dérivation avec les mêmes paramètres.
    const key = scryptSync(password, salt, expected.length, { N, r, p });
    // Comparaison à temps constant.
    return key.length === expected.length && timingSafeEqual(key, expected);
  // Forme illisible.
  } catch {
    // Refus.
    return false;
  // Fin de l'essai.
  }
}

/**
 * Claims d'une session JWT. Le jeton est signé, pas chiffré : aucun secret ni mot de passe ne doit y être placé.
 * `ver` correspond à contribution_accounts.session_version et permet la révocation immédiate.
 */
export interface SessionPayload { id: string; name: string; exp: number; ver: number; jti: string }

const SESSION_ISSUER = 'https://www.gobaispace.com';
const SESSION_AUDIENCE = 'gobai-space-app';
const SESSION_KEY_ID = 'gobai-session-v2';
const SESSION_KDF_SALT = Buffer.from('Gobai Space / JWT v2', 'utf8');
const SESSION_KDF_INFO = Buffer.from('HS512 session signing key', 'utf8');

/**
 * Dérive une clé HS512 de 64 octets d'un secret maître aléatoire d'au moins 32 octets.
 * Le contexte HKDF sépare cryptographiquement la signature des sessions des autres usages de SESSION_SECRET.
 */
function sessionSigningKey(secret: string): Buffer {
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new AccountError('SESSION_SECRET doit contenir au moins 32 octets aléatoires.');
  return Buffer.from(hkdfSync('sha512', Buffer.from(secret, 'utf8'), SESSION_KDF_SALT, SESSION_KDF_INFO, 64));
}

/**
 * JWT compact standard signé HS512. Algorithme explicitement fixé, identifiant de clé versionné et claims
 * d'émetteur, audience, sujet, dates, identifiant unique et version de révocation.
 */
export function signSession(
  payload: { id: string; name: string; ver?: number },
  secret: string,
  ttlSeconds = SESSION_TTL_SECONDS,
  now = Date.now(),
): string {
  const signingKey = sessionSigningKey(secret);
  const issuedAt = Math.floor(now / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT', kid: SESSION_KEY_ID })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: SESSION_ISSUER,
    aud: SESSION_AUDIENCE,
    sub: payload.id,
    name: payload.name,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: randomUUID(),
    ver: Number.isInteger(payload.ver) && (payload.ver as number) >= 0 ? payload.ver : 0,
  })).toString('base64url');
  const signingInput = `${header}.${claims}`;
  const signature = createHmac('sha512', signingKey).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

/** Retourne les claims seulement si le JWT, son algorithme, son audience et ses dates sont valides. */
export function verifySession(token: unknown, secret: string, now = Date.now()): SessionPayload | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  const [encodedHeader, encodedClaims, signature] = parts;
  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (header.alg !== 'HS512' || header.typ !== 'JWT' || header.kid !== SESSION_KEY_ID) return null;

    const expected = createHmac('sha512', sessionSigningKey(secret)).update(`${encodedHeader}.${encodedClaims}`).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

    const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8')) as Record<string, unknown>;
    const nowSeconds = Math.floor(now / 1000);
    if (claims.iss !== SESSION_ISSUER || claims.aud !== SESSION_AUDIENCE) return null;
    if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.name !== 'string' || !claims.name) return null;
    if (typeof claims.jti !== 'string' || !claims.jti || !Number.isInteger(claims.ver) || (claims.ver as number) < 0) return null;
    if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)) return null;
    if ((claims.iat as number) > nowSeconds + 60 || (claims.exp as number) <= nowSeconds) return null;
    if ((claims.exp as number) <= (claims.iat as number) || (claims.exp as number) - (claims.iat as number) > SESSION_TTL_SECONDS) return null;

    return {
      id: claims.sub,
      name: claims.name,
      exp: claims.exp as number,
      ver: claims.ver as number,
      jti: claims.jti,
    };
  } catch {
    return null;
  }
}

/** Lit la session du cookie HttpOnly, sans jamais exposer cette valeur au code navigateur. */
export function cookieSessionToken(cookieHeader: unknown): string | null {
  if (typeof cookieHeader !== 'string' || cookieHeader.length > 16_384) return null;
  const entry = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('gobai_session='));
  if (!entry) return null;
  const value = entry.slice('gobai_session='.length);
  return value && value.length <= 4096 && /^[A-Za-z0-9_.-]+$/.test(value) ? value : null;
}

/** Jeton porté par un en-tête « Authorization: Bearer … », ou null. */
export function bearerToken(header: unknown): string | null {
  // Texte attendu.
  if (typeof header !== 'string') return null;
  // Préfixe attendu, insensible à la casse.
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  // Le jeton, ou rien.
  return m ? m[1] : null;
}
