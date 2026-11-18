// ApiProperty : décrit un champ dans la documentation Swagger.
import { ApiProperty } from '@nestjs/swagger';

// Forme de la réponse de GET /api/health.
export class HealthDto {
  // Documente le champ suivant.
  @ApiProperty({ example: 'ok' })
  // status : toujours le texte « ok ».
  status: 'ok';

  // Documente le champ suivant : heure du serveur.
  @ApiProperty({ example: '2026-10-23T09:30:00.000Z', description: 'Heure du serveur (ISO 8601, UTC).' })
  // time : l'heure du serveur, en ISO 8601 (UTC).
  time: string;

  // Documente le champ suivant : durée de fonctionnement.
  @ApiProperty({ example: 3600, description: 'Durée depuis le démarrage, en secondes.' })
  // uptimeSeconds : le nombre de secondes depuis le démarrage.
  uptimeSeconds: number;

  // Documente le champ suivant : commit déployé.
  @ApiProperty({ example: '44c3cddb151c8e0815b7f61bec933ef8085286fa', description: 'Commit déployé (vide hors de Render). Les pages ouvertes se rechargent quand il change.' })
  // build : l'identifiant du commit déployé, vide hors de Render.
  build: string;
// Fin de HealthDto.
}
