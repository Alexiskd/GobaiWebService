// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Type : indique en quel type convertir une valeur reçue en texte.
import { Type } from 'class-transformer';
// Règles de validation : entier, facultatif, texte, maximum, longueur maximale, minimum.
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Forme d'une ville.
export class CityDto {
  // name : son nom.
  @ApiProperty({ example: 'Paris' }) name: string;
  // lon : sa longitude en degrés, positive vers l'est.
  @ApiProperty({ example: 2.35, description: 'Longitude en degrés (Est positif).' }) lon: number;
  // lat : sa latitude en degrés, positive vers le nord.
  @ApiProperty({ example: 48.86, description: 'Latitude en degrés (Nord positif).' }) lat: number;
// Fin de CityDto.
}

// Forme des paramètres de requête de GET /cities.
export class FindCitiesQueryDto {
  // Documente le champ suivant : filtre sur le nom.
  @ApiPropertyOptional({ example: 'sao', description: 'Filtre sur le nom, sans tenir compte des accents ni de la casse.' })
  // Validation : le champ peut être absent.
  @IsOptional()
  // Validation : s'il est présent, c'est un texte.
  @IsString()
  // Validation : de 60 caractères au plus.
  @MaxLength(60)
  // q : le texte cherché dans les noms de villes.
  q?: string;

  // Documente le champ suivant : nombre maximal de résultats.
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 500, description: 'Nombre maximal de résultats (défaut : tous).' })
  // Validation : le champ peut être absent.
  @IsOptional()
  // Conversion : le texte reçu dans l'adresse devient un nombre.
  @Type(() => Number)
  // Validation : un entier.
  @IsInt()
  // Validation : au moins 1.
  @Min(1)
  // Validation : au plus 500.
  @Max(500)
  // limit : le nombre maximal de villes renvoyées.
  limit?: number;

  // Documente le champ suivant : pagination.
  @ApiPropertyOptional({ example: 0, minimum: 0, description: 'Nombre de résultats à ignorer (pagination).' })
  // Validation : le champ peut être absent.
  @IsOptional()
  // Conversion : le texte reçu devient un nombre.
  @Type(() => Number)
  // Validation : un entier.
  @IsInt()
  // Validation : au moins 0.
  @Min(0)
  // offset : le nombre de résultats à sauter avant de commencer.
  offset?: number;
// Fin de FindCitiesQueryDto.
}

// Forme de la réponse de GET /cities.
export class CitiesPageDto {
  // Documente le champ suivant : total avant pagination.
  @ApiProperty({ example: 208, description: 'Nombre total de villes correspondant au filtre (avant pagination).' })
  // total : le nombre de villes qui correspondent au filtre.
  total: number;

  // Documente le champ suivant : une liste de villes.
  @ApiProperty({ type: [CityDto], description: 'Villes, dans l’ordre d’importance (les plus grandes d’abord).' })
  // items : les villes de cette page, les plus grandes d'abord.
  items: CityDto[];
// Fin de CitiesPageDto.
}
