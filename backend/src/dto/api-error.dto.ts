// ApiProperty : décrit un champ dans la documentation Swagger (exemple, description, type).
import { ApiProperty } from '@nestjs/swagger';

/** Format d'erreur unique de toute l'API (documenté dans Swagger pour chaque route). */
// Classe qui décrit la forme de toute réponse d'erreur de l'API.
export class ApiErrorDto {
  // Documente le champ suivant : exemple 400.
  @ApiProperty({ example: 400, description: 'Code HTTP.' })
  // statusCode : le code HTTP de l'erreur, un nombre.
  statusCode: number;

  // Documente le champ suivant : exemple « Bad Request ».
  @ApiProperty({ example: 'Bad Request', description: 'Nom court de l’erreur HTTP.' })
  // error : le nom court de l'erreur HTTP, un texte.
  error: string;

  // Ouvre la documentation du champ message :
  @ApiProperty({
    // exemple, une liste d'un seul texte ;
    example: ['zoom must not be greater than 22'],
    // sa description ;
    description: 'Explication lisible. Texte, ou liste de textes pour les erreurs de validation.',
    // son type : soit un texte, soit une liste de textes.
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  // Fin de la documentation.
  })
  // message : l'explication lisible, un texte ou une liste de textes.
  message: string | string[];

  // Documente le champ suivant : exemple d'adresse appelée.
  @ApiProperty({ example: '/api/v1/tiles/locate?lat=48.86&lon=2.35&zoom=99', description: 'Requête concernée.' })
  // path : l'adresse de la requête qui a échoué.
  path: string;

  // Documente le champ suivant : exemple de date.
  @ApiProperty({ example: '2026-10-23T09:30:00.000Z', description: 'Horodatage ISO 8601 (UTC).' })
  // timestamp : l'heure de l'erreur, en ISO 8601 (UTC).
  timestamp: string;
// Fin de ApiErrorDto.
}
