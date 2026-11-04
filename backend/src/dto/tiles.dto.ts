import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { MAX_LATITUDE, MAX_ZOOM } from '../services/map-tiles/tile-math';

export class TileLayerDto {
  @ApiProperty({ example: 'satellite', description: 'Identifiant à utiliser dans les autres routes.' }) id: string;
  @ApiProperty({ example: 'Satellite' }) label: string;
  @ApiProperty({ example: 'Photographie aérienne et satellite.' }) description: string;
  @ApiProperty({ enum: ['imagery', 'map', 'relief', 'hybrid', 'overlay'], description: 'Nature du rendu. `overlay` = calque transparent à superposer.' })
  kind: string;
  @ApiProperty({ enum: ['gibs', 'nasa-trek', 'mars-trek', 'venus-trek', 'moon-trek', 'usgs-astro', 'lroc-lunaserv', 'usgs-astro-mars', 'opm-mars', 'murray-lab'], description: 'Fournisseur qui sert réellement les images.' }) provider: string;
  @ApiProperty({ enum: ['earth', 'moon', 'mars', 'mercury', 'venus'], description: 'Astre sur lequel la couche se pose.' }) body: string;
  @ApiProperty({
    enum: ['mercator', 'equirectangular'],
    description: 'Découpage : `mercator` = 2^z × 2^z tuiles Web Mercator ; `equirectangular` = 2^(z+1) × 2^z tuiles géographiques (pôle à pôle).',
  })
  projection: string;
  @ApiProperty({ example: 0 }) minZoom: number;
  @ApiProperty({ example: 22 }) maxZoom: number;
  @ApiProperty({ example: 256, description: 'Taille d’une tuile, en pixels.' }) tileSize: number;
  @ApiProperty({ enum: ['jpeg', 'png'] }) format: string;
  @ApiProperty({ description: 'Vrai si les tuiles ont de la transparence.' }) transparent: boolean;
  @ApiProperty({ description: 'Vrai si le fournisseur n’a pas pu être vérifié (voir README).' }) experimental: boolean;
}

export class TileLayerListDto {
  @ApiProperty({ enum: ['gibs'], description: 'Fournisseur actif de la Terre (les couches de la Lune ont `body: moon`).' }) provider: string;
  @ApiProperty({ description: 'Vrai si la couche active est un fournisseur de repli.' }) fallback: boolean;
  @ApiProperty({ example: 256 }) tileSize: number;
  @ApiProperty({ description: 'Vrai si la recherche de lieux via Uber Maps est configurée.' }) placeSearch: boolean;
  @ApiProperty({ type: [TileLayerDto] }) layers: TileLayerDto[];
}

export class TileAttributionDto {
  @ApiProperty({ example: 'NASA EOSDIS GIBS' }) text: string;
}

export class ResolvedTileLayerDto extends TileLayerDto {
  @ApiProperty({
    example: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/…/{z}/{y}/{x}.jpeg',
    description: 'Modèle d’URL : remplacez {z}, {x}, {y}. À charger directement depuis le navigateur.',
  })
  urlTemplate: string;

  @ApiProperty({ nullable: true, example: '2026-11-05T10:00:00.000Z', description: 'Date d’expiration du modèle (ISO 8601, UTC). `null` = permanent. Redemandez-le avant.' })
  expiresAt: string | null;

  @ApiProperty({ type: TileAttributionDto, description: 'Mention à afficher en permanence près de la carte.' })
  attribution: TileAttributionDto;
}

export class AttributionQueryDto {
  @ApiProperty({ example: 12, minimum: 0, maximum: MAX_ZOOM })
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM)
  zoom: number;

  @ApiProperty({ example: 48.9, minimum: -90, maximum: 90 })
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  north: number;

  @ApiProperty({ example: 48.8, minimum: -90, maximum: 90 })
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  south: number;

  @ApiProperty({ example: 2.4, minimum: -180, maximum: 180 })
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  east: number;

  @ApiProperty({ example: 2.3, minimum: -180, maximum: 180 })
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  west: number;
}

export class AttributionDto {
  @ApiProperty({ example: 'Imagerie : NASA EOSDIS GIBS', description: 'Texte de sources de données pour la zone demandée.' })
  copyright: string;
  @ApiProperty({ example: 'gibs' }) provider: string;
}

export class LocateQueryDto {
  @ApiProperty({ example: 48.8566, minimum: -90, maximum: 90, description: 'Latitude en degrés.' })
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @ApiProperty({ example: 2.3522, minimum: -180, maximum: 180, description: 'Longitude en degrés.' })
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  lon: number;

  @ApiProperty({ example: 12, minimum: 0, maximum: MAX_ZOOM })
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM)
  zoom: number;

  @ApiPropertyOptional({ example: 'satellite', description: 'Si présent, la réponse contient aussi l’URL de la tuile.' })
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]{1,64}$/)
  layer?: string;
}

export class TileBoundsDto {
  @ApiProperty({ example: 48.92 }) north: number;
  @ApiProperty({ example: 48.84 }) south: number;
  @ApiProperty({ example: 2.46 }) east: number;
  @ApiProperty({ example: 2.37 }) west: number;
}

export class LocateDto {
  @ApiProperty({ example: 12 }) z: number;
  @ApiProperty({ example: 2074 }) x: number;
  @ApiProperty({ example: 1409 }) y: number;
  @ApiProperty({ type: TileBoundsDto }) bounds: TileBoundsDto;
  @ApiProperty({ required: false, description: 'URL directe de la tuile (si `layer` demandé).' }) url?: string;
  @ApiProperty({ example: MAX_LATITUDE, description: 'Latitude maximale couverte par le Web Mercator.' }) maxLatitude: number;
}

export class TileParamsDto {
  @IsString() @Matches(/^[a-z0-9-]{1,64}$/) layerId: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM) z: number;
  @Type(() => Number) @IsInt() @Min(0) x: number;
  @Type(() => Number) @IsInt() @Min(0) y: number;
}

export class MoonTileParamsDto {
  @IsString() @Matches(/^moon-[a-z0-9-]{1,27}$/) layerId: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10) z: number;
  @Type(() => Number) @IsInt() @Min(0) x: number;
  @Type(() => Number) @IsInt() @Min(0) y: number;
}

export class MoonPrefetchStatusDto {
  @ApiProperty({ description: 'Préchargement en cours.' }) running: boolean;
  @ApiProperty({ example: 4, description: 'Niveau maximal préchargé (-1 = désactivé).' }) maxZoom: number;
  @ApiProperty({ example: 682 }) done: number;
  @ApiProperty({ example: 1364 }) total: number;
  @ApiProperty({ example: 0 }) failed: number;
}

export const LAYER_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
