// Outils NestJS : erreur 502, injection par jeton, service injectable.
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
// join : assemble des morceaux de chemin.
import { join } from 'node:path';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Dossier des fichiers tiers et fonction de chargement d'un JSON (fichier ou adresse).
import { VENDOR_DIR, loadJson } from '../../common/local-source';
// Type (effacé à la compilation) de la fiche de World Atlas.
import type { WorldAtlasInfoDto } from '../../dto/world-atlas.dto';
// Fonction de fabrication de la topologie et types de son résultat et de son entrée.
import { buildCountriesTopology, type CountriesBuild, type CountryFeature } from './countries-topology';
// Type (effacé à la compilation) d'un document TopoJSON.
import type { Topology } from './topology';

// Délai maximal d'un téléchargement : 15 secondes.
const TIMEOUT_MS = 15_000;

/** Pays Natural Earth 4.1.0 au 1:50m (la version utilisée par world-atlas 2.0.2), importés dans le projet. */
// Chemin du GeoJSON Natural Earth des pays.
export const NATURAL_EARTH_COUNTRIES = join(VENDOR_DIR, 'natural-earth', 'ne_50m_admin_0_countries-v4.1.0.geojson');
/** TopoJSON des pays fabriqué à partir de ce fichier (`npm run world-atlas:build`). */
// Chemin du TopoJSON des pays.
export const WORLD_ATLAS_COUNTRIES = join(VENDOR_DIR, 'world-atlas', 'countries-50m.json');

/**
 * World Atlas : TopoJSON des pays (Natural Earth 1:50m, recette de topojson/world-atlas 2.0.2). Le fichier, importé
 * dans le projet (backend/data/vendor/world-atlas), est lu une fois au premier appel puis gardé en mémoire ; en cas
 * d'échec, l'appel suivant réessaie. `BORDERS_SOURCE_URL` permet de le remplacer par un autre TopoJSON.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service World Atlas.
export class WorldAtlasService {
  // Topologie gardée en mémoire : une promesse, ou null tant que rien n'a été demandé.
  private cache: Promise<Topology> | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // la fonction de téléchargement, par défaut le fetch de Node (remplaçable dans les tests).
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  // Corps du constructeur vide.
  ) {}

  /** Topologie des pays (objet `countries`). */
  // Méthode countries : renvoie la topologie.
  countries(): Promise<Topology> {
    // Si rien n'est en mémoire :
    if (!this.cache) {
      // lance la lecture et garde sa promesse ; si elle échoue,
      this.cache = this.load().catch((e) => {
        // on oublie la promesse, pour que l'appel suivant réessaie,
        this.cache = null;
        // et l'erreur est transmise.
        throw e;
      // Fin du traitement d'échec.
      });
    // Fin du cas.
    }
    // Renvoie la promesse.
    return this.cache;
  // Fin de countries.
  }

  /** Fiche du jeu de données servi. */
  // Méthode info : la fiche du jeu de données.
  async info(): Promise<WorldAtlasInfoDto> {
    // Attend la topologie.
    const topo = await this.countries();
    // Objet renvoyé :
    return {
      // nom du jeu de données ;
      source: this.config.borders.label,
      // mention à afficher ;
      attribution: 'Frontières : Natural Earth',
      // nom de l'objet des pays ;
      object: 'countries',
      // nombre de pays (0 si l'objet manque) ;
      countries: topo.objects.countries?.geometries?.length ?? 0,
      // nombre d'arcs ;
      arcs: topo.arcs.length,
      // vrai si une transformation est présente ;
      quantized: Boolean(topo.transform),
      // l'emprise, ajoutée seulement si le fichier la donne.
      ...(topo.bbox ? { bbox: topo.bbox } : {}),
    // Fin de l'objet.
    };
  // Fin de info.
  }

  /** Refabrique la topologie des pays à partir d'un GeoJSON Natural Earth (fichier local ou adresse). */
  // Méthode build : refabrique la topologie ; source par défaut : le fichier Natural Earth du projet.
  async build(source: string = NATURAL_EARTH_COUNTRIES): Promise<CountriesBuild> {
    // Charge le GeoJSON.
    const geojson = await loadJson<{ features?: CountryFeature[] }>(source, this.fetchFn, TIMEOUT_MS);
    // Sans liste « features » : erreur.
    if (!Array.isArray(geojson?.features)) throw new Error(`${source} : GeoJSON sans liste « features ».`);
    // Fabrique et renvoie la topologie.
    return buildCountriesTopology(geojson.features);
  // Fin de build.
  }

  // Méthode privée load : lit le TopoJSON.
  private async load(): Promise<Topology> {
    // Fichier ou adresse configurés.
    const url = this.config.borders.sourceUrl;
    // Topologie à remplir.
    let topo: Topology;
    // Essaie
    try {
      // de la charger ;
      topo = await loadJson<Topology>(url, this.fetchFn, TIMEOUT_MS);
    // en cas d'échec,
    } catch (e) {
      // erreur 502 qui cite la source et la cause.
      throw new BadGatewayException(`Frontières indisponibles (${url}) : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Ce n'est pas du TopoJSON : erreur 502.
    if (topo?.type !== 'Topology') throw new BadGatewayException('Frontières : le fichier reçu n’est pas du TopoJSON.');
    // Renvoie la topologie.
    return topo;
  // Fin de load.
  }
// Fin du service.
}
