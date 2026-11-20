// ApiProperty : décrit un champ dans la documentation Swagger.
import { ApiProperty } from '@nestjs/swagger';

// Forme d'une ligne de la table seo_tags, pour GET /api/v1/seo.
export class SeoTagDto {
  // Documente le champ suivant : adresse de la page.
  @ApiProperty({ example: 'mars', description: 'Adresse de la page (son astre ou sa fenêtre), sans la barre oblique.' })
  // page_slug : l'adresse de la page.
  page_slug: string;

  // Documente le champ suivant : nom de la balise.
  @ApiProperty({ example: 'og:title', description: 'Nom de la balise HTML (title, description, canonical, og:title, og:description, twitter:title, twitter:description…).' })
  // tag_name : le nom de la balise.
  tag_name: string;

  // Documente le champ suivant : contenu de la balise.
  @ApiProperty({ example: 'Mars en 3D et en direct · Système solaire 3D Go白ناन्टех (Gobai Space)', description: 'Contenu de la balise, tel qu’écrit dans la page.' })
  // tag_content : le contenu de la balise.
  tag_content: string;
// Fin de SeoTagDto.
}
