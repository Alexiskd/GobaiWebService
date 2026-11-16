/**
 * Contrôles du secret de signature : l'ordre des trois sources, et le fait qu'un secret rangé en base ne soit
 * jamais écrasé — c'est lui qui fait tenir les sessions et les clés d'API d'un redémarrage à l'autre.
 */
import { SESSION_SECRET_NAME, newSecret, resolveSessionSecret, type SecretStore } from './session-secret';

/** Un magasin en mémoire, qui compte ses écritures. */
function fakeStore(initial: string | null = null) {
  // Le secret rangé.
  let value = initial;
  // Nombre d'écritures acceptées.
  let writes = 0;
  // Le magasin, plus ses compteurs.
  return {
    async read() { return value; },
    async claim(_name: string, candidate: string) {
      // N'écrase jamais : le premier arrivé gagne.
      if (value === null) { value = candidate; writes += 1; }
      // Celui qui vaut.
      return value;
    },
    get value() { return value; },
    get writes() { return writes; },
  };
}

/** Un magasin en panne. */
const brokenStore: SecretStore = {
  async read() { throw new Error('base injoignable'); },
  async claim() { throw new Error('base injoignable'); },
};

describe('resolveSessionSecret', () => {
  it('prend la variable d’environnement quand elle est posée, sans toucher à la base', async () => {
    // Un magasin qui contient déjà autre chose.
    const store = fakeStore('secret-de-la-base');
    // La variable gagne.
    const { secret, source } = await resolveSessionSecret({ SESSION_SECRET: '  secret-pose-a-la-main  ' }, store);
    // Espaces retirés.
    expect(secret).toBe('secret-pose-a-la-main');
    // Et c'est bien elle qui a servi.
    expect(source).toBe('environnement');
    // La base n'a pas été écrite.
    expect(store.writes).toBe(0);
  });

  it('relit le secret rangé en base : c’est ce qui fait tenir les sessions d’un démarrage à l’autre', async () => {
    // Un magasin qui contient déjà un secret.
    const store = fakeStore('secret-deja-range');
    // Sans variable d'environnement.
    const { secret, source } = await resolveSessionSecret({}, store);
    // Le secret de la base.
    expect(secret).toBe('secret-deja-range');
    expect(source).toBe('base');
    // Rien n'a été écrit : on n'écrase pas un secret qui existe.
    expect(store.writes).toBe(0);
  });

  it('en tire un et le range au premier démarrage', async () => {
    // Un magasin vide.
    const store = fakeStore(null);
    // La résolution.
    const { secret, source } = await resolveSessionSecret({}, store);
    // Un secret neuf, assez long pour signer.
    expect(secret.length).toBeGreaterThan(40);
    expect(source).toBe('base');
    // Rangé, une seule fois.
    expect(store.value).toBe(secret);
    expect(store.writes).toBe(1);
  });

  it('donne le même secret à deux démarrages successifs', async () => {
    // Un magasin vide, partagé.
    const store = fakeStore(null);
    // Deux résolutions de suite, comme deux redéploiements.
    const first = await resolveSessionSecret({}, store);
    const second = await resolveSessionSecret({}, store);
    // Le même secret : les clés d'API délivrées entre les deux restent valables.
    expect(second.secret).toBe(first.secret);
    // Et une seule écriture.
    expect(store.writes).toBe(1);
  });

  it('retombe sur un secret éphémère sans base', async () => {
    // Aucun magasin.
    const { secret, source } = await resolveSessionSecret({}, null);
    // Un secret quand même, mais annoncé comme éphémère.
    expect(secret.length).toBeGreaterThan(40);
    expect(source).toBe('éphémère');
  });

  it('retombe sur un secret éphémère quand la base est en panne, sans empêcher le démarrage', async () => {
    // Un magasin qui lève.
    const { secret, source } = await resolveSessionSecret({}, brokenStore);
    // Le démarrage continue.
    expect(secret.length).toBeGreaterThan(40);
    expect(source).toBe('éphémère');
  });

  it('tire des secrets imprévisibles et de longueur stable', async () => {
    // Deux secrets neufs.
    const a = newSecret(), b = newSecret();
    // Différents.
    expect(a === b).toBe(false);
    // En base64url : 48 octets donnent 64 caractères, sans caractère à échapper dans une variable d'environnement.
    expect(a.length).toBe(64);
    expect(/^[A-Za-z0-9_-]+$/.test(a)).toBe(true);
  });

  it('range le secret sous un nom stable', () => {
    // Le nom ne doit pas bouger : il sert de clé en base.
    expect(SESSION_SECRET_NAME).toBe('session');
  });
});
