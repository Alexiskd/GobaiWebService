// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Règles de validation : date ISO 8601, champ facultatif.
import { IsISO8601, IsOptional } from 'class-validator';

// Forme des paramètres de requête de GET /ephemeris.
export class EphemerisQueryDto {
  // Ouvre la documentation du champ time :
  @ApiPropertyOptional({
    // un exemple de date ;
    example: '2026-10-23T12:00:00Z',
    // sa description.
    description: 'Instant voulu, au format ISO 8601. Par défaut : maintenant.',
  // Fin de la documentation.
  })
  // Validation : le champ peut être absent.
  @IsOptional()
  // Validation : une date ISO 8601 stricte (une date impossible comme le 30 février est refusée).
  @IsISO8601({ strict: true })
  // time : l'instant voulu.
  time?: string;
// Fin de EphemerisQueryDto.
}

// Forme de la position d'une planète.
export class PlanetPositionDto {
  // name : son nom.
  @ApiProperty({ example: 'Mars' }) name: string;
  // Ouvre la documentation du champ au :
  @ApiProperty({
    // un exemple de trois nombres ;
    example: [1.2, -0.03, -1.1],
    // son type : une liste de nombres ;
    type: [Number],
    // sa description : position autour du Soleil, en unités astronomiques.
    description: 'Position héliocentrique [x, y, z] en UA, dans le repère de la scène (y = axe perpendiculaire à l’écliptique).',
  // Fin de la documentation.
  })
  // au : exactement trois nombres, x, y et z.
  au: [number, number, number];
  // distanceAu : sa distance au Soleil, en unités astronomiques.
  @ApiProperty({ example: 1.62, description: 'Distance au Soleil, en UA.' }) distanceAu: number;
  // lightMinutes : le temps que met la lumière du Soleil à l'atteindre, en minutes.
  @ApiProperty({ example: 13.5, description: 'Temps que met la lumière du Soleil à arriver, en minutes.' }) lightMinutes: number;
// Fin de PlanetPositionDto.
}

// Forme de la réponse de GET /ephemeris.
/**
 * Positions des planètes et leurs métadonnées : époque, échelle de temps, centre, repère, unités, modèle et
 * précision. Deux états ne se comparent que si l'on sait de quel instant et de quel repère ils viennent.
 */
export class EphemerisDto {
  // time : l'instant du calcul, en ISO 8601.
  @ApiProperty({ example: '2026-10-23T12:00:00.000Z' }) time: string;
  // julianDay : le même instant en jour julien, l'échelle de temps des astronomes.
  @ApiProperty({ example: 2461337.0, description: 'Jour julien correspondant (UTC).' }) julianDay: number;
  // timeScale : l'échelle de temps employée ; UTC n'est pas interchangeable avec le Temps terrestre.
  @ApiProperty({ example: 'UTC en entrée, Temps terrestre (TT) pour le calcul des orbites' }) timeScale: string;
  // center : le point d'où les positions sont comptées.
  @ApiProperty({ example: 'Centre du Soleil' }) center: string;
  // frame : le repère des coordonnées.
  @ApiProperty({ example: 'Écliptique J2000, repère de la scène (x, z, −y de l’écliptique)' }) frame: string;
  // unit : les unités des positions et des vitesses.
  @ApiProperty({ example: 'UA et UA/jour' }) unit: string;
  // model : la méthode de calcul, pour savoir à quoi comparer.
  @ApiProperty({ description: 'Modèle employé : aucun service d’éphémérides n’est interrogé.' }) model: string;
  // accuracy : l'ordre de grandeur de l'écart attendu.
  @ApiProperty({ description: 'Ordre de grandeur de l’écart à une éphéméride de référence.' }) accuracy: string;
  // planets : la position de chaque planète.
  @ApiProperty({ type: [PlanetPositionDto] }) planets: PlanetPositionDto[];
// Fin de EphemerisDto.
}

// Forme d'un point d'une table de positions.
export class StatePointDto {
  // t : l'instant, en millisecondes depuis 1970 (UTC).
  @ApiProperty({ example: 1793145600000, description: 'Instant UTC (ms depuis 1970).' }) t: number;
  // x : coordonnée x.
  @ApiProperty({ example: 123456.79 }) x: number;
  // y : coordonnée y.
  @ApiProperty({ example: -345678.9 }) y: number;
  // z : coordonnée z.
  @ApiProperty({ example: 12345.68 }) z: number;
// Fin de StatePointDto.
}

// Forme de la réponse de GET /ephemeris/moon.
export class MoonEphemerisDto {
  // source : l'origine des données.
  @ApiProperty({ example: 'Théorie ELP, termes principaux (Meeus, chap. 47), calcul local' }) source: string;
  // target : l'astre visé, la Lune.
  @ApiProperty({ example: 'Lune' }) target: string;
  // center : le point d'où part le vecteur, le centre de la Terre.
  @ApiProperty({ example: 'Centre de la Terre' }) center: string;
  // frame : le repère des coordonnées.
  @ApiProperty({ example: 'Écliptique J2000', description: 'Même repère que les éléments des planètes.' }) frame: string;
  // unit : l'unité des coordonnées.
  @ApiProperty({ example: 'km' }) unit: string;
  // stepMinutes : l'écart entre deux points de la table, en minutes.
  @ApiProperty({ example: 30 }) stepMinutes: number;
  // points : la table des positions, à interpoler par le client.
  @ApiProperty({ type: [StatePointDto], description: 'Table de ≈ 50 h centrée sur maintenant, à interpoler.' }) points: StatePointDto[];
// Fin de MoonEphemerisDto.
}

// Forme de la table d'un satellite.
export class SatelliteEphemerisDto {
  // id : son identifiant.
  @ApiProperty({ example: 'io' }) id: string;
  // target : l'astre visé.
  @ApiProperty({ example: 'Io (501)' }) target: string;
  // center : le centre de sa planète.
  @ApiProperty({ example: 'Centre de Jupiter (500@599)' }) center: string;
  // points : ses positions par rapport à sa planète.
  @ApiProperty({ type: [StatePointDto], description: 'Positions planète → satellite (km, écliptique J2000), à interpoler.' }) points: StatePointDto[];
// Fin de SatelliteEphemerisDto.
}

// Forme de la réponse de GET /ephemeris/satellites.
export class SatellitesEphemerisDto {
  // source : l'origine des données.
  @ApiProperty({ example: 'Éléments képlériens et équation de Kepler, calcul local' }) source: string;
  // frame : le repère des coordonnées.
  @ApiProperty({ example: 'Écliptique J2000 (ICRF)' }) frame: string;
  // unit : l'unité des coordonnées.
  @ApiProperty({ example: 'km' }) unit: string;
  // stepMinutes : l'écart entre deux points, en minutes.
  @ApiProperty({ example: 20 }) stepMinutes: number;
  // satellites : une table par satellite.
  @ApiProperty({ type: [SatelliteEphemerisDto], description: 'Satellites dont la table a pu être obtenue.' }) satellites: SatelliteEphemerisDto[];
// Fin de SatellitesEphemerisDto.
}

// Forme d'une phase de la Lune.
export class MoonPhaseDto {
  // phase : son nom (nouvelle lune, premier quartier, pleine lune, dernier quartier).
  @ApiProperty({ example: 'Pleine lune' }) phase: string;
  // utc : sa date et son heure, en temps universel.
  @ApiProperty({ example: '2026-10-26T04:12:00.000Z' }) utc: string;
// Fin de MoonPhaseDto.
}

// Forme de la réponse de GET /ephemeris/moon/phases.
export class MoonPhasesDto {
  // source : l'origine des données.
  @ApiProperty({ example: 'U.S. Naval Observatory (aa.usno.navy.mil)' }) source: string;
  // items : les quatre prochaines phases.
  @ApiProperty({ type: [MoonPhaseDto], description: 'Les 4 prochaines phases principales.' }) items: MoonPhaseDto[];
// Fin de MoonPhasesDto.
}

/** État instantané calculé par le modèle képlérien local. */
export class KeplerBodyStateDto {
  @ApiProperty({ example: 'mars' }) id: string;
  @ApiProperty({ example: 'Mars' }) name: string;
  @ApiProperty({ example: 'planet' }) type: string;
  @ApiProperty({ example: 'Centre du Soleil' }) center: string;
  @ApiProperty({ example: '2026-11-14T12:00:00.000Z' }) time: string;
  @ApiProperty({ example: 'UTC en entrée, TT pour la propagation depuis J2000' }) timeScale: string;
  @ApiProperty({ example: 'ecliptic' }) frame: string;
  @ApiProperty({ example: 'Écliptique J2000' }) outputFrame: string;
  @ApiProperty({ example: 'au' }) distanceUnit: string;
  @ApiProperty({ example: 'au/jour' }) velocityUnit: string;
  @ApiProperty({ example: 'Kepler elliptique à deux corps, éléments moyens référencés à J2000' }) model: string;
  @ApiProperty({ example: 'Ne modélise pas les perturbations mutuelles, les résonances ni les corrections relativistes.' }) limitations: string;
  @ApiProperty({ type: [Number], example: [1.2, -0.03, -1.1] }) position: [number, number, number];
  @ApiProperty({ type: [Number], example: [0.01, 0.02, 0.001] }) velocity: [number, number, number];
  @ApiProperty({ example: 1.52 }) distance: number;
  @ApiProperty({ example: 0.0091 }) meanMotionRadPerDay: number;
  @ApiProperty({ example: 686.98 }) periodDays: number;
  @ApiProperty({ example: 0.52 }) eccentricAnomalyRad: number;
  @ApiProperty({ example: 0.57 }) trueAnomalyRad: number;
}

