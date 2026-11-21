// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Type : convertit un objet imbriqué reçu en JSON.
import { Type } from 'class-transformer';
// Règles de validation : valeur parmi un choix, nombre, bornes, texte, longueur, champ facultatif, objet imbriqué.
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

// Astres où l'on peut poser une position.
const BODIES = ['earth', 'moon'] as const;
// Fournisseurs de modèle.
const PROVIDERS = ['claude', 'mistral'] as const;

/** Une position GPS sur la Terre ou sur la Lune. */
export class PositionPointDto {
  @ApiProperty({ enum: BODIES, example: 'earth' })
  @IsIn(BODIES as unknown as string[])
  body!: 'earth' | 'moon';

  @ApiProperty({ example: 48.9992, minimum: -90, maximum: 90, description: 'Latitude en degrés, Nord positif.' })
  @IsNumber() @Min(-90) @Max(90)
  lat!: number;

  @ApiProperty({ example: 2.0967, minimum: -180, maximum: 180, description: 'Longitude en degrés, Est positif.' })
  @IsNumber() @Min(-180) @Max(180)
  lon!: number;

  @ApiPropertyOptional({ example: 'Conflans-Sainte-Honorine', maxLength: 80 })
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;
}

/** Corps de POST position/trajet (la clé est dans l'en-tête x-assistant-key). */
export class TripRequestDto {
  @ApiProperty({ enum: PROVIDERS, example: 'claude', description: 'Modèle qui estime la durée, avec la clé de l’utilisateur.' })
  @IsIn(PROVIDERS as unknown as string[])
  provider!: 'claude' | 'mistral';

  @ApiProperty({ type: PositionPointDto, description: 'Départ.' })
  @ValidateNested() @Type(() => PositionPointDto)
  a!: PositionPointDto;

  @ApiProperty({ type: PositionPointDto, description: 'Arrivée.' })
  @ValidateNested() @Type(() => PositionPointDto)
  b!: PositionPointDto;
}

/** Un site d'alunissage proposé comme position sur la Lune. */
export class MoonSiteDto {
  @ApiProperty({ example: 'apollo-11' }) id!: string;
  @ApiProperty({ example: 'Apollo 11' }) name!: string;
  @ApiProperty({ example: 0.674 }) lat!: number;
  @ApiProperty({ example: 23.473 }) lon!: number;
  @ApiProperty({ example: 'Juillet 1969 · Armstrong, Aldrin · Mer de la Tranquillité' }) info!: string;
}

/** Réponse de GET position/lune : les sites Apollo. */
export class MoonSitesDto {
  @ApiProperty({ type: [MoonSiteDto] }) items!: MoonSiteDto[];
}

/** Réponse de POST position/trajet : la durée, sans tracé. */
export class TripDto {
  @ApiProperty({ enum: ['fixe', 'ia'], description: '`fixe` : 3 jours Terre ↔ site Apollo ; `ia` : estimée par le modèle de l’utilisateur.' })
  source!: 'fixe' | 'ia';
  @ApiProperty({ example: 4320, description: 'Durée du trajet en minutes.' }) durationMinutes!: number;
  @ApiProperty({ example: 'Vaisseau' }) mode!: string;
  @ApiProperty({ example: 'Transit Terre–Lune d’une mission Apollo : 3 jours.' }) summary!: string;
  @ApiProperty({ example: 384400, description: 'Distance au sol (même astre) ou distance moyenne Terre–Lune, en km.' }) distanceKm!: number;
  @ApiProperty({ enum: ['surface', 'terre-lune'] }) distanceKind!: 'surface' | 'terre-lune';
  @ApiPropertyOptional({ example: 'claude', description: 'Fournisseur qui a répondu (source `ia`).' }) provider?: string;
  @ApiPropertyOptional({ example: 'claude-fable-5-2', description: 'Modèle qui a répondu (source `ia`).' }) model?: string;
}
