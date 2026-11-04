import { ApiProperty } from '@nestjs/swagger';

/** Format d'erreur unique de toute l'API (documenté dans Swagger pour chaque route). */
export class ApiErrorDto {
  @ApiProperty({ example: 400, description: 'Code HTTP.' })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request', description: 'Nom court de l’erreur HTTP.' })
  error: string;

  @ApiProperty({
    example: ['zoom must not be greater than 22'],
    description: 'Explication lisible. Texte, ou liste de textes pour les erreurs de validation.',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: '/api/v1/tiles/locate?lat=48.86&lon=2.35&zoom=99', description: 'Requête concernée.' })
  path: string;

  @ApiProperty({ example: '2026-10-23T09:30:00.000Z', description: 'Horodatage ISO 8601 (UTC).' })
  timestamp: string;
}
