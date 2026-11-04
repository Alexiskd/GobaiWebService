import { ApiProperty } from '@nestjs/swagger';

export class RoadLabelDto {
  @ApiProperty({ example: 'I-95', description: 'Nom de l’axe.' }) name: string;
  @ApiProperty({ example: -76.5 }) lon: number;
  @ApiProperty({ example: 39.2 }) lat: number;
}

export class RoadsDto {
  @ApiProperty({
    description:
      'Axes principaux : chaque chaîne est une suite de points, reliés dans l’ordre. ' +
      'Un point est soit le nom d’une ville de `/cities`, soit un couple `[longitude, latitude]`.',
    example: [['Paris', 'Lyon', [4.9, 44.5], 'Marseille']],
    type: 'array',
    items: {
      type: 'array',
      items: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }] },
    },
  })
  chains: (string | [number, number])[][];

  @ApiProperty({ type: [RoadLabelDto] }) labels: RoadLabelDto[];
}
