// Décorateurs de documentation OpenAPI.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Conversion des paramètres de requête.
import { Type } from 'class-transformer';
// Validateurs des champs reçus.
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
// Borne du niveau de zoom assemblable.
import { MAX_ZOOM } from '../services/export/mosaic.service';

/** Un astre exportable. */
export class ExportableBodyDto {
  @ApiProperty({ example: 'mars', description: 'Clé à employer dans les routes.' }) key: string;
  @ApiProperty({ example: 'Mars' }) name: string;
  @ApiProperty({ example: 3389.5, description: 'Rayon équatorial réel, en kilomètres : l’échelle du modèle 3D.' }) radiusKm: number;
  @ApiProperty({ example: 0.00589, description: 'Aplatissement appliqué au modèle (0 = sphère).' }) flattening: number;
  @ApiPropertyOptional({ example: true, description: 'Vrai si un fond de carte existe pour cet astre ; sinon le modèle 3D est livré sans texture.' }) hasTiles?: boolean;
  @ApiPropertyOptional({ example: true, description: 'Vrai si l’astre a une orbite héliocentrique ; faux pour le Soleil, dont on calcule la position apparente.' }) hasOrbit?: boolean;
}

/** Liste des astres exportables. */
export class ExportableBodiesDto {
  @ApiProperty({ type: [ExportableBodyDto] }) items: ExportableBodyDto[];
}

/** Paramètre de route : la clé d'un astre. */
export class BodyParamsDto {
  @ApiProperty({ example: 'mars' })
  @IsString() @MaxLength(40) @Matches(/^[a-z-]+$/, { message: 'Clé d’astre inattendue.' })
  body: string;
}

/** Paramètres communs aux exports d'images et de modèles. */
export class ExportQueryDto {
  @ApiPropertyOptional({ example: 4, minimum: 0, maximum: MAX_ZOOM, description: 'Niveau de zoom des tuiles assemblées : chaque niveau double la résolution.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM)
  zoom?: number;

  @ApiPropertyOptional({ example: 'satellite', description: 'Couche de tuiles ; par défaut, la première couche d’imagerie de l’astre.' })
  @IsOptional() @IsString() @MaxLength(80) @Matches(/^[a-z0-9:_-]+$/, { message: 'Identifiant de couche inattendu.' })
  layer?: string;
}

/** Paramètres du modèle 3D. */
export class ModelQueryDto extends ExportQueryDto {
  @ApiPropertyOptional({ enum: ['basse', 'normale', 'haute'], description: 'Finesse du maillage.' })
  @IsOptional() @IsIn(['basse', 'normale', 'haute'])
  quality?: 'basse' | 'normale' | 'haute';
}

/** Paramètres du calcul d'orbite. */
export class OrbitQueryDto {
  @ApiProperty({ example: 'mars', description: 'Astre dont on veut l’orbite.' })
  @IsString() @MaxLength(40) @Matches(/^[a-z-]+$/, { message: 'Clé d’astre inattendue.' })
  body: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z', description: 'Début de la période ; par défaut, maintenant.' })
  @IsOptional() @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00Z', description: 'Fin de la période ; par défaut, un an après le début.' })
  @IsOptional() @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ example: 365, minimum: 1, maximum: 10_000, description: 'Nombre de points rendus.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000)
  steps?: number;
}

/** Un point de l'orbite. */
export class OrbitPointDto {
  @ApiProperty({ example: 1767225600000, description: 'Instant, en millisecondes UTC.' }) t: number;
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' }) time: string;
  @ApiProperty({ example: [0.34, -1.38, -0.04], description: 'Position héliocentrique, en UA.' }) au: number[];
  @ApiProperty({ description: 'La même, en kilomètres.' }) km: number[];
  @ApiPropertyOptional({ description: 'Vitesse, en UA par jour. Absente pour le Soleil.' }) auPerDay?: number[];
  @ApiPropertyOptional({ description: 'La même, en km/s. Absente pour le Soleil.' }) kmPerSecond?: number[];
  @ApiPropertyOptional({ example: 0.9833, description: 'Soleil : distance à la Terre, en UA.' }) distanceAu?: number;
  @ApiPropertyOptional({ example: 147_100_000, description: 'Soleil : distance à la Terre, en kilomètres.' }) distanceKm?: number;
  @ApiPropertyOptional({ example: 280.46, description: 'Soleil : longitude écliptique apparente, en degrés.' }) eclipticLonDeg?: number;
  @ApiPropertyOptional({ example: 0.0001, description: 'Soleil : latitude écliptique apparente, en degrés.' }) eclipticLatDeg?: number;
  @ApiPropertyOptional({ example: 281.28, description: 'Soleil : ascension droite, en degrés.' }) rightAscensionDeg?: number;
  @ApiPropertyOptional({ example: -23.03, description: 'Soleil : déclinaison, en degrés.' }) declinationDeg?: number;
  @ApiPropertyOptional({ description: 'Soleil : point de la Terre où il est au zénith (longitude est et latitude, en degrés).' }) subSolar?: { lon: number; lat: number };
}

/** Résultat du calcul d'orbite. */
export class OrbitDto {
  @ApiProperty({ example: 'Mars' }) body: string;
  @ApiProperty({ example: 'Centre du Soleil' }) center: string;
  @ApiProperty({ example: 'Écliptique J2000' }) frame: string;
  @ApiProperty({ example: 'Dates en UTC ; orbites calculées en Temps terrestre' }) timeScale: string;
  @ApiProperty({ example: 'UA, UA/jour, km et km/s' }) unit: string;
  @ApiProperty({ description: 'Modèle employé pour le calcul.' }) model: string;
  @ApiPropertyOptional({ description: 'Éléments orbitaux au début de la période. Absents pour le Soleil, qui n’a pas d’orbite.' }) elements?: Record<string, number>;
  @ApiPropertyOptional({ description: 'Précision apportée au relevé, quand il y en a une.' }) note?: string;
  @ApiProperty({ type: [OrbitPointDto] }) points: OrbitPointDto[];
}
