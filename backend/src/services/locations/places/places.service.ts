// Outils NestJS : erreur 503, journal, service injectable et démarrage du module.
import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
// Lecture de fichier asynchrone.
import { readFile } from 'node:fs/promises';
// Décompression gzip asynchrone.
import { gunzip } from 'node:zlib';
// Transformation d'une fonction à rappel en promesse.
import { promisify } from 'node:util';
// Assemblage de chemins.
import { join } from 'node:path';
// Dossier des données tierces embarquées.
import { VENDOR_DIR } from '../../../common/local-source';
// Types (effacés à la compilation) de la réponse.
import type { PlacesDto } from '../../../dto/places.dto';
// Moteur de recherche de lieux interne.
import { PlaceIndex, displayNames, searchLoose } from './place-index';

// Fichier de la base des lieux (voir tools/geonames/construire-lieux.mjs et data/vendor/README.md).
export const PLACES_FILE = join(VENDOR_DIR, 'geonames', 'places.tsv.gz');
// Identifiant du moteur dans les réponses.
export const PLACES_PROVIDER = 'gobai';
// Mention à afficher avec les résultats (GeoNames est sous licence CC BY 4.0).
export const PLACES_ATTRIBUTION = 'Lieux : GeoNames (CC BY 4.0) · Natural Earth';

/**
 * Recherche de villes et lieux du monde entier, entièrement interne : ≈ 172 000 localités (GeoNames, toutes celles de
 * plus de 1 000 habitants et les chefs-lieux), chargées en mémoire au démarrage. Aucun service extérieur n'est
 * appelé : plus de quota, de panne ni de délai d'un fournisseur.
 */
@Injectable()
export class PlacesService implements OnModuleInit {
  private readonly logger = new Logger(PlacesService.name);
  // Chargement de l'index, partagé par toutes les recherches.
  private loading: Promise<PlaceIndex> | null = null;

  // Au démarrage : lance le chargement en arrière-plan (le serveur s'ouvre sans l'attendre).
  onModuleInit(): void {
    this.ready().catch((e: Error) => this.logger.warn(`Base des lieux indisponible : ${e.message}`));
  }

  /** L'index, chargé une seule fois ; un échec permet de réessayer à la recherche suivante. */
  ready(file = PLACES_FILE): Promise<PlaceIndex> {
    if (!this.loading) {
      const started = Date.now();
      this.loading = readFile(file)
        .then((gz) => promisify(gunzip)(gz))
        .then((buf) => {
          const index = new PlaceIndex(buf.toString('utf8'), displayNames('fr'));
          this.logger.log(`Recherche de lieux interne : ${index.size} localités indexées en ${Date.now() - started} ms.`);
          return index;
        });
      this.loading.catch(() => { this.loading = null; });
    }
    return this.loading;
  }

  /** Localités dont le nom correspond au texte, des plus pertinentes aux moins pertinentes. */
  async find(q: string, limit = 8): Promise<PlacesDto> {
    let index: PlaceIndex;
    try { index = await this.ready(); }
    catch { throw new ServiceUnavailableException('Base des lieux indisponible sur ce serveur.'); }
    return { provider: PLACES_PROVIDER, items: searchLoose(index, q, limit), attribution: PLACES_ATTRIBUTION };
  }
}
