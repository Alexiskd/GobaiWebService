// Outils NestJS : erreur 502, service injectable, journal, erreur 404.
import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
// Taille maximale acceptée : 60 Mo.
const MAX_BYTES = 60 * 1024 * 1024;

// Forme de la source d'un modèle.
export interface BodyModelSource {
  // name : le nom de l'astre.
  name: string;
  /** Fichier glTF binaire (GLB) officiel. */
  // url : l'adresse du fichier.
  url: string;
  // credit : la mention de l'auteur.
  credit: string;
  /** Page de la ressource, pour les sources. */
  // page : la page de la ressource.
  page: string;
// Fin de BodyModelSource.
}

/**
 * Modèles 3D officiels des astres de forme irrégulière, affichés à la place de la sphère.
 * Phobos : modèle NASA (https://solarsystem.nasa.gov/gltf_embed/2358/, fichier Phobos_1_1000.glb, 3,7 Mo).
 * Deimos : modèle NASA (https://solarsystem.nasa.gov/gltf_embed/2434/, fichier Deimos_1_1000.glb, 1,5 Mo).
 */
// Sources des modèles, par identifiant d'astre :
export const BODY_MODELS: Record<string, BodyModelSource> = {
  // Phobos,
  phobos: {
    // son nom,
    name: 'Phobos',
    // l'adresse de son fichier,
    url: 'https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24878_Phobos_1_1000.glb',
    // son crédit,
    credit: 'NASA/JPL-Caltech',
    // sa page.
    page: 'https://science.nasa.gov/resource/phobos-mars-moon-3d-model/',
  // Fin de Phobos.
  },
  // Deimos,
  deimos: {
    // son nom,
    name: 'Deimos',
    // l'adresse de son fichier,
    url: 'https://assets.science.nasa.gov/content/dam/science/psd/mars/resources/gltf_files/24879_Deimos_1_1000.glb',
    // son crédit,
    credit: 'NASA/JPL-Caltech',
    // sa page.
    page: 'https://science.nasa.gov/resource/deimos-mars-moon-3d-model/',
  // Fin de Deimos.
  },
// Fin de la table.
};

// Forme du modèle rendu.
export interface BodyModel {
  // body : ses octets.
  body: Buffer;
  // contentType : son type de contenu.
  contentType: string;
// Fin de BodyModel.
}

/**
 * Relaie le modèle 3D (GLB) d'un astre : téléchargé une seule fois chez la NASA, gardé sur le disque à côté des
 * tuiles et servi au navigateur depuis la même origine (pas de souci CORS). Même principe que MoonModelService.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des modèles 3D.
export class BodyModelService {
  // Journal préfixé par « BodyModel ».
  private readonly log = new Logger('BodyModel');
  // Chargements en cours ou terminés, par astre.
  private readonly loading = new Map<string, Promise<BodyModel>>();

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration ;
    private readonly config: AppConfig,
    // la fonction de téléchargement, fetch par défaut.
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  // Méthode get : le modèle d'un astre.
  get(id: string): Promise<BodyModel> {
    // Sa source.
    const source = BODY_MODELS[id];
    // Aucune : erreur 404 qui liste les astres possibles.
    if (!source) throw new NotFoundException(`Aucun modèle 3D pour « ${id} ». Astres possibles : ${Object.keys(BODY_MODELS).join(', ')}.`);
    // Chargement déjà lancé pour cet astre ?
    let p = this.loading.get(id);
    // Sinon :
    if (!p) {
      // on le lance ; en cas d'échec, on l'oublie et l'erreur est transmise ;
      p = this.load(id, source).catch((e) => { this.loading.delete(id); throw e; });
      // et on le garde.
      this.loading.set(id, p);
    // Fin du cas.
    }
    // Renvoie la promesse.
    return p;
  // Fin de get.
  }

  // Méthode privée file : le chemin du fichier gardé sur le disque.
  private file(id: string, url: string): string {
    // Un fichier par adresse : changer l'adresse du modèle ne ressert pas l'ancien fichier.
    // Les 12 premiers caractères de l'empreinte SHA-1 de l'adresse.
    const h = createHash('sha1').update(url).digest('hex').slice(0, 12);
    // Fichier « <astre>-model-<empreinte>.glb », dans le dossier qui contient le cache des tuiles.
    return path.resolve(path.dirname(path.resolve(this.config.tiles.moonCache.dir)), `${id}-model-${h}.glb`);
  // Fin de file.
  }

  // Méthode privée load.
  private async load(id: string, source: BodyModelSource): Promise<BodyModel> {
    // Chemin du fichier.
    const file = this.file(id, source.url);
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
      res = await this.fetchFn(source.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // En cas d'échec réseau,
    } catch (e) {
      // erreur 502 qui cite l'adresse et la cause.
      throw new BadGatewayException(`Modèle 3D de ${source.name} injoignable (${source.url}) : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Réponse en erreur : erreur 502 avec le code HTTP.
    if (!res.ok) throw new BadGatewayException(`Modèle 3D de ${source.name} indisponible (${source.url}) : HTTP ${res.status}`);
    // Lit le corps en octets.
    const body = Buffer.from(await res.arrayBuffer());
    // Trop lourd : erreur 502.
    if (body.length > MAX_BYTES) throw new BadGatewayException(`Modèle 3D de ${source.name} trop lourd (> 60 Mo).`);
    // Un GLB commence par « glTF » : on refuse une page HTML d'erreur servie avec un code 200.
    // Les quatre premiers octets ne sont pas « glTF » : erreur 502.
    if (body.subarray(0, 4).toString('ascii') !== 'glTF') throw new BadGatewayException(`Ce n’est pas un fichier GLB : ${source.url}`);
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
      this.log.log(`Modèle 3D de ${source.name} enregistré (${(body.length / 1e6).toFixed(1)} Mo) : ${file}`);
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
