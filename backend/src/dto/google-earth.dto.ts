// Décorateur de documentation Swagger.
import { ApiProperty } from '@nestjs/swagger';

/** Configuration du globe Google. */
// Classe de la réponse.
export class GoogleEarthConfigDto {
  // Vrai si une clé est configurée sur le serveur.
  @ApiProperty({ description: 'Une clé GOOGLE_MAPS_API_KEY est configurée.' }) available!: boolean;
  // La clé de l'API Maps JavaScript, ou null.
  @ApiProperty({ nullable: true, type: String, description: 'Clé de l’API Maps JavaScript (publique, restreinte par site), ou null.' }) key!: string | null;
// Fin de la classe.
}
