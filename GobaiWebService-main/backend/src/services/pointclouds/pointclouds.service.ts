// Outils NestJS : erreur 400, injection par jeton, service injectable, erreur 404.
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
// Type (effacé à la compilation) des informations système d'un fichier.
import type { Stats } from 'node:fs';
// Fonctions de fichiers asynchrones : informations sans suivre les liens, ouverture, liste d'un dossier, chemin réel.
import { lstat, open, readdir, realpath } from 'node:fs/promises';
// Fonctions de chemins : nom final, chemin absolu ou non, assemblage, chemin relatif, chemin absolu.
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Fonctions et types du calage GPS et du registre des tuiles.
import { anchorPoint, type LidarAnchor, normalizeAnchor, readAnchor, readRegistry, type RegisteredTile, removeAnchor, writeAnchor } from './lidar-anchor';

// Forme de l'en-tête lu dans un fichier LAS.
export interface PointCloudHeader {
  // version : la version du format.
  version: string;
  // pointFormat : le format des points.
  pointFormat: number;
  // pointCount : le nombre de points, en texte.
  pointCount: string;
  // bounds : l'emprise.
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  // coordinateSystemWkt : la référence spatiale embarquée, ou null.
  coordinateSystemWkt: string | null;
// Fin de PointCloudHeader.
}

/** Fichier de nuage de points servi tel quel au navigateur (Potree ou un loader COPC lisent l'en-tête eux-mêmes). */
// Forme interne d'un fichier de nuage.
export interface PointCloudFile {
  // name : son nom.
  name: string;
  // sizeBytes : sa taille.
  sizeBytes: number;
  // modifiedAt : sa date de modification.
  modifiedAt: Date;
  // path : son chemin sur le disque.
  path: string;
  // header : son en-tête, ou null s'il est illisible.
  header: PointCloudHeader | null;
  // potreeAvailable : vrai si une version Potree existe.
  potreeAvailable: boolean;
  /** false : tuile connue seulement par backend/data/pointclouds.json (fichier absent du serveur). */
  // fileAvailable : faux si le fichier n'est pas sur le serveur.
  fileAvailable?: boolean;
  /** Système de coordonnées déclaré dans le registre (le LAS n'en embarque pas toujours). */
  // crs : son système de coordonnées déclaré.
  crs?: string | null;
  /** Calage GPS (POINTCLOUD_DIR/anchors/<nom>.json), posé au centre du nuage, en bas de la projection. */
  // anchor : son calage GPS.
  anchor?: LidarAnchor | null;
// Fin de PointCloudFile.
}

/** Résultat de l'analyse d'un en-tête `Range` (RFC 9110, une seule plage). */
// Type ByteRange : le résultat de l'analyse d'un en-tête Range, parmi quatre cas :
export type ByteRange =
  // le fichier entier ;
  | { kind: 'full' }
  // une partie, avec son premier et son dernier octet ;
  | { kind: 'partial'; start: number; end: number }
  // un en-tête mal formé ;
  | { kind: 'invalid' }
  // une plage en dehors du fichier.
  | { kind: 'unsatisfiable' };

// Forme d'un nom de fichier accepté : 1 à 200 lettres, chiffres, points, tirets bas ou tirets.
const POINT_CLOUD_NAME = /^[A-Za-z0-9._-]{1,200}$/;
// Extension acceptée : .las ou .laz, sans tenir compte de la casse.
const POINT_CLOUD_EXTENSION = /\.(las|laz)$/i;

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des nuages de points.
export class PointCloudsService {
  // Dossier des nuages, en chemin absolu.
  private readonly dir: string;
  // Dossier des versions Potree.
  private readonly potreeDir: string;

  // Constructeur : reçoit la configuration, demandée par son jeton.
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // Rend absolu le dossier configuré.
    this.dir = resolve(config.pointclouds.dir);
    // Sous-dossier « potree ».
    this.potreeDir = join(this.dir, 'potree');
  // Fin du constructeur.
  }

  /** Fichiers LAS/LAZ du répertoire configuré, triés par nom. Répertoire absent = liste vide. */
  // Méthode list : tous les nuages.
  async list(): Promise<PointCloudFile[]> {
    // Noms des fichiers trouvés.
    let names: string[];
    // Essaie
    try {
      // de lister le dossier, avec le type de chaque entrée ;
      const entries = await readdir(this.dir, { withFileTypes: true });
      // et garde les noms des fichiers d'extension .las ou .laz.
      names = entries.filter((e) => e.isFile() && POINT_CLOUD_EXTENSION.test(e.name)).map((e) => e.name);
    // En cas d'erreur :
    } catch (error) {
      // si ce n'est pas « dossier absent », on la transmet ;
      if (!isMissing(error)) throw error;
      // dossier absent : aucun fichier.
      names = [];
    // Fin du cas.
    }

    // Tuiles enregistrées dans le code source.
    const registry = await readRegistry();
    // Pour chaque nom, du dossier ou du registre, sans doublon, tous traités en même temps :
    const files = await Promise.all([...new Set([...names, ...registry.map((t) => t.name)])].map(async (name) => {
      // essaie
      try {
        // de le décrire ;
        return await this.get(name);
      // en cas d'erreur :
      } catch (error) {
        // introuvable : null ;
        if (error instanceof NotFoundException) return null;
        // toute autre erreur est transmise.
        throw error;
      // Fin du cas.
      }
    // Fin de l'appel.
    }));
    // Parmi les résultats,
    return files
      // retire les null,
      .filter((file): file is PointCloudFile => file !== null)
      // et trie par nom.
      .sort((a, b) => a.name.localeCompare(b.name));
  // Fin de list.
  }

  /** Décrit un fichier précis ; refuse tout nom qui sortirait du répertoire configuré. */
  // Méthode get : décrit un nuage.
  async get(name: string): Promise<PointCloudFile> {
    // Sa tuile dans le registre, ou null.
    const registered = (await readRegistry()).find((t) => t.name === name) ?? null;
    // Informations du fichier.
    let file: PointCloudFile;
    // Essaie
    try {
      // de les lire sur le disque.
      file = await this.getFile(name);
    // En cas d'erreur :
    } catch (error) {
      // si ce n'est pas « introuvable », ou si le registre ne connaît pas ce nom, on la transmet ;
      if (!(error instanceof NotFoundException) || !registered) throw error;
      // sinon on décrit le nuage d'après le registre, avec le calage écrit à l'exécution, à défaut celui du registre, à défaut null.
      return { ...fromRegistry(registered, this.resolveFile(name)), anchor: (await readAnchor(this.dir, name)) ?? registered.anchor ?? null };
    // Fin du cas.
    }
    // Lit en même temps trois choses :
    const [header, potreeAvailable, anchor] = await Promise.all([
      // l'en-tête du fichier ;
      readPointCloudHeader(file.path),
      // la présence d'une version Potree ;
      this.hasPotreeDataset(name),
      // le calage écrit à l'exécution.
      readAnchor(this.dir, name),
    // Fin des lectures.
    ]);
    // Renvoie :
    return {
      // les informations du fichier ;
      ...file,
      // l'en-tête lu, à défaut celui du registre, à défaut null ;
      header: header ?? (registered ? fromRegistry(registered, file.path).header : null),
      // la présence d'une version Potree ;
      potreeAvailable,
      // le fichier est bien sur le serveur ;
      fileAvailable: true,
      // le système de coordonnées du registre, ou null ;
      crs: registered?.crs ?? null,
      // le calage écrit à l'exécution, à défaut celui du registre, à défaut null.
      anchor: anchor ?? registered?.anchor ?? null,
    // Fin de l'objet.
    };
  // Fin de get.
  }

  /** Répertoire des nuages (sert au script interne de calage). */
  // Accesseur directory : le dossier des nuages.
  get directory(): string { return this.dir; }

  /** Nom validé (lève BadRequest sinon) : sert au script de calage avant d'écrire anchors/<nom>.json. */
  // Méthode assertName : vérifie un nom (une erreur 400 est levée s'il est refusé).
  assertName(name: string): void { this.resolveFile(name); }

  /**
   * Pose (ou retire, avec null) la coordonnée GPS au centre du nuage, en bas de la projection.
   * Le fichier LAS/LAZ doit exister ; le calage est écrit dans POINTCLOUD_DIR/anchors/<nom>.json.
   */
  // Méthode setAnchor : pose ou retire un calage.
  async setAnchor(name: string, raw: Partial<LidarAnchor> | null): Promise<PointCloudFile> {
    // Vérifie d'abord que le nuage existe (404 sinon).
    await this.get(name); // fichier présent, ou tuile du registre
    // null : on retire le calage.
    if (raw === null) await removeAnchor(this.dir, name);
    // Sinon :
    else {
      // calage à écrire.
      let anchor: LidarAnchor;
      // Vérifie le calage reçu ; une valeur invalide donne une erreur 400 avec le message de la vérification.
      try { anchor = normalizeAnchor(raw); } catch (e) { throw new BadRequestException((e as Error).message); }
      // Écrit le calage.
      await writeAnchor(this.dir, name, anchor);
    // Fin du cas.
    }
    // Renvoie la description à jour du nuage.
    return this.get(name);
  // Fin de setAnchor.
  }

  /** Point natif sur lequel la coordonnée GPS est posée : centre de l'emprise, Z minimal. */
  // Méthode statique anchorOrigin : le point d'ancrage d'après l'emprise de l'en-tête.
  static anchorOrigin(header: PointCloudHeader) { return anchorPoint(header.bounds); }

  /** Résout uniquement les informations système nécessaires à un flux binaire Range. */
  // Méthode getFile : les informations système d'un fichier.
  async getFile(name: string): Promise<PointCloudFile> {
    // Chemin du fichier (erreur 400 si le nom est refusé).
    const path = this.resolveFile(name);
    // Informations système.
    let info: Stats;
    // Essaie
    try {
      // de les lire, sans suivre un éventuel lien symbolique.
      info = await lstat(path);
    // En cas d'erreur :
    } catch (error) {
      // fichier absent : erreur 404 ;
      if (isMissing(error)) throw new NotFoundException(`Nuage de points introuvable : ${name}.`);
      // toute autre erreur est transmise.
      throw error;
    // Fin du cas.
    }
    // Ce n'est pas un fichier (dossier, lien) : erreur 404.
    if (!info.isFile()) throw new NotFoundException(`Nuage de points introuvable : ${name}.`);
    // Renvoie le nom, la taille, la date et le chemin ; l'en-tête sera lu par get.
    return { name, sizeBytes: info.size, modifiedAt: info.mtime, path, header: null, potreeAvailable: false };
  // Fin de getFile.
  }

  /** Résout une ressource d’un nuage Potree converti, sans autoriser de sortie du répertoire dédié. */
  // Méthode getPotreeAsset : une ressource de la version Potree.
  async getPotreeAsset(name: string, assetPath: string): Promise<PointCloudFile> {
    // Vérifie le nom du nuage.
    this.resolveFile(name);
    // Coupe le chemin demandé à chaque barre oblique.
    const segments = assetPath.split('/');
    // Chemin vide, ou morceau contenant un caractère interdit, ou égal à « . » ou « .. » :
    if (!assetPath || segments.some((segment) => !/^[A-Za-z0-9._-]{1,200}$/.test(segment) || segment === '.' || segment === '..')) {
      // erreur 400.
      throw new BadRequestException('Chemin de ressource Potree invalide.');
    // Fin du cas.
    }

    // Dossier de la version Potree de ce nuage.
    const datasetDir = join(this.potreeDir, name);
    // Chemin absolu de la ressource.
    const path = resolve(datasetDir, ...segments);
    // S'il sort de ce dossier : erreur 400.
    if (!isWithin(datasetDir, path)) throw new BadRequestException('Chemin de ressource Potree invalide.');

    // Informations système.
    let info: Stats;
    // Essaie :
    try {
      // résout en même temps les chemins réels (liens symboliques suivis) de
      const [sourceRoot, potreeRoot, rootPath, resolvedPath] = await Promise.all([
        // le dossier des nuages,
        realpath(this.dir),
        // le dossier Potree,
        realpath(this.potreeDir),
        // le dossier de ce nuage,
        realpath(datasetDir),
        // et la ressource.
        realpath(path),
      // Fin des résolutions.
      ]);
      // Si l'un de ces chemins réels n'est pas contenu dans le précédent :
      if (!isWithin(sourceRoot, potreeRoot) || !isWithin(potreeRoot, rootPath) || !isWithin(rootPath, resolvedPath)) {
        // erreur 400 (un lien symbolique pointe ailleurs).
        throw new BadRequestException('Ressource Potree hors du répertoire autorisé.');
      // Fin du cas.
      }
      // Lit les informations de la ressource.
      info = await lstat(resolvedPath);
      // Ce n'est pas un fichier : erreur 404.
      if (!info.isFile()) throw new NotFoundException(`Ressource Potree introuvable : ${assetPath}.`);
      // Renvoie :
      return {
        // son nom, le dernier morceau du chemin ;
        name: segments[segments.length - 1],
        // sa taille ;
        sizeBytes: info.size,
        // sa date ;
        modifiedAt: info.mtime,
        // son chemin réel ;
        path: resolvedPath,
        // pas d'en-tête ;
        header: null,
        // version Potree présente.
        potreeAvailable: true,
      // Fin de l'objet.
      };
    // En cas d'erreur :
    } catch (error) {
      // les erreurs 400 et 404 levées ci-dessus sont transmises telles quelles ;
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      // fichier ou dossier absent : erreur 404 ;
      if (isMissing(error)) throw new NotFoundException(`Ressource Potree introuvable : ${assetPath}.`);
      // toute autre erreur est transmise.
      throw error;
    // Fin du cas.
    }
  // Fin de getPotreeAsset.
  }

  // Méthode privée resolveFile : vérifie un nom et rend son chemin.
  private resolveFile(name: string): string {
    // Refusé s'il contient un chemin, des caractères interdits, ou une autre extension que .las ou .laz :
    if (name !== basename(name) || !POINT_CLOUD_NAME.test(name) || !POINT_CLOUD_EXTENSION.test(name)) {
      // erreur 400.
      throw new BadRequestException('Nom de nuage de points invalide (lettres, chiffres, « . », « _ », « - » ; extension .las ou .laz).');
    // Fin du cas.
    }
    // Chemin du fichier dans le dossier des nuages.
    return join(this.dir, name);
  // Fin de resolveFile.
  }

  // Méthode privée hasPotreeDataset : une version Potree existe-t-elle ?
  private async hasPotreeDataset(name: string): Promise<boolean> {
    // Dossier de la version Potree de ce nuage.
    const datasetDir = join(this.potreeDir, name);
    // Essaie :
    try {
      // résout en même temps les chemins réels de
      const [sourceRoot, potreeRoot, rootPath, cloudPath] = await Promise.all([
        // le dossier des nuages,
        realpath(this.dir),
        // le dossier Potree,
        realpath(this.potreeDir),
        // le dossier de ce nuage,
        realpath(datasetDir),
        // et son fichier cloud.js.
        realpath(join(datasetDir, 'cloud.js')),
      // Fin des résolutions.
      ]);
      // Un chemin réel sort du précédent : non.
      if (!isWithin(sourceRoot, potreeRoot) || !isWithin(potreeRoot, rootPath) || !isWithin(rootPath, cloudPath)) return false;
      // Oui si cloud.js est bien un fichier.
      return (await lstat(cloudPath)).isFile();
    // En cas d'erreur :
    } catch (error) {
      // fichier ou dossier absent : non ;
      if (isMissing(error)) return false;
      // toute autre erreur est transmise.
      throw error;
    // Fin du cas.
    }
  // Fin de hasPotreeDataset.
  }
// Fin du service.
}

/** Tuile du registre sans fichier sur le serveur : en-tête reconstitué depuis le JSON. */
// Fonction fromRegistry : décrit un nuage d'après le registre, sans fichier.
function fromRegistry(t: RegisteredTile, path: string): PointCloudFile {
  // Renvoie :
  return {
    // son nom, une taille de 0, la date zéro (1970), son chemin théorique, pas de Potree, fichier absent, son système de coordonnées ;
    name: t.name, sizeBytes: 0, modifiedAt: new Date(0), path, potreeAvailable: false, fileAvailable: false, crs: t.crs ?? null,
    // un en-tête reconstitué :
    header: {
      // version, format et nombre de points du registre, avec des valeurs neutres s'ils manquent ;
      version: t.version ?? '', pointFormat: t.pointFormat ?? 0, pointCount: t.pointCount ?? '0',
      // l'emprise du registre, sans référence spatiale embarquée.
      bounds: t.bounds, coordinateSystemWkt: null,
    // Fin de l'en-tête.
    },
  // Fin de l'objet.
  };
// Fin de fromRegistry.
}

// Fonction readPointCloudHeader : lit l'en-tête d'un fichier LAS.
async function readPointCloudHeader(path: string): Promise<PointCloudHeader | null> {
  // Ouvre le fichier en lecture.
  const file = await open(path, 'r');
  // Essaie :
  try {
    // lit ses 375 premiers octets, la taille d'un en-tête LAS 1.4.
    const header = await readAt(file, 0, 375);
    // Moins de 227 octets (la taille d'un en-tête LAS 1.0), ou signature différente de « LASF » : ce n'est pas un LAS.
    if (header.length < 227 || header.toString('ascii', 0, 4) !== 'LASF') return null;

    // Taille de l'en-tête, lue à l'octet 94.
    const headerSize = header.readUInt16LE(94);
    // Trop petite : fichier incohérent.
    if (headerSize < 227) return null;

    // Version majeure, à l'octet 24.
    const versionMajor = header.readUInt8(24);
    // Version mineure, à l'octet 25.
    const versionMinor = header.readUInt8(25);
    // Format des points, à l'octet 104 ; les deux bits du haut, qui signalent la compression LAZ, sont retirés.
    const pointFormat = header.readUInt8(104) & 0x3f;
    // Nombre de points : en LAS 1.4 avec un en-tête complet,
    const pointCount = versionMinor >= 4 && headerSize >= 375 && header.length >= 375
      // le compteur sur 64 bits de l'octet 247, en texte ;
      ? header.readBigUInt64LE(247).toString()
      // sinon l'ancien compteur sur 32 bits de l'octet 107.
      : String(header.readUInt32LE(107));
    // Emprise, lue en nombres à virgule sur 64 bits :
    const bounds = {
      // maximum en X ;
      maxX: header.readDoubleLE(179),
      // minimum en X ;
      minX: header.readDoubleLE(187),
      // maximum en Y ;
      maxY: header.readDoubleLE(195),
      // minimum en Y ;
      minY: header.readDoubleLE(203),
      // maximum en Z ;
      maxZ: header.readDoubleLE(211),
      // minimum en Z.
      minZ: header.readDoubleLE(219),
    // Fin de l'emprise.
    };
    // Une valeur non finie : en-tête illisible.
    if (Object.values(bounds).some((value) => !Number.isFinite(value))) return null;

    // Cherche la référence spatiale dans les enregistrements du fichier.
    const wkt = await readProjectionWkt(file, header, headerSize);
    // Renvoie :
    return {
      // la version « majeure.mineure » ;
      version: `${versionMajor}.${versionMinor}`,
      // le format des points ;
      pointFormat,
      // le nombre de points ;
      pointCount,
      // l'emprise ;
      bounds,
      // la référence spatiale.
      coordinateSystemWkt: wkt,
    // Fin de l'objet.
    };
  // Dans tous les cas,
  } finally {
    // ferme le fichier.
    await file.close();
  // Fin du bloc.
  }
// Fin de readPointCloudHeader.
}

// Fonction readProjectionWkt ; ses paramètres :
async function readProjectionWkt(
  // le fichier ouvert ;
  file: Awaited<ReturnType<typeof open>>,
  // son en-tête ;
  header: Buffer,
  // la taille de cet en-tête.
  headerSize: number,
// Elle renvoie la référence spatiale en texte, ou null.
): Promise<string | null> {
  // Position du début des points : les enregistrements variables sont avant.
  const pointOffset = header.readUInt32LE(96);
  // Nombre d'enregistrements variables.
  const vlrCount = header.readUInt32LE(100);
  // Plus de 4 096 : fichier incohérent, on abandonne.
  if (vlrCount > 4096) return null;
  // Position de lecture : juste après l'en-tête.
  let offset = headerSize;
  // Pour chaque enregistrement variable :
  for (let i = 0; i < vlrCount; i++) {
    // lit son en-tête de 54 octets ;
    const record = await readAt(file, offset, 54);
    // lecture incomplète, ou en-tête qui déborde sur les points : on abandonne.
    if (record.length < 54 || offset + 54 > pointOffset) return null;
    // Son identifiant d'utilisateur, 16 octets de texte, sans les zéros de remplissage.
    const userId = record.toString('ascii', 2, 18).replace(/\0+$/, '').trim();
    // Son numéro.
    const recordId = record.readUInt16LE(18);
    // La longueur de son contenu.
    const recordLength = record.readUInt16LE(20);
    // Avance après l'en-tête.
    offset += 54;
    // Contenu qui déborde sur les points : on abandonne.
    if (offset + recordLength > pointOffset) return null;
    // Si c'est la référence spatiale en WKT (identifiant LASF_Projection, numéro 2112) et qu'elle fait un mégaoctet au plus :
    if (userId === 'LASF_Projection' && recordId === 2112 && recordLength <= 1_000_000) {
      // lit son contenu ;
      const value = await readAt(file, offset, recordLength);
      // et le renvoie en texte, sans les zéros de fin ; null s'il est vide.
      return value.toString('utf8').replace(/\0+$/, '').trim() || null;
    // Fin du cas.
    }
    // Sinon passe à l'enregistrement suivant.
    offset += recordLength;
  // Fin de la boucle.
  }

  // Sans en-tête LAS 1.4 complet, il n'y a pas d'enregistrements étendus : null.
  if (header.length < 375 || headerSize < 375) return null;
  // Position des enregistrements étendus, placés après les points.
  const evlrOffset = Number(header.readBigUInt64LE(235));
  // Leur nombre.
  const evlrCount = header.readUInt32LE(243);
  // Position ou nombre incohérents : null.
  if (!Number.isSafeInteger(evlrOffset) || evlrOffset <= 0 || evlrCount === 0 || evlrCount > 4096) return null;
  // Position de lecture : le premier enregistrement étendu.
  offset = evlrOffset;
  // Pour chaque enregistrement étendu :
  for (let i = 0; i < evlrCount; i++) {
    // lit son en-tête de 60 octets ;
    const record = await readAt(file, offset, 60);
    // lecture incomplète : on abandonne.
    if (record.length < 60) return null;
    // Son identifiant d'utilisateur.
    const userId = record.toString('ascii', 2, 18).replace(/\0+$/, '').trim();
    // Son numéro.
    const recordId = record.readUInt16LE(18);
    // La longueur de son contenu, sur 64 bits.
    const recordLength = Number(record.readBigUInt64LE(20));
    // Avance après l'en-tête.
    offset += 60;
    // Longueur incohérente : on abandonne.
    if (!Number.isSafeInteger(recordLength) || recordLength < 0 || offset + recordLength > Number.MAX_SAFE_INTEGER) return null;
    // Si c'est la référence spatiale en WKT, d'un mégaoctet au plus :
    if (userId === 'LASF_Projection' && recordId === 2112 && recordLength <= 1_000_000) {
      // lit son contenu ;
      const value = await readAt(file, offset, recordLength);
      // et le renvoie en texte.
      return value.toString('utf8').replace(/\0+$/, '').trim() || null;
    // Fin du cas.
    }
    // Sinon passe à l'enregistrement suivant.
    offset += recordLength;
  // Fin de la boucle.
  }
  // Aucune référence spatiale trouvée.
  return null;
// Fin de readProjectionWkt.
}

// Fonction readAt : lit un nombre d'octets à une position du fichier.
async function readAt(file: Awaited<ReturnType<typeof open>>, position: number, length: number): Promise<Buffer> {
  // Réserve la mémoire.
  const buffer = Buffer.alloc(length);
  // Lit ; bytesRead est le nombre d'octets réellement lus.
  const { bytesRead } = await file.read(buffer, 0, length, position);
  // Renvoie seulement ce qui a été lu (moins que demandé à la fin du fichier).
  return buffer.subarray(0, bytesRead);
// Fin de readAt.
}

// Fonction isWithin : un chemin est-il dans un dossier ?
function isWithin(root: string, path: string): boolean {
  // Chemin relatif du dossier vers ce chemin.
  const fromRoot = relative(root, path);
  // Oui s'il est vide (le dossier lui-même), ou s'il ne remonte pas (« .. ») et n'est pas absolu (autre disque sous Windows).
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
// Fin de isWithin.
}

/**
 * Convertit l'en-tête `Range` en plage d'octets. Seule la forme `bytes=a-b`, `bytes=a-` ou `bytes=-n` est acceptée :
 * c'est tout ce dont un lecteur COPC a besoin pour demander la hiérarchie puis des nœuds isolés.
 */
// Fonction parseRange : analyse l'en-tête Range par rapport à la taille du fichier.
export function parseRange(header: string | undefined, sizeBytes: number): ByteRange {
  // En-tête absent ou vide : le fichier entier.
  if (header === undefined || header.trim() === '') return { kind: 'full' };

  // Reconnaît « bytes=début-fin », chaque borne pouvant être vide.
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  // Autre forme : invalide.
  if (!match) return { kind: 'invalid' };

  // Les deux bornes, en texte.
  const [, rawStart, rawEnd] = match;
  // Aucune des deux : invalide.
  if (rawStart === '' && rawEnd === '') return { kind: 'invalid' };
  // Fichier vide : aucune plage possible.
  if (sizeBytes <= 0) return { kind: 'unsatisfiable' };

  // Sans début : forme « bytes=-n », les n derniers octets.
  if (rawStart === '') {
    // n, en nombre.
    const suffix = Number(rawEnd);
    // n non entier ou nul : invalide.
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: 'invalid' };
    // Plage : les n derniers octets, sans descendre sous 0.
    return { kind: 'partial', start: Math.max(0, sizeBytes - suffix), end: sizeBytes - 1 };
  // Fin du cas.
  }

  // Début, en nombre.
  const start = Number(rawStart);
  // Fin : le dernier octet du fichier si elle est absente.
  const end = rawEnd === '' ? sizeBytes - 1 : Number(rawEnd);
  // Bornes non entières, ou début après la fin : invalide.
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) return { kind: 'invalid' };
  // Début au-delà du fichier : aucune plage possible.
  if (start >= sizeBytes) return { kind: 'unsatisfiable' };
  // Plage : du début à la fin, sans dépasser le dernier octet.
  return { kind: 'partial', start, end: Math.min(end, sizeBytes - 1) };
// Fin de parseRange.
}

// Fonction isMissing : l'erreur signifie-t-elle « fichier ou dossier absent » ?
function isMissing(error: unknown): boolean {
  // Oui si son code système est ENOENT.
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
// Fin de isMissing.
}
