// Outils NestJS : erreur 502, injection par jeton, service injectable.
import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
// Jeton d'injection de la configuration.
import { APP_CONFIG } from '../../modules/config.module';
// Type (effacé à la compilation) de la configuration.
import type { AppConfig } from '../../common/configuration';
// Type (effacé à la compilation) de la réponse des phases.
import type { MoonPhasesDto } from '../../dto/ephemeris.dto';

// Durée de garde en mémoire : 6 heures.
const TTL_MS = 6 * 3_600_000;
// Délai maximal d'un appel : 15 secondes.
const TIMEOUT_MS = 15_000;
// Traduction française du nom de chaque phase :
const PHASE_FR: Record<string, string> = {
  // nouvelle lune, premier quartier, pleine lune, dernier quartier.
  'New Moon': 'Nouvelle lune', 'First Quarter': 'Premier quartier', 'Full Moon': 'Pleine lune', 'Last Quarter': 'Dernier quartier',
// Fin de la table.
};

// Forme d'une phase telle que l'observatoire la renvoie : année, mois, jour, heure en texte, nom anglais.
interface UsnoPhase { year: number; month: number; day: number; time: string; phase: string }

/**
 * Prochaines phases principales de la Lune (U.S. Naval Observatory, API publique sans clé :
 * https://aa.usno.navy.mil/data/api). Heures en temps universel. Gardées 6 h en mémoire.
 */
// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des phases de la Lune.
export class UsnoService {
  // Réponse gardée en mémoire avec l'instant de la demande ; null au départ.
  private cache: { at: number; data: Promise<MoonPhasesDto> } | null = null;

  // Constructeur ; ses paramètres :
  constructor(
    // la configuration, demandée par son jeton ;
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    // la fonction de téléchargement, fetch par défaut ;
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    // la fonction qui donne l'heure, Date.now par défaut.
    private readonly now: () => number = Date.now,
  // Corps du constructeur vide.
  ) {}

  // Méthode phases : les prochaines phases.
  phases(): Promise<MoonPhasesDto> {
    // Heure actuelle.
    const now = this.now();
    // Réponse en mémoire de moins de 6 heures : on la rend.
    if (this.cache && now - this.cache.at < TTL_MS) return this.cache.data;
    // Sinon lance la lecture ; si elle échoue, on oublie cette réponse (si c'est toujours elle qui est en mémoire) et l'erreur est transmise.
    const data = this.load(now).catch((e) => { if (this.cache?.data === data) this.cache = null; throw e; });
    // Garde la promesse en mémoire tout de suite : les demandes simultanées partagent le même appel.
    this.cache = { at: now, data };
    // La renvoie.
    return data;
  // Fin de phases.
  }

  // Méthode privée load : interroge l'observatoire.
  private async load(now: number): Promise<MoonPhasesDto> {
    // Date du jour, au format AAAA-MM-JJ.
    const date = new Date(now).toISOString().slice(0, 10);
    // Adresse : les 4 phases à partir de cette date.
    const url = `${this.config.usno.url}/moon/phases/date?date=${date}&nump=4`;
    // Corps de la réponse : la liste des phases, ou un message d'erreur.
    let body: { phasedata?: UsnoPhase[]; error?: string };
    // Essaie
    try {
      // d'appeler l'observatoire, avec abandon au bout du délai ;
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      // une réponse en erreur lève une erreur avec le code HTTP ;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // lit le JSON.
      body = (await res.json()) as typeof body;
    // En cas d'échec,
    } catch (e) {
      // erreur 502, observatoire injoignable.
      throw new BadGatewayException(`USNO injoignable : ${(e as Error).message}`);
    // Fin du cas.
    }
    // Erreur annoncée par l'observatoire, ou pas de liste : erreur 502.
    if (body.error || !Array.isArray(body.phasedata)) throw new BadGatewayException(`USNO : ${body.error ?? 'réponse inattendue'}`);
    // Réponse :
    return {
      // origine des données ;
      source: 'U.S. Naval Observatory (aa.usno.navy.mil)',
      // pour chaque phase :
      items: body.phasedata.map((p) => {
        // son heure et ses minutes, converties en nombres ;
        const [h, m] = p.time.split(':').map(Number);
        // son nom français (ou anglais s'il est inconnu) et sa date en ISO 8601 ; le mois est décalé de 1, car JavaScript compte les mois à partir de 0.
        return { phase: PHASE_FR[p.phase] ?? p.phase, utc: new Date(Date.UTC(p.year, p.month - 1, p.day, h, m)).toISOString() };
      // Fin de la liste.
      }),
    // Fin de la réponse.
    };
  // Fin de load.
  }
// Fin du service.
}
