import { BadGatewayException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';

const TIMEOUT_MS = 30_000;
const MAX_BYTES = 30 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ColorTexture {
  body: Buffer;
  contentType: string;
}

/** Type d'image déduit du contenu (une page HTML d'erreur servie en 200 est ainsi refusée). */
function imageType(body: Buffer): string | null {
  if (body.length > 2 && body[0] === 0xff && body[1] === 0xd8) return 'image/jpeg';
  if (body.length >= PNG_SIGNATURE.length && body.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'image/png';
  return null;
}

/**
 * Texture des couleurs naturelles de la Lune : NASA SVS « CGI Moon Kit » (https://svs.gsfc.nasa.gov/4720), carte
 * 2:1 équirectangulaire centrée sur 0° adaptée de la mosaïque couleur LROC (bandes 643/566/415 nm, réglée pour la vision
 * humaine). Le seul format lisible par un navigateur est le JPEG 2048×1024 ; `MOON_COLOR_URL` peut pointer vers une
 * version plus grande convertie en JPEG/PNG, `MOON_COLOR_FALLBACK_URLS` vers des miroirs essayés si elle échoue.
 * L'image retenue est gardée sur le disque et relayée (évite tout souci CORS et tout nouveau téléchargement).
 */
@Injectable()
export class MoonColorService {
  private readonly log = new Logger('MoonColor');
  private cache: Promise<ColorTexture> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  get(): Promise<ColorTexture> {
    if (!this.cache) this.cache = this.load().catch((e) => { this.cache = null; throw e; });
    return this.cache;
  }

  /** Adresse principale puis secours, sans doublon. */
  private get urls(): string[] {
    return [...new Set([this.config.tiles.moonColorUrl, ...this.config.tiles.moonColorFallbackUrls].filter(Boolean))];
  }

  private file(url: string): string {
    // Un fichier par adresse : changer d'adresse ne ressert pas l'ancienne texture.
    const h = createHash('sha1').update(url).digest('hex').slice(0, 12);
    return path.resolve(path.dirname(path.resolve(this.config.tiles.moonCache.dir)), `moon-color-${h}.img`);
  }

  private async load(): Promise<ColorTexture> {
    const errors: string[] = [];
    for (const url of this.urls) {
      const file = this.file(url);
      try {
        const body = await fs.readFile(file);
        const contentType = imageType(body);
        if (contentType) return { body, contentType };
      } catch { /* pas encore en cache */ }

      try {
        const texture = await this.download(url);
        try {
          await fs.mkdir(path.dirname(file), { recursive: true });
          const tmp = `${file}.${process.pid}.tmp`;
          await fs.writeFile(tmp, texture.body);
          await fs.rename(tmp, file);
          this.log.log(`Texture des couleurs de la Lune enregistrée (${(texture.body.length / 1e6).toFixed(2)} Mo) : ${file}`);
        } catch (e) {
          this.log.warn(`Écriture de la texture couleur impossible : ${(e as Error).message}`);
        }
        if (url !== this.urls[0]) this.log.warn(`Texture couleur servie par le secours : ${url}`);
        return texture;
      } catch (e) {
        errors.push((e as Error).message);
        this.log.warn(`Texture couleur indisponible (${url}) : ${(e as Error).message}`);
      }
    }
    throw new BadGatewayException(`Texture des couleurs de la Lune introuvable : ${errors.join(' · ')}`);
  }

  private async download(url: string): Promise<ColorTexture> {
    let res: Response;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new Error(`${url} injoignable (${(e as Error).message})`);
    }
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !contentType.startsWith('image/')) {
      throw new Error(`${url} : HTTP ${res.status} ${contentType}`.trim());
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) throw new Error(`${url} : plus de 30 Mo, trop lourd pour un navigateur`);
    if (!imageType(body)) throw new Error(`${url} : ni JPEG ni PNG`);
    return { body, contentType };
  }
}
