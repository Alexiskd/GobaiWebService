// Outils NestJS : Injectable, Logger (journal), et les deux interfaces d'un service qui agit au démarrage et à l'arrêt de son module.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// Pool : un groupe de connexions à PostgreSQL.
import { Pool } from 'pg';
// Pages des astres et des fenêtres, et nom du site : source du balisage à ranger en base au premier démarrage.
import { APP_NAME, BODY_PAGES, SITE_KEYWORD, SITE_URL, WINDOW_PAGES, focusKeyword, type BodyPage } from '../data/body-pages';

/**
 * Balisage SEO des pages (titre, description, adresse canonique, balises Open Graph et X/Twitter), en base
 * PostgreSQL : une ligne par balise et par page, triée par page (voir body-pages.ts, renderBodyPage).
 * Au premier démarrage, la table est remplie à partir du texte écrit dans body-pages.ts (ON CONFLICT DO NOTHING) :
 * les lignes déjà en base, elles, ne sont jamais réécrites par le code, pour qu'une modification faite
 * directement en base (psql, tableau de bord Render) tienne d'un redéploiement à l'autre.
 * Sans DATABASE_URL, le service ne renseigne aucune page : renderBodyPage retombe alors sur le texte écrit
 * dans body-pages.ts, exactement comme avant l'ajout de cette table.
 */

// Forme d'une ligne de balisage.
export interface SeoTagRow {
  // page_slug : l'adresse de la page (« mars », « galerie »…).
  page_slug: string;
  // tag_type : la nature de la balise HTML (title, meta ou link).
  tag_type: 'title' | 'meta' | 'link';
  // tag_name : son nom (« description », « og:title »…).
  tag_name: string;
  // tag_content : son contenu.
  tag_content: string;
  // position : son rang dans la page, pour trier l'affichage dans l'ordre du modèle index.html.
  position: number;
// Fin de SeoTagRow.
}

// Requête SQL de création, envoyée telle quelle à PostgreSQL : la table seo_tags (page, type et nom de la
// balise, contenu, rang, date de mise à jour), créée seulement si elle n'existe pas ; une page ne porte
// qu'une seule fois chaque nom de balise (contrainte d'unicité page_slug + tag_name).
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS seo_tags (
    id SERIAL PRIMARY KEY,
    page_slug TEXT NOT NULL,
    tag_type TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    tag_content TEXT NOT NULL,
    position INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (page_slug, tag_name)
  );
`;

/** Les neuf balises écrites par renderBodyPage pour une page, dans l'ordre où elles apparaissent dans index.html. */
// Fonction tagsFor : la liste des balises d'une page, à partir de son contenu écrit dans body-pages.ts.
function tagsFor(body: BodyPage): Omit<SeoTagRow, 'position'>[] {
  // Adresse de la page.
  const url = `${SITE_URL}/${body.slug}`;
  // Nom du site dans le titre : sans le mot-clé pour une fenêtre, avec pour un astre (même règle que renderBodyPage).
  const site = body.kind === 'fenêtre' ? `${APP_NAME} (Gobai Space)` : `${SITE_KEYWORD} ${APP_NAME} (Gobai Space)`;
  // Titre et description de départ.
  const title = `${body.heading} · ${site}`;
  const description = body.description;
  // Mot-clé de référencement : la planète mère pour un satellite, la position réelle pour les autres astres.
  const keywords = focusKeyword(body);
  // Les neuf lignes : titre, description, mot-clé, adresse canonique, puis les quatre balises des réseaux sociaux.
  return [
    { page_slug: body.slug, tag_type: 'title', tag_name: 'title', tag_content: title },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'description', tag_content: description },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'keywords', tag_content: keywords },
    { page_slug: body.slug, tag_type: 'link', tag_name: 'canonical', tag_content: url },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'og:url', tag_content: url },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'og:title', tag_content: title },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'og:description', tag_content: description },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'twitter:title', tag_content: title },
    { page_slug: body.slug, tag_type: 'meta', tag_name: 'twitter:description', tag_content: description },
  ];
// Fin de tagsFor.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service du balisage SEO ; elle agit au démarrage et à l'arrêt de son module.
export class SeoTagsService implements OnModuleInit, OnModuleDestroy {
  // Journal préfixé par le nom de la classe.
  private readonly logger = new Logger(SeoTagsService.name);
  // Groupe de connexions à PostgreSQL, ou null sans base.
  private readonly pool: Pool | null = null;
  // Balisage en mémoire, rempli au démarrage : adresse de page → (nom de balise → contenu).
  private readonly bySlug = new Map<string, Map<string, string>>();

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

  // Méthode appelée par NestJS quand le module est prêt : attend le chargement, pour que le balisage soit déjà en
  // mémoire quand serveFrontend (main.ts) rend la première page d'astre.
  async onModuleInit(): Promise<void> {
    // Sans base : le balisage reste vide, renderBodyPage retombe sur le texte de body-pages.ts. On le note.
    if (!this.pool) { this.logger.warn('DATABASE_URL absent : le balisage SEO reste celui écrit dans body-pages.ts.'); return; }
    // Avec une base : charge (en créant et en amorçant la table si besoin) ; un échec est noté, sans arrêter le serveur.
    try { await this.load(); } catch (e) { this.logger.warn(`Balisage SEO : chargement impossible (${(e as Error).message}). Repli sur body-pages.ts.`); }
  // Fin de onModuleInit.
  }

  // Méthode appelée par NestJS à l'arrêt : ferme les connexions à la base, s'il y en a.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Charge la table en mémoire, après avoir créé la table et y avoir amorcé les pages absentes. */
  // Méthode privée load, asynchrone.
  private async load(): Promise<void> {
    // Groupe de connexions ; le « ! » affirme à TypeScript qu'il n'est pas null ici.
    const pool = this.pool!;
    // Crée la table si elle n'existe pas.
    await pool.query(SCHEMA);
    // Amorce une page absente : insère ses neuf lignes ; une page déjà présente (même une seule ligne) n'est pas touchée.
    for (const body of [...BODY_PAGES, ...WINDOW_PAGES]) {
      // Lignes de cette page, dans l'ordre d'affichage.
      const rows = tagsFor(body);
      // Pour chaque ligne, avec son rang dans la liste :
      for (const [position, row] of rows.entries()) {
        // insère la ligne ; si la page porte déjà ce nom de balise (contrainte d'unicité), ne change rien :
        // une valeur déjà en base, même modifiée à la main, n'est jamais réécrite par ce chargement.
        await pool.query(
          `INSERT INTO seo_tags (page_slug, tag_type, tag_name, tag_content, position)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (page_slug, tag_name) DO NOTHING`,
          [row.page_slug, row.tag_type, row.tag_name, row.tag_content, position],
        );
      // Fin de la boucle des lignes.
      }
    // Fin de la boucle des pages.
    }
    // Relit toute la table, triée par page puis par rang, et la range en mémoire.
    const { rows } = await pool.query<SeoTagRow>('SELECT page_slug, tag_name, tag_content FROM seo_tags ORDER BY page_slug, position');
    // Vide la table en mémoire avant de la remplir (un rechargement ne doit pas garder d'anciennes pages).
    this.bySlug.clear();
    // Range chaque ligne dans la table page → (nom → contenu).
    for (const row of rows) {
      // Table de la page, créée si absente.
      let page = this.bySlug.get(row.page_slug);
      if (!page) this.bySlug.set(row.page_slug, (page = new Map()));
      // Range le contenu sous le nom de la balise.
      page.set(row.tag_name, row.tag_content);
    // Fin de la boucle.
    }
    // Note dans le journal le nombre de pages et de lignes chargées.
    this.logger.log(`Balisage SEO : ${this.bySlug.size} pages, ${rows.length} balises chargées depuis PostgreSQL (table seo_tags).`);
  // Fin de load.
  }

  /** Balisage d'une page (nom de balise → contenu), ou undefined si la base est absente ou sans cette page. */
  // Méthode getPageTags : lecture synchrone, puisque tout est déjà en mémoire depuis onModuleInit.
  getPageTags(slug: string): Map<string, string> | undefined {
    return this.bySlug.get(slug);
  // Fin de getPageTags.
  }

  /** Toutes les lignes en mémoire, triées par page puis par nom de balise : pour une route de consultation. */
  // Méthode allTags : à plat, triée par page.
  allTags(): { page_slug: string; tag_name: string; tag_content: string }[] {
    // Rassemble toutes les pages,
    return [...this.bySlug.entries()]
      // triées par adresse de page,
      .sort(([a], [b]) => a.localeCompare(b))
      // chacune développée en une ligne par balise, triées par nom de balise,
      .flatMap(([page_slug, tags]) => [...tags.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag_name, tag_content]) => ({ page_slug, tag_name, tag_content })));
  // Fin de allTags.
  }
// Fin de la classe.
}
