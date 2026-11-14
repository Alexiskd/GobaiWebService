// Outils NestJS : Injectable, Logger (journal), erreur 404, et les interfaces d'un service qui agit au démarrage et à l'arrêt de son module.
import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// Fonctions de fichiers synchrones : tester la présence, lister un dossier, lire un fichier.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
// readFile : lit un fichier de façon asynchrone.
import { readFile } from 'node:fs/promises';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// Pool : un groupe de connexions à PostgreSQL.
import { Pool } from 'pg';
// Cache mémoire, fonctions de vérification, types du manifeste et d'un nœud, et fabrication du manifeste public.
import { ByteCache, isLidarManifest, isLidarNodeKey, isLidarTileId, type LidarManifest, type LidarNode, publicLidarManifest } from './lidar-tiles';

/**
 * Dalles LiDAR en vrais points 3D (voir lidar-tiles.ts pour le format).
 * Les fichiers sont versionnés dans backend/data/lidar/<dalle>/. Au démarrage, si DATABASE_URL est renseigné, ils sont
 * copiés dans PostgreSQL (table lidar_nodes) puis servis depuis la base ; sinon ils sont servis depuis le dossier.
 * Un nœud déjà en base (même empreinte) n'est pas renvoyé. Les nœuds demandés restent en mémoire (cache borné) :
 * la racine et les premiers niveaux, demandés par tout le monde, partent sans lecture de la base.
 */

// Requête SQL de création, envoyée telle quelle à PostgreSQL : la table lidar_nodes (dalle, nœud, empreinte, nombre de points, données binaires, date de création ; clé : dalle + nœud), créée seulement si elle n'existe pas ; puis le stockage « externe », non compressé, de la colonne data. Les lignes de cette requête sont du texte : elles ne peuvent pas recevoir de commentaire sans modifier la requête.
// Détail du texte SQL, ligne par ligne (les lignes d'une chaîne ne peuvent pas porter de commentaire) :
// ligne 1 : crée la table lidar_nodes si elle n'existe pas (début) ;
// ligne 2 : tile, l'identifiant de la dalle, obligatoire ;
// ligne 3 : node, la clé du nœud, obligatoire ;
// ligne 4 : sha, l'empreinte du fichier, obligatoire ;
// ligne 5 : points, le nombre de points, obligatoire ;
// ligne 6 : data, les octets du nœud, obligatoires ;
// ligne 7 : created_at, la date de création, l'instant présent par défaut ;
// ligne 8 : clé primaire sur la dalle et le nœud ;
// ligne 9 : fin de la table ;
// ligne 10 : la colonne data est rangée hors ligne, sans compression ;
// ligne 11 : fin du texte.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS lidar_nodes (
    tile TEXT NOT NULL,
    node TEXT NOT NULL,
    sha TEXT NOT NULL,
    points INTEGER NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tile, node)
  );
  ALTER TABLE lidar_nodes ALTER COLUMN data SET STORAGE EXTERNAL;
`;

/** Mémoire réservée aux nœuds déjà servis (le service gratuit de Render a 512 Mo en tout). */
// Taille du cache mémoire : 40 Mo (40 × 1024 × 1024 octets).
const CACHE_BYTES = 40 * 1024 * 1024;

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des dalles LiDAR ; elle agit au démarrage et à l'arrêt de son module.
export class LidarTilesService implements OnModuleInit, OnModuleDestroy {
  // Journal préfixé par le nom de la classe.
  private readonly logger = new Logger(LidarTilesService.name);
  // Dossier backend/data/lidar, calculé depuis l'emplacement du fichier compilé.
  private readonly dir = join(__dirname, '..', '..', '..', 'data', 'lidar');
  // Manifestes des dalles, par identifiant.
  private readonly tiles = new Map<string, LidarManifest>();
  // Nœuds, par « dalle/clé ».
  private readonly nodes = new Map<string, LidarNode>();
  // Groupe de connexions à PostgreSQL, ou null sans base.
  private readonly pool: Pool | null = null;
  /** Nœuds présents en base (« dalle/clé », remplis après la copie) : les autres sont servis depuis le dossier. */
  // Nœuds présents en base.
  private readonly stored = new Set<string>();
  // Cache mémoire des fichiers déjà servis.
  private readonly cache = new ByteCache(CACHE_BYTES);

  // Constructeur.
  constructor() {
    // Pour chaque dossier de backend/data/lidar (aucun si le dossier manque) :
    for (const name of existsSync(this.dir) ? readdirSync(this.dir) : []) {
      // chemin de son manifeste ;
      const file = join(this.dir, name, 'manifest.json');
      // pas de manifeste : on passe.
      if (!existsSync(file)) continue;
      // Essaie
      try {
        // de lire et d'analyser le manifeste ;
        const manifest: unknown = JSON.parse(readFileSync(file, 'utf8'));
        // invalide, ou identifiant différent du nom du dossier : erreur ;
        if (!isLidarManifest(manifest) || manifest.id !== name) throw new Error('manifeste invalide');
        // range le manifeste ;
        this.tiles.set(manifest.id, manifest);
        // et range chacun de ses nœuds.
        for (const node of manifest.nodes) this.nodes.set(`${manifest.id}/${node.k}`, node);
      // En cas d'erreur : la dalle est ignorée, avec une ligne dans le journal.
      } catch (e) { this.logger.warn(`Dalle LiDAR ${name} ignorée : ${(e as Error).message}`); }
    // Fin de la boucle.
    }
    // Adresse de la base, espaces retirés.
    const url = process.env.DATABASE_URL?.trim();
    // Si elle est définie et qu'il y a au moins une dalle :
    if (url && this.tiles.size) {
      // crée le groupe de connexions : 4 au plus, en TLS sans vérification du certificat quand la base est chez Render ;
      this.pool = new Pool({ connectionString: url, max: 4, ssl: url.includes('render.com') ? { rejectUnauthorized: false } : undefined });
      // et note dans le journal toute erreur de connexion.
      this.pool.on('error', (e: Error) => this.logger.warn(`PostgreSQL : ${e.message}`));
    // Fin du cas.
    }
  // Fin du constructeur.
  }

  // Méthode appelée par NestJS quand le module est prêt.
  onModuleInit(): void {
    // En arrière-plan : le démarrage du serveur n'attend pas la copie des dalles.
    // Avec une base : lance la copie des nœuds sans l'attendre ; un échec est noté dans le journal.
    if (this.pool) void this.sync().catch((e: Error) => this.logger.warn(`LiDAR : copie vers PostgreSQL impossible (${e.message}). Fichiers servis depuis le dossier.`));
    // Sans base mais avec des dalles : le note dans le journal.
    else if (this.tiles.size) this.logger.warn('DATABASE_URL absent : les dalles LiDAR sont servies depuis backend/data/lidar.');
  // Fin de onModuleInit.
  }

  // Méthode appelée par NestJS à l'arrêt : ferme les connexions à la base, s'il y en a.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Copie en base les nœuds absents ou modifiés, sans supprimer les lignes préexistantes. */
  // Méthode privée sync, asynchrone.
  private async sync(): Promise<void> {
    // Sans aucun nœud valide :
    if (this.nodes.size === 0) {
      // on le note,
      this.logger.warn('LiDAR : aucun nœud valide dans les manifestes, synchronisation PostgreSQL ignorée pour protéger les données existantes.');
      // et on ne touche pas à la base.
      return;
    // Fin du cas.
    }
    // Groupe de connexions ; le « ! » affirme à TypeScript qu'il n'est pas null ici.
    const pool = this.pool!;
    // Crée la table si elle n'existe pas.
    await pool.query(SCHEMA);
    // Lit la dalle, la clé et l'empreinte de chaque nœud déjà en base.
    const { rows } = await pool.query<{ tile: string; node: string; sha: string }>('SELECT tile, node, sha FROM lidar_nodes');
    // Table « dalle/clé » → empreinte de ce qui est en base.
    const inDb = new Map(rows.map((r: { tile: string; node: string; sha: string }) => [`${r.tile}/${r.node}`, r.sha]));
    // Compteur des nœuds ajoutés ou mis à jour.
    let added = 0;
    // Pour chaque nœud des manifestes :
    for (const [id, node] of this.nodes) {
      // si la base ne l'a pas avec la même empreinte,
      if (inDb.get(id) !== node.h) {
        // identifiant de sa dalle : ce qui précède la barre oblique ;
        const tile = id.slice(0, id.indexOf('/'));
        // lit son fichier ;
        const data = await readFile(this.file(tile, node.k));
        // envoie la requête d'insertion,
        await pool.query(
          // dont le texte SQL insère la ligne ou, si elle existe déjà, remplace son empreinte, son nombre de points et ses données ;
          // ligne 2 du texte : en cas de conflit sur la dalle et le nœud, remplace l'empreinte, le nombre de points et les données ;
          `INSERT INTO lidar_nodes (tile, node, sha, points, data) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (tile, node) DO UPDATE SET sha=EXCLUDED.sha, points=EXCLUDED.points, data=EXCLUDED.data`,
          // avec les cinq valeurs, dans l'ordre des colonnes ;
          [tile, node.k, node.h, node.n, data],
        // fin de l'envoi ;
        );
        // et on compte ce nœud.
        added++;
      // Fin du cas.
      }
      // Le nœud est maintenant en base.
      this.stored.add(id);
    // Fin de la boucle.
    }
    // Ne pas supprimer les nœuds absents des manifestes : le jeu de données peut être partiel.
    // Le nettoyage doit être séparé, sauvegardé et explicitement validé.
    // Note le bilan dans le journal.
    this.logger.log(`LiDAR : ${this.stored.size} nœuds synchronisés depuis les manifestes (${added} ajoutés ou mis à jour). Aucune suppression automatique.`);
  // Fin de sync.
  }

  // Méthode privée file : chemin du fichier d'un nœud sur le disque.
  private file(tile: string, key: string): string { return join(this.dir, tile, 'nodes', `${key}.bin`); }

  // Accesseur storage : d'où viennent les fichiers.
  get storage(): 'postgres' | 'files' {
    // « postgres » si tous les nœuds sont en base, sinon « files ».
    return this.stored.size > 0 && this.stored.size === this.nodes.size ? 'postgres' : 'files';
  // Fin de storage.
  }

  /** Dalles disponibles, avec la liste de leurs nœuds et le modèle d'adresse des fichiers. */
  // Méthode list.
  list() {
    // Origine des fichiers.
    const storage = this.storage;
    // Renvoie cette origine et le manifeste public de chaque dalle.
    return { storage, items: [...this.tiles.values()].map((m) => publicLidarManifest(m, storage)) };
  // Fin de list.
  }

  /** Fichier compressé (gzip) d'un nœud : mémoire, puis base, puis dossier. */
  // Méthode node : le fichier d'un nœud.
  async node(tile: string, key: string): Promise<Buffer> {
    // Identifiant « dalle/clé ».
    const id = `${tile}/${key}`;
    // Si la dalle ou la clé sont mal formées, ou si le nœud n'existe pas :
    if (!isLidarTileId(tile) || !isLidarNodeKey(key) || !this.nodes.has(id)) {
      // erreur 404.
      throw new NotFoundException(`Nœud LiDAR « ${id} » introuvable.`);
    // Fin du cas.
    }
    // Cherche dans le cache mémoire.
    const hit = this.cache.get(id);
    // Trouvé : on le rend.
    if (hit) return hit;
    // Contenu à lire.
    let body: Buffer | null = null;
    // Si une base est configurée et contient ce nœud :
    if (this.pool && this.stored.has(id)) {
      // essaie
      try {
        // de le lire en base ;
        const { rows } = await this.pool.query<{ data: Buffer }>('SELECT data FROM lidar_nodes WHERE tile = $1 AND node = $2', [tile, key]);
        // et de le garder si la ligne existe.
        if (rows[0]) body = rows[0].data;
      // En cas d'erreur de la base : notée dans le journal, on continue.
      } catch (e) { this.logger.warn(`Nœud ${id} : ${(e as Error).message}`); }
    // Fin du cas « base ».
    }
    // Toujours rien : lit le fichier sur le disque.
    body ??= await readFile(this.file(tile, key));
    // Le range dans le cache mémoire.
    this.cache.set(id, body);
    // Le renvoie.
    return body;
  // Fin de node.
  }
// Fin du service.
}
