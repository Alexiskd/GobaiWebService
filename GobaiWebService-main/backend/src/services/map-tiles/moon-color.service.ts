// Outils NestJS : erreur 502, injection par jeton, service injectable, journal.
import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
// createHash : calcule une empreinte.
import { createHash } from 'node:crypto';
// Fonctions de fichiers asynchrones de Node, sous le nom fs.
import { promises as fs } from 'node:fs';
// Fonctions de chemins de Node, sous le nom path.
import * as path from 'node:path';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Fonction qui dit si une source est une adresse http(s).
import { isRemote } from '../../common/local-source';

// Délai maximal d'un téléchargement : 30 secondes.
const TIMEOUT_MS = 30_000;
// Taille maximale du fichier source téléchargé : 120 Mo (un TIFF pèse bien plus que le JPEG qui en sort).
const MAX_SOURCE_BYTES = 120 * 1024 * 1024;
// Taille maximale de l'image servie au navigateur : 30 Mo.
const MAX_SERVED_BYTES = 30 * 1024 * 1024;
// Les huit premiers octets de tout fichier PNG.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Les quatre premiers octets d'un TIFF : II*\0 (petit-boutien), MM\0* (gros-boutien),
// et leurs variantes BigTIFF (au-delà de 4 Go), qui portent un 43 à la place du 42.
const TIFF_SIGNATURES = [
  // TIFF petit-boutien, puis gros-boutien ;
  Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.from([0x4d, 0x4d, 0x00, 0x2a]),
  // BigTIFF petit-boutien, puis gros-boutien.
  Buffer.from([0x49, 0x49, 0x2b, 0x00]), Buffer.from([0x4d, 0x4d, 0x00, 0x2b]),
];

// Forme de la texture rendue.
export interface ColorTexture {
  // body : ses octets.
  body: Buffer;
  // contentType : son type de contenu.
  contentType: string;
// Fin de ColorTexture.
}

/** Type d'image déduit du contenu (une page HTML d'erreur servie en 200 est ainsi refusée). */
// Fonction imageType : reconnaît le type d'une image à ses premiers octets.
function imageType(body: Buffer): string | null {
  // FF D8 au début : JPEG.
  if (body.length > 2 && body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
  // La signature PNG au début : PNG.
  if (body.length >= PNG_SIGNATURE.length && body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'image/png';
  // Sinon : pas une image connue.
  return null;
// Fin de imageType.
}

/** Vrai si ces octets commencent par une signature TIFF (les grandes cartes du CGI Moon Kit sont en TIFF). */
// Fonction isTiff : reconnaît un TIFF à ses premiers octets.
function isTiff(body: Buffer): boolean {
  // Vrai si l'une des quatre signatures est au début du fichier.
  return TIFF_SIGNATURES.some((sig) => body.length >= sig.length && body.subarray(0, sig.length).equals(sig));
// Fin de isTiff.
}

/** Ce que ce service utilise de sharp (décrit ici : le typage de la bibliothèque change d'une version à l'autre). */
// Forme d'une image sharp, limitée à ce que ce service utilise.
interface SharpImage {
  // resize : changement de taille, avec le filtre choisi.
  resize(width: number, height: number, options: { fit: 'fill'; kernel: 'lanczos3' }): SharpImage;
  // jpeg : sortie en JPEG, avec qualité, progressivité et encodeur mozjpeg.
  jpeg(options: { quality: number; progressive: boolean; mozjpeg: boolean }): SharpImage;
  // toBuffer : les octets.
  toBuffer(): Promise<Buffer>;
// Fin de SharpImage.
}
// Type SharpFactory : la fonction sharp, qui prend les octets d'une image.
type SharpFactory = (input: Buffer) => SharpImage;

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
 * Texture des couleurs naturelles de la Lune : NASA SVS « CGI Moon Kit » (https://svs.gsfc.nasa.gov/4720), carte
 * 2:1 équirectangulaire centrée sur 0° adaptée de la mosaïque couleur LROC (bandes 643/566/415 nm, réglée pour la vision
 * humaine). Les grandes cartes du kit sont en TIFF, qu'aucun navigateur ne décode : le serveur convertit la source
 * en JPEG à `MOON_COLOR_WIDTH` pixels de large (4096 par défaut) avant de la garder sur le disque. `MOON_COLOR_URL`
 * peut pointer vers une autre taille, `MOON_COLOR_FALLBACK_URLS` vers des miroirs essayés si elle échoue.
 * L'image retenue est gardée sur le disque et relayée (évite tout souci CORS et tout nouveau téléchargement).
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des couleurs de la Lune.
export class MoonColorService {
  // Journal préfixé par « MoonColor ».
  private readonly log = new Logger('MoonColor');
  // Texture gardée en mémoire : une promesse, ou null.
  private cache: Promise<ColorTexture> | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // la fonction de téléchargement, fetch par défaut.
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  // Méthode get.
  get(): Promise<ColorTexture> {
    // Rien en mémoire : lance le chargement et garde sa promesse ; en cas d'échec, on l'oublie et l'erreur est transmise.
    if (!this.cache) this.cache = this.load().catch((e) => { this.cache = null; throw e; });
    // Renvoie la promesse.
    return this.cache;
  // Fin de get.
  }

  /** Adresse principale puis secours, sans doublon. */
  // Accesseur privé urls.
  private get urls(): string[] {
    // L'adresse principale puis les secours, sans les vides ni les doublons.
    return [...new Set([this.config.tiles.moonColorUrl, ...this.config.tiles.moonColorFallbackUrls].filter(Boolean))];
  // Fin de urls.
  }

  // Méthode privée file : le chemin du fichier gardé sur le disque pour une adresse.
  private file(url: string): string {
    // Un fichier par adresse : changer d'adresse ne ressert pas l'ancienne texture.
    // Les 12 premiers caractères de l'empreinte SHA-1 de l'adresse.
    const h = createHash('sha1').update(url).digest('hex').slice(0, 12);
    // Fichier « moon-color-<empreinte>.img », dans le dossier qui contient le cache des tuiles.
    return path.resolve(path.dirname(path.resolve(this.config.tiles.moonCache.dir)), `moon-color-${h}.img`);
  // Fin de file.
  }

  // Méthode privée load.
  private async load(): Promise<ColorTexture> {
    // Erreurs rencontrées.
    const errors: string[] = [];
    // Pour chaque adresse, dans l'ordre :
    for (const url of this.urls) {
      // Fichier importé dans le projet (texture de secours de three.js) : lu directement, sans téléchargement.
      // si c'est un fichier local :
      if (!isRemote(url)) {
        // essaie
        try {
          // de le lire ;
          const body = await fs.readFile(url);
          // de reconnaître son type ;
          const contentType = imageType(body);
          // ni JPEG ni PNG : erreur ;
          if (!contentType) throw new Error(`${url} : ni JPEG ni PNG`);
          // si ce n'est pas l'adresse principale, le note dans le journal ;
          if (url !== this.urls[0]) this.log.warn(`Texture couleur servie par le secours local : ${url}`);
          // et rend la texture.
          return { body, contentType };
        // En cas d'échec,
        } catch (e) {
          // note l'erreur,
          errors.push((e as Error).message);
          // et l'écrit dans le journal.
          this.log.warn(`Texture couleur locale illisible (${url}) : ${(e as Error).message}`);
        // Fin du cas.
        }
        // Passe à l'adresse suivante.
        continue;
      // Fin du cas « fichier local ».
      }
      // Chemin de la copie gardée sur le disque.
      const file = this.file(url);
      // Essaie
      try {
        // de lire cette copie ;
        const body = await fs.readFile(file);
        // de reconnaître son type ;
        const contentType = imageType(body);
        // et de la rendre si c'est bien une image.
        if (contentType) return { body, contentType };
      // Copie absente : on continue.
      } catch { /* pas encore en cache */ }

      // Essaie
      try {
        // de télécharger la texture.
        const texture = await this.download(url);
        // Essaie ensuite
        try {
          // de créer le dossier ;
          await fs.mkdir(path.dirname(file), { recursive: true });
          // nom d'un fichier temporaire ;
          const tmp = `${file}.${process.pid}.tmp`;
          // d'y écrire la texture ;
          await fs.writeFile(tmp, texture.body);
          // puis de le renommer ;
          await fs.rename(tmp, file);
          // et de le noter dans le journal.
          this.log.log(`Texture des couleurs de la Lune enregistrée (${(texture.body.length / 1e6).toFixed(2)} Mo) : ${file}`);
        // En cas d'échec d'écriture,
        } catch (e) {
          // un avertissement dans le journal.
          this.log.warn(`Écriture de la texture couleur impossible : ${(e as Error).message}`);
        // Fin du cas.
        }
        // Si ce n'est pas l'adresse principale, le note dans le journal.
        if (url !== this.urls[0]) this.log.warn(`Texture couleur servie par le secours : ${url}`);
        // Rend la texture.
        return texture;
      // En cas d'échec du téléchargement,
      } catch (e) {
        // note l'erreur,
        errors.push((e as Error).message);
        // et l'écrit dans le journal ; l'adresse suivante sera essayée.
        this.log.warn(`Texture couleur indisponible (${url}) : ${(e as Error).message}`);
      // Fin du cas.
      }
    // Fin de la boucle.
    }
    // Aucune adresse n'a marché : erreur 502 qui liste les erreurs.
    throw new BadGatewayException(`Texture des couleurs de la Lune introuvable : ${errors.join(' · ')}`);
  // Fin de load.
  }

  /**
   * TIFF → JPEG, ramené à `maxWidth` pixels de large et à la moitié en hauteur (la carte est 2:1 équirectangulaire).
   * sharp est chargé à la première conversion, par require puis par import() : s'il ne se charge pas sur cette
   * machine, l'erreur remonte et l'adresse de secours est essayée comme pour n'importe quel autre échec.
   */
  // Méthode privée tiffToJpeg : convertit un TIFF en JPEG à la largeur demandée (début).
  private async tiffToJpeg(body: Buffer, maxWidth: number): Promise<Buffer> {
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
        // import() natif, que la compilation en CommonJS ne doit pas transformer en require ;
        const load = new Function('name', 'return import(name)') as (name: string) => Promise<unknown>;
        // charge sharp avec lui.
        sharp = sharpFrom(await load('sharp'));
      // En cas d'échec : pas de sharp.
      } catch { /* pas de sharp */ }
    // Fin du cas.
    }
    // Toujours pas chargée : erreur, l'adresse de secours prendra le relais.
    if (!sharp) throw new Error('sharp indisponible : carte couleur TIFF non convertible');
    // Convertit : taille visée en remplissant exactement le cadre 2:1, filtre de Lanczos, JPEG de qualité 92.
    return sharp(body)
      // Largeur demandée, hauteur moitié.
      .resize(maxWidth, Math.round(maxWidth / 2), { fit: 'fill', kernel: 'lanczos3' })
      // Sortie JPEG progressive, encodée par mozjpeg (fichier plus petit à qualité égale).
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      // Ses octets.
      .toBuffer();
  // Fin de tiffToJpeg.
  }

  // Méthode privée download.
  private async download(url: string): Promise<ColorTexture> {
    // Réponse HTTP.
    let res: Response;
    // Essaie
    try {
      // de télécharger, avec abandon au bout du délai.
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // En cas d'échec réseau,
    } catch (e) {
      // erreur qui cite l'adresse et la cause.
      throw new Error(`${url} injoignable (${(e as Error).message})`);
    // Fin du cas.
    }
    // Type de contenu annoncé, sans ses paramètres : sert aux messages d'erreur seulement. Le format réel est
    // décidé plus bas sur les octets : le SVS sert ses TIFF en « application/octet-stream », et une page HTML
    // d'erreur rendue en 200 serait de toute façon refusée par l'absence de signature d'image.
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    // Réponse en erreur :
    if (!res.ok) {
      // erreur.
      throw new Error(`${url} : HTTP ${res.status} ${contentType}`.trim());
    // Fin du cas.
    }
    // Lit les octets. Type noté à la main : `Buffer.from` d'un ArrayBuffer donne un `Buffer<ArrayBuffer>`, alors
    // que la conversion TIFF plus bas rend un `Buffer<ArrayBufferLike>` (le type que porte aussi ColorTexture).
    let body: Buffer = Buffer.from(await res.arrayBuffer());
    // Source trop lourde : erreur.
    if (body.length > MAX_SOURCE_BYTES) throw new Error(`${url} : plus de 120 Mo, source trop lourde`);
    // Source en TIFF (les grandes cartes du CGI Moon Kit) : convertie en JPEG, seul format qu'un navigateur
    // décode. La conversion a lieu avant l'écriture sur le disque : le cache ne contient donc que du JPEG,
    // et une copie déjà gardée est relue telle quelle sans repasser par sharp.
    if (isTiff(body)) {
      // Taille du TIFF, gardée pour le journal.
      const sourceMo = (body.length / 1e6).toFixed(2);
      // Convertit à la largeur configurée.
      body = await this.tiffToJpeg(body, this.config.tiles.moonColorWidth);
      // Note la conversion dans le journal.
      this.log.log(`Carte couleur TIFF (${sourceMo} Mo) convertie en JPEG ${this.config.tiles.moonColorWidth} px (${(body.length / 1e6).toFixed(2)} Mo)`);
    // Fin du cas.
    }
    // Image à servir trop lourde : erreur.
    if (body.length > MAX_SERVED_BYTES) throw new Error(`${url} : plus de 30 Mo, trop lourd pour un navigateur`);
    // Type réel du contenu, après une éventuelle conversion ; ni JPEG ni PNG : erreur.
    const type = imageType(body);
    // Format inconnu du navigateur : erreur.
    if (!type) throw new Error(`${url} : ni JPEG ni PNG`);
    // Renvoie la texture, avec son type réel plutôt que celui annoncé par le serveur (TIFF avant conversion).
    return { body, contentType: type };
  // Fin de download.
  }
// Fin du service.
}
