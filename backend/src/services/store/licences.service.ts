/**
 * Achats d'un compte : ce que chacun a payé, et jusqu'à quand.
 *
 * Le jeton JWT reste la preuve d'achat — il se suffit à lui-même et le serveur n'en garde pas de copie. Ce qui
 * est enregistré ici, c'est l'achat : quel compte, quel article, combien d'heures, quel paiement Stripe, et
 * l'expiration. Cela permet trois choses que le jeton seul ne permet pas :
 *
 *   1. la boutique montre à l'acheteur connecté ce qu'il possède, sur n'importe quel appareil ;
 *   2. un jeton perdu se redemande sans retrouver l'identifiant de la session Stripe ;
 *   3. un paiement ne peut être réclamé qu'une fois, et seulement par le compte qui l'a fait.
 *
 * Stockage : PostgreSQL quand DATABASE_URL est renseigné, comme les contributions ; sinon en mémoire, pour le
 * développement local — les achats sont alors perdus au redémarrage, et le journal le dit.
 *
 * Aucune donnée bancaire n'est enregistrée : Stripe seul voit la carte. Ici, seul l'identifiant de la session
 * de paiement est gardé, pour relier un achat à son reçu.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

/** Un achat enregistré. */
export interface StoredLicence {
  /** Identifiant de l'achat. */
  id: string;
  /** Compte acheteur. */
  accountId: string;
  /** Article du catalogue. */
  productId: string;
  /** Heures payées (1 pour un article à prix fixe). */
  hours: number;
  /** Droits accordés par l'achat. */
  scopes: string[];
  /** Identifiant de la session de paiement Stripe. */
  payment: string;
  /** Montant payé, en centimes. */
  cents: number;
  /** Date de l'achat. */
  createdAt: Date;
  /** Fin de validité. */
  expiresAt: Date;
}

/** Ce qu'il faut pour enregistrer un achat. */
export type NewLicence = Omit<StoredLicence, 'id' | 'createdAt'>;

/** Schéma de la table des achats. Pas de clé étrangère vers les comptes : les deux services créent leurs
 * tables indépendamment, dans un ordre que personne ne garantit. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS store_licences (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    hours INTEGER NOT NULL,
    scopes TEXT[] NOT NULL,
    payment TEXT NOT NULL UNIQUE,
    cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE INDEX IF NOT EXISTS store_licences_account ON store_licences (account_id, created_at DESC);
`;

/** Une ligne de la table. */
interface Row {
  id: string; account_id: string; product_id: string; hours: number; scopes: string[];
  payment: string; cents: number; created_at: Date; expires_at: Date;
}

/** Une ligne de la base vers un achat. */
const fromRow = (r: Row): StoredLicence => ({
  id: r.id, accountId: r.account_id, productId: r.product_id, hours: Number(r.hours),
  scopes: r.scopes ?? [], payment: r.payment, cents: Number(r.cents), createdAt: r.created_at, expiresAt: r.expires_at,
});

/** Nombre maximal d'achats renvoyés pour un compte. */
export const MAX_LICENCES = 200;

// Service injecté par NestJS.
@Injectable()
// Classe du service des achats.
export class LicencesService implements OnModuleInit, OnModuleDestroy {
  // Journal du service.
  private readonly logger = new Logger(LicencesService.name);
  // Groupe de connexions PostgreSQL, ou null (stockage en mémoire).
  private readonly pool: Pool | null = null;
  // Stockage en mémoire, employé seulement sans base de données : identifiant de paiement → achat.
  private readonly memory = new Map<string, StoredLicence>();
  // Le schéma a-t-il été créé ?
  private ready: Promise<void> | null = null;

  // Constructeur : prépare la connexion.
  constructor() {
    // Adresse de la base, si elle est configurée.
    const url = process.env.DATABASE_URL?.trim();
    // Base configurée : un petit groupe de connexions.
    if (url) {
      // Le groupe.
      this.pool = new Pool({ connectionString: url, max: 2, ssl: url.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      // Une panne de connexion est signalée sans arrêter le serveur.
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    // Fin du cas avec base.
    }
  // Fin du constructeur.
  }

  // Au démarrage : crée le schéma, ou annonce le stockage en mémoire.
  onModuleInit(): void {
    // Avec base : création immédiate, sans retarder le démarrage ; un échec est journalisé et retenté.
    if (this.pool) void this.db().catch((e: Error) => this.logger.warn(`Achats : schéma non créé (${e.message}). Nouvelle tentative à la première requête.`));
    // Sans base : avertit que rien ne sera conservé.
    else this.logger.warn('DATABASE_URL absent : les achats sont gardés en mémoire et perdus au redémarrage.');
  // Fin de onModuleInit.
  }

  // À l'arrêt : ferme les connexions.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Le stockage est-il durable (PostgreSQL) ? */
  get persistent(): boolean { return this.pool !== null; }

  // Attend la création du schéma, faite une seule fois ; un échec est retenté à l'appel suivant.
  private async db(): Promise<Pool> {
    // Base attendue.
    const pool = this.pool!;
    // Première requête, ou reprise après un échec.
    if (!this.ready) {
      // La création, dont l'échec libère la place pour un nouvel essai.
      this.ready = pool.query(SCHEMA).then(() => undefined).catch((e: Error) => {
        // Prochain appel : nouvelle tentative.
        this.ready = null;
        // Et une erreur claire pour celui-ci.
        throw new ServiceUnavailableException(`Achats indisponibles : la base de données n’a pas répondu (${e.message}).`);
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

  /**
   * Enregistre un achat, ou renvoie celui qui existe déjà pour ce paiement.
   * Un même paiement ne donne donc jamais deux achats, même si l'acheteur recharge la page de retour.
   */
  async record(input: NewLicence): Promise<StoredLicence> {
    // L'achat, tel qu'il sera enregistré.
    const licence: StoredLicence = { ...input, id: randomUUID(), createdAt: new Date() };
    // Sans base : la mémoire, où le paiement sert de clé.
    if (!this.pool) {
      // Déjà enregistré : celui-là.
      const seen = this.memory.get(input.payment);
      // Sinon : on garde celui-ci.
      if (!seen) this.memory.set(input.payment, licence);
      // L'achat retenu.
      return seen ?? licence;
    // Fin du cas en mémoire.
    }
    // Avec base : insertion qui ne fait rien si le paiement est déjà là.
    const pool = await this.db();
    // L'insertion.
    await pool.query(
      `INSERT INTO store_licences (id, account_id, product_id, hours, scopes, payment, cents, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (payment) DO NOTHING`,
      [licence.id, licence.accountId, licence.productId, licence.hours, licence.scopes, licence.payment, licence.cents, licence.expiresAt],
    );
    // Relit la ligne qui vaut pour ce paiement : la nouvelle, ou celle qui existait déjà.
    const found = await this.findByPayment(licence.payment);
    // Elle existe forcément après l'insertion ; par prudence, on rend l'achat calculé à défaut.
    return found ?? licence;
  // Fin de record.
  }

  /** L'achat correspondant à un paiement Stripe, ou null. */
  async findByPayment(payment: string): Promise<StoredLicence | null> {
    // Sans base : la mémoire.
    if (!this.pool) return this.memory.get(payment) ?? null;
    // Avec base : la ligne.
    const pool = await this.db();
    // La requête.
    const { rows } = await pool.query<Row>('SELECT * FROM store_licences WHERE payment = $1', [payment]);
    // L'achat, s'il y en a un.
    return rows[0] ? fromRow(rows[0]) : null;
  // Fin de findByPayment.
  }

  /** Les achats d'un compte, du plus récent au plus ancien. */
  async listOf(accountId: string): Promise<StoredLicence[]> {
    // Sans base : la mémoire, filtrée et triée.
    if (!this.pool) {
      // Les achats de ce compte.
      return [...this.memory.values()]
        .filter((l) => l.accountId === accountId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, MAX_LICENCES);
    // Fin du cas en mémoire.
    }
    // Avec base : la requête.
    const pool = await this.db();
    // Les lignes.
    const { rows } = await pool.query<Row>(
      'SELECT * FROM store_licences WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2',
      [accountId, MAX_LICENCES],
    );
    // Les achats.
    return rows.map(fromRow);
  // Fin de listOf.
  }
// Fin du service.
}
