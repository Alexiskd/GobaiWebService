/**
 * Service des contributions, en stockage mémoire (sans DATABASE_URL) : comptes, publication, votes et retrait.
 * Le même code sert les deux stockages ; la branche PostgreSQL n'est pas couverte ici.
 */
import { ContributionsService } from './contributions.service';

// Groupe de tests.
describe('ContributionsService (mémoire)', () => {
  /** En-tête de la dalle LiDAR HD de Beaubourg, telle que le navigateur la lirait. */
  const HEADER = { bounds: { minX: 652_000, minY: 6_862_000, minZ: 25.52, maxX: 653_000, maxY: 6_863_000, maxZ: 98.05 }, pointCount: 16_618_577, epsg: 2154 };
  /** Un fichier et son en-tête, prêts à publier. */
  const DALLE = { filename: 'LHD_FXX_0652_6863_PTS_C_LAMB93_IGN69.copc.laz', header: HEADER };

  // Le service, neuf à chaque test.
  let service: ContributionsService;

  // Avant chaque test : un service sans base de données, avec un secret de session fixe.
  beforeEach(() => {
    // Pas de base : stockage mémoire.
    delete process.env.DATABASE_URL;
    // Secret de signature fixe.
    process.env.SESSION_SECRET = 'test-session-signing-secret-at-least-32-bytes-long';
    // Le service, et son démarrage.
    service = new ContributionsService();
    service.onModuleInit();
  // Fin de beforeEach.
  });

  // Test : l'inscription.
  it('ouvre un compte et sa session sans courriel ni validation', async () => {
    // Inscription.
    const opened = await service.signup('Alex', 'un-mot-de-passe');
    // Le compte et le jeton.
    expect(opened.account.name).toBe('Alex');
    expect(opened.token).toBeTruthy();
    // La session est acceptée aussitôt : aucune validation à attendre.
    expect(await service.accountOf(opened.token)).toMatchObject({ name: 'Alex' });
    // Le stockage mémoire est signalé.
    expect(service.persistent).toBe(false);
  // Fin du test.
  });

  // Test : les refus de l'inscription.
  it('refuse un pseudonyme déjà pris, à la casse et aux accents près', async () => {
    // Premier compte.
    await service.signup('Léa', 'un-mot-de-passe');
    // Même pseudonyme sous une autre écriture.
    await expect(service.signup('lea', 'un-autre-mot-de-passe')).rejects.toThrow(/déjà pris/);
    // Pseudonyme ou mot de passe refusé.
    await expect(service.signup('b@d', 'un-mot-de-passe')).rejects.toThrow(/pseudonyme/i);
    await expect(service.signup('Bob', 'court')).rejects.toThrow(/mot de passe/i);
  // Fin du test.
  });

  // Test : la connexion.
  it('reconnaît le compte et refuse le mauvais mot de passe', async () => {
    // Compte créé.
    const created = await service.signup('Alex', 'un-mot-de-passe');
    // Connexion, espaces et casse pardonnés.
    expect((await service.login('  ALEX ', 'un-mot-de-passe')).account.id).toBe(created.account.id);
    // Mauvais mot de passe et compte inconnu : le même message.
    await expect(service.login('Alex', 'faux-mot-de-passe')).rejects.toThrow(/incorrect/);
    await expect(service.login('Inconnu', 'un-mot-de-passe')).rejects.toThrow(/incorrect/);
  // Fin du test.
  });

  it('révoque immédiatement un JWT lors de la déconnexion', async () => {
    const { account, token } = await service.signup('Alex', 'un-mot-de-passe');
    expect(await service.accountOf(token)).toMatchObject({ id: account.id });
    await service.revokeSessions(account.id);
    expect(await service.accountOf(token)).toBeNull();
    const reopened = await service.login('Alex', 'un-mot-de-passe');
    expect(await service.accountOf(reopened.token)).toMatchObject({ id: account.id });
  });

  // Test : les sessions refusées.
  it('refuse un jeton inconnu et exige un compte pour agir', async () => {
    // Jeton inventé.
    expect(await service.accountOf('jeton-bidon')).toBeNull();
    // Sans session, rien n'est possible.
    await expect(service.requireAccount(null)).rejects.toThrow(/Connectez-vous/);
  // Fin du test.
  });

  // Test : la publication.
  it('place une dalle LiDAR HD à partir du seul en-tête reçu', async () => {
    // Compte et publication.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    const created = await service.create(account, DALLE);
    // Position calculée par le serveur, conforme au manifeste de la dalle du dépôt.
    expect(created.anchor.lat).toBeCloseTo(48.8607816, 6);
    expect(created.anchor.lon).toBeCloseTo(2.3525702, 6);
    // Dalle IGN reconnue, emprise conservée, auteur et état de départ.
    expect(created.tile).toBe('LHD_FXX_0652_6863');
    expect(created.bounds).toEqual(HEADER.bounds);
    expect(created.author.name).toBe('Alex');
    expect(created.status).toBe('attente');
    expect(created.score).toBe(0);
    // À défaut de titre, le nom du fichier.
    expect(created.title).toBe(DALLE.filename);
  // Fin du test.
  });

  // Test : le refus d'un fichier non plaçable.
  it('refuse de publier un relevé qu’il ne sait pas placer', async () => {
    // Compte.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    // Coordonnées d'un autre système projeté.
    const ailleurs = { filename: 'releve.laz', header: { bounds: { minX: 500_000, minY: 4_600_000, minZ: 0, maxX: 500_100, maxY: 4_600_100, maxZ: 5 }, pointCount: 10 } };
    // Refus.
    await expect(service.create(account, ailleurs)).rejects.toThrow(/non reconnu/);
  // Fin du test.
  });

  // Test : les votes.
  it('valide un placement à partir de trois voix favorables', async () => {
    // Un auteur et trois votants.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    const placement = await service.create(account, DALLE);
    // Les votants.
    const voters = [];
    for (const name of ['Bea', 'Cyril', 'Dana']) voters.push((await service.signup(name, 'un-mot-de-passe')).account);
    // Dernier résultat de vote.
    let result = { up: 0, down: 0, score: 0, status: 'attente', myVote: 0 };
    // Chacun vote pour.
    for (const voter of voters) result = await service.vote(voter, placement.id, 1);
    // Trois voix favorables : le placement est validé.
    expect(result).toMatchObject({ up: 3, down: 0, score: 3, status: 'valide' });
  // Fin du test.
  });

  // Test : une seule voix par compte.
  it('ne compte qu’une voix par compte, et la même flèche la retire', async () => {
    // Un auteur, un placement, un votant.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    const placement = await service.create(account, DALLE);
    const { account: bea } = await service.signup('Bea', 'un-mot-de-passe');
    // Une voix pour.
    expect(await service.vote(bea, placement.id, 1)).toMatchObject({ up: 1, down: 0, myVote: 1 });
    // La même flèche à nouveau : la voix est retirée.
    expect(await service.vote(bea, placement.id, 1)).toMatchObject({ up: 0, down: 0, myVote: 0 });
    // L'autre flèche : la voix change de camp, sans jamais compter deux fois.
    expect(await service.vote(bea, placement.id, -1)).toMatchObject({ up: 0, down: 1, score: -1, myVote: -1 });
    expect(await service.vote(bea, placement.id, 1)).toMatchObject({ up: 1, down: 0, score: 1, myVote: 1 });
  // Fin du test.
  });

  // Test : le vote sur un placement inconnu.
  it('refuse un vote sur un placement inconnu', async () => {
    // Compte.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    // Identifiant qui n'existe pas.
    await expect(service.vote(account, '00000000-0000-4000-8000-000000000000', 1)).rejects.toThrow(/n’existe pas/);
  // Fin du test.
  });

  // Test : la liste.
  it('rend la voix du visiteur et trie la liste', async () => {
    // Un auteur, deux placements, un votant.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    const premier = await service.create(account, DALLE);
    const { account: bea } = await service.signup('Bea', 'un-mot-de-passe');
    // Bea approuve le premier placement.
    await service.vote(bea, premier.id, 1);
    // Puis publie un relevé en degrés, sans système déclaré.
    const second = await service.create(bea, {
      filename: 'releve.las',
      title: 'Relevé en degrés',
      header: { bounds: { minX: 2.34, minY: 48.85, minZ: 30, maxX: 2.36, maxY: 48.87, maxZ: 90 }, pointCount: 5 },
    });
    // Le système est reconnu à l'emprise, et la dalle IGN retrouvée.
    expect(second).toMatchObject({ crs: 'EPSG:4326', crsSource: 'deduit', tile: 'LHD_FXX_0652_6863' });
    // La voix du visiteur est rendue, et seulement la sienne.
    expect((await service.list('recent', bea.id)).find((i) => i.id === premier.id)?.myVote).toBe(1);
    expect((await service.list('recent', null)).find((i) => i.id === premier.id)?.myVote).toBe(0);
    // Récent : le dernier publié d'abord ; meilleur : le plus approuvé d'abord.
    expect((await service.list('recent', null))[0].id).toBe(second.id);
    expect((await service.list('meilleur', null))[0].id).toBe(premier.id);
  // Fin du test.
  });

  // Test : le retrait.
  it('ne laisse retirer un placement qu’à son auteur', async () => {
    // Deux comptes et un placement.
    const { account } = await service.signup('Alex', 'un-mot-de-passe');
    const { account: bea } = await service.signup('Bea', 'un-mot-de-passe');
    const placement = await service.create(account, DALLE);
    // Bea vote, puis essaie de retirer le placement d'Alex.
    await service.vote(bea, placement.id, 1);
    await expect(service.remove(bea, placement.id)).rejects.toThrow(/auteur|la vôtre/);
    // Alex le retire : il disparaît de la liste, avec ses voix.
    await service.remove(account, placement.id);
    expect(await service.list('recent', null)).toEqual([]);
  // Fin du test.
  });
// Fin du groupe.
});
