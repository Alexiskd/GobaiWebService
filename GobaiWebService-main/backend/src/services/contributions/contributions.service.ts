/**
 * Contributions de placement LiDAR : comptes, placements et votes.
 *
 * Ce que garde le serveur : le compte (pseudonyme et empreinte du mot de passe), la position calculée d'un relevé
 * (emprise, calage GPS, dalle IGN) et les voix. Le fichier LAS/LAZ lui-même n'est jamais envoyé : seul son en-tête
 * sert, et il reste sur l'appareil du contributeur. Une contribution décrit donc *où* se trouve un relevé, pas
 * le relevé lui-même.
 *
 * Stockage : PostgreSQL quand DATABASE_URL est renseigné (comme la galerie) ; sinon en mémoire, pour le
 * développement local — tout est alors perdu au redémarrage, et le journal le dit au démarrage.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AccountError, checkPassword, hashPassword, normalizePseudonym, pseudonymKey, signSession, verifyPassword, verifySession } from './accounts';
import { PlacementError, placeFromHeader, storedBounds, type LasHeaderInput } from './placement';
import { SortMode, netScore, placementStatus, sortContributions } from './ranking';
import type { Bounds } from './lambert93';

/** Un compte de contributeur, tel qu'il sort du stockage. */
export interface Account { id: string; name: string; createdAt: Date }

/** Une contribution, telle qu'elle est rendue par l'API. */
export interface Contribution {
  id: string;
  title: string;
  filename: string;
  note: string;
  pointCount: number;
  crs: string;
  crsSource: string;
  tile: string | null;
  anchor: { lat: number; lon: number; alt: number; heading: number };
  bounds: Bounds;
  sizeMeters: number[];
  footprint: { lat: number; lon: number }[];
  author: { id: string; name: string };
  up: number;
  down: number;
  score: number;
  status: string;
  myVote: number;
  createdAt: Date;
}

/** Ce que le navigateur envoie pour publier un placement. */
export interface CreateContributionInput {
  title?: string;
  filename: string;
  note?: string;
  header: LasHeaderInput;
}

/** Longueurs maximales des textes libres. */
const MAX_TITLE = 100;
const MAX_NOTE = 500;
const MAX_FILENAME = 200;

/** Nombre maximal de contributions renvoyées par la liste. */
export const MAX_LIST = 200;
/** Nombre maximal de contributions par compte : borne simple contre l'inondation. */
export const MAX_PER_ACCOUNT = 100;

/**
 * Schéma PostgreSQL. Trois tables :
 *  - `contribution_accounts` : le compte, son pseudonyme affiché, sa clé d'unicité (minuscules sans accent) et
 *    l'empreinte scrypt de son mot de passe ; aucune adresse de courriel n'est demandée ni stockée ;
 *  - `contributions` : un placement, avec la position calculée par le serveur et l'emprise du relevé ;
 *  - `contribution_votes` : une voix par compte et par contribution (clé primaire des deux colonnes).
 * Les index servent le tri par date et le comptage des voix.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS contribution_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    session_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE contribution_accounts ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE IF NOT EXISTS contributions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES contribution_accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    point_count BIGINT NOT NULL,
    crs TEXT NOT NULL,
    crs_source TEXT NOT NULL,
    tile TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    alt DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION NOT NULL,
    bounds JSONB NOT NULL,
    size_meters JSONB NOT NULL,
    footprint JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS contribution_votes (
    contribution_id TEXT NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES contribution_accounts(id) ON DELETE CASCADE,
    value SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contribution_id, account_id)
  );
  CREATE INDEX IF NOT EXISTS contributions_created_at ON contributions (created_at DESC);
  CREATE INDEX IF NOT EXISTS contribution_votes_contribution ON contribution_votes (contribution_id);
`;

/** Ligne de la table des contributions, jointe à son auteur et à ses voix. */
interface Row {
  id: string; title: string; filename: string; note: string; point_count: string; crs: string; crs_source: string;
  tile: string | null; lat: number; lon: number; alt: number; heading: number;
  bounds: Bounds; size_meters: number[]; footprint: { lat: number; lon: number }[];
  created_at: Date; account_id: string; author: string; up: string; down: string; my_vote: number | null;
}

/** Texte nettoyé et borné. */
const text = (raw: unknown, max: number): string => (typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, max) : '');

// Service injecté par NestJS.
@Injectable()
// Classe du service des contributions.
export class ContributionsService implements OnModuleInit, OnModuleDestroy {
  // Journal du service.
  private readonly logger = new Logger(ContributionsService.name);
  // Groupe de connexions PostgreSQL, ou null (stockage en mémoire).
  private readonly pool: Pool | null = null;
  // Secret de signature des sessions.
  private readonly secret: string;
  // Stockage en mémoire, utilisé seulement sans base de données.
  private readonly memory = {
    accounts: new Map<string, Account & { nameKey: string; password: string; sessionVersion: number }>(),
    contributions: new Map<string, Omit<Contribution, 'up' | 'down' | 'score' | 'status' | 'myVote'> & { accountId: string }>(),
    votes: new Map<string, number>(),
  };
  // Le schéma a-t-il été créé ?
  private ready: Promise<void> | null = null;

  // Constructeur : prépare la connexion et le secret de session.
  constructor() {
    // Adresse de la base, si elle est configurée.
    const url = process.env.DATABASE_URL?.trim();
    // Base configurée : un petit groupe de connexions, chiffré chez Render.
    if (url) {
      // Le groupe.
      this.pool = new Pool({ connectionString: url, max: 4, ssl: url.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      // Une panne de connexion est signalée sans arrêter le serveur.
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    // Fin du cas avec base.
    }
    // Secret de signature : celui du serveur, ou un secret tiré au hasard au démarrage.
    const configured = process.env.SESSION_SECRET?.trim();
    // Le secret retenu.
    this.secret = configured || randomBytes(32).toString('base64url');
    // Sans secret configuré, les sessions ne survivent pas à un redémarrage : le journal le dit.
    if (!configured) this.logger.warn('SESSION_SECRET absent : les sessions des contributeurs seront perdues au redémarrage du serveur.');
  // Fin du constructeur.
  }

  // Au démarrage du module : crée le schéma, ou annonce le stockage en mémoire.
  onModuleInit(): void {
    // Avec base : crée les tables tout de suite, sans retarder le démarrage. Un échec est seulement journalisé
    // (et non laissé en promesse rejetée, ce qui arrêterait le serveur) : la création est retentée à la
    // première requête.
    if (this.pool) void this.db().catch((e: Error) => this.logger.warn(`Contributions : schéma non créé (${e.message}). Nouvelle tentative à la première requête.`));
    // Sans base : avertit que rien ne sera conservé.
    else this.logger.warn('DATABASE_URL absent : les contributions et les comptes sont gardés en mémoire et perdus au redémarrage.');
  // Fin de onModuleInit.
  }

  // À l'arrêt du module : ferme les connexions.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Le stockage est-il durable (PostgreSQL) ? */
  get persistent(): boolean { return this.pool !== null; }

  // Attend la création du schéma, faite une seule fois ; une création échouée est retentée à l'appel suivant.
  private async db(): Promise<Pool> {
    // Base attendue.
    const pool = this.pool!;
    // Première requête, ou reprise après un échec : (re)lance la création du schéma.
    if (!this.ready) {
      // La création, dont l'échec libère la place pour un nouvel essai.
      this.ready = pool.query(SCHEMA).then(() => undefined).catch((e: Error) => {
        // Prochain appel : nouvelle tentative.
        this.ready = null;
        // Et une erreur claire pour celui-ci.
        throw new ServiceUnavailableException(`Contributions indisponibles : la base de données n’a pas répondu (${e.message}).`);
      // Fin de la création.
      });
    // Fin du lancement.
    }
    // Attend la création.
    await this.ready;
    // Le groupe de connexions.
    return pool;
  // Fin de db.
  }

  // ───────────────────────── Comptes ─────────────────────────

  /** Inscription : pseudonyme et mot de passe, sans courriel ni validation. Renvoie la session. */
  async signup(rawName: unknown, rawPassword: unknown): Promise<{ token: string; account: Account }> {
    // Pseudonyme et mot de passe vérifiés.
    const name = this.check(() => normalizePseudonym(rawName));
    const password = this.check(() => checkPassword(rawPassword));
    // Clé d'unicité, empreinte et identifiant.
    const key = pseudonymKey(name);
    const hash = hashPassword(password);
    const id = randomUUID();
    // Avec base : insertion refusée si le pseudonyme est pris.
    if (this.pool) {
      // La base.
      const pool = await this.db();
      // Insertion, sans erreur si la clé existe déjà.
      const { rowCount } = await pool.query(
        'INSERT INTO contribution_accounts (id, name, name_key, password) VALUES ($1, $2, $3, $4) ON CONFLICT (name_key) DO NOTHING',
        [id, name, key, hash],
      );
      // Rien inséré : le pseudonyme est déjà pris.
      if (!rowCount) throw new ConflictException('Ce pseudonyme est déjà pris.');
    // Sans base : même règle, en mémoire.
    } else {
      // Pseudonyme déjà pris ?
      if ([...this.memory.accounts.values()].some((a) => a.nameKey === key)) throw new ConflictException('Ce pseudonyme est déjà pris.');
      // Enregistre le compte.
      this.memory.accounts.set(id, { id, name, nameKey: key, password: hash, sessionVersion: 0, createdAt: new Date() });
    // Fin du cas sans base.
    }
    // Le compte créé.
    const account: Account = { id, name, createdAt: new Date() };
    // Session ouverte aussitôt : aucune validation à attendre.
    return { token: signSession({ id, name, ver: 0 }, this.secret), account };
  // Fin de signup.
  }

  /** Connexion : pseudonyme et mot de passe. Renvoie la session. */
  async login(rawName: unknown, rawPassword: unknown): Promise<{ token: string; account: Account }> {
    // Textes attendus, sans révéler laquelle des deux valeurs est fausse.
    if (typeof rawName !== 'string' || typeof rawPassword !== 'string') throw new UnauthorizedException('Pseudonyme ou mot de passe incorrect.');
    // Clé d'unicité du pseudonyme donné.
    const key = pseudonymKey(rawName.trim().replace(/\s+/g, ' '));
    // Compte correspondant, s'il existe : lu dans la base, ou en mémoire.
    const row = this.pool
      ? (await (await this.db()).query<{ id: string; name: string; password: string; session_version: number; created_at: Date }>(
        'SELECT id, name, password, session_version, created_at FROM contribution_accounts WHERE name_key = $1', [key],
      )).rows[0]
      : undefined;
    // En mémoire, le compte de même clé.
    const kept = this.pool ? undefined : [...this.memory.accounts.values()].find((a) => a.nameKey === key);
    // Le compte trouvé, sous une forme unique.
    const found = row
      ? { id: row.id, name: row.name, password: row.password, sessionVersion: Number(row.session_version) || 0, createdAt: row.created_at }
      : kept
        ? { id: kept.id, name: kept.name, password: kept.password, sessionVersion: kept.sessionVersion, createdAt: kept.createdAt }
        : null;
    // Empreinte à vérifier : celle du compte, ou une empreinte factice pour garder le même temps de réponse
    // qu'un compte existant (un pseudonyme inconnu ne se reconnaît donc pas à la rapidité du refus).
    const stored = found ? found.password : hashPassword('mot-de-passe-absent');
    // Mot de passe faux, ou compte inconnu : le même message dans les deux cas.
    if (!verifyPassword(rawPassword, stored) || !found) throw new UnauthorizedException('Pseudonyme ou mot de passe incorrect.');
    // Le compte.
    const account: Account = { id: found.id, name: found.name, createdAt: found.createdAt };
    // La session.
    return { token: signSession({ id: account.id, name: account.name, ver: found.sessionVersion }, this.secret), account };
  // Fin de login.
  }

  /** Compte d'un jeton de session, ou null : jeton faux, expiré, ou compte supprimé depuis. */
  async accountOf(token: string | null): Promise<Account | null> {
    // Vérifie la signature et tous les claims standards du JWT.
    const payload = token ? verifySession(token, this.secret) : null;
    if (!payload) return null;
    // Le compte et sa version de révocation sont relus à chaque requête protégée.
    if (!this.pool) {
      const kept = this.memory.accounts.get(payload.id);
      return kept && kept.sessionVersion === payload.ver
        ? { id: kept.id, name: kept.name, createdAt: kept.createdAt }
        : null;
    }
    const { rows } = await (await this.db()).query<{
      id: string; name: string; session_version: number; created_at: Date;
    }>(
      'SELECT id, name, session_version, created_at FROM contribution_accounts WHERE id = $1',
      [payload.id],
    );
    const row = rows[0];
    return row && Number(row.session_version) === payload.ver
      ? { id: row.id, name: row.name, createdAt: row.created_at }
      : null;
  // Fin de accountOf.
  }

  /** Invalide immédiatement tous les JWT de ce compte en incrémentant sa version de session. */
  async revokeSessions(accountId: string): Promise<void> {
    if (!this.pool) {
      const kept = this.memory.accounts.get(accountId);
      if (kept) kept.sessionVersion += 1;
      return;
    }
    await (await this.db()).query(
      'UPDATE contribution_accounts SET session_version = session_version + 1 WHERE id = $1',
      [accountId],
    );
  // Fin de revokeSessions.
  }

  /** Compte exigé : lève 401 si la session est absente, expirée, révoquée ou refusée. */
  async requireAccount(token: string | null): Promise<Account> {
    const account = await this.accountOf(token);
    if (!account) throw new UnauthorizedException('Connectez-vous pour faire cela.');
    return account;
  // Fin de requireAccount.
  }

  // ───────────────────────── Contributions ─────────────────────────

  /** Liste des placements, triés, avec les voix et celle du visiteur. */
  async list(sort: SortMode, viewerId: string | null): Promise<Contribution[]> {
    // Sans base : assemble depuis la mémoire.
    if (!this.pool) {
      // Chaque contribution, avec ses voix.
      const items = [...this.memory.contributions.values()].map((c) => {
        // Voix de cette contribution.
        const votes = [...this.memory.votes.entries()].filter(([k]) => k.startsWith(`${c.id}|`)).map(([, v]) => v);
        // Compteurs.
        const up = votes.filter((v) => v > 0).length;
        const down = votes.filter((v) => v < 0).length;
        // La contribution complète.
        return this.withVotes(c, up, down, viewerId ? this.memory.votes.get(`${c.id}|${viewerId}`) ?? 0 : 0);
      // Fin de l'assemblage.
      });
      // Triée et bornée.
      return sortContributions(items, sort).slice(0, MAX_LIST);
    // Fin du cas sans base.
    }
    // Avec base : une requête, les voix comptées par sous-requêtes. La borne porte sur les plus récents, puis le tri
    // demandé s'applique à ce lot : au-delà de MAX_LIST placements, « populaire » et « meilleur » ne voient que les
    // MAX_LIST derniers publiés.
    const { rows } = await (await this.db()).query<Row>(
      `SELECT c.*, a.name AS author,
              (SELECT count(*) FROM contribution_votes v WHERE v.contribution_id = c.id AND v.value > 0) AS up,
              (SELECT count(*) FROM contribution_votes v WHERE v.contribution_id = c.id AND v.value < 0) AS down,
              (SELECT v.value FROM contribution_votes v WHERE v.contribution_id = c.id AND v.account_id = $1) AS my_vote
         FROM contributions c JOIN contribution_accounts a ON a.id = c.account_id
        ORDER BY c.created_at DESC LIMIT $2`,
      [viewerId, MAX_LIST],
    );
    // Lignes converties puis triées.
    return sortContributions(rows.map((r) => this.fromRow(r)), sort);
  // Fin de list.
  }

  /** Publie un placement calculé par le serveur à partir de l'en-tête reçu. */
  async create(account: Account, input: CreateContributionInput): Promise<Contribution> {
    // Nom de fichier, titre et note nettoyés.
    const filename = text(input.filename, MAX_FILENAME);
    // Nom de fichier attendu.
    if (!filename) throw new BadRequestException('Le nom du fichier est manquant.');
    // Titre : celui donné, à défaut le nom du fichier.
    const title = text(input.title, MAX_TITLE) || filename;
    const note = text(input.note, MAX_NOTE);
    // Placement calculé ici, sans faire confiance au client.
    const placement = this.check(() => placeFromHeader(input.header));
    // Emprise à enregistrer.
    const bounds = storedBounds(input.header, placement);
    // Identifiant et date.
    const id = randomUUID();
    const createdAt = new Date();
    // Nombre de points déclaré, arrondi à l'entier.
    const pointCount = Math.round(input.header.pointCount);
    // Sans base : garde en mémoire.
    if (!this.pool) {
      // Compte déjà au maximum ?
      if ([...this.memory.contributions.values()].filter((c) => c.accountId === account.id).length >= MAX_PER_ACCOUNT) {
        // Refus.
        throw new ForbiddenException(`Vous avez atteint ${MAX_PER_ACCOUNT} contributions.`);
      // Fin du contrôle.
      }
      // Enregistre.
      this.memory.contributions.set(id, {
        id, accountId: account.id, title, filename, note, pointCount, crs: placement.crs, crsSource: placement.crsSource,
        tile: placement.tile?.id ?? null, anchor: placement.anchor, bounds, sizeMeters: placement.sizeMeters,
        footprint: placement.footprint, author: { id: account.id, name: account.name }, createdAt,
      });
      // La contribution, sans voix.
      return this.withVotes(this.memory.contributions.get(id)!, 0, 0, 0);
    // Fin du cas sans base.
    }
    // Avec base : contrôle du nombre de contributions du compte.
    const pool = await this.db();
    // Comptage.
    const { rows: counted } = await pool.query<{ n: string }>('SELECT count(*) AS n FROM contributions WHERE account_id = $1', [account.id]);
    // Au maximum : refus.
    if (Number(counted[0]?.n ?? 0) >= MAX_PER_ACCOUNT) throw new ForbiddenException(`Vous avez atteint ${MAX_PER_ACCOUNT} contributions.`);
    // Insertion.
    await pool.query(
      `INSERT INTO contributions (id, account_id, title, filename, note, point_count, crs, crs_source, tile, lat, lon, alt, heading, bounds, size_meters, footprint, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [id, account.id, title, filename, note, pointCount, placement.crs, placement.crsSource, placement.tile?.id ?? null,
        placement.anchor.lat, placement.anchor.lon, placement.anchor.alt, placement.anchor.heading,
        JSON.stringify(bounds), JSON.stringify(placement.sizeMeters), JSON.stringify(placement.footprint), createdAt],
    );
    // La contribution telle qu'elle vient d'être écrite, sans voix.
    return {
      id, title, filename, note, pointCount, crs: placement.crs, crsSource: placement.crsSource, tile: placement.tile?.id ?? null,
      anchor: placement.anchor, bounds, sizeMeters: placement.sizeMeters, footprint: placement.footprint,
      author: { id: account.id, name: account.name }, up: 0, down: 0, score: 0, status: placementStatus({ up: 0, down: 0 }), myVote: 0, createdAt,
    };
  // Fin de create.
  }

  /**
   * Vote sur un placement : +1 juste, -1 faux, 0 retire la voix. Une seule voix par compte et par placement, et
   * renvoyer la voix déjà donnée la retire (la même flèche cliquée deux fois).
   */
  async vote(account: Account, id: string, value: number): Promise<{ up: number; down: number; score: number; status: string; myVote: number }> {
    // Valeur ramenée à -1, 0 ou +1.
    const asked = value > 0 ? 1 : value < 0 ? -1 : 0;
    // Sans base : vote en mémoire.
    if (!this.pool) {
      // Contribution connue ?
      if (!this.memory.contributions.has(id)) throw new NotFoundException('Cette contribution n’existe pas.');
      // Clé de la voix de ce compte sur ce placement.
      const key = `${id}|${account.id}`;
      // Voix déjà donnée, et voix qui en résulte : la même valeur retire la voix.
      const next = (this.memory.votes.get(key) ?? 0) === asked ? 0 : asked;
      // Pose ou retire la voix.
      if (next === 0) this.memory.votes.delete(key);
      else this.memory.votes.set(key, next);
      // Compteurs à jour.
      const votes = [...this.memory.votes.entries()].filter(([k]) => k.startsWith(`${id}|`)).map(([, x]) => x);
      // Le résultat.
      return this.counts(votes.filter((x) => x > 0).length, votes.filter((x) => x < 0).length, next);
    // Fin du cas sans base.
    }
    // Avec base : l'existence du placement et la voix déjà donnée, en une seule requête.
    const pool = await this.db();
    // Les deux renseignements.
    const { rows: before } = await pool.query<{ found: number | null; current: number | null }>(
      `SELECT (SELECT 1 FROM contributions WHERE id = $1) AS found,
              (SELECT value FROM contribution_votes WHERE contribution_id = $1 AND account_id = $2) AS current`,
      [id, account.id],
    );
    // Placement inconnu.
    if (!before[0]?.found) throw new NotFoundException('Cette contribution n’existe pas.');
    // Voix qui résulte du clic : la même valeur retire la voix.
    const next = (before[0].current ?? 0) === asked ? 0 : asked;
    // Retrait de la voix.
    if (next === 0) await pool.query('DELETE FROM contribution_votes WHERE contribution_id = $1 AND account_id = $2', [id, account.id]);
    // Pose ou changement de la voix : une seule ligne par compte et par contribution.
    else {
      // Insertion, remplacée si la voix existe déjà.
      await pool.query(
        `INSERT INTO contribution_votes (contribution_id, account_id, value) VALUES ($1, $2, $3)
         ON CONFLICT (contribution_id, account_id) DO UPDATE SET value = $3, created_at = now()`,
        [id, account.id, next],
      );
    // Fin de la pose.
    }
    // Compteurs à jour.
    const { rows } = await pool.query<{ up: string; down: string }>(
      `SELECT count(*) FILTER (WHERE value > 0) AS up, count(*) FILTER (WHERE value < 0) AS down
         FROM contribution_votes WHERE contribution_id = $1`, [id],
    );
    // Le résultat.
    return this.counts(Number(rows[0]?.up ?? 0), Number(rows[0]?.down ?? 0), next);
  // Fin de vote.
  }

  /** Retire une contribution : seul son auteur peut le faire. */
  async remove(account: Account, id: string): Promise<void> {
    // Sans base : retrait en mémoire.
    if (!this.pool) {
      // La contribution.
      const c = this.memory.contributions.get(id);
      // Inconnue.
      if (!c) throw new NotFoundException('Cette contribution n’existe pas.');
      // Pas l'auteur.
      if (c.accountId !== account.id) throw new ForbiddenException('Seul l’auteur peut retirer sa contribution.');
      // Retire la contribution et ses voix.
      this.memory.contributions.delete(id);
      for (const k of [...this.memory.votes.keys()]) if (k.startsWith(`${id}|`)) this.memory.votes.delete(k);
      // Fait.
      return;
    // Fin du cas sans base.
    }
    // Avec base : suppression limitée à l'auteur ; les voix suivent par la contrainte de clé étrangère.
    const { rowCount } = await (await this.db()).query('DELETE FROM contributions WHERE id = $1 AND account_id = $2', [id, account.id]);
    // Rien supprimé : inconnue, ou pas l'auteur.
    if (!rowCount) throw new NotFoundException('Cette contribution n’existe pas, ou n’est pas la vôtre.');
  // Fin de remove.
  }

  // ───────────────────────── Outils ─────────────────────────

  // Exécute un contrôle pur et traduit son refus en erreur HTTP 400.
  private check<T>(fn: () => T): T {
    // Essaie.
    try {
      // Le résultat.
      return fn();
    // Refus d'un contrôle : message montré tel quel.
    } catch (e) {
      // Erreur attendue.
      if (e instanceof AccountError || e instanceof PlacementError) throw new BadRequestException(e.message);
      // Autre erreur : laissée remonter.
      throw e;
    // Fin de l'essai.
    }
  // Fin de check.
  }

  // Compteurs, score, état et voix du visiteur.
  private counts(up: number, down: number, myVote: number) {
    // Le tout.
    return { up, down, score: netScore({ up, down }), status: placementStatus({ up, down }), myVote };
  // Fin de counts.
  }

  // Contribution de la mémoire, complétée par ses voix.
  private withVotes(c: Omit<Contribution, 'up' | 'down' | 'score' | 'status' | 'myVote'>, up: number, down: number, myVote: number): Contribution {
    // La contribution complète.
    return { ...c, ...this.counts(up, down, myVote) };
  // Fin de withVotes.
  }

  // Ligne de la base convertie en contribution.
  private fromRow(r: Row): Contribution {
    // Compteurs.
    const up = Number(r.up);
    const down = Number(r.down);
    // La contribution.
    return {
      id: r.id, title: r.title, filename: r.filename, note: r.note, pointCount: Number(r.point_count),
      crs: r.crs, crsSource: r.crs_source, tile: r.tile,
      anchor: { lat: r.lat, lon: r.lon, alt: r.alt, heading: r.heading },
      bounds: r.bounds, sizeMeters: r.size_meters, footprint: r.footprint,
      author: { id: r.account_id, name: r.author },
      ...this.counts(up, down, r.my_vote ?? 0),
      createdAt: r.created_at,
    };
  // Fin de fromRow.
  }
// Fin du service.
}
