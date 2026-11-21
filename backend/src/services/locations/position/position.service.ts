// Erreurs HTTP : requête invalide (400) et réponse de fournisseur inutilisable (502).
import { BadRequestException, HttpException } from '@nestjs/common';
// Service de l'assistant : il porte l'appel au modèle de l'utilisateur et le classement des refus du fournisseur.
import { AssistantService } from '../../content/assistant/assistant.service';
// Calculs purs de la position et du trajet.
import {
  APOLLO_SITES, MoonSite, PositionPoint, TRIP_SYSTEM_PROMPT, buildTripMessage, fixedTripMinutes, normalizePoint,
  parseTripReply, tripDistance,
} from './position';

/** Résultat d'un calcul de trajet. */
export interface TripResult {
  /** `fixe` : durée fixée par le serveur (Terre ↔ site Apollo) ; `ia` : estimée par le modèle de l'utilisateur. */
  source: 'fixe' | 'ia';
  durationMinutes: number;
  mode: string;
  summary: string;
  distanceKm: number;
  distanceKind: 'surface' | 'terre-lune';
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

    // Durée fixée : aucun appel au modèle.
    const fixed = fixedTripMinutes(a, b);
    if (fixed !== null) {
      return {
        source: 'fixe', durationMinutes: fixed, mode: 'Vaisseau',
        summary: 'Transit Terre–Lune d’une mission Apollo : 3 jours.', distanceKm: km, distanceKind: kind,
      };
    }

    // Sinon, le modèle de l'utilisateur estime la durée ; une réponse illisible est redemandée une fois.
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
    return { source: 'ia', ...estimate, distanceKm: km, distanceKind: kind, provider, model };
  }

  /** Position validée, ou erreur 400 qui nomme le point fautif. */
  private pointOf(raw: unknown, label: string): PositionPoint {
    const p = normalizePoint(raw);
    if (!p) throw new BadRequestException(`Position ${label} invalide : astre « earth » ou « moon », latitude de −90 à 90, longitude de −180 à 180.`);
    return p;
  }
}
