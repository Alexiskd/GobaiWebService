// Relais des polices Google et du décodeur Draco : le navigateur du visiteur ne contacte jamais les serveurs de Google (RGPD).
// Sans ce relais, chaque visite envoie l'adresse IP du visiteur à fonts.googleapis.com et fonts.gstatic.com.
// Le serveur lit la feuille de style et les fichiers chez Google, les garde en mémoire, et les sert lui-même.
import { BadRequestException, Controller, Get, NotFoundException, Param, Query, Res, VERSION_NEUTRAL } from '@nestjs/common';
// Masque la route dans la documentation publique de l'API.
import { ApiExcludeController } from '@nestjs/swagger';
// Dispense de la limite de débit : une page charge plusieurs fichiers de police d'un coup.
import { SkipThrottle } from '@nestjs/throttler';
// Type de la réponse Express.
import type { Response } from 'express';

/** Feuille de style de Google Fonts. */
const CSS_HOST = 'https://fonts.googleapis.com/css2';
/** Fichiers de police de Google Fonts. */
const FILE_HOST = 'https://fonts.gstatic.com/s/';
/** Préfixe public des fichiers relayés. */
const FILE_PREFIX = '/api/fonts/files/';
/**
 * Navigateur annoncé à Google : un navigateur récent reçoit des fichiers WOFF2 découpés par alphabet.
 * Google adapte la feuille de style au navigateur ; tous les navigateurs visés savent lire le WOFF2.
 */
const MODERN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
/** Paramètre family autorisé : lettres, chiffres, espaces, +, :, ;, @, virgules et points (ex. « Google Sans:wght@400;600 »). */
const FAMILY = /^[A-Za-z0-9 +:;@,.]{1,200}$/;
/** Chemin de fichier autorisé chez gstatic : « googlesans/v58/xxxx.woff2 ». */
const FILE = /^[a-z0-9]+\/v\d+\/[A-Za-z0-9_-]+\.woff2$/;
/** Nombre maximal d'entrées gardées en mémoire (feuilles et fichiers). */
const MAX_ENTRIES = 400;
/** Décodeur Draco des modèles 3D (Google), version figée. */
const DRACO_HOST = 'https://www.gstatic.com/draco/versioned/decoders/1.4.1/';
/** Fichiers du décodeur Draco autorisés, avec leur type. */
const DRACO_FILES: Record<string, string> = {
  'draco_decoder.js': 'text/javascript',
  'draco_wasm_wrapper.js': 'text/javascript',
  'draco_decoder.wasm': 'application/wasm',
};
/** Délai maximal d'une lecture chez Google. */
const TIMEOUT_MS = 10_000;

/** Une entrée du cache : contenu et type. */
interface Cached { body: Buffer; type: string }

// Pas dans la documentation publique : c'est un relais technique.
@ApiExcludeController()
// Pas de limite de débit.
@SkipThrottle()
// Route sans version : /api/fonts/…
@Controller({ path: 'fonts', version: VERSION_NEUTRAL })
// Contrôleur du relais des polices.
export class FontsController {
  /** Cache en mémoire, du plus ancien au plus récent. */
  private readonly cache = new Map<string, Cached>();

  /** GET /api/fonts/css2?family=… : la feuille de style, avec des adresses de fichiers réécrites vers ce serveur. */
  @Get('css2')
  async css(@Query('family') family: string | string[] | undefined, @Query('display') display: string | undefined, @Res() res: Response): Promise<void> {
    // Plusieurs familles possibles (« family=A&family=B »).
    const families = (Array.isArray(family) ? family : [family]).filter((f): f is string => typeof f === 'string');
    // Au moins une famille, toutes au bon format.
    if (!families.length || families.length > 6 || !families.every((f) => FAMILY.test(f))) throw new BadRequestException('Famille de police invalide.');
    // Adresse chez Google.
    const query = families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&') + `&display=${display === 'block' ? 'block' : 'swap'}`;
    // Lit la feuille (ou la reprend du cache).
    const got = await this.fetchCached(`css:${query}`, `${CSS_HOST}?${query}`, 'text/css; charset=utf-8');
    // Réécrit les adresses des fichiers vers le relais.
    const css = got.body.toString('utf8').split(FILE_HOST).join(FILE_PREFIX);
    // Un jour de cache dans le navigateur.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Envoie la feuille.
    res.type('text/css').send(css);
  }

  /** GET /api/fonts/files/<famille>/<version>/<fichier>.woff2 : un fichier de police. */
  @Get('files/:family/:version/:file')
  async file(@Param('family') fam: string, @Param('version') version: string, @Param('file') file: string, @Res() res: Response): Promise<void> {
    // Chemin relatif chez gstatic.
    const path = `${fam}/${version}/${file}`;
    // Seuls les fichiers WOFF2 de Google Fonts sont relayés : pas d'adresse arbitraire.
    if (!FILE.test(path)) throw new NotFoundException();
    // Lit le fichier (ou le reprend du cache).
    const got = await this.fetchCached(`file:${path}`, FILE_HOST + path, 'font/woff2');
    // Un an de cache : l'adresse change avec la version de la police.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Envoie le fichier.
    res.type('font/woff2').send(got.body);
  }

  /** GET /api/fonts/draco/<fichier> : le décodeur Draco des modèles 3D, relayé lui aussi (même raison). */
  @Get('draco/:file')
  async draco(@Param('file') file: string, @Res() res: Response): Promise<void> {
    // Seuls les trois fichiers du décodeur sont relayés.
    const type = Object.prototype.hasOwnProperty.call(DRACO_FILES, file) ? DRACO_FILES[file] : null;
    if (!type) throw new NotFoundException();
    // Lit le fichier (ou le reprend du cache).
    const got = await this.fetchCached(`draco:${file}`, DRACO_HOST + file, type);
    // Un an de cache : la version est figée dans l'adresse d'origine.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // Envoie le fichier.
    res.type(type).send(got.body);
  }

  /** Lit une adresse chez Google, en gardant le résultat en mémoire. */
  private async fetchCached(key: string, url: string, type: string): Promise<Cached> {
    // Déjà en mémoire : renvoyé tel quel.
    const hit = this.cache.get(key);
    if (hit) return hit;
    // Lecture chez Google, avec un délai maximal.
    const r = await fetch(url, { headers: { 'User-Agent': MODERN_UA }, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => null);
    // Échec : la page retombe sur la police système (pile de secours de la feuille de style).
    if (!r || !r.ok) throw new NotFoundException('Police indisponible.');
    // Contenu lu.
    const entry: Cached = { body: Buffer.from(await r.arrayBuffer()), type };
    // Cache plein : retire la plus ancienne entrée.
    if (this.cache.size >= MAX_ENTRIES) this.cache.delete(this.cache.keys().next().value as string);
    // Garde l'entrée.
    this.cache.set(key, entry);
    // Renvoie l'entrée.
    return entry;
  }
}
