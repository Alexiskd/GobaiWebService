import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class EphemerisQueryDto {
  @ApiPropertyOptional({
    example: '2026-10-23T12:00:00Z',
    description: 'Instant voulu, au format ISO 8601. Par défaut : maintenant.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  time?: string;
}

export class PlanetPositionDto {
  @ApiProperty({ example: 'Mars' }) name: string;
  @ApiProperty({
    example: [1.2, -0.03, -1.1],
    type: [Number],
    description: 'Position héliocentrique [x, y, z] en UA, dans le repère de la scène (y = axe perpendiculaire à l’écliptique).',
  })
  au: [number, number, number];
  @ApiProperty({ example: 1.62, description: 'Distance au Soleil, en UA.' }) distanceAu: number;
  @ApiProperty({ example: 13.5, description: 'Temps que met la lumière du Soleil à arriver, en minutes.' }) lightMinutes: number;
}

export class EphemerisDto {
  @ApiProperty({ example: '2026-10-23T12:00:00.000Z' }) time: string;
  @ApiProperty({ example: 2461337.0, description: 'Jour julien correspondant.' }) julianDay: number;
  @ApiProperty({ type: [PlanetPositionDto] }) planets: PlanetPositionDto[];
}

export class StatePointDto {
  @ApiProperty({ example: 1793145600000, description: 'Instant UTC (ms depuis 1970).' }) t: number;
  @ApiProperty({ example: 123456.79 }) x: number;
  @ApiProperty({ example: -345678.9 }) y: number;
  @ApiProperty({ example: 12345.68 }) z: number;
}

export class MoonEphemerisDto {
  @ApiProperty({ example: 'JPL Horizons (NASA/JPL-Caltech), vecteurs géométriques' }) source: string;
  @ApiProperty({ example: 'Lune (301)' }) target: string;
  @ApiProperty({ example: 'Centre de la Terre (500@399)' }) center: string;
  @ApiProperty({ example: 'Écliptique J2000 (ICRF)', description: 'Même repère que les éléments des planètes.' }) frame: string;
  @ApiProperty({ example: 'km' }) unit: string;
  @ApiProperty({ example: 30 }) stepMinutes: number;
  @ApiProperty({ type: [StatePointDto], description: 'Table de ≈ 50 h centrée sur maintenant, à interpoler.' }) points: StatePointDto[];
}

export class MoonOrbiterDto {
  @ApiProperty({ example: 'lro' }) id: string;
  @ApiProperty({ example: 'LRO' }) name: string;
  @ApiProperty({ example: 'NASA' }) agency: string;
  @ApiProperty({ example: 'Lunar Reconnaissance Orbiter (2009)' }) description: string;
  @ApiProperty({ example: '-85', description: 'Identifiant JPL Horizons.' }) horizonsId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiPropertyOptional({ description: 'Raison de l’absence de données.' }) error?: string;
  @ApiProperty({ type: [StatePointDto], description: 'Positions Lune → sonde (km), à interpoler.' }) points: StatePointDto[];
}

export class MoonOrbitersDto {
  @ApiProperty() source: string;
  @ApiProperty({ example: 'Centre de la Lune (500@301)' }) center: string;
  @ApiProperty({ example: 'Écliptique J2000 (ICRF)' }) frame: string;
  @ApiProperty({ example: 'km' }) unit: string;
  @ApiProperty({ example: 2 }) stepMinutes: number;
  @ApiProperty({ type: [MoonOrbiterDto] }) items: MoonOrbiterDto[];
}

export class MoonPhaseDto {
  @ApiProperty({ example: 'Pleine lune' }) phase: string;
  @ApiProperty({ example: '2026-10-26T04:12:00.000Z' }) utc: string;
}

export class MoonPhasesDto {
  @ApiProperty({ example: 'U.S. Naval Observatory (aa.usno.navy.mil)' }) source: string;
  @ApiProperty({ type: [MoonPhaseDto], description: 'Les 4 prochaines phases principales.' }) items: MoonPhaseDto[];
}
