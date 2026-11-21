// Erreurs HTTP : requête invalide (400) et réponse de fournisseur inutilisable (502).
import { BadRequestException, HttpException } from '@nestjs/common';
// Service de l'assistant : il porte l'appel au modèle de l'utilisateur et le classement des refus du fournisseur.
import { AssistantService } from '../../content/assistant/assistant.service';
// Calculs purs de la position et du trajet.
import {
  APOLLO_SITES, AT_LAUNCH_SITE_KM, LaunchSite, MoonSite, PositionPoint, TRIP_SYSTEM_PROMPT, buildTripMessage, fixedTripMinutes,
  launchSitePoint, nearestLaunchSite, normalizePoint, parseTripReply, tripDistance,
} from './position';

/** Une étape d'un trajet : `sol` (jusqu'au site de lancement) ou `vol` (vers la Lune). */
export interface TripLeg { kind: 'sol' | 'vol'; label: string; minutes: number }

/** Résultat d'un calcul de trajet. */
export interface TripResult {
  /** `fixe` : durée fixée par le serveur (Terre ↔ site Apollo) ; `ia` : estimée par le modèle de l'utilisateur. */
  source: 'fixe' | 'ia';
  durationMinutes: number;
  mode: string;
  summary: string;
  distanceKm: number;
  distanceKind: 'surface' | 'terre-lune';
  /** Étapes du trajet Terre → Lune : trajet au sol jusqu'au site de lancement, puis vol. */
  legs?: TripLeg[];
  /** Site de lancement retenu (Terre → Lune). */
  launchSite?: { name: string; distanceKm: number };
  /** Vrai quand le trajet au sol n'est pas compté faute de clé : la durée ne porte que sur le vol. */
  needsKey?: boolean;
  /** Fournisseur et modèle qui ont répondu (source `ia` seulement). */
  provider?: string;
  model?: string;
}

/**
 * Position GPS et temps de trajet. Pas de tracé : seulement une durée.
 *  - Terre ↔ site Apollo de la Lune : 3 jours, fixés, sans appel à un modèle ni clé ;
 *  - tout autre trajet : estimé automatiquement par le modèle de l'utilisateur (Claude ou Mistral), avec SA clé
 *    reçue dans la requête, jamais gardée ni journalisée.
 */
export class PositionService {
  constructor(private readonly assistant: AssistantService) {}

  /** Les sites d'alunissage Apollo proposés comme positions sur la Lune. */
  moonSites(): MoonSite[] {
    return APOLLO_SITES.map((s) => ({ ...s }));
  }

  /** Temps de trajet entre deux positions. `key` n'est lue que si le modèle doit répondre. */
  async trip(providerId: string, key: string, rawA: unknown, rawB: unknown): Promise<TripResult> {
    const a = this.pointOf(rawA, 'A');
    const b = this.pointOf(rawB, 'B');
    const { km, kind } = tripDistance(a, b);

    const fixed = fixedTripMinutes(a, b);
    // Terre → Lune : trajet jusqu'au site de lancement le plus proche, puis le vol (3 jours fixés).
    const launch = fixed !== null && a.body === 'earth' ? nearestLaunchSite(a) : null;
    if (fixed !== null && launch) return this.earthToMoon(providerId, key, a, launch, fixed, km, kind);
    // Durée fixée (Lune → Terre) : aucun appel au modèle.
    if (fixed !== null) {
      return {
        source: 'fixe', durationMinutes: fixed, mode: 'Vaisseau',
        summary: 'Transit Terre–Lune d’une mission Apollo : 3 jours.', distanceKm: km, distanceKind: kind,
      };
    }

    // Sinon, le modèle de l'utilisateur estime la durée.
    const { estimate, provider, model } = await this.estimate(providerId, key, a, b);
    return { source: 'ia', ...estimate, distanceKm: km, distanceKind: kind, provider, model };
  }

  /**
   * Terre → Lune : trajet au sol de A jusqu'au site de lancement le plus proche (estimé par le modèle de
   * l'utilisateur), plus le vol de `flightMinutes`. Déjà sur le site : pas de trajet au sol, aucun appel. Sans clé :
   * la durée du vol seul, avec `needsKey` pour que la fenêtre invite à connecter la clé.
   */
  private async earthToMoon(
    providerId: string, key: string, a: PositionPoint, launch: { site: LaunchSite; km: number },
    flightMinutes: number, km: number, kind: 'surface' | 'terre-lune',
  ): Promise<TripResult> {
    const flight: TripLeg = { kind: 'vol', label: 'Vol vers la Lune', minutes: flightMinutes };
    const launchSite = { name: launch.site.name, distanceKm: launch.km };
    const base = { distanceKm: km, distanceKind: kind, launchSite };
    if (launch.km <= AT_LAUNCH_SITE_KM) {
      return { source: 'fixe', durationMinutes: flightMinutes, mode: 'Vaisseau', summary: `Départ de ${launch.site.name} : 3 jours de vol vers la Lune.`, legs: [flight], ...base };
    }
    if (!String(key ?? '').trim()) {
      return {
        source: 'fixe', durationMinutes: flightMinutes, mode: 'Vaisseau', needsKey: true, legs: [flight], ...base,
        summary: `Vol de 3 jours. Connectez votre clé pour ajouter le trajet jusqu’à ${launch.site.name}.`,
      };
    }
    const ground = await this.estimate(providerId, key, a, launchSitePoint(launch.site));
    const groundLeg: TripLeg = { kind: 'sol', label: `Jusqu’à ${launch.site.name}`, minutes: ground.estimate.durationMinutes };
    return {
      source: 'ia', durationMinutes: groundLeg.minutes + flightMinutes, mode: ground.estimate.mode || 'Vaisseau',
      summary: `${ground.estimate.summary} Puis 3 jours de vol vers la Lune.`.trim(), legs: [groundLeg, flight], ...base,
      provider: ground.provider, model: ground.model,
    };
  }

  /** Estimation du modèle de l'utilisateur pour un trajet ; une réponse illisible est redemandée une fois. */
  private async estimate(providerId: string, key: string, a: PositionPoint, b: PositionPoint) {
    const messages: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'user', content: buildTripMessage(a, b) }];
    let answer = await this.assistant.complete(providerId, key, TRIP_SYSTEM_PROMPT, messages, 600);
    let estimate = parseTripReply(answer.text);
    if (!estimate) {
      messages.push({ role: 'assistant', content: answer.text || '(vide)' }, { role: 'user', content: 'Réponds seulement par l’objet JSON demandé, avec durationMinutes en nombre.' });
      answer = await this.assistant.complete(providerId, key, TRIP_SYSTEM_PROMPT, messages, 600);
      estimate = parseTripReply(answer.text);
    }
    const { provider, model } = answer;
    if (!estimate) {
      throw new HttpException({
        statusCode: 502, error: 'Bad Gateway', code: 'unavailable', provider,
        message: 'Le modèle n’a pas renvoyé une durée exploitable : réessayez dans un instant.',
      }, 502);
    }
    return { estimate, provider, model };
  }

  /** Position validée, ou erreur 400 qui nomme le point fautif. */
  private pointOf(raw: unknown, label: string): PositionPoint {
    const p = normalizePoint(raw);
    if (!p) throw new BadRequestException(`Position ${label} invalide : astre « earth » ou « moon », latitude de −90 à 90, longitude de −180 à 180.`);
    return p;
  }
}
