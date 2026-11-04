import { ApiProperty } from '@nestjs/swagger';

export class LyonPointCloudDto {
  @ApiProperty({ example: 'Nuage de points LiDAR 2018 — Métropole de Lyon' })
  title!: string;

  @ApiProperty({ example: 'https://www.data.gouv.fr/datasets/nuage-de-points-lidar-2018-de-la-metropole-de-lyon-format-laz' })
  sourceUrl!: string;

  @ApiProperty({ example: '/api/v1/pointclouds/lyon/ept/ept.json' })
  eptUrl!: string;

  @ApiProperty({ example: 'Licence Ouverte / Open Licence 2.0 (LOv2)' })
  license!: string;

  @ApiProperty({ example: '13791199599', description: 'Nombre de points, conservé en chaîne pour éviter toute perte de précision.' })
  pointCount!: string;

  @ApiProperty({ example: 'EPSG:3946 — RGF93 / CC46' })
  coordinateSystem!: string;

  @ApiProperty({
    type: 'object',
    example: { minX: 1829188, minY: 5150048, minZ: -23, maxX: 1870353, maxY: 5197981, maxZ: 810 },
  })
  bounds!: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };

  @ApiProperty({ example: 'Nuage colorisé à partir de l’orthophotographie 2018.' })
  note!: string;
}
