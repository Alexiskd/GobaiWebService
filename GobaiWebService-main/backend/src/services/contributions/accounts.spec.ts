// Fonctions testées : les comptes de contributeurs, leurs mots de passe et leurs sessions.
import {
  AccountError, bearerToken, checkPassword, cookieSessionToken, hashPassword, normalizePseudonym, pseudonymKey, signSession, verifyPassword, verifySession,
} from './accounts';

// Groupe de tests.
describe('accounts', () => {
  // Test : le nettoyage du pseudonyme.
  it('nettoie et borne le pseudonyme', () => {
    // Espaces des bords retirés, espaces intérieurs réduits.
    expect(normalizePseudonym('  Léa   Martin ')).toBe('Léa Martin');
    // Les accents sont gardés, les chiffres et le tiret acceptés.
    expect(normalizePseudonym('Alex-78_2')).toBe('Alex-78_2');
    // Trop court, trop long, ou caractères refusés.
    expect(() => normalizePseudonym('ab')).toThrow(AccountError);
    expect(() => normalizePseudonym('a'.repeat(25))).toThrow(AccountError);
    expect(() => normalizePseudonym('alex@example.com')).toThrow(AccountError);
    expect(() => normalizePseudonym(42)).toThrow(AccountError);
  // Fin du test.
  });

  // Test : la clé d'unicité.
  it('confond les pseudonymes qui ne diffèrent que par la casse ou les accents', () => {
    // Même clé pour trois écritures.
    expect(pseudonymKey('Léa Martin')).toBe('lea-martin');
    expect(pseudonymKey('LEA_MARTIN')).toBe('lea-martin');
    expect(pseudonymKey('lea-martin')).toBe('lea-martin');
    // Deux personnes différentes gardent deux clés différentes.
    expect(pseudonymKey('Alex')).not.toBe(pseudonymKey('Alexis'));
  // Fin du test.
  });

  // Test : la longueur du mot de passe.
  it('n’exige du mot de passe qu’une longueur', () => {
    // Accepté tel quel.
    expect(checkPassword('un-mot-de-passe')).toBe('un-mot-de-passe');
    // Trop court.
    expect(() => checkPassword('court')).toThrow(AccountError);
    // Absent.
    expect(() => checkPassword(undefined)).toThrow(AccountError);
  // Fin du test.
  });

  // Test : l'empreinte du mot de passe.
  it('garde une empreinte scrypt salée, jamais le mot de passe', () => {
    // Empreinte.
    const stored = hashPassword('un-mot-de-passe');
    // Forme attendue, et le mot de passe n'y apparaît pas.
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(stored).not.toContain('un-mot-de-passe');
    // Le bon mot de passe passe, un autre non.
    expect(verifyPassword('un-mot-de-passe', stored)).toBe(true);
    expect(verifyPassword('un-autre-mot-de-passe', stored)).toBe(false);
    // Une empreinte illisible ne passe jamais.
    expect(verifyPassword('un-mot-de-passe', 'bidon')).toBe(false);
    // Le sel change à chaque fois : deux empreintes du même mot de passe diffèrent.
    expect(hashPassword('un-mot-de-passe')).not.toBe(stored);
  // Fin du test.
  });

  // Test : les sessions.
  it('émet un JWT HS512 standard et refuse les signatures ou claims invalides', () => {
    const secret = 'test-session-signing-secret-at-least-32-bytes-long';
    const token = signSession({ id: 'i1', name: 'Léa', ver: 3 }, secret);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))).toMatchObject({
      alg: 'HS512', typ: 'JWT', kid: 'gobai-session-v2',
    });
    expect(verifySession(token, secret)).toMatchObject({ id: 'i1', name: 'Léa', ver: 3 });
    expect(verifySession(token, 'another-test-signing-secret-at-least-32-bytes-long')).toBeNull();
    expect(verifySession(`${token}x`, secret)).toBeNull();
    expect(verifySession('n’importe quoi', secret)).toBeNull();
    expect(verifySession(null, secret)).toBeNull();
    expect(verifySession(token, 'short')).toBeNull();
    const expired = signSession({ id: 'i', name: 'n' }, secret, 10, Date.now() - 20_000);
    expect(verifySession(expired, secret)).toBeNull();
  // Fin du test.
  });

  it('extrait uniquement le cookie gobai_session', () => {
    expect(cookieSessionToken('theme=night; gobai_session=abc.def.ghi; consent=1')).toBe('abc.def.ghi');
    expect(cookieSessionToken('theme=night; consent=1')).toBeNull();
    expect(cookieSessionToken('gobai_session=bad%20token')).toBeNull();
    expect(cookieSessionToken(undefined)).toBeNull();
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
