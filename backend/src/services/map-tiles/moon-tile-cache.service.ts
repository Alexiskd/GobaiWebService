// Outils NestJS : erreur 502, service injectable, journal, erreur 404.
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
// Fonctions de fichiers asynchrones de Node, sous le nom fs.
import { promises as fs } from 'node:fs';
// Fonctions de chemins de Node, sous le nom path.
import * as path from 'node:path';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Niveaux des couches de la Lune, nombres de colonnes et de lignes, et fournisseur NASA Trek de la Lune.
import { MOON_LAYER_LEVELS, moonCols, moonRows, NasaTrekMoonProvider } from './providers/nasa-trek-moon.provider';
// Cache en mémoire borné en octets.
import { ByteCache } from '../lidar-tiles/lidar-tiles';
// Ouvre l'import du module de reconstruction :
import {
  // ses fonctions et ses constantes ;
  accumulate, emptyStats, fillSource, holeMask, IDENTITY, linearMatch, MIN_HOLE_PIXELS, MOON_FILL, polarRows, reconstruct,
  // et le type d'un accord linéaire.
  type LinearMatch,
// Fin de l'import.
} from './moon-reconstruct';

/** Couche reconstruite (mosaïque Kaguya : zones vides comblées, pôles fondus avec LROC). */
// Identifiant de la couche reconstruite.
const REPAIRED_LAYER = 'moon-kaguya';
/** Tuiles gardées en mémoire vive (les plus demandées : niveaux bas, zone regardée). */
// Taille de la mémoire vive des tuiles : 32 Mo.
const MEMORY_BYTES = 32 * 1024 * 1024;
/** Qualité WebP des tuiles servies (images en gris : 3 à 4 fois plus légères que le PNG d'origine, sans perte visible). */
// Qualité WebP : 84.
const WEBP_QUALITY = 84;
/** Marge (pixels de la source) prise autour de la portion agrandie, pour que le filtre n'invente pas de bord. */
// Marge d'agrandissement : 4 pixels.
const UPSCALE_MARGIN = 4;
/** Tuiles enfants préparées d'avance : file bornée, deux à la fois. */
// Longueur maximale de la file d'avance : 64 tuiles.
const WARM_QUEUE = 64;
// Nombre de tuiles préparées d'avance en même temps : 2.
const WARM_CONCURRENCY = 2;

/** Type MIME d'une image d'après ses premiers octets (PNG, JPEG, WebP) ; `fallback` sinon. */
// Fonction sniffImageType ; type par défaut : PNG.
export function sniffImageType(body: Uint8Array, fallback = 'image/png'): string {
  // Au moins 12 octets, qui commencent par « RIFF »
  if (body.length >= 12 && body[0] === 0x52 && body[1] === 0x49 && body[2] === 0x46 && body[3] === 0x46
    // et portent « WEBP » aux octets 8 à 11 : WebP.
    && body[8] === 0x57 && body[9] === 0x45 && body[10] === 0x42 && body[11] === 0x50) return 'image/webp';
  // Signature PNG : PNG.
  if (body.length >= 4 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return 'image/png';
  // FF D8 au début : JPEG.
  if (body.length >= 2 && body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
  // Sinon : le type par défaut.
  return fallback;
// Fin de sniffImageType.
}

/**
 * Portion à extraire d'une image source pour l'agrandir : la portion demandée (fractions de 0 à 1) plus une marge de
 * `margin` pixels là où l'image en a, et le facteur d'agrandissement vers `width` pixels de large.
 */
// Fonction upscalePlan ; marge de 4 pixels par défaut.
export function upscalePlan(crop: { left: number; top: number; size: number }, srcW: number, srcH: number, width: number, margin = UPSCALE_MARGIN) {
  // Largeur et hauteur de la portion, en pixels de la source (au moins 1).
  const sideW = Math.max(1, Math.round(crop.size * srcW)), sideH = Math.max(1, Math.round(crop.size * srcH));
  // Bords gauche et haut de la portion, sans sortir de l'image.
  const left = Math.min(srcW - sideW, Math.round(crop.left * srcW)), top = Math.min(srcH - sideH, Math.round(crop.top * srcH));
  // Facteur d'agrandissement.
  const scale = width / sideW;
  // Sans agrandissement, pas de marge : l'image est prise telle quelle.
  // Marge : seulement s'il y a agrandissement.
  const m = scale > 1 ? margin : 0;
  // Marges à gauche, en haut, à droite et en bas, bornées par ce que l'image a.
  const padL = Math.min(m, left), padT = Math.min(m, top), padR = Math.min(m, srcW - left - sideW), padB = Math.min(m, srcH - top - sideH);
  // Renvoie
  return {
    // la zone à extraire, marges comprises ;
    extract: { left: left - padL, top: top - padT, width: sideW + padL + padR, height: sideH + padT + padB },
    // le facteur, et les marges de gauche et du haut.
    scale, padL, padT,
  // Fin de l'objet.
  };
// Fin de upscalePlan.
}

/** Décodage et encodage des images (sharp en production, remplacé dans les tests). */
// Forme d'un codec d'images.
export interface MoonImageCodec {
  /** Image → pixels RGBA. */
  // decode : une image vers ses pixels RGBA et ses dimensions.
  decode(body: Buffer): Promise<{ data: Uint8Array; width: number; height: number }>;
  /**
   * Portion d'une image (fractions de 0 à 1), ramenée à width × height, en gris (un octet par pixel). Une portion
   * plus petite que la sortie est agrandie finement (filtre de Lanczos, puis netteté rendue).
   */
  // gray : une portion d'image en gris, à la taille demandée.
  gray(body: Buffer, crop: { left: number; top: number; size: number }, width: number, height: number): Promise<Uint8Array>;
  /** Pixels RGBA → image compacte à servir (WebP ; PNG si le WebP échoue). */
  // encode : des pixels RGBA vers une image à servir.
  encode(rgba: Uint8Array, width: number, height: number): Promise<{ body: Buffer; contentType: string }>;
  /** Image → WebP, sans passer par les pixels (tuiles servies sans retouche : deux fois moins de calcul). */
  // recompress : une image vers du WebP.
  recompress(body: Buffer): Promise<{ body: Buffer; contentType: string }>;
// Fin de MoonImageCodec.
}

/**
 * Pixels RVBA → tampon brut le plus étroit qui les décrit : 1 canal (gris opaque), 3 (couleur opaque) ou 4.
 * Une tuile de la Lune est presque toujours grise et opaque : un seul canal à compresser.
 */
// Fonction compactPixels.
export function compactPixels(rgba: Uint8Array): { data: Uint8Array; channels: 1 | 3 | 4 } {
  // Nombre de pixels.
  const n = rgba.length >> 2;
  // Deux indicateurs : tout opaque, tout gris.
  let opaque = true, gray = true;
  // Parcourt les pixels tant qu'un des deux tient encore :
  for (let i = 0; i < n && (opaque || gray); i++) {
    // position de ses 4 octets ;
    const p = i * 4;
    // un pixel non opaque : pas opaque ;
    if (rgba[p + 3] !== 255) opaque = false;
    // trois couleurs différentes : pas gris.
    if (rgba[p] !== rgba[p + 1] || rgba[p] !== rgba[p + 2]) gray = false;
  // Fin de la boucle.
  }
  // Pas opaque : les 4 canaux, tels quels.
  if (!opaque) return { data: rgba, channels: 4 };
  // Nombre de canaux : 1 pour du gris, 3 sinon.
  const channels = gray ? 1 : 3;
  // Tampon de sortie.
  const data = new Uint8Array(n * channels);
  // Y copie les canaux utiles de chaque pixel.
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) data[i * channels + c] = rgba[i * 4 + c];
  // Renvoie le tampon et son nombre de canaux.
  return { data, channels };
// Fin de compactPixels.
}

/** Pixels bruts de 1 à 4 canaux (gris, gris + alpha, RVB, RVBA) → RVBA. */
// Fonction toRgba.
export function toRgba(data: Uint8Array, channels: number): Uint8Array {
  // Déjà 4 canaux : rien à faire.
  if (channels === 4) return data;
  // Nombre de pixels.
  const n = Math.floor(data.length / channels);
  // Tampon de sortie, 4 octets par pixel.
  const out = new Uint8Array(n * 4);
  // Pour chaque pixel :
  for (let i = 0; i < n; i++) {
    // position de ses octets ;
    const p = i * channels;
    // gris s'il a moins de 3 canaux ;
    const gray = channels < 3;
    // rouge : le premier canal ;
    out[i * 4] = data[p];
    // vert : le même en gris, sinon le deuxième ;
    out[i * 4 + 1] = gray ? data[p] : data[p + 1];
    // bleu : le même en gris, sinon le troisième ;
    out[i * 4 + 2] = gray ? data[p] : data[p + 2];
    // alpha : le deuxième canal s'il y en a 2, sinon opaque.
    out[i * 4 + 3] = channels === 2 ? data[p + 1] : 255;
  // Fin de la boucle.
  }
  // Renvoie le tampon.
  return out;
// Fin de toRgba.
}

/** Ce que ce service utilise de sharp (décrit ici : le typage de la bibliothèque change d'une version à l'autre). */
// Forme d'une image sharp, limitée à ce que ce service utilise.
interface SharpImage {
  // raw : sortie en pixels bruts.
  raw(): SharpImage;
  // greyscale : passage en gris.
  greyscale(): SharpImage;
  // png : sortie en PNG.
  png(): SharpImage;
  // webp : sortie en WebP, avec qualité et effort.
  webp(options: { quality: number; effort: number }): SharpImage;
  // sharpen : netteté.
  sharpen(options: { sigma: number }): SharpImage;
  // extract : découpe d'une zone.
  extract(region: { left: number; top: number; width: number; height: number }): SharpImage;
  // resize : changement de taille, avec le filtre choisi.
  resize(width: number, height: number, options: { fit: 'fill'; kernel: 'cubic' | 'lanczos3' }): SharpImage;
  // metadata : dimensions de l'image.
  metadata(): Promise<{ width?: number; height?: number }>;
  // toBuffer : les octets.
  toBuffer(): Promise<Buffer>;
  // toBuffer avec option : les octets et leurs dimensions.
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number; channels: number } }>;
// Fin de SharpImage.
}
// Type SharpFactory : la fonction sharp, qui prend des octets (et, pour des pixels bruts, leurs dimensions).
type SharpFactory = (input: Buffer, options?: { raw: { width: number; height: number; channels: number } }) => SharpImage;

/** Fonction sharp d'un module chargé par require ou import (export direct, ou export par défaut). */
// Fonction sharpFrom.
function sharpFrom(mod: unknown): SharpFactory | null {
  // Prend l'export par défaut du module, sinon le module lui-même.
  const candidate = (mod as { default?: unknown } | null)?.default ?? mod;
  // Le renvoie si c'est une fonction, sinon null.
  return typeof candidate === 'function' ? (candidate as SharpFactory) : null;
// Fin de sharpFrom.
}

/**
 * Codec sharp, chargé à la première utilisation : si la bibliothèque ne se charge pas sur cette machine, le serveur
 * démarre quand même et sert les tuiles telles quelles (null). Essai par require, puis par import (bibliothèque
 * publiée en module ES seulement).
 */
// Fonction sharpCodec.
async function sharpCodec(): Promise<MoonImageCodec | null> {
  // La fonction sharp : pas encore chargée.
  let sharp: SharpFactory | null = null;
  // Premier essai :
  try {
    // par require (la ligne du dessous autorise ce require pour ESLint).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharp = sharpFrom(require('sharp'));
  // En cas d'échec : essai suivant.
  } catch { /* essai suivant */ }
  // Si elle n'est pas chargée :
  if (!sharp) {
    // second essai :
    try {
      // import() natif, que la compilation en CommonJS ne doit pas transformer en require.
      // fabrique une fonction qui appelle import() ;
      const load = new Function('name', 'return import(name)') as (name: string) => Promise<unknown>;
      // charge sharp avec elle.
      sharp = sharpFrom(await load('sharp'));
    // En cas d'échec : pas de sharp.
    } catch { /* pas de sharp */ }
  // Fin du cas.
  }
  // Toujours pas chargée : null.
  if (!sharp) return null;
  // La garde sous le nom make.
  const make = sharp;
  // Renvoie le codec :
  return {
    // méthode decode :
    async decode(body) {
      // lit les pixels bruts et leurs dimensions ;
      const { data, info } = await make(body).raw().toBuffer({ resolveWithObject: true });
      // les rend en RGBA.
      return { data: toRgba(new Uint8Array(data), info.channels), width: info.width, height: info.height };
    // Fin de decode.
    },
    // Méthode gray :
    async gray(body, crop, width, height) {
      // lit les dimensions de l'image ;
      const meta = await make(body).metadata();
      // calcule la zone à extraire et le facteur ;
      const plan = upscalePlan(crop, meta.width ?? width, meta.height ?? height, width);
      // Agrandissement : la portion est prise avec une marge, agrandie au filtre de Lanczos (plus net que le
      // bicubique), puis la netteté perdue est rendue, d'autant plus que l'agrandissement est fort (× 2 à × 8).
      // La marge est retirée ensuite : le bord de la tuile est calculé avec ses vrais voisins.
      // taille de la zone une fois agrandie ;
      const w2 = Math.round(plan.extract.width * plan.scale), h2 = Math.round(plan.extract.height * plan.scale);
      // extrait, redimensionne (Lanczos si on agrandit, bicubique sinon), passe en gris ;
      let image = make(body).extract(plan.extract).resize(w2, h2, { fit: 'fill', kernel: plan.scale > 1 ? 'lanczos3' : 'cubic' }).greyscale();
      // si on agrandit, rend de la netteté, d'autant plus que le facteur est grand (1,3 au plus) ;
      if (plan.scale > 1) image = image.sharpen({ sigma: Math.min(1.3, 0.5 + 0.25 * Math.log2(plan.scale)) });
      // lit les pixels bruts ;
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      // tampon de sortie, un octet par pixel ;
      const out = new Uint8Array(width * height);
      // décalage dû aux marges, à gauche et en haut ;
      const x0 = Math.round(plan.padL * plan.scale), y0 = Math.round(plan.padT * plan.scale);
      // pour chaque ligne :
      for (let y = 0; y < height; y++) {
        // début de la ligne source, sans sortir de l'image ;
        const row = Math.min(info.height - 1, y0 + y) * info.width;
        // copie le premier canal de chaque pixel, sans sortir de l'image.
        for (let x = 0; x < width; x++) out[y * width + x] = data[(row + Math.min(info.width - 1, x0 + x)) * info.channels];
      // Fin de la boucle.
      }
      // Renvoie le tampon.
      return out;
    // Fin de gray.
    },
    // Méthode encode :
    async encode(rgba, width, height) {
      // réduit les pixels au nombre de canaux utile ;
      const { data, channels } = compactPixels(rgba);
      // fonction image : une image sharp faite de ces pixels bruts ;
      const image = () => make(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { raw: { width, height, channels } });
      // essaie
      try {
        // de l'encoder en WebP ;
        return { body: await image().webp({ quality: WEBP_QUALITY, effort: 2 }).toBuffer(), contentType: 'image/webp' };
      // en cas d'échec,
      } catch {
        // l'encode en PNG.
        return { body: await image().png().toBuffer(), contentType: 'image/png' };
      // Fin du cas.
      }
    // Fin de encode.
    },
    // Méthode recompress :
    async recompress(body) {
      // encode l'image en WebP.
      return { body: await make(body).webp({ quality: WEBP_QUALITY, effort: 2 }).toBuffer(), contentType: 'image/webp' };
    // Fin de recompress.
    },
  // Fin du codec.
  };
// Fin de sharpCodec.
}

// Délai maximal d'un téléchargement : 30 secondes.
const TIMEOUT_MS = 30_000;
// Taille maximale d'une tuile : 4 Mo.
const MAX_BYTES = 4 * 1024 * 1024;
// Nombre d'essais : 3.
const RETRIES = 3;

// Forme d'une tuile de la Lune.
export interface MoonTile {
  // body : ses octets.
  body: Buffer;
  // contentType : son type de contenu.
  contentType: string;
  /** true = servie depuis la mémoire ou le disque du serveur. */
  // cached : vrai si elle vient du cache.
  cached: boolean;
// Fin de MoonTile.
}

// Forme de l'état du préchargement.
export interface MoonPrefetchStatus {
  // running : en cours ou non.
  running: boolean;
  // maxZoom : niveau maximal.
  maxZoom: number;
  // done : tuiles traitées.
  done: number;
  // total : tuiles à traiter.
  total: number;
  // failed : tuiles en échec.
  failed: number;
// Fin de MoonPrefetchStatus.
}

/**
 * Cache des tuiles de la Lune (NASA Moon Trek). Une tuile est téléchargée une seule fois chez la NASA, préparée,
 * écrite dans `MOON_TILE_CACHE_DIR/{couche}/{z}/{x}/{y}.tile`, puis servie depuis le disque (quelques millisecondes)
 * ou depuis la mémoire vive pour les plus demandées (32 Mo).
 *
 * Préparation : chaque tuile est recompressée en WebP (3 à 4 fois plus légère que le PNG de la NASA, donc affichée
 * plus vite). Si sharp manque, les tuiles sont servies telles quelles.
 *
 * Avance : quand une tuile est demandée par l'application, ses quatre tuiles enfants (niveau suivant) sont
 * préparées en arrière-plan : en zoomant, elles sont déjà sur le serveur au lieu d'être cherchées chez la NASA.
 *
 * Priorité à l'affichage : tant que l'application attend une tuile, le préchargement du démarrage et l'avance
 * patientent. Le serveur n'a qu'une fraction de processeur : la tuile regardée passe avant le travail de fond.
 *
 * Préchargement : toutes les tuiles des niveaux 0 à `MOON_PREFETCH_MAX_ZOOM` des deux couches (Kaguya et LOLA).
 * Nombre de tuiles par couche jusqu'au niveau n : 2·(4^(n+1) − 1)/3 → n=4 : 682, n=6 : 10 922, n=8 : 174 762.
 * Les tuiles déjà sur le disque sont sautées : relancer le préchargement ne retélécharge rien.
 *
 * Reconstruction : avant d'être enregistrée, une tuile Kaguya qui a des zones vides (pixels transparents ou noirs),
 * ou qui manque chez la NASA, est comblée par la mosaïque mondiale LROC WAC, agrandie finement au-delà de son niveau
 * natif. Au-delà de 70° de latitude, les parties de Kaguya qui ne sont pas réalistes sont fondues avec LROC (voir
 * moon-reconstruct.ts). Si le remplissage échoue (image illisible, NASA injoignable), la tuile est servie telle quelle.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du cache des tuiles de la Lune.
export class MoonTileCacheService {
  // Journal préfixé par « MoonTiles ».
  private readonly log = new Logger('MoonTiles');
  // Chargements en cours, par clé.
  private readonly inflight = new Map<string, Promise<MoonTile>>();
  // Dossier du cache.
  private readonly dir: string;
  // État du préchargement.
  private prefetch: MoonPrefetchStatus;
  // Téléchargements de remplissage en cours.
  private readonly fillInflight = new Map<string, Promise<Buffer>>();
  // Codec, chargé une seule fois.
  private codecLoaded?: Promise<MoonImageCodec | null>;
  // Accord de la Lune entière, mesuré une seule fois.
  private matchLoaded?: Promise<LinearMatch>;
  // Mémoire vive des tuiles.
  private readonly memory = new ByteCache(MEMORY_BYTES);
  /** Niveau le plus fin de la mosaïque de remplissage : le niveau 8 est essayé, puis abandonné s'il manque. */
  // Niveau le plus fin du remplissage : 8 au départ.
  private fillTop: number = MOON_FILL.probeZoom;
  /** Tuiles enfants à préparer d'avance (les dernières demandées d'abord), et celles déjà mises en file. */
  // File des tuiles à préparer d'avance.
  private readonly warmQueue: Array<{ id: string; z: number; x: number; y: number }> = [];
  // Clés des tuiles déjà mises en file.
  private readonly warmSeen = new Set<string>();
  // Nombre de préparations d'avance en cours.
  private warming = 0;
  /** Demandes de l'application en cours : le préchargement et l'avance attendent qu'elles soient servies. */
  // Nombre de demandes de l'application en cours.
  private foreground = 0;
  /** Depuis le démarrage : tuiles aux zones vides comblées, tuiles aux pôles fondus, préparations en échec. */
  // Nombre de tuiles aux zones vides comblées.
  private repaired = 0;
  // Nombre de tuiles aux pôles fondus.
  private blended = 0;
  // Nombre de préparations en échec.
  private repairFailed = 0;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration ;
    private readonly config: AppConfig,
    // le fournisseur NASA Trek, créé par défaut avec la configuration ;
    private readonly provider: NasaTrekMoonProvider = new NasaTrekMoonProvider(config.tiles.moon),
    // la fonction de téléchargement, fetch par défaut ;
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    /** Codec d'images : sharp par défaut ; null = pas de reconstruction. */
    // un codec imposé (facultatif).
    private readonly codecOverride?: MoonImageCodec | null,
  // Corps du constructeur :
  ) {
    // chemin absolu du dossier du cache ;
    this.dir = path.resolve(config.tiles.moonCache.dir);
    // état du préchargement, à zéro.
    this.prefetch = { running: false, maxZoom: config.tiles.moonCache.prefetchMaxZoom, done: 0, total: 0, failed: 0 };
  // Fin du constructeur.
  }

  // Méthode status.
  status(): MoonPrefetchStatus {
    // Renvoie une copie de l'état.
    return { ...this.prefetch };
  // Fin de status.
  }

  /** Reconstruction depuis le démarrage : zones vides comblées, pôles fondus, échecs, tuiles préparées d'avance en file. */
  // Méthode repairStatus.
  repairStatus(): { repaired: number; blended: number; failed: number; warming: number } {
    // Renvoie les trois compteurs, et le nombre de tuiles d'avance en file ou en cours.
    return { repaired: this.repaired, blended: this.blended, failed: this.repairFailed, warming: this.warmQueue.length + this.warming };
  // Fin de repairStatus.
  }

  // Méthode privée codec.
  private codec(): Promise<MoonImageCodec | null> {
    // Au premier appel : le codec imposé, sinon celui de sharp ; puis :
    this.codecLoaded ??= (this.codecOverride !== undefined ? Promise.resolve(this.codecOverride) : sharpCodec()).then((codec) => {
      // s'il manque, un avertissement dans le journal ;
      if (!codec) this.log.warn('sharp indisponible : les tuiles de la Lune sont servies telles quelles (ni reconstruction, ni WebP).');
      // rend le codec.
      return codec;
    // Fin du traitement.
    });
    // Renvoie la promesse.
    return this.codecLoaded;
  // Fin de codec.
  }

  /**
   * Tuile depuis la mémoire ou le disque, sinon téléchargée chez la NASA, préparée et enregistrée. Les demandes
   * simultanées sont regroupées. `ahead` (demande de l'application) : les quatre tuiles enfants sont préparées d'avance.
   */
  // Méthode get.
  get(layerId: string, z: number, x: number, y: number, options: { ahead?: boolean } = {}): Promise<MoonTile> {
    // Adresse de la tuile chez la NASA.
    const url = this.provider.upstreamUrl(layerId, z, x, y);
    // Aucune : erreur 404.
    if (!url) throw new NotFoundException(`Tuile lunaire inexistante : ${layerId} ${z}/${x}/${y}.`);
    // Clé de la tuile.
    const key = `${layerId}/${z}/${x}/${y}`;
    // Demande de l'application : met les enfants en file.
    if (options.ahead) this.warmChildren(layerId, z, x, y);
    // Cherche en mémoire vive.
    const hot = this.memory.get(key);
    // Trouvée : la renvoie.
    if (hot) return Promise.resolve({ body: hot, contentType: sniffImageType(hot), cached: true });
    // Cherche un chargement en cours.
    let p = this.inflight.get(key);
    // Aucun :
    if (!p) {
      // lance le chargement, et le retire de la liste à la fin ;
      p = this.load(key, url, layerId, { z, x, y }).finally(() => this.inflight.delete(key));
      // l'inscrit dans la liste.
      this.inflight.set(key, p);
    // Fin du cas.
    }
    // Travail de fond : renvoie la promesse.
    if (!options.ahead) return p;
    // Demande de l'application : elle passe avant le travail de fond (voir quiet).
    // Une demande de l'application de plus.
    this.foreground++;
    // Renvoie la promesse ; à la fin, une demande de moins.
    return p.finally(() => { this.foreground--; });
  // Fin de get.
  }

  /**
   * Attend que l'application n'ait plus de tuile en cours (10 s au plus) : le préchargement et l'avance ne prennent
   * pas le processeur à une tuile que quelqu'un attend à l'écran.
   */
  // Méthode privée quiet.
  private async quiet(): Promise<void> {
    // Tant que l'application attend une tuile, patiente 40 ms, 250 fois au plus.
    for (let i = 0; this.foreground > 0 && i < 250; i++) await new Promise((r) => setTimeout(r, 40));
  // Fin de quiet.
  }

  /** Met en file les quatre enfants d'une tuile (niveau suivant, s'il existe) pour les préparer en arrière-plan. */
  // Méthode privée warmChildren.
  private warmChildren(layerId: string, z: number, x: number, y: number): void {
    // Pas d'avance pendant le préchargement du démarrage : il passe d'abord, la Lune entière est vite disponible.
    // Rien pendant le préchargement, ni s'il n'y a pas de niveau suivant.
    if (this.prefetch.running || !this.provider.upstreamUrl(layerId, z + 1, 2 * x, 2 * y)) return;
    // Pour les deux lignes,
    for (let dy = 0; dy < 2; dy++) {
      // et les deux colonnes :
      for (let dx = 0; dx < 2; dx++) {
        // la tuile enfant ;
        const job = { id: layerId, z: z + 1, x: 2 * x + dx, y: 2 * y + dy };
        // sa clé ;
        const key = `${job.id}/${job.z}/${job.x}/${job.y}`;
        // déjà en file : suivante ;
        if (this.warmSeen.has(key)) continue;
        // plus de 50 000 clés retenues : on les oublie toutes ;
        if (this.warmSeen.size > 50_000) this.warmSeen.clear();
        // retient la clé ;
        this.warmSeen.add(key);
        // met la tuile en file.
        this.warmQueue.push(job);
      // Fin des colonnes.
      }
    // Fin des lignes.
    }
    // File bornée : les plus anciennes demandes (zone quittée) sont oubliées, et pourront être redemandées.
    // Tant que la file dépasse 64 :
    while (this.warmQueue.length > WARM_QUEUE) {
      // retire la plus ancienne ;
      const old = this.warmQueue.shift();
      // oublie sa clé.
      if (old) this.warmSeen.delete(`${old.id}/${old.z}/${old.x}/${old.y}`);
    // Fin de la boucle.
    }
    // Tant qu'il reste une place et une tuile :
    while (this.warming < WARM_CONCURRENCY && this.warmQueue.length) {
      // une préparation de plus ;
      this.warming++;
      // la lance, sans l'attendre.
      void this.warmNext();
    // Fin de la boucle.
    }
  // Fin de warmChildren.
  }

  // Méthode privée warmNext.
  private async warmNext(): Promise<void> {
    // Essaie :
    try {
      // Dernières demandées d'abord : c'est la zone que l'on regarde maintenant.
      // prend la dernière tuile de la file, tant qu'il y en a ;
      for (let job = this.warmQueue.pop(); job; job = this.warmQueue.pop()) {
        // attend que l'application ne demande plus rien ;
        await this.quiet();
        // charge la tuile ; un échec est ignoré.
        try { await this.get(job.id, job.z, job.x, job.y); } catch { /* tuile absente ou NASA injoignable : sans suite */ }
      // Fin de la boucle.
      }
    // Dans tous les cas :
    } finally {
      // une préparation de moins.
      this.warming--;
    // Fin du cas.
    }
  // Fin de warmNext.
  }

  // Méthode privée file.
  private file(key: string) {
    // Chemin du fichier : le dossier, la clé, l'extension « .tile ».
    return path.join(this.dir, `${key}.tile`);
  // Fin de file.
  }

  // Méthode privée load.
  private async load(key: string, url: string, layerId: string, c: { z: number; x: number; y: number }): Promise<MoonTile> {
    // Chemin du fichier.
    const file = this.file(key);
    // Essaie
    try {
      // de le lire ;
      const body = await fs.readFile(file);
      // de le garder en mémoire vive ;
      this.memory.set(key, body);
      // et de le renvoyer, marqué « du cache ».
      return { body, contentType: sniffImageType(body), cached: true };
    // Fichier absent : on continue.
    } catch { /* pas encore en cache */ }

    // Tuile à préparer.
    let tile: MoonTile;
    // Essaie
    try {
      // de la télécharger et de la préparer.
      tile = await this.prepare(layerId, c, await this.download(url));
    // En cas d'échec :
    } catch (e) {
      // Tuile absente de la mosaïque Kaguya : reconstruite en entier à partir du remplissage, si possible.
      // pour la couche reconstruite et une tuile absente, la reconstruit en entier ; sinon rien ;
      const rebuilt = layerId === REPAIRED_LAYER && e instanceof NotFoundException ? await this.prepare(layerId, c, null) : null;
      // rien : relance l'erreur ;
      if (!rebuilt) throw e;
      // garde la tuile reconstruite.
      tile = rebuilt;
    // Fin du cas.
    }
    // La garde en mémoire vive.
    this.memory.set(key, tile.body);
    // Essaie
    try {
      // de créer le dossier ;
      await fs.mkdir(path.dirname(file), { recursive: true });
      // Écriture atomique : un fichier à moitié écrit (arrêt du serveur) ne sera jamais servi.
      // nom d'un fichier temporaire ;
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      // d'y écrire la tuile ;
      await fs.writeFile(tmp, tile.body);
      // puis de le renommer.
      await fs.rename(tmp, file);
    // En cas d'échec :
    } catch (e) {
      // un avertissement dans le journal.
      this.log.warn(`Écriture du cache impossible (${file}) : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Renvoie la tuile.
    return tile;
  // Fin de load.
  }

  /**
   * Prépare une tuile avant de l'enregistrer : mosaïque Kaguya reconstruite (zones vides comblées, pôles fondus avec
   * LROC), puis recompression en WebP. `tile` null : tuile Kaguya absente, reconstruite en entier (256 × 256).
   * Renvoie la tuile d'origine (ou null) si la préparation échoue.
   */
  // Première signature de prepare : avec une tuile, elle rend une tuile.
  private async prepare(layerId: string, c: { z: number; x: number; y: number }, tile: MoonTile): Promise<MoonTile>;
  // Seconde signature : sans tuile, elle rend une tuile ou null.
  private async prepare(layerId: string, c: { z: number; x: number; y: number }, tile: null): Promise<MoonTile | null>;
  // Méthode privée prepare.
  private async prepare(layerId: string, c: { z: number; x: number; y: number }, tile: MoonTile | null): Promise<MoonTile | null> {
    // Codec.
    const codec = await this.codec();
    // Sans codec : la tuile telle quelle.
    if (!codec) return tile;
    // Essaie :
    try {
      // Couche sans retouche (relief LOLA) : recompression directe.
      // autre couche que la reconstruite : recompression directe ;
      if (tile && layerId !== REPAIRED_LAYER) return { ...(await codec.recompress(tile.body)), cached: false };
      // pixels de la tuile, ou 256 × 256 pixels transparents s'il n'y a pas de tuile ;
      const img = tile ? await codec.decode(tile.body) : { data: new Uint8Array(256 * 256 * 4), width: 256, height: 256 };
      // pour la couche reconstruite :
      if (layerId === REPAIRED_LAYER) {
        // masque des pixels vides ;
        const hole = holeMask(img.data, img.width, img.height);
        // y a-t-il assez de pixels vides ?
        const holes = hole.holes >= MIN_HOLE_PIXELS;
        // latitudes de la tuile si elle est polaire ;
        const polar = polarRows(c.z, c.y);
        // s'il faut reconstruire :
        if (holes || polar) {
          // image de remplissage et portion à extraire ;
          const { body, src } = await this.fillFor(c);
          // la portion en gris, à la taille de la tuile ;
          const fill = await codec.gray(body, src, img.width, img.height);
          // reconstruit les pixels ;
          reconstruct(img.data, fill, img.width, img.height, hole, { polar, global: await this.globalMatch(codec) });
          // compte les zones vides comblées ;
          if (holes) this.repaired++;
          // compte les pôles fondus.
          if (polar) this.blended++;
        // Fin du cas.
        }
      // Fin du cas.
      }
      // Encode les pixels et renvoie la tuile.
      return { ...(await codec.encode(img.data, img.width, img.height)), cached: false };
    // En cas d'échec :
    } catch (e) {
      // Journal limité : une NASA injoignable ferait sinon une ligne par tuile.
      // écrit les 5 premiers échecs dans le journal ;
      if (this.repairFailed++ < 5) this.log.warn(`Préparation impossible (${layerId} ${c.z}/${c.x}/${c.y}) : ${(e as Error).message}`);
      // renvoie la tuile d'origine.
      return tile;
    // Fin du cas.
    }
  // Fin de prepare.
  }

  /**
   * Image de remplissage LROC WAC qui couvre la tuile, et la portion à en extraire. Prise au niveau le plus fin
   * disponible : le niveau 8 est essayé d'abord (et abandonné pour la suite s'il ne répond pas), puis le niveau 7 ;
   * si la tuile manque (404), un ancêtre, jusqu'à trois niveaux au-dessus.
   */
  // Méthode privée fillFor.
  private async fillFor(c: { z: number; x: number; y: number }): Promise<{ body: Buffer; src: ReturnType<typeof fillSource> }> {
    // Niveau le plus fin à essayer.
    let top = this.fillTop;
    // Boucle d'essais :
    for (let tries = 0; ; tries++) {
      // tuile de remplissage et portion ;
      const src = fillSource(c.z, c.x, c.y, top);
      // essaie
      try {
        // de la charger et de la renvoyer.
        return { body: await this.fillTile(src.z, src.x, src.y), src };
      // En cas d'échec :
      } catch (e) {
        // était-ce un essai au-delà du niveau sûr ?
        const probing = src.z > MOON_FILL.maxZoom;
        // non, et l'erreur n'est pas un 404, ou 3 essais sont faits, ou on est au niveau 0 : relance l'erreur ;
        if (!probing && (!(e instanceof NotFoundException) || tries >= 3 || src.z === 0)) throw e;
        // oui, et ce niveau était encore retenu :
        if (probing && this.fillTop >= src.z) {
          // on l'abandonne pour la suite ;
          this.fillTop = src.z - 1;
          // et on l'écrit dans le journal.
          this.log.log(`Mosaïque LROC WAC : pas de niveau ${src.z} chez la NASA, niveau ${src.z - 1} agrandi à la place.`);
        // Fin du cas.
        }
        // Essaie un niveau au-dessus.
        top = src.z - 1;
      // Fin du cas.
      }
    // Fin de la boucle.
    }
  // Fin de fillFor.
  }

  /**
   * Accord de luminosité et de contraste entre les deux mosaïques, mesuré une fois sur la Lune entière (niveau 0 :
   * deux tuiles par mosaïque). Sert près des pôles et pour les tuiles presque vides : le même accord pour toutes les
   * tuiles, donc pas de damier. Identité si la mesure échoue.
   */
  // Méthode privée globalMatch.
  private globalMatch(codec: MoonImageCodec): Promise<LinearMatch> {
    // Au premier appel, lance la mesure :
    this.matchLoaded ??= (async () => {
      // sommes à zéro ;
      const stats = emptyStats();
      // pour les deux tuiles du niveau 0 :
      for (let x = 0; x < 2; x++) {
        // adresse de la tuile Kaguya ;
        const url = this.provider.upstreamUrl(REPAIRED_LAYER, 0, x, 0);
        // aucune : suivante ;
        if (!url) continue;
        // la télécharge et la décode ;
        const img = await codec.decode((await this.download(url)).body);
        // la tuile de remplissage, en gris, à la même taille ;
        const fill = await codec.gray(await this.fillTile(0, x, 0), { left: 0, top: 0, size: 1 }, img.width, img.height);
        // ajoute leurs pixels valides aux sommes.
        accumulate(stats, img.data, fill, holeMask(img.data, img.width, img.height).mask);
      // Fin de la boucle.
      }
      // Accord, s'il y a au moins 1 000 pixels.
      const match = stats.count >= 1000 ? linearMatch(stats) : null;
      // Aucun : l'accord qui ne change rien.
      if (!match) return IDENTITY;
      // L'écrit dans le journal.
      this.log.log(`Accord LROC → Kaguya mesuré sur la Lune entière : gain ${match.gain.toFixed(2)}, décalage ${match.offset.toFixed(1)}`);
      // Rend l'accord.
      return match;
    // En cas d'échec :
    })().catch((e) => {
      // un avertissement dans le journal ;
      this.log.warn(`Accord LROC → Kaguya non mesuré (${(e as Error).message}) : mosaïque LROC utilisée telle quelle.`);
      // l'accord qui ne change rien.
      return IDENTITY;
    // Fin du cas.
    });
    // Renvoie la promesse.
    return this.matchLoaded;
  // Fin de globalMatch.
  }

  /** Tuile de la mosaïque de remplissage (LROC WAC) : disque, sinon NASA. Les demandes simultanées sont regroupées. */
  // Méthode privée fillTile.
  private fillTile(z: number, x: number, y: number): Promise<Buffer> {
    // Clé de la tuile.
    const key = `${z}/${x}/${y}`;
    // Cherche un téléchargement en cours.
    let p = this.fillInflight.get(key);
    // Aucun :
    if (!p) {
      // lance le chargement :
      p = (async () => {
        // chemin du fichier, dans le dossier « moon-wac » ;
        const file = path.join(this.dir, 'moon-wac', `${key}.${MOON_FILL.extension}`);
        // le renvoie s'il est sur le disque ;
        try { return await fs.readFile(file); } catch { /* pas encore en cache */ }
        // adresse de la tuile chez la NASA ;
        const url = `${this.config.tiles.moon.baseUrl}/${MOON_FILL.path}/1.0.0/default/${MOON_FILL.matrixSet}/${z}/${y}/${x}.${MOON_FILL.extension}`;
        // la télécharge ;
        const { body } = await this.download(url);
        // essaie
        try {
          // de créer le dossier ;
          await fs.mkdir(path.dirname(file), { recursive: true });
          // nom d'un fichier temporaire ;
          const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
          // d'y écrire la tuile ;
          await fs.writeFile(tmp, body);
          // puis de le renommer.
          await fs.rename(tmp, file);
        // Un échec d'écriture est ignoré.
        } catch { /* cache facultatif */ }
        // Rend les octets.
        return body;
      // À la fin, retire le chargement de la liste.
      })().finally(() => this.fillInflight.delete(key));
      // L'inscrit dans la liste.
      this.fillInflight.set(key, p);
    // Fin du cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de fillTile.
  }

  // Méthode privée download.
  private async download(url: string): Promise<MoonTile> {
    // Dernière erreur.
    let last = '';
    // Trois essais au plus :
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      // essaie
      try {
        // de télécharger, avec un délai de 30 secondes ;
        const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        // type de contenu, PNG par défaut ;
        const contentType = res.headers.get('content-type') || 'image/png';
        // code 404 : erreur 404 ;
        if (res.status === 404) throw new NotFoundException(`Tuile absente chez la NASA : ${url}`);
        // réponse en erreur, ou qui n'est pas une image :
        if (!res.ok || !contentType.startsWith('image/')) {
          // note l'erreur ;
          last = `HTTP ${res.status} ${contentType}`;
        // sinon :
        } else {
          // lit les octets ;
          const body = Buffer.from(await res.arrayBuffer());
          // trop lourd : erreur 502 ;
          if (body.length > MAX_BYTES) throw new BadGatewayException('Tuile lunaire trop lourde.');
          // renvoie la tuile.
          return { body, contentType, cached: false };
        // Fin du cas.
        }
      // En cas d'échec :
      } catch (e) {
        // erreurs 404 et 502 : relancées ;
        if (e instanceof NotFoundException || e instanceof BadGatewayException) throw e;
        // sinon note l'erreur.
        last = (e as Error).message;
      // Fin du cas.
      }
      // Attend 0,5 s, puis 1 s, puis 2 s.
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    // Fin de la boucle.
    }
    // Erreur 502 « NASA injoignable ».
    throw new BadGatewayException(`NASA Moon Trek injoignable (${url}) : ${last}`);
  // Fin de download.
  }

  /** Nombre de tuiles à précharger jusqu'au niveau `maxZoom` (toutes couches, bornées à leur niveau natif). */
  // Méthode statique countTiles.
  static countTiles(maxZoom: number): number {
    // Compteur.
    let n = 0;
    // Pour chaque couche et chaque niveau jusqu'au plus petit des deux maximums, ajoute colonnes × lignes.
    for (const l of MOON_LAYER_LEVELS) for (let z = 0; z <= Math.min(maxZoom, l.maxZoom); z++) n += moonCols(z) * moonRows(z);
    // Renvoie le compte.
    return n;
  // Fin de countTiles.
  }

  /**
   * Précharge toute la Lune jusqu'au niveau `maxZoom` (niveaux bas d'abord : la Lune entière est vite disponible).
   * Sans effet si un préchargement tourne déjà. `onProgress` est appelé après chaque tuile.
   */
  // Méthode prefetchAll ; ses paramètres :
  async prefetchAll(
    // le niveau maximal, celui de la configuration par défaut ;
    maxZoom = this.config.tiles.moonCache.prefetchMaxZoom,
    // le nombre de tuiles chargées en même temps, celui de la configuration par défaut ;
    concurrency = this.config.tiles.moonCache.prefetchConcurrency,
    // une fonction appelée après chaque tuile (facultatif).
    onProgress?: (s: MoonPrefetchStatus) => void,
  // Elle renvoie l'état final.
  ): Promise<MoonPrefetchStatus> {
    // Préchargement déjà en cours, ou niveau négatif : renvoie l'état.
    if (this.prefetch.running || maxZoom < 0) return this.status();
    // Nouvel état : en cours, avec le nombre total de tuiles.
    this.prefetch = { running: true, maxZoom, done: 0, total: MoonTileCacheService.countTiles(maxZoom), failed: 0 };

    // Générateur des tuiles à charger :
    const jobs = (function* () {
      // pour chaque niveau, du plus bas au plus haut,
      for (let z = 0; z <= maxZoom; z++) {
        // et chaque couche :
        for (const l of MOON_LAYER_LEVELS) {
          // passe celles qui n'ont pas ce niveau ;
          if (z > l.maxZoom) continue;
          // donne chaque tuile du niveau.
          for (let y = 0; y < moonRows(z); y++) for (let x = 0; x < moonCols(z); x++) yield { id: l.id, z, x, y };
        // Fin des couches.
        }
      // Fin des niveaux.
      }
    // Fin du générateur, créé tout de suite.
    })();

    // Fonction worker : un ouvrier.
    const worker = async () => {
      // Prend la tuile suivante, tant qu'il y en a :
      for (let j = jobs.next(); !j.done; j = jobs.next()) {
        // ses coordonnées ;
        const { id, z, x, y } = j.value;
        // attend que l'application ne demande plus rien ;
        await this.quiet();
        // la charge ; un échec est compté ;
        try { await this.get(id, z, x, y); } catch { this.prefetch.failed++; }
        // une tuile traitée de plus ;
        this.prefetch.done++;
        // prévient de l'avancement.
        onProgress?.(this.status());
      // Fin de la boucle.
      }
    // Fin de worker.
    };
    // Lance les ouvriers (au moins un) et attend leur fin.
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
    // Préchargement fini.
    this.prefetch.running = false;
    // Renvoie l'état.
    return this.status();
  // Fin de prefetchAll.
  }

  /** Lancé au démarrage du serveur, en arrière-plan : n'empêche pas l'API de répondre. */
  // Méthode startBackgroundPrefetch.
  startBackgroundPrefetch(): void {
    // Niveau maximal de la configuration.
    const { prefetchMaxZoom } = this.config.tiles.moonCache;
    // Négatif : pas de préchargement.
    if (prefetchMaxZoom < 0) return;
    // Écrit le début dans le journal.
    this.log.log(`Préchargement de la Lune : niveaux 0 à ${prefetchMaxZoom} (${MoonTileCacheService.countTiles(prefetchMaxZoom)} tuiles) dans ${this.dir}`);
    // Heure de départ.
    const t0 = Date.now();
    // Lance le préchargement, sans l'attendre ;
    this.prefetchAll()
      // à la fin, écrit le bilan dans le journal ;
      .then((s) => this.log.log(`Lune préchargée : ${s.done - s.failed}/${s.total} tuiles en ${Math.round((Date.now() - t0) / 1000)} s${s.failed ? ` (${s.failed} échecs, réessayés au prochain démarrage)` : ''} ; zones vides reconstruites sur ${this.repaired} tuiles, pôles fondus avec LROC sur ${this.blended}${this.repairFailed ? `, ${this.repairFailed} préparations en échec` : ''}`))
      // en cas d'échec, un avertissement.
      .catch((e) => this.log.warn(`Préchargement interrompu : ${(e as Error).message}`));
  // Fin de startBackgroundPrefetch.
  }
// Fin du service.
}
