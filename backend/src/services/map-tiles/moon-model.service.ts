import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { AppConfig } from '../../common/configuration';

const TIMEOUT_MS = 120_000;
const MAX_BYTES = 150 * 1024 * 1024;

export interface MoonModel {
  body: Buffer;
  contentType: string;
}

/**
 * Modèle 3D officiel de la Lune (NASA, glTF binaire) : vue d'ensemble de la Lune, avec son relief, avant que les tuiles
 * prennent le relais en zoomant. Par défaut le modèle « couleurs + relief » du NASA Scientific Visualization Studio
 * (https://svs.gsfc.nasa.gov/14959, LRO), réglable avec `MOON_MODEL_URL` (ex. modèle de solarsystem.nasa.gov).
 * Téléchargé une seule fois, gardé sur le disque à côté des tuiles et relayé au navigateur (pas de souci CORS).
 */
@Injectable()
export class MoonModelService {
  private readonly log = new Logger('MoonModel');
  private loading: Promise<MoonModel> | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  get url(): string {
    return this.config.tiles.moonModelUrl;
  }

  get(): Promise<MoonModel> {
    if (!this.loading) this.loading = this.load().catch((e) => { this.loading = null; throw e; });
    return this.loading;
  }

  private file(): string {
    // Un fichier par adresse : changer MOON_MODEL_URL ne ressert pas l'ancien modèle.
    const h = createHash('sha1').update(this.url).digest('hex').slice(0, 12);
    return path.resolve(path.dirname(path.resolve(this.config.tiles.moonCache.dir)), `moon-model-${h}.glb`);
  }

  private async load(): Promise<MoonModel> {
    const file = this.file();
    try {
      return { body: await fs.readFile(file), contentType: 'model/gltf-binary' };
    } catch { /* pas encore en cache */ }

    let res: Response;
    try {
      res = await this.fetchFn(this.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new BadGatewayException(`Modèle 3D de la Lune injoignable (${this.url}) : ${(e as Error).message}`);
    }
    if (!res.ok) throw new BadGatewayException(`Modèle 3D de la Lune indisponible (${this.url}) : HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) throw new BadGatewayException('Modèle 3D de la Lune trop lourd (> 150 Mo).');
    // Un GLB commence par « glTF » : on refuse une page HTML d'erreur servie avec un code 200.
    if (body.subarray(0, 4).toString('ascii') !== 'glTF') throw new BadGatewayException(`Ce n’est pas un fichier GLB : ${this.url}`);
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, body);
      await fs.rename(tmp, file);
      this.log.log(`Modèle 3D de la Lune enregistré (${(body.length / 1e6).toFixed(1)} Mo) : ${file}`);
    } catch (e) {
      this.log.warn(`Écriture du modèle impossible : ${(e as Error).message}`);
    }
    return { body, contentType: 'model/gltf-binary' };
  }
}
