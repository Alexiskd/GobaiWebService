// Astres pour lesquels le point sous-solaire est défini :
export const SUN_BODIES = {
  // la Lune,
  moon: {
    // son nom,
    name: 'Lune',
    // son repère de coordonnées,
    frame: 'MOON_ME',
    // et le sens de la longitude de sa texture : positive vers l'est.
    textureLongitude: 'east-positive',
  // Fin de la Lune.
  },
  // Mars,
  mars: {
    // son nom,
    name: 'Mars',
    // son repère de coordonnées,
    frame: 'IAU_MARS',
    // et le sens de la longitude de sa texture.
    textureLongitude: 'east-positive',
  // Fin de Mars.
  },
// « as const » fige l'objet et ses valeurs exactes pour TypeScript.
} as const;

// Type SunBody : les noms d'astres acceptés, tirés des clés de l'objet (« moon » ou « mars »).
export type SunBody = keyof typeof SUN_BODIES;

// Forme d'un échantillon.
export interface SunSample {
  /** Instant UTC du point sous-solaire, au format ISO 8601. */
  // time : l'instant.
  time: string;
  /** Longitude du point sous-solaire, positive vers l'est, en degrés. */
  // lon : la longitude du point sous-solaire.
  lon: number;
  /** Latitude du point sous-solaire, en degrés. */
  // lat : sa latitude.
  lat: number;
// Fin de SunSample.
}

// Forme de la réponse.
export interface SunEphemeris {
  // body : l'astre.
  body: SunBody;
  /** Instant de la réponse (peut différer de `generatedAt`). */
  // now : l'instant de la réponse.
  now: string;
  // generatedAt : l'heure de fabrication des données.
  generatedAt: string;
  // expiresAt : leur heure d'expiration.
  expiresAt: string;
  /** Vrai quand l'éphéméride est servie depuis un cache périmé. */
  // stale : vrai si les données sont périmées.
  stale: boolean;
  // source : l'origine des données :
  source: {
    // son nom ;
    name: string;
    // le jeu de données ;
    dataset: string;
    // la grandeur demandée ;
    quantity: string;
    // son adresse.
    url: string;
  // Fin de source.
  };
  // frame : le repère :
  frame: {
    // son nom ;
    reference: string;
    // longitude positive vers l'est ;
    longitude: 'east-positive';
    // latitude liée à l'astre.
    latitude: 'body-fixed';
  // Fin de frame.
  };
  // samples : les échantillons.
  samples: SunSample[];
  // current : la position à l'instant de la réponse.
  current: SunSample;
// Fin de SunEphemeris.
}

// Fonction isSunBody : un texte est-il un nom d'astre accepté ? Si oui, TypeScript le traite ensuite comme un SunBody.
export function isSunBody(value: string): value is SunBody {
  // Vrai si l'objet des astres possède cette clé en propre.
  return Object.hasOwn(SUN_BODIES, value);
// Fin de isSunBody.
}
