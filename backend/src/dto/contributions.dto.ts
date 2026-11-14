// Décorateurs de documentation OpenAPI.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Conversion des types reçus.
import { Type } from 'class-transformer';
// Validateurs des champs reçus.
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
// Modes de tri acceptés par la liste.
import { SORT_MODES } from '../services/contributions/ranking';
// Bornes du placement.
import { MAX_POINTS } from '../services/contributions/placement';
// Bornes des identifiants.
import { PASSWORD_MAX, PASSWORD_MIN, PSEUDONYM_MAX } from '../services/contributions/accounts';

/** Emprise déclarée par l'en-tête d'un fichier LAS/LAZ, en coordonnées natives. */
export class BoundsDto {
  @ApiProperty({ example: 652000 }) @IsNumber() minX: number;
  @ApiProperty({ example: 6862000 }) @IsNumber() minY: number;
  @ApiProperty({ example: 25.52 }) @IsNumber() minZ: number;
  @ApiProperty({ example: 653000 }) @IsNumber() maxX: number;
  @ApiProperty({ example: 6863000 }) @IsNumber() maxY: number;
  @ApiProperty({ example: 98.05 }) @IsNumber() maxZ: number;
}

/** En-tête du fichier LAS/LAZ, lu par le navigateur : le fichier lui-même n'est jamais envoyé. */
export class LasHeaderDto {
  @ApiProperty({ type: BoundsDto, description: 'Emprise de l’en-tête, dans le système du fichier.' })
  @ValidateNested() @Type(() => BoundsDto)
  bounds: BoundsDto;

  @ApiProperty({ example: 16618577, description: 'Nombre de points déclaré par l’en-tête.' })
  @IsNumber() @Min(1) @Max(MAX_POINTS)
  pointCount: number;

  @ApiPropertyOptional({ example: 2154, description: 'Code EPSG lu dans les clés GeoTIFF de l’en-tête.' })
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000)
  epsg?: number;

  @ApiPropertyOptional({ description: 'Description WKT du système de coordonnées, si le fichier en porte une.' })
  @IsOptional() @IsString() @MaxLength(20_000)
  crsWkt?: string;
}

/** Corps de POST /contributions : le placement à publier. */
export class CreateContributionDto {
  @ApiProperty({ example: 'LHD_FXX_0652_6863_PTS_C_LAMB93_IGN69.copc.laz', description: 'Nom du fichier analysé.' })
  @IsString() @MaxLength(200)
  filename: string;

  @ApiPropertyOptional({ example: 'Paris, Hôtel de Ville', description: 'Titre affiché ; à défaut, le nom du fichier.' })
  @IsOptional() @IsString() @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 'Relevé 2021, altitudes IGN69.', description: 'Note libre.' })
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;

  @ApiProperty({ type: LasHeaderDto })
  @ValidateNested() @Type(() => LasHeaderDto)
  header: LasHeaderDto;
}

/** Corps de POST /contributions/signup et /contributions/login. */
export class CredentialsDto {
  @ApiProperty({ example: 'Alex', minLength: 3, maxLength: PSEUDONYM_MAX, description: 'Pseudonyme : lettres, chiffres, espace, tiret et tiret bas.' })
  @IsString() @MaxLength(PSEUDONYM_MAX + 10)
  name: string;

  @ApiProperty({ example: 'un-mot-de-passe', minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX, description: 'Mot de passe ; aucune adresse de courriel n’est demandée.' })
  @IsString() @MaxLength(PASSWORD_MAX)
  password: string;
}

/** Corps de POST /contributions/:id/vote. */
export class VoteDto {
  @ApiProperty({ example: 1, enum: [-1, 0, 1], description: '+1 : placement juste ; -1 : placement faux ; 0 : retire la voix.' })
  @IsInt() @Min(-1) @Max(1)
  value: number;
}

/** Paramètres de GET /contributions. */
export class ListContributionsQueryDto {
  @ApiPropertyOptional({ enum: SORT_MODES, default: 'populaire', description: 'Ordre de la liste.' })
  @IsOptional() @IsIn(SORT_MODES)
  sort?: 'populaire' | 'recent' | 'meilleur';
}

/** Un compte de contributeur. */
export class AccountDto {
  @ApiProperty({ example: '9f1c…' }) id: string;
  @ApiProperty({ example: 'Alex' }) name: string;
  @ApiProperty() createdAt: Date;
}

/** Session ouverte : le jeton à renvoyer dans l'en-tête « Authorization: Bearer … ». */
export class SessionDto {
  @ApiProperty({ description: 'Jeton de session signé, valable 30 jours.' }) token: string;
  @ApiProperty({ type: AccountDto }) account: AccountDto;
  @ApiProperty({ example: true, description: 'Faux quand le serveur n’a pas de base de données : tout est perdu à son redémarrage.' }) persistent: boolean;
}

/** Session web par cookie HttpOnly : aucun JWT n'est renvoyé dans le corps HTTP. */
export class CookieSessionDto {
  @ApiProperty({ type: AccountDto }) account: AccountDto;
  @ApiProperty({ example: true, description: 'Faux quand le serveur ne possède pas de base PostgreSQL durable.' }) persistent: boolean;
}

/** Position d'un contributeur sur un placement, et compteurs. */
export class VoteResultDto {
  @ApiProperty({ example: 4 }) up: number;
  @ApiProperty({ example: 1 }) down: number;
  @ApiProperty({ example: 3 }) score: number;
  @ApiProperty({ example: 'valide', enum: ['valide', 'conteste', 'attente'] }) status: string;
  @ApiProperty({ example: 1, description: 'Voix du visiteur : +1, -1 ou 0.' }) myVote: number;
}

/** Un placement publié. */
export class ContributionDto extends VoteResultDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'Paris, Hôtel de Ville' }) title: string;
  @ApiProperty({ example: 'LHD_FXX_0652_6863_PTS_C_LAMB93_IGN69.copc.laz' }) filename: string;
  @ApiProperty({ example: '' }) note: string;
  @ApiProperty({ example: 16618577 }) pointCount: number;
  @ApiProperty({ example: 'EPSG:2154' }) crs: string;
  @ApiProperty({ example: 'declare', enum: ['declare', 'deduit'], description: 'Système de coordonnées déclaré par le fichier, ou déduit de son emprise.' }) crsSource: string;
  @ApiProperty({ example: 'LHD_FXX_0652_6863', nullable: true, description: 'Dalle LiDAR HD de l’IGN qui contient le relevé.' }) tile: string | null;
  @ApiProperty({ example: { lat: 48.8607816, lon: 2.3525702, alt: 25.52, heading: -0.4684 }, description: 'Calage GPS calculé par le serveur.' }) anchor: { lat: number; lon: number; alt: number; heading: number };
  @ApiProperty({ type: BoundsDto }) bounds: BoundsDto;
  @ApiProperty({ example: [1000, 1000, 72.53], description: 'Côtés de l’emprise en mètres.' }) sizeMeters: number[];
  @ApiProperty({ example: [{ lat: 48.856, lon: 2.346 }], description: 'Les quatre coins du bas de l’emprise, en WGS84.' }) footprint: { lat: number; lon: number }[];
  @ApiProperty({ type: AccountDto, description: 'Auteur du placement (identifiant et pseudonyme).' }) author: { id: string; name: string };
  @ApiProperty() createdAt: Date;
}

/** Liste des placements. */
export class ContributionListDto {
  @ApiProperty({ type: [ContributionDto] }) items: ContributionDto[];
  @ApiProperty({ example: true, description: 'Faux quand le serveur n’a pas de base de données.' }) persistent: boolean;
}
