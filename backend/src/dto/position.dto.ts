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

/** Corps de POST position/billets : deux lieux de la Terre et une date de départ. */
export class TicketsRequestDto {
  @ApiProperty({ type: PositionPointDto, description: 'Départ (Terre).' })
  @ValidateNested() @Type(() => PositionPointDto)
  a!: PositionPointDto;

  @ApiProperty({ type: PositionPointDto, description: 'Arrivée (Terre).' })
  @ValidateNested() @Type(() => PositionPointDto)
  b!: PositionPointDto;

  @ApiPropertyOptional({ example: '2026-12-05', description: 'Date de départ (AAAA-MM-JJ). Par défaut : aujourd’hui (heure de Paris).' })
  @IsOptional() @IsString()
  date?: string;
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

/** Une étape d'un trajet Terre → Lune. */
export class TripLegDto {
  @ApiProperty({ enum: ['sol', 'vol'], description: '`sol` : jusqu’au site de lancement ; `vol` : vers la Lune.' }) kind!: 'sol' | 'vol';
  @ApiProperty({ example: 'Vol vers la Lune' }) label!: string;
  @ApiProperty({ example: 4320, description: 'Durée de l’étape en minutes.' }) minutes!: number;
}

/** Site de lancement retenu pour un trajet Terre → Lune. */
export class LaunchSiteDto {
  @ApiProperty({ example: 'Centre spatial Kennedy (Cap Canaveral)' }) name!: string;
  @ApiProperty({ example: 1240, description: 'Distance au sol entre le départ et ce site, en km.' }) distanceKm!: number;
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
  @ApiPropertyOptional({ type: [TripLegDto], description: 'Étapes d’un trajet Terre → Lune : trajet au sol puis vol.' }) legs?: TripLegDto[];
  @ApiPropertyOptional({ type: LaunchSiteDto, description: 'Site de lancement lunaire le plus proche du départ (Terre → Lune).' }) launchSite?: LaunchSiteDto;
  @ApiPropertyOptional({ description: 'Vrai quand le trajet au sol n’est pas compté faute de clé : la durée ne porte que sur le vol.' }) needsKey?: boolean;
  @ApiPropertyOptional({ example: 'claude', description: 'Fournisseur qui a répondu (source `ia`).' }) provider?: string;
  @ApiPropertyOptional({ example: 'claude-fable-5-2', description: 'Modèle qui a répondu (source `ia`).' }) model?: string;
}

/** Un point d'une étape d'itinéraire. */
export class GeoPointDto {
  @ApiProperty({ example: 48.99 }) lat!: number;
  @ApiProperty({ example: 2.09 }) lon!: number;
  @ApiPropertyOptional({ example: 'Gare de Conflans' }) name?: string;
}

/** Une étape d'un itinéraire, avec le moteur qui la modélise côté frontend. */
export class ItinerarySegmentDto {
  @ApiProperty({ example: 0 }) index!: number;
  @ApiProperty({ example: 'train', description: 'Moteur : marche, course, velo, trottinette, moto, voiture, bus, tramway, metro, train, bateau, ski, cheval, avion, helicoptere, fusee, drone, ballon, planeur, ou autre-sol / autre-vol.' }) mode!: string;
  @ApiProperty({ example: 'Train', description: 'Nom du moyen, tel que donné par le modèle.' }) modeLabel!: string;
  @ApiProperty({ enum: ['sol', 'vol'], description: '`vol` : modélisé en 3D ; `sol` : modélisé en 2D.' }) category!: 'sol' | 'vol';
  @ApiProperty({ example: 'Train jusqu’à Paris Saint-Lazare' }) label!: string;
  @ApiProperty({ type: GeoPointDto }) from!: GeoPointDto;
  @ApiProperty({ type: GeoPointDto }) to!: GeoPointDto;
  @ApiProperty({ type: [GeoPointDto], description: 'Points intermédiaires, extrémités exclues.' }) waypoints!: GeoPointDto[];
  @ApiProperty({ example: 25, description: 'Durée de l’étape en minutes.' }) minutes!: number;
  @ApiProperty({ example: 21.4, description: 'Longueur du tracé en km, recalculée par le serveur.' }) km!: number;
  @ApiPropertyOptional({ example: 11, description: 'Altitude de croisière en km (étapes aériennes).' }) altitudeKm?: number;
}

/** Réponse de POST position/itineraire. */
export class ItineraryDto {
  @ApiProperty({ example: 'Marche jusqu’à la gare, puis train.' }) summary!: string;
  @ApiProperty({ example: 62 }) totalMinutes!: number;
  @ApiProperty({ example: 41.2 }) totalKm!: number;
  @ApiProperty({ type: [ItinerarySegmentDto] }) segments!: ItinerarySegmentDto[];
  @ApiPropertyOptional({ example: 'claude' }) provider?: string;
  @ApiPropertyOptional({ example: 'claude-fable-5-2' }) model?: string;
}
