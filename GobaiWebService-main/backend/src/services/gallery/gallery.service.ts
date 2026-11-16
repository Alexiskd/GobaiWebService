// Outils NestJS : Injectable, Logger (journal), erreur 404, et les deux interfaces d'un service qui agit au démarrage et à l'arrêt de son module.
import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// existsSync teste la présence d'un fichier ; readFileSync le lit en entier, de façon synchrone.
import { existsSync, readFileSync } from 'node:fs';
// open ouvre un fichier pour en lire une partie ; readFile le lit en entier, de façon asynchrone.
import { open, readFile } from 'node:fs/promises';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// Pool : un groupe de connexions à PostgreSQL.
import { Pool } from 'pg';

/**
 * Collection personnelle de la galerie (photos et vidéos d'Alexis).
 * Les fichiers sont versionnés dans backend/data/galerie (manifest.json + médias + vignettes). Au démarrage, si
 * DATABASE_URL est renseigné, ils sont copiés dans PostgreSQL (table gallery_media) puis servis depuis la base ;
 * sinon ils sont servis directement depuis le dossier. Un média déjà en base (même sha256) n'est pas renvoyé.
 */

// Forme d'un média de la galerie.
export interface GalleryItem {
  // id : son identifiant.
  id: string;
  // folder : le dossier où il est classé.
  folder: string;
  // title : son titre.
  title: string;
  // kind : image ou vidéo.
  kind: 'image' | 'video';
  // mime : son type de contenu.
  mime: string;
  // file : le nom de son fichier.
  file: string;
  // thumb : le nom du fichier de sa vignette.
  thumb: string;
  // bytes : sa taille en octets.
  bytes: number;
  // width : sa largeur en pixels.
  width: number;
  // height : sa hauteur en pixels.
  height: number;
  // sha256 : l'empreinte de son contenu.
  sha256: string;
  // duration : sa durée, pour une vidéo.
  duration?: number;
// Fin de GalleryItem.
}
// Forme du manifeste : la liste des dossiers (identifiant, nom, catégorie) et la liste des médias.
interface GalleryManifest { folders: { id: string; name: string; category: string }[]; items: GalleryItem[] }

// Forme d'un morceau de média : ses octets, la taille totale, le premier et le dernier octet, le type de contenu.
export interface GalleryChunk { body: Buffer; total: number; start: number; end: number; mime: string }

// Requête SQL de création, envoyée telle quelle à PostgreSQL : la table gallery_media (identifiant, dossier, titre, type, type de contenu, taille, largeur, hauteur, durée, empreinte, position, vignette et données en binaire, date de création), créée seulement si elle n'existe pas ; puis le stockage « externe » de la colonne data, non compressé, pour lire vite une plage d'octets. Les lignes de cette requête sont du texte : elles ne peuvent pas recevoir de commentaire sans modifier la requête.
// Détail du texte SQL, ligne par ligne (les lignes d'une chaîne ne peuvent pas porter de commentaire) :
// ligne 1 : crée la table gallery_media si elle n'existe pas (début) ;
// ligne 2 : id, l'identifiant du média, clé primaire ;
// ligne 3 : folder, le dossier, obligatoire ;
// ligne 4 : title, le titre, obligatoire ;
// ligne 5 : kind, le type de média, obligatoire ;
// ligne 6 : mime, le type de contenu, obligatoire ;
// ligne 7 : bytes, la taille en octets, obligatoire ;
// ligne 8 : width, la largeur, obligatoire ;
// ligne 9 : height, la hauteur, obligatoire ;
// ligne 10 : duration, la durée, facultative ;
// ligne 11 : sha256, l'empreinte, obligatoire ;
// ligne 12 : position, le rang dans la galerie, obligatoire ;
// ligne 13 : thumb, les octets de la vignette, obligatoires ;
// ligne 14 : data, les octets du média, obligatoires ;
// ligne 15 : created_at, la date de création, l'instant présent par défaut ;
// ligne 16 : fin de la table ;
// ligne 17 : la colonne data est rangée hors ligne, sans compression ;
// ligne 18 : fin du texte.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS gallery_media (
    id TEXT PRIMARY KEY,
    folder TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    duration REAL,
    sha256 TEXT NOT NULL,
    position INTEGER NOT NULL,
    thumb BYTEA NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE gallery_media ALTER COLUMN data SET STORAGE EXTERNAL;
`;

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de la galerie ; elle agit au démarrage et à l'arrêt de son module.
export class GalleryService implements OnModuleInit, OnModuleDestroy {
  // Journal préfixé par le nom de la classe.
  private readonly logger = new Logger(GalleryService.name);
  // Dossier backend/data/galerie, calculé depuis l'emplacement du fichier compilé.
  private readonly dir = join(__dirname, '..', '..', '..', 'data', 'galerie');
  // Manifeste, rempli dans le constructeur.
  private readonly manifest: GalleryManifest;
  // Table identifiant → média, pour retrouver un média sans parcourir la liste.
  private readonly byId = new Map<string, GalleryItem>();
  // Groupe de connexions à PostgreSQL, ou null sans base.
  private readonly pool: Pool | null = null;
  /** Identifiants présents en base (remplis après la copie) : les autres sont servis depuis le dossier. */
  // Identifiants des médias présents en base.
  private readonly stored = new Set<string>();

  // Constructeur.
  constructor() {
    // Chemin du manifeste.
    const file = join(this.dir, 'manifest.json');
    // Lit et analyse le manifeste s'il existe ; sinon un manifeste vide.
    this.manifest = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { folders: [], items: [] };
    // Range chaque média dans la table par identifiant.
    for (const item of this.manifest.items) this.byId.set(item.id, item);
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

  // Méthode appelée par NestJS quand le module est prêt.
  onModuleInit(): void {
    // En arrière-plan : le démarrage du serveur n'attend pas la copie des médias.
    // Avec une base : lance la copie des médias sans l'attendre ; un échec est noté dans le journal.
    if (this.pool) void this.sync().catch((e: Error) => this.logger.warn(`Galerie : copie vers PostgreSQL impossible (${e.message}). Fichiers servis depuis le dossier.`));
    // Sans base : le note dans le journal.
    else this.logger.warn('DATABASE_URL absent : la galerie est servie depuis backend/data/galerie.');
  // Fin de onModuleInit.
  }

  // Méthode appelée par NestJS à l'arrêt : ferme les connexions à la base, s'il y en a.
  async onModuleDestroy(): Promise<void> { await this.pool?.end(); }

  /** Copie en base les médias absents ou modifiés, sans supprimer les lignes préexistantes. */
  // Méthode privée sync, asynchrone.
  private async sync(): Promise<void> {
    // Si le manifeste est vide :
    if (this.manifest.items.length === 0) {
      // on le note,
      this.logger.warn('Galerie : manifeste vide, synchronisation PostgreSQL ignorée pour protéger les médias existants.');
      // et on ne touche pas à la base.
      return;
    // Fin du cas.
    }
    // Groupe de connexions ; le « ! » affirme à TypeScript qu'il n'est pas null ici.
    const pool = this.pool!;
    // Crée la table si elle n'existe pas.
    await pool.query(SCHEMA);
    // Lit l'identifiant et l'empreinte de chaque média déjà en base.
    const { rows } = await pool.query<{ id: string; sha256: string }>('SELECT id, sha256 FROM gallery_media');
    // Table identifiant → empreinte de ce qui est en base.
    const inDb = new Map(rows.map((r: { id: string; sha256: string }) => [r.id, r.sha256]));
    // Compteur des médias ajoutés ou mis à jour.
    let added = 0;
    // Pour chaque média du manifeste, avec sa position dans la liste :
    for (const [position, item] of this.manifest.items.entries()) {
      // si la base a déjà ce média avec la même empreinte,
      if (inDb.get(item.id) === item.sha256) {
        // on met seulement à jour son dossier, son titre et sa position ;
        await pool.query('UPDATE gallery_media SET folder=$2, title=$3, position=$4 WHERE id=$1', [item.id, item.folder, item.title, position]);
      // sinon,
      } else {
        // on lit en même temps le fichier du média et celui de sa vignette ;
        const [data, thumb] = await Promise.all([readFile(join(this.dir, item.file)), readFile(join(this.dir, item.thumb))]);
        // on envoie la requête d'insertion,
        await pool.query(
          // dont le texte SQL insère la ligne ou, si l'identifiant existe déjà, remplace toutes ses colonnes ;
          // ligne 2 du texte : les treize valeurs, passées en paramètres ;
          // ligne 3 du texte : en cas de conflit sur l'identifiant, remplace le dossier, le titre, le type et le type de contenu,
          // ligne 4 du texte : la taille, la largeur, la hauteur, la durée et l'empreinte,
          // ligne 5 du texte : le rang, la vignette et les données ;
          `INSERT INTO gallery_media (id, folder, title, kind, mime, bytes, width, height, duration, sha256, position, thumb, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (id) DO UPDATE SET folder=EXCLUDED.folder, title=EXCLUDED.title, kind=EXCLUDED.kind, mime=EXCLUDED.mime,
             bytes=EXCLUDED.bytes, width=EXCLUDED.width, height=EXCLUDED.height, duration=EXCLUDED.duration, sha256=EXCLUDED.sha256,
             position=EXCLUDED.position, thumb=EXCLUDED.thumb, data=EXCLUDED.data`,
          // avec les treize valeurs, dans l'ordre des colonnes (durée à null si elle est absente) ;
          [item.id, item.folder, item.title, item.kind, item.mime, item.bytes, item.width, item.height, item.duration ?? null, item.sha256, position, thumb, data],
        // fin de l'envoi ;
        );
        // et on compte ce média.
        added++;
      // Fin du choix.
      }
      // Le média est maintenant en base.
      this.stored.add(item.id);
    // Fin de la boucle.
    }
    // Ne pas supprimer les lignes absentes du manifeste : celui-ci peut être incomplet lors d'un déploiement.
    // Le nettoyage des médias obsolètes doit être une opération séparée, sauvegardée et explicitement validée.
    // Note le bilan dans le journal.
    this.logger.log(`Galerie : ${this.stored.size} médias synchronisés depuis le manifeste (${added} ajoutés ou mis à jour). Aucune suppression automatique.`);
  // Fin de sync.
  }

  // Accesseur storage : d'où viennent les médias.
  get storage(): 'postgres' | 'files' {
    // « postgres » si tous les médias du manifeste sont en base, sinon « files ».
    return this.stored.size > 0 && this.stored.size === this.manifest.items.length ? 'postgres' : 'files';
  // Fin de storage.
  }

  // Méthode list.
  list() {
    // Indexer les médias en un seul passage évite de reparcourir toute la galerie
    // pour chaque dossier (coût précédent : dossiers × médias).
    // Table dossier → médias, vide au départ.
    const itemsByFolder = new Map<string, GalleryItem[]>();
    // Pour chaque média :
    for (const item of this.manifest.items) {
      // liste déjà commencée pour son dossier ;
      const folderItems = itemsByFolder.get(item.folder);
      // si elle existe, on y ajoute le média ;
      if (folderItems) folderItems.push(item);
      // sinon on la crée avec ce média.
      else itemsByFolder.set(item.folder, [item]);
    // Fin de la boucle.
    }

    // Objet renvoyé :
    return {
      // origine des médias ;
      storage: this.storage,
      // nombre total de médias ;
      total: this.manifest.items.length,
      // dossiers : chaque dossier du manifeste devient un objet,
      folders: this.manifest.folders.map((folder) => ({
        // avec ses propres champs,
        ...folder,
        // et ses médias, chacun privé de ses noms de fichiers et de son empreinte (les variables _f et _t ne servent pas),
        items: (itemsByFolder.get(folder.id) ?? []).map(({ file: _f, thumb: _t, sha256, ...rest }) => ({
          // avec ses autres champs,
          ...rest,
          // Le sha256 dans l'adresse permet un cache navigateur permanent.
          // l'adresse du média, suivie des 10 premiers caractères de l'empreinte,
          url: `/api/v1/galerie/media/${rest.id}?v=${sha256.slice(0, 10)}`,
          // et l'adresse de sa vignette, construite de la même façon.
          thumbUrl: `/api/v1/galerie/media/${rest.id}/vignette?v=${sha256.slice(0, 10)}`,
        // Fin d'un média et de la liste.
        })),
      // Fin d'un dossier et de la liste.
      })),
    // Fin de l'objet.
    };
  // Fin de list.
  }

  // Méthode privée item : retrouve un média par son identifiant.
  private item(id: string): GalleryItem {
    // Cherche dans la table.
    const item = this.byId.get(id);
    // Introuvable : erreur 404.
    if (!item) throw new NotFoundException(`Média « ${id} » introuvable dans la galerie.`);
    // Renvoie le média.
    return item;
  // Fin de item.
  }

  // Méthode thumb : renvoie les octets de la vignette.
  async thumb(id: string): Promise<Buffer> {
    // Retrouve le média (404 s'il n'existe pas).
    const item = this.item(id);
    // Si une base est configurée et contient ce média :
    if (this.pool && this.stored.has(id)) {
      // essaie
      try {
        // de lire la vignette en base ;
        const { rows } = await this.pool.query<{ thumb: Buffer }>('SELECT thumb FROM gallery_media WHERE id = $1', [id]);
        // et de la renvoyer si la ligne existe.
        if (rows[0]) return rows[0].thumb;
      // En cas d'erreur de la base : notée dans le journal, on continue.
      } catch (e) { this.logger.warn(`Vignette ${id} : ${(e as Error).message}`); }
    // Fin du cas « base ».
    }
    // Sinon lit le fichier de la vignette sur le disque.
    return readFile(join(this.dir, item.thumb));
  // Fin de thumb.
  }

  /** Octets [start, end] d'un média (inclus) : seule la plage demandée est lue, en base comme sur disque. */
  // Méthode chunk : renvoie une plage d'octets d'un média ; début à 0 par défaut, fin facultative.
  async chunk(id: string, start = 0, end?: number): Promise<GalleryChunk> {
    // Retrouve le média.
    const item = this.item(id);
    // Taille totale.
    const total = item.bytes;
    // Dernier octet : la fin demandée, ou le dernier du fichier, jamais au-delà.
    const last = Math.min(end ?? total - 1, total - 1);
    // Nombre d'octets à lire.
    const length = last - start + 1;
    // Si une base est configurée et contient ce média :
    if (this.pool && this.stored.has(id)) {
      // essaie
      try {
        // de demander à la base
        const { rows } = await this.pool.query<{ body: Buffer }>(
          // uniquement cette plage (substring compte à partir de 1, d'où start + 1) ;
          'SELECT substring(data FROM $2 FOR $3) AS body FROM gallery_media WHERE id = $1', [id, start + 1, length]);
        // et de la renvoyer si la ligne existe.
        if (rows[0]) return { body: rows[0].body, total, start, end: last, mime: item.mime };
      // En cas d'erreur de la base : notée dans le journal, on continue.
      } catch (e) { this.logger.warn(`Média ${id} : ${(e as Error).message}`); }
    // Fin du cas « base ».
    }
    // Sinon ouvre le fichier du média en lecture.
    const handle = await open(join(this.dir, item.file), 'r');
    // Essaie :
    try {
      // de réserver la mémoire pour la plage ;
      const body = Buffer.alloc(length);
      // de lire ces octets à partir de la position de début ;
      await handle.read(body, 0, length, start);
      // et de les renvoyer.
      return { body, total, start, end: last, mime: item.mime };
    // Dans tous les cas, ferme le fichier.
    } finally { await handle.close(); }
  // Fin de chunk.
  }
// Fin du service.
}
