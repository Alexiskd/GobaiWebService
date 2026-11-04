import { ApiProperty } from '@nestjs/swagger';

export class PointCloudDto {
  @ApiProperty({ example: 'lion_takanawa.copc.laz', description: 'Nom du fichier, à réutiliser dans les autres routes.' })
  name!: string;

  @ApiProperty({ example: 123456789, description: 'Taille du fichier, en octets.' })
  sizeBytes!: number;

  @ApiProperty({ example: '2026-11-04T12:00:00.000Z', description: 'Dernière modification (ISO 8601, UTC).' })
  modifiedAt!: string;

  @ApiProperty({
    example: '/api/v1/pointclouds/lion_takanawa.copc.laz/file',
    description: 'Flux binaire du fichier, avec support des requêtes HTTP `Range` (COPC, LAS/LAZ).',
  })
  fileUrl!: string;
}

export class PointCloudListDto {
  @ApiProperty({ type: [PointCloudDto], description: 'Fichiers présents dans le répertoire configuré (`POINTCLOUD_DIR`).' })
  items!: PointCloudDto[];
}
