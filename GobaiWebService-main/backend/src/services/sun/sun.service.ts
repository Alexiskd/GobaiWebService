/**
 * Point sous-solaire des globes : le point de la surface où le Soleil est au zénith, qui sert à éclairer la
 * carte de la Lune et de Mars.
 *
 * Calculé sur place (voir subsolar.ts) : position héliocentrique de l'astre par ses éléments orbitaux, puis
 * passage dans le repère qui tourne avec lui. Aucun service d'éphémérides n'est interrogé — cette route
 * appelait autrefois JPL Horizons, puis a cessé de répondre quand cet appel a été retiré ; elle répond de
 * nouveau, sans dépendance.
 *
 * Le calcul étant immédiat, il n'y a ni cache ni table à rafraîchir : la réponse porte l'instant demandé et une
 * série de points à venir, que le client interpole s'il veut animer l'éclairage.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
// Astres couverts et forme de la réponse.
import { SUN_BODIES, type SunBody, type SunEphemeris, type SunSample } from './sun.types';
// Calcul local du point sous-solaire.
import { subSolarOf } from './subsolar';

/** Durée d'une heure, en millisecondes. */
const HOUR_MS = 3_600_000;
/** Pas entre deux points de la série, en millisecondes. */
const STEP_MS = 30 * 60 * 1000;
/** Durée couverte par la série rendue, en millisecondes. */
const SPAN_MS = 24 * HOUR_MS;

/** Jeton d'injection des options du service. */
export const SUN_SERVICE_OPTIONS = Symbol('SUN_SERVICE_OPTIONS');

/** Options du service : seule l'horloge est remplaçable, pour les tests. */
export interface SunServiceOptions {
  now?: () => number;
}

// Service injecté par NestJS.
@Injectable()
// Classe du service du point sous-solaire.
export class SunService {
  // L'horloge du service.
  private readonly now: () => number;

  // Constructeur : les options sont facultatives.
  constructor(@Optional() @Inject(SUN_SERVICE_OPTIONS) options: SunServiceOptions = {}) {
    // L'horloge : celle des options, sinon l'heure réelle.
    this.now = options.now ?? (() => Date.now());
  // Fin du constructeur.
  }

  /** Point sous-solaire d'un astre : l'instant présent, et les vingt-quatre heures qui suivent. */
  async get(body: SunBody): Promise<SunEphemeris> {
    // Instant de la demande.
    const nowMs = this.now();
    // Le point à cet instant.
    const current = this.sampleAt(body, nowMs);
    // La série, du présent à vingt-quatre heures plus tard.
    const samples: SunSample[] = [];
    // Un point par pas.
    for (let t = nowMs; t <= nowMs + SPAN_MS; t += STEP_MS) samples.push(this.sampleAt(body, t));
    // La réponse, au format inchangé.
    return {
      body,
      now: new Date(nowMs).toISOString(),
      generatedAt: new Date(nowMs).toISOString(),
      // La série couvre vingt-quatre heures : au-delà, le client redemande.
      expiresAt: new Date(nowMs + SPAN_MS).toISOString(),
      // Rien n'est servi depuis un cache : le calcul est refait à chaque demande.
      stale: false,
      source: {
        name: 'Gobai Space',
        dataset: 'Éléments orbitaux et modèles de rotation, calcul local',
        quantity: 'Point sous-solaire (longitude et latitude du Soleil au zénith)',
        url: 'https://www.gobaispace.com/api/docs',
      },
      frame: {
        reference: SUN_BODIES[body].frame,
        longitude: SUN_BODIES[body].textureLongitude,
        latitude: 'body-fixed',
      },
      samples,
      current,
    };
  // Fin de get.
  }

  /** Point sous-solaire à un instant donné, au format de la série. */
  private sampleAt(body: SunBody, ms: number): SunSample {
    // Le point.
    const { lon, lat } = subSolarOf(body, ms);
    // Arrondi au dix-millième de degré : environ dix mètres sur la Lune, bien au-delà de la précision du modèle.
    return { time: new Date(ms).toISOString(), lon: Math.round(lon * 1e4) / 1e4, lat: Math.round(lat * 1e4) / 1e4 };
  // Fin de sampleAt.
  }
// Fin du service.
}
