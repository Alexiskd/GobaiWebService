export const SUN_BODIES = {
  moon: {
    horizonsId: '301',
    name: 'Lune',
    frame: 'MOON_ME',
    textureLongitude: 'east-positive',
  },
  mars: {
    horizonsId: '499',
    name: 'Mars',
    frame: 'IAU_MARS',
    textureLongitude: 'east-positive',
  },
} as const;

export type SunBody = keyof typeof SUN_BODIES;

export interface SunSample {
  /** Instant UTC du point sous-solaire, au format ISO 8601. */
  time: string;
  /** Longitude du point sous-solaire, positive vers l'est, en degrés. */
  lon: number;
  /** Latitude du point sous-solaire, en degrés. */
  lat: number;
}

export interface SunEphemeris {
  body: SunBody;
  /** Instant de la réponse (peut différer de `generatedAt`). */
  now: string;
  generatedAt: string;
  expiresAt: string;
  /** Vrai quand l'éphéméride est servie depuis un cache périmé. */
  stale: boolean;
  source: {
    name: string;
    dataset: string;
    quantity: string;
    url: string;
  };
  frame: {
    reference: string;
    longitude: 'east-positive';
    latitude: 'body-fixed';
  };
  samples: SunSample[];
  current: SunSample;
}

export function isSunBody(value: string): value is SunBody {
  return Object.hasOwn(SUN_BODIES, value);
}
