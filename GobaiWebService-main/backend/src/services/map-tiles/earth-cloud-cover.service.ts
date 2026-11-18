// Outils NestJS : erreur 502, service injectable, journal.
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
// Adresses à appeler, lecture des réponses, et type de la grille.
import { cloudCoverUrls, parseCloudCover, type CloudCoverGrid } from './earth-cloud-cover';

// Délai maximal d'un appel : 30 secondes.
const TIMEOUT_MS = 30_000;
// Durée de garde : une heure.
const REFRESH_MS = 60 * 60_000; // la couverture nuageuse est donnée heure par heure
// Après un échec, pas de nouvel essai avant 15 minutes.
const RETRY_MS = 15 * 60_000;

// Forme de la réponse : la grille, plus ce qui suit.
export interface EarthCloudCoverDto extends CloudCoverGrid {
  // source : l'origine des données.
  source: string;
  /** Heure de validité donnée par la source (UTC). */
  // validAt : l'heure de validité.
  validAt: string;
  /** Couverture moyenne de la grille, en %. */
  // mean : la couverture moyenne.
  mean: number;
// Fin de EarthCloudCoverDto.
}

/**
 * Couverture nuageuse du moment, relayée depuis Open-Meteo (gratuit, sans clé, usage non commercial) et gardée une
 * heure en mémoire. Si l'API est injoignable, 502 : le site garde ses nuages simulés.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service de la couverture nuageuse.
export class EarthCloudCoverService {
  // Journal préfixé par « Couverture nuageuse ».
  private readonly log = new Logger('Couverture nuageuse');
  // Dernière grille obtenue, avec son heure.
  private current: { at: number; dto: EarthCloudCoverDto } | null = null;
  // Téléchargement en cours.
  private loading: Promise<EarthCloudCoverDto> | null = null;
  // Heure du dernier échec.
  private failedAt = 0;
  // Message du dernier échec.
  private lastError = '';

  // Constructeur : reçoit la fonction de téléchargement et la fonction qui donne l'heure ; corps vide.
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args), private readonly now: () => number = Date.now) {}

  // Méthode get.
  get(): Promise<EarthCloudCoverDto> {
    // Grille de moins d'une heure : on la rend.
    if (this.current && this.now() - this.current.at < REFRESH_MS) return Promise.resolve(this.current.dto);
    // Téléchargement déjà en cours : on rend le même.
    if (this.loading) return this.loading;
    // Échec de moins de 15 minutes :
    if (this.now() - this.failedAt < RETRY_MS) {
      // on rend l'ancienne grille s'il y en a une ;
      if (this.current) return Promise.resolve(this.current.dto); // grille précédente plutôt que rien
      // sinon erreur 502.
      return Promise.reject(new BadGatewayException(`Couverture nuageuse indisponible (${this.lastError}).`));
    // Fin du cas.
    }
    // Lance le téléchargement ;
    this.loading = this.download()
      // en cas de succès : garde la grille avec l'heure ;
      .then((dto) => { this.current = { at: this.now(), dto }; return dto; })
      // en cas d'échec :
      .catch((e) => {
        // note l'heure de l'échec ;
        this.failedAt = this.now();
        // note son message ;
        this.lastError = e instanceof Error ? e.message : String(e);
        // l'écrit dans le journal ;
        this.log.warn(`Open-Meteo indisponible : ${this.lastError}`);
        // rend l'ancienne grille s'il y en a une ;
        if (this.current) return this.current.dto;
        // sinon erreur 502.
        throw new BadGatewayException(`Couverture nuageuse indisponible (${this.lastError}).`);
      // Fin du traitement d'échec.
      })
      // Dans tous les cas, efface la marque « en cours ».
      .finally(() => { this.loading = null; });
    // Renvoie le téléchargement en cours.
    return this.loading;
  // Fin de get.
  }

  // Méthode privée download.
  private async download(): Promise<EarthCloudCoverDto> {
    // Réponses reçues.
    const responses: unknown[] = [];
    // L'une après l'autre : pas de rafale sur une API gratuite.
    // Appelle chaque adresse, l'une après l'autre.
    for (const url of cloudCoverUrls()) responses.push(await this.fetchJson(url));
    // Lit la grille.
    const grid = parseCloudCover(responses);
    // Le note dans le journal.
    this.log.log(`Couverture nuageuse chargée (${grid.validAt}, moyenne ${grid.mean} %).`);
    // Renvoie la grille avec sa source.
    return { source: 'Open-Meteo', ...grid };
  // Fin de download.
  }

  // Méthode privée fetchJson : appelle une adresse et rend son JSON.
  private async fetchJson(url: string): Promise<unknown> {
    // Contrôleur qui permet d'abandonner l'appel.
    const ctrl = new AbortController();
    // Minuterie : abandon au bout du délai.
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Essaie :
    try {
      // d'appeler l'adresse, en s'identifiant ;
      const res = await this.fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'GobaiWebService' } });
      // une réponse en erreur lève une erreur avec le code HTTP ;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // renvoie le JSON.
      return await res.json();
    // Dans tous les cas,
    } finally {
      // arrête la minuterie.
      clearTimeout(timer);
    // Fin du bloc.
    }
  // Fin de fetchJson.
  }
// Fin du service.
}
