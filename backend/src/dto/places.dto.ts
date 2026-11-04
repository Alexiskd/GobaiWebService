import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class FindPlacesQueryDto {
  @ApiProperty({ example: 'Conflans', description: 'Texte recherché (début de nom accepté).' })
  @IsString() @Length(2, 120)
  q: string;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  limit?: number;
}

export class PlaceDto {
  @ApiProperty({ example: 'Conflans-Sainte-Honorine' }) name: string;
  @ApiProperty({ example: 'Yvelines, France', description: 'Contexte (région, pays).' }) context: string;
  @ApiProperty({ example: 2.0967 }) lon: number;
  @ApiProperty({ example: 48.9992 }) lat: number;
}

export class CityLabelDto {
  @ApiProperty({ example: 'Tokyo' }) name: string;
  @ApiPropertyOptional({ example: 'Le Caire', description: 'Nom français, absent quand il est identique au nom Natural Earth.' }) nameFr?: string;
  @ApiPropertyOptional({ example: '東京都', description: 'Nom dans l’écriture locale, absent quand Natural Earth ne le fournit pas.' }) native?: string;
  @ApiPropertyOptional({ example: 'japanese', description: 'Écriture de `native` (typographie à appliquer côté client).' }) script?: string;
  @ApiProperty({ example: 'Japan' }) country: string;
  @ApiPropertyOptional({ example: 'Japon', description: 'Nom français du pays, absent quand il est identique.' }) countryFr?: string;
  @ApiPropertyOptional({ example: 'Tokyo', description: 'Région ou État (Natural Earth `adm1name`).' }) region?: string;
  @ApiPropertyOptional({ example: 'Asia/Tokyo', description: 'Fuseau horaire IANA.' }) timezone?: string;
  @ApiPropertyOptional({ example: 5750, description: 'Aire urbaine maximale en km² (Natural Earth `max_areakm`).' }) areaKm2?: number;
  @ApiProperty({ example: 139.7494 }) lon: number;
  @ApiProperty({ example: 35.6869 }) lat: number;
  @ApiProperty({ example: 35676000, description: 'Population (agglomération, Natural Earth `pop_max`).' }) pop: number;
  @ApiProperty({ description: 'Capitale d’État.' }) capital: boolean;
}

export class CityLabelsDto {
  @ApiProperty({ example: 'Natural Earth 1:10m populated places' }) source: string;
  @ApiProperty({ example: 'Villes : Natural Earth' }) attribution: string;
  @ApiProperty({ example: 7342 }) count: number;
  @ApiProperty({ type: [CityLabelDto], description: 'Triées de la plus peuplée à la moins peuplée.' }) items: CityLabelDto[];
}

export class PlacesDto {
  @ApiProperty({ example: 'uber' }) provider: string;
  @ApiProperty({ type: [PlaceDto] }) items: PlaceDto[];
  @ApiProperty({ example: '© Uber' }) attribution: string;
}
