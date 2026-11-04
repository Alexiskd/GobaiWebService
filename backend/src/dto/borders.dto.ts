import { ApiProperty } from '@nestjs/swagger';

export class BordersDto {
  @ApiProperty({ example: 'Natural Earth 1:50m · world-atlas 2.0.2', description: 'Jeu de données utilisé.' }) source: string;
  @ApiProperty({ example: 'Frontières : Natural Earth', description: 'Mention à afficher avec la carte.' }) attribution: string;
  @ApiProperty({ example: 512, description: 'Nombre de polylignes de frontières (`lines`).' }) count: number;
  @ApiProperty({
    description:
      'Frontières terrestres entre pays. Chaque polyligne est une liste plate `[lon1, lat1, lon2, lat2, …]` en degrés ' +
      '(3 décimales, ≈ 100 m). Les littoraux sont dans `coastlines`.',
    example: [[2.545, 51.089, 2.66, 50.82]],
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  lines: number[][];

  @ApiProperty({
    description: 'Littoraux (mers, océans, Caspienne), même format que `lines`. Les découpes de la carte à ±180° et au pôle Sud sont exclues.',
    example: [[-1.79, 43.39, -1.66, 43.4]],
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  coastlines: number[][];
}
