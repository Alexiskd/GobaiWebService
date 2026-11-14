// Outils NestJS : erreur 502, service injectable, journal.
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
// Lecture de la réponse, adresse à appeler, et type de la grille.
import { parseWind, windUrl, type WindGrid } from './earth-wind';

// Délai maximal d'un appel : 30 secondes.
const TIMEOUT_MS = 30_000;
// Durée de garde : 3 heures.
const REFRESH_MS = 3 * 60 * 60_000; // le vent à grande échelle change lentement : une requête toutes les 3 h
// Après un échec, pas de nouvel essai avant 30 minutes.
const RETRY_MS = 30 * 60_000;

// Forme de la réponse : la grille, plus ce qui suit.
export interface EarthWindDto extends WindGrid {
  // source : l'origine des données.
  source: string;
  // level : le niveau du vent.
  level: string;
  // validAt : l'heure de validité.
  validAt: string;
// Fin de EarthWindDto.
}

/**
 * Vents réels du moment, relayés depuis Open-Meteo (gratuit, sans clé, usage non commercial) et gardés 3 heures en
 * mémoire. Si l'API est injoignable, l'erreur remonte (le contrôleur répond 204) : le site garde son modèle de
 * circulation générale.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des vents.
export class EarthWindService {
  // Journal préfixé par « Vents de la Terre ».
  private readonly log = new Logger('Vents de la Terre');
  // Dernière grille obtenue, avec son heure ; null au départ.
  private current: { at: number; dto: EarthWindDto } | null = null;
  // Téléchargement en cours ; null s'il n'y en a pas.
  private loading: Promise<EarthWindDto> | null = null;
  // Heure du dernier échec.
  private failedAt = 0;
  // Message du dernier échec.
  private lastError = '';

  // Constructeur : reçoit la fonction de téléchargement et la fonction qui donne l'heure, toutes deux remplaçables dans les tests ; corps vide.
  constructor(private readonly fetchFn: typeof fetch = (...args) => fetch(...args), private readonly now: () => number = Date.now) {}

  // Méthode get : la grille des vents.
  get(): Promise<EarthWindDto> {
    // Grille de moins de 3 heures : on la rend.
    if (this.current && this.now() - this.current.at < REFRESH_MS) return Promise.resolve(this.current.dto);
    // Téléchargement déjà en cours : on rend le même.
    if (this.loading) return this.loading;
    // Échec de moins de 30 minutes :
    if (this.now() - this.failedAt < RETRY_MS) {
      // on rend l'ancienne grille s'il y en a une ;
      if (this.current) return Promise.resolve(this.current.dto);
      // sinon erreur 502.
      return Promise.reject(new BadGatewayException(`Vents indisponibles (${this.lastError}).`));
    // Fin du cas.
    }
    // Lance le téléchargement, avec le vent d'altitude ;
    this.loading = this.download(true)
      // Le vent d'altitude peut être refusé : second essai avec le vent à 10 m seul. Pas après un 429 : le quota
      // d'Open-Meteo est épuisé, et chaque appel y compte pour 162 points.
      // en cas d'échec : un 429 (quota épuisé) est transmis tel quel ; sinon second essai, sans le vent d'altitude ;
      .catch((e) => { if (e instanceof Error && e.message === 'HTTP 429') throw e; return this.download(false); })
      // en cas de succès : garde la grille avec l'heure ;
      .then((dto) => { this.current = { at: this.now(), dto }; return dto; })
      // en cas d'échec final :
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
        throw new BadGatewayException(`Vents indisponibles (${this.lastError}).`);
      // Fin du traitement d'échec.
      })
      // Dans tous les cas, efface la marque « en cours ».
      .finally(() => { this.loading = null; });
    // Renvoie le téléchargement en cours.
    return this.loading;
  // Fin de get.
  }

  // Méthode privée download.
  private async download(upperAir: boolean): Promise<EarthWindDto> {
    // Contrôleur qui permet d'abandonner l'appel.
    const ctrl = new AbortController();
    // Minuterie : abandon au bout du délai.
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    // Essaie :
    try {
      // d'appeler Open-Meteo, en s'identifiant ;
      const res = await this.fetchFn(windUrl(upperAir), { signal: ctrl.signal, headers: { 'User-Agent': 'GobaiWebService' } });
      // une réponse en erreur lève une erreur avec le code HTTP ;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // lit la grille ;
      const grid = parseWind(await res.json());
      // le note dans le journal ;
      this.log.log(`Vents chargés (${grid.level}, ${grid.validAt}).`);
      // renvoie la grille avec sa source.
      return { source: 'Open-Meteo', ...grid };
    // Dans tous les cas,
    } finally {
      // arrête la minuterie.
      clearTimeout(timer);
    // Fin du bloc.
    }
  // Fin de download.
  }
// Fin du service.
}
