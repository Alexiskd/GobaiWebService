// Outils NestJS : erreur 502, service injectable, journal.
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
// createHash : calcule une empreinte.
import { createHash } from 'node:crypto';
// Fonctions de fichiers asynchrones de Node, sous le nom fs.
import { promises as fs } from 'node:fs';
// Fonctions de chemins de Node, sous le nom path.
import * as path from 'node:path';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';

// Délai maximal du téléchargement : 2 minutes.
const TIMEOUT_MS = 120_000;
// Taille maximale acceptée : 150 Mo.
const MAX_BYTES = 150 * 1024 * 1024;

// Forme du modèle rendu.
export interface MoonModel {
  // body : ses octets.
  body: Buffer;
  // contentType : son type de contenu.
  contentType: string;
// Fin de MoonModel.
}

/**
 * Modèle 3D officiel de la Lune (NASA, glTF binaire) : vue d'ensemble de la Lune, avec son relief, avant que les tuiles
 * prennent le relais en zoomant. Par défaut le modèle « couleurs + relief » du NASA Scientific Visualization Studio
 * (https://svs.gsfc.nasa.gov/14959, LRO), réglable avec `MOON_MODEL_URL` (ex. modèle de solarsystem.nasa.gov).
 * Téléchargé une seule fois, gardé sur le disque à côté des tuiles et relayé au navigateur (pas de souci CORS).
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service du modèle 3D de la Lune.
export class MoonModelService {
  // Journal préfixé par « MoonModel ».
  private readonly log = new Logger('MoonModel');
  // Chargement en cours ou terminé : une promesse, ou null.
  private loading: Promise<MoonModel> | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration ;
    private readonly config: AppConfig,
    // la fonction de téléchargement, fetch par défaut.
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  // Accesseur url.
  get url(): string {
    // L'adresse du modèle dans la configuration.
    return this.config.tiles.moonModelUrl;
  // Fin de url.
  }

  // Méthode get.
  get(): Promise<MoonModel> {
    // Rien en cours : lance le chargement et garde sa promesse ; en cas d'échec, on l'oublie et l'erreur est transmise.
    if (!this.loading) this.loading = this.load().catch((e) => { this.loading = null; throw e; });
    // Renvoie la promesse.
    return this.loading;
  // Fin de get.
  }

  // Méthode privée file : le chemin du fichier gardé sur le disque.
  private file(): string {
    // Un fichier par adresse : changer MOON_MODEL_URL ne ressert pas l'ancien modèle.
    // Les 12 premiers caractères de l'empreinte SHA-1 de l'adresse.
    const h = createHash('sha1').update(this.url).digest('hex').slice(0, 12);
    // Fichier « moon-model-<empreinte>.glb », dans le dossier qui contient le cache des tuiles.
    return path.resolve(path.dirname(path.resolve(this.config.tiles.moonCache.dir)), `moon-model-${h}.glb`);
  // Fin de file.
  }

  // Méthode privée load.
  private async load(): Promise<MoonModel> {
    // Chemin du fichier.
    const file = this.file();
    // Essaie
    try {
      // de le lire sur le disque et de le rendre ;
      return { body: await fs.readFile(file), contentType: 'model/gltf-binary' };
    // absent : on continue.
    } catch { /* pas encore en cache */ }

    // Réponse HTTP.
    let res: Response;
    // Essaie
    try {
      // de télécharger le modèle, avec abandon au bout du délai.
      res = await this.fetchFn(this.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // En cas d'échec réseau,
    } catch (e) {
      // erreur 502 qui cite l'adresse et la cause.
      throw new BadGatewayException(`Modèle 3D de la Lune injoignable (${this.url}) : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Réponse en erreur : erreur 502 avec le code HTTP.
    if (!res.ok) throw new BadGatewayException(`Modèle 3D de la Lune indisponible (${this.url}) : HTTP ${res.status}`);
    // Lit le corps en octets.
    const body = Buffer.from(await res.arrayBuffer());
    // Trop lourd : erreur 502.
    if (body.length > MAX_BYTES) throw new BadGatewayException('Modèle 3D de la Lune trop lourd (> 150 Mo).');
    // Un GLB commence par « glTF » : on refuse une page HTML d'erreur servie avec un code 200.
    // Les quatre premiers octets ne sont pas « glTF » : erreur 502.
    if (body.subarray(0, 4).toString('ascii') !== 'glTF') throw new BadGatewayException(`Ce n’est pas un fichier GLB : ${this.url}`);
    // Essaie
    try {
      // de créer le dossier ;
      await fs.mkdir(path.dirname(file), { recursive: true });
      // nom d'un fichier temporaire, propre à ce processus ;
      const tmp = `${file}.${process.pid}.tmp`;
      // d'y écrire le modèle ;
      await fs.writeFile(tmp, body);
      // puis de le renommer : le fichier final n'existe jamais à moitié écrit ;
      await fs.rename(tmp, file);
      // et de le noter dans le journal, avec sa taille en Mo.
      this.log.log(`Modèle 3D de la Lune enregistré (${(body.length / 1e6).toFixed(1)} Mo) : ${file}`);
    // En cas d'échec d'écriture,
    } catch (e) {
      // un avertissement dans le journal ; le modèle est quand même rendu.
      this.log.warn(`Écriture du modèle impossible : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Renvoie le modèle.
    return { body, contentType: 'model/gltf-binary' };
  // Fin de load.
  }
// Fin du service.
}
