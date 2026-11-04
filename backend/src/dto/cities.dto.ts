import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CityDto {
  @ApiProperty({ example: 'Paris' }) name: string;
  @ApiProperty({ example: 2.35, description: 'Longitude en degrés (Est positif).' }) lon: number;
  @ApiProperty({ example: 48.86, description: 'Latitude en degrés (Nord positif).' }) lat: number;
}

export class FindCitiesQueryDto {
  @ApiPropertyOptional({ example: 'sao', description: 'Filtre sur le nom, sans tenir compte des accents ni de la casse.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 500, description: 'Nombre maximal de résultats (défaut : tous).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, description: 'Nombre de résultats à ignorer (pagination).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class CitiesPageDto {
  @ApiProperty({ example: 208, description: 'Nombre total de villes correspondant au filtre (avant pagination).' })
  total: number;

  @ApiProperty({ type: [CityDto], description: 'Villes, dans l’ordre d’importance (les plus grandes d’abord).' })
  items: CityDto[];
}
