// Fonctions testées : les jetons JWT signés HS256.
import { CLOCK_SKEW_S, JwtError, bearerToken, decodeJwtUnsafe, signJwt, verifyJwt } from './jwt';

// Groupe de tests.
describe('jwt', () => {
  /** Clé de signature des tests. */
  const SECRET = 'une-clé-de-signature-de-test';
  /** Instant de référence. */
  const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);

  // Test : la forme du jeton.
  it('écrit un jeton en trois parties, dont un en-tête HS256 lisible', () => {
    // Un jeton.
    const token = signJwt({ sub: 'client-1' }, SECRET, { now: NOW });
    // Trois parties séparées par des points.
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    // L'en-tête annonce l'algorithme et le type, comme l'exige la norme.
    expect(JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))).toEqual({ alg: 'HS256', typ: 'JWT' });
    // La charge est lisible par son porteur : elle est signée, pas chiffrée.
    expect(decodeJwtUnsafe(token)).toMatchObject({ sub: 'client-1' });
  // Fin du test.
  });

  // Test : les champs normalisés.
  it('ajoute les champs normalisés : émission, expiration, émetteur, destinataire, identifiant', () => {
    // Un jeton d'une heure.
    const token = signJwt({ sub: 'client-1' }, SECRET, {
      now: NOW, expiresInSeconds: 3600, issuer: 'gobai.space', audience: 'api',
    });
    // Les champs relus.
    const claims = verifyJwt(token, SECRET, { now: NOW, issuer: 'gobai.space', audience: 'api' });
    // Dates en secondes depuis l'epoch, et non en millisecondes.
    expect(claims.iat).toBe(Math.floor(NOW / 1000));
    expect(claims.exp).toBe(Math.floor(NOW / 1000) + 3600);
    // Émetteur, destinataire et identifiant unique.
    expect(claims.iss).toBe('gobai.space');
    expect(claims.aud).toBe('api');
    expect(typeof claims.jti).toBe('string');
    // Deux jetons de suite portent deux identifiants différents.
    expect(signJwt({}, SECRET).split('.')[1]).not.toBe(signJwt({}, SECRET).split('.')[1]);
  // Fin du test.
  });

  // Test : la signature.
  it('refuse un jeton signé d’une autre clé ou modifié', () => {
    // Un jeton.
    const token = signJwt({ sub: 'client-1', scope: ['all'] }, SECRET, { now: NOW });
    // Avec la bonne clé : accepté.
    expect(verifyJwt(token, SECRET, { now: NOW }).sub).toBe('client-1');
    // Avec une autre clé : refusé.
    expect(() => verifyJwt(token, 'une-autre-clé', { now: NOW })).toThrow(/[Ss]ignature/);
    // Charge modifiée : la signature ne correspond plus.
    const [h, , s] = token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'client-1', scope: ['all'], vol: true })).toString('base64url')}.${s}`;
    expect(() => verifyJwt(forged, SECRET, { now: NOW })).toThrow(JwtError);
  // Fin du test.
  });

  // Test : la confusion d'algorithme.
  it('refuse un jeton qui annonce un autre algorithme, « none » compris', () => {
    // Charge quelconque.
    const payload = Buffer.from(JSON.stringify({ sub: 'intrus', scope: ['all'] })).toString('base64url');
    // Un jeton « alg: none », sans signature : l'attaque classique.
    const none = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${payload}.`;
    expect(() => verifyJwt(none, SECRET, { now: NOW })).toThrow(/mal formé|Algorithme/);
    // Un jeton qui annonce RS256 mais signé HS256 avec la clé publique supposée : refusé sur l'algorithme.
    const rs = `${Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')}.${payload}`;
    expect(() => verifyJwt(`${rs}.signature`, SECRET, { now: NOW })).toThrow(/Algorithme refusé/);
  // Fin du test.
  });

  // Test : les dates.
  it('refuse un jeton expiré ou pas encore valable, avec une tolérance d’horloge', () => {
    // Un jeton d'une heure.
    const token = signJwt({ sub: 'client-1' }, SECRET, { now: NOW, expiresInSeconds: 3600 });
    // Pendant sa validité.
    expect(verifyJwt(token, SECRET, { now: NOW + 3_599_000 }).sub).toBe('client-1');
    // Juste après, dans la tolérance d'horloge.
    expect(verifyJwt(token, SECRET, { now: NOW + 3_600_000 + (CLOCK_SKEW_S - 1) * 1000 }).sub).toBe('client-1');
    // Au-delà : refusé.
    expect(() => verifyJwt(token, SECRET, { now: NOW + 3_600_000 + (CLOCK_SKEW_S + 2) * 1000 })).toThrow(/expiré/);
    // Un jeton qui n'entre en vigueur que plus tard.
    const later = signJwt({ nbf: Math.floor(NOW / 1000) + 600 }, SECRET, { now: NOW });
    expect(() => verifyJwt(later, SECRET, { now: NOW })).toThrow(/pas encore valable/);
    expect(verifyJwt(later, SECRET, { now: NOW + 601_000 })).toBeTruthy();
  // Fin du test.
  });

  // Test : l'émetteur et le destinataire.
  it('refuse un jeton émis pour un autre service', () => {
    // Un jeton destiné à l'API de ce site.
    const token = signJwt({}, SECRET, { now: NOW, issuer: 'gobai.space', audience: 'api' });
    // Le bon destinataire.
    expect(verifyJwt(token, SECRET, { now: NOW, issuer: 'gobai.space', audience: 'api' })).toBeTruthy();
    // Un autre émetteur ou un autre destinataire : refusé.
    expect(() => verifyJwt(token, SECRET, { now: NOW, issuer: 'autre.site' })).toThrow(/Émetteur/);
    expect(() => verifyJwt(token, SECRET, { now: NOW, audience: 'autre-api' })).toThrow(/Destinataire/);
  // Fin du test.
  });

  // Test : les formes inattendues.
  it('refuse tout ce qui n’est pas un jeton', () => {
    // Valeurs qui ne sont pas des jetons.
    for (const bad of [null, undefined, 42, '', 'a.b', 'a.b.c.d', 'x'.repeat(9000)]) {
      // Chacune est refusée sans exception non maîtrisée.
      expect(() => verifyJwt(bad as unknown, SECRET, { now: NOW })).toThrow(JwtError);
    // Fin des valeurs.
    }
    // Une clé vide ne doit jamais servir à signer ni à vérifier.
    expect(() => signJwt({}, '')).toThrow(/Clé de signature/);
    expect(() => verifyJwt(signJwt({}, SECRET), '')).toThrow(/Clé de signature/);
  // Fin du test.
  });

  // Test : l'en-tête Authorization.
  it('lit le jeton de l’en-tête Authorization', () => {
    // Avec le préfixe attendu, quelle que soit la casse.
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer  abc')).toBe('abc');
    // Sans préfixe, ou sans en-tête.
    expect(bearerToken('abc')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  // Fin du test.
  });
// Fin du groupe.
});
