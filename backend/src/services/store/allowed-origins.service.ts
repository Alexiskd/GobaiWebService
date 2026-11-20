// Outils NestJS : Injectable, Logger (journal), erreurs HTTP, et les deux interfaces d'un service qui agit au démarrage et à l'arrêt de son module.
import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
// Pool : un groupe de connexions à PostgreSQL.
import { Pool } from 'pg';
// Normalisation d'une adresse de site en origine comparable (schéma + hôte + port, en minuscules).
import { normalizeOrigin } from '../../common/free-origins';

/**
 * Liste des sites externes autorisés à appeler l'API Gobai Space depuis un navigateur (CORS), en base
 * PostgreSQL : table `allowed_origins`, une ligne par site. C'est la **seule** protection de l'API pour un
 * usage externe — pas de clé ni de jeton à présenter à chaque requête : une fois son site ajouté, il appelle
 * l'API comme gobaispace.com lui-même. L'ajout se fait après un paiement (voir StoreController,
 * `POST /store/cors-sites`, article « cors-site » du catalogue).
 *
 * Sans DATABASE_URL, la liste reste vide : aucun site externe n'est autorisé (le site gobaispace.com lui-même
 * continue de fonctionner, sa propre origine n'étant jamais soumise à cette liste — voir common/cors.ts).
 */

// Requête SQL de création, envoyée telle quelle à PostgreSQL : la table allowed_origins (origine, compte
// acheteur, commande Stripe, date d'ajout), créée seulement si elle n'existe pas ; une origine n'y figure
// jamais deux fois (contrainte d'unicité).
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS allowed_origins (
    id SERIAL PRIMARY KEY,
    origin TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL,
    payment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de la liste des sites autorisés.
export class AllowedOriginsService implements OnModuleInit, OnModuleDestroy {
  // Journal préfixé par le nom de la classe.
  private readonly logger = new Logger(AllowedOriginsService.name);
  // Groupe de connexions à PostgreSQL, ou null sans base.
  private readonly pool: Pool | null = null;
  // Origines autorisées, en mémoire : une lecture rapide, sur chaque requête CORS.
  private readonly origins = new Set<string>();

  // Constructeur.
  constructor() {
    // Adresse de la base, espaces retirés.
    const url = process.env.DATABASE_URL?.trim();
    // Si elle est définie :
    if (url) {
      // crée le groupe de connexions : 4 au plus, en TLS sans vérification du certificat quand la base est chez Render ;
      this.pool = new Pool({ connectionString: url, max: 4, ssl: url.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      // et note dans le journal toute erreur de connexion, au lieu de laisser planter le serveur.
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    // Fin du cas.
    }
  // Fin du constructeur.
  }

  // Méthode appelée par NestJS quand le module est prêt : attend le chargement, pour que la liste soit déjà en
  // mémoire quand les premières requêtes arrivent.
  async onModuleInit(): Promise<void> {
    // Sans base : aucun site externe ne pourra être autorisé. On le note.
    if (!this.pool) { this.logger.warn('DATABASE_URL absent : aucun site externe ne peut être ajouté aux CORS (table allowed_origins).'); return; }
    // Avec une base : charge (en créant la table si besoin) ; un échec est noté, sans arrêter le serveur.
    try { await this.load(); } catch (e) { this.logger.warn(`Sites autorisés : chargement impossible (${(e as Error).message}).`); }
  // Fin de onModuleInit.
  }

  // Méthode appelée par NestJS à l'arrêt : ferme les connexions à la base, s'il y en a.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Charge la table en mémoire, après avoir créé la table si besoin. */
  // Méthode privée load, asynchrone.
  private async load(): Promise<void> {
    // Groupe de connexions ; le « ! » affirme à TypeScript qu'il n'est pas null ici.
    const pool = this.pool!;
    // Crée la table si elle n'existe pas.
    await pool.query(SCHEMA);
    // Lit toutes les origines.
    const { rows } = await pool.query<{ origin: string }>('SELECT origin FROM allowed_origins');
    // Vide la liste en mémoire avant de la remplir.
    this.origins.clear();
    // Range chaque origine.
    for (const row of rows) this.origins.add(row.origin);
    // Note dans le journal le nombre de sites chargés.
    this.logger.log(`Sites autorisés (CORS) : ${this.origins.size} chargés depuis PostgreSQL (table allowed_origins).`);
  // Fin de load.
  }

  /** Cette origine est-elle autorisée (lecture en mémoire, synchrone) ? */
  isAllowed(origin: string): boolean {
    // Normalisée avant comparaison : le même format que celui rangé par add().
    const normalized = normalizeOrigin(origin);
    return Boolean(normalized) && this.origins.has(normalized as string);
  // Fin de isAllowed.
  }

  /** Nombre de sites actuellement autorisés. */
  get count(): number { return this.origins.size; }

  /**
   * Ajoute un site à la liste, après un paiement vérifié : enregistre en base (si elle existe) puis en mémoire.
   * Une origine déjà présente ne crée pas de deuxième ligne (son compte et sa commande sont mis à jour).
   * Lève une erreur si l'adresse est illisible, ou si aucune base n'est configurée (rien ne survivrait alors
   * à un redémarrage : mieux vaut refuser que promettre un accès qui disparaîtrait).
   */
  async add(site: string, accountId: string, payment?: string): Promise<string> {
    // Normalise l'adresse reçue ; illisible : refus clair.
    const origin = normalizeOrigin(site);
    if (!origin) throw new BadRequestException(`Adresse de site illisible : « ${site} ».`);
    // Sans base, l'ajout ne pourrait pas survivre à un redémarrage.
    if (!this.pool) throw new ServiceUnavailableException('Aucune base de données configurée (DATABASE_URL) : impossible d’enregistrer durablement un site.');
    // Insère, ou met à jour le compte et la commande si l'origine existait déjà.
    await this.pool.query(
      `INSERT INTO allowed_origins (origin, account_id, payment)
       VALUES ($1,$2,$3)
       ON CONFLICT (origin) DO UPDATE SET account_id = EXCLUDED.account_id, payment = EXCLUDED.payment`,
      [origin, accountId, payment ?? null],
    );
    // Range aussitôt en mémoire : la prochaine requête CORS de ce site est déjà autorisée.
    this.origins.add(origin);
    // L'origine telle qu'enregistrée.
    return origin;
  // Fin de add.
  }
// Fin de la classe.
}
