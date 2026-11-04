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

  @ApiProperty({ example: '1.4', nullable: true, description: 'Version du format LAS, si l’en-tête est lisible.' })
  version!: string | null;

  @ApiProperty({ example: '6', nullable: true, description: 'Format d’enregistrement des points LAS/LAZ.' })
  pointFormat!: number | null;

  @ApiProperty({ example: '125000000', nullable: true, description: 'Nombre de points, conservé en chaîne pour éviter toute perte de précision.' })
  pointCount!: string | null;

  @ApiProperty({
    type: 'object',
    nullable: true,
    example: { minX: 139.7, minY: 35.6, minZ: 2, maxX: 139.9, maxY: 35.8, maxZ: 850 },
    description: 'Emprise des coordonnées natives LAS, sans reprojection.',
  })
  bounds!: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null;

  @ApiProperty({ nullable: true, description: 'WKT de référence spatiale embarqué dans les VLR/EVLR LAS.' })
  coordinateSystemWkt!: string | null;

  @ApiProperty({
    example: '/api/v1/pointclouds/lion_takanawa.copc.laz/potree/cloud.js',
    nullable: true,
    description: 'URL du cloud.js PotreeConverter correspondant, si présent dans POINTCLOUD_DIR/potree/<nom>/.',
  })
  potreeUrl!: string | null;

  @ApiProperty({
    example: '/api/v1/pointclouds/lion_takanawa.copc.laz/potree/',
    nullable: true,
    description: 'Répertoire de base des ressources du nuage Potree.',
  })
  potreeBaseUrl!: string | null;
}

export class PointCloudListDto {
  @ApiProperty({ type: [PointCloudDto], description: 'Fichiers présents dans le répertoire configuré (`POINTCLOUD_DIR`).' })
  items!: PointCloudDto[];
}
