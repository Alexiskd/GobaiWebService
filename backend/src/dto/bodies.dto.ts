import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SunDto {
  @ApiProperty({ example: 'Soleil' }) name: string;
  @ApiProperty({ example: 109.2, description: 'Rayon, en rayons terrestres.' }) radius: number;
  @ApiProperty({ example: '#ffb300', description: 'Couleur d’interface.' }) color: string;
}

export class MoonDto {
  @ApiProperty({ example: 'Lune' }) name: string;
  @ApiProperty({ example: 0.273, description: 'Rayon, en rayons terrestres.' }) radius: number;
}

export class PlanetDto {
  @ApiProperty({ example: 'Terre' }) name: string;
  @ApiProperty({ example: 1, description: 'Rayon, en rayons terrestres.' }) radius: number;
  @ApiProperty({ example: 0.9973, description: 'Période de rotation, en jours (négatif = rotation rétrograde).' })
  rotation: number;
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour la Terre uniquement.' }) earth?: true;
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour Mars uniquement.' }) mars?: true;
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour Saturne uniquement.' }) ring?: true;
  @ApiProperty({ example: '#3d8bff' }) color: string;
  @ApiProperty({
    type: [Number],
    description:
      'Éléments képlériens JPL (J2000) suivis de leur dérive par siècle : ' +
      '[a, a’, e, e’, I, I’, L, L’, ϖ, ϖ’, Ω, Ω’]. Angles en degrés, demi-grand axe en UA.',
  })
  elements: number[];
}

export class BodiesDto {
  @ApiProperty({ type: SunDto }) sun: SunDto;
  @ApiProperty({ type: MoonDto }) moon: MoonDto;
  @ApiProperty({ type: [PlanetDto], description: 'Du plus proche au plus lointain du Soleil.' }) planets: PlanetDto[];
}
