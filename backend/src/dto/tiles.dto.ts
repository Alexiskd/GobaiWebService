// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Type : indique en quel type convertir une valeur reçue en texte.
import { Type } from 'class-transformer';
// Règles de validation : entier, nombre, facultatif, texte, expression régulière, maximum, minimum.
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
// Constantes du calcul des tuiles : latitude maximale du Web Mercator (≈ 85,05°) et niveau de zoom maximal (22).
import { MAX_LATITUDE, MAX_ZOOM } from '../services/map-tiles/tile-math';

// Forme d'une couche de tuiles.
export class TileLayerDto {
  // id : son identifiant, à réutiliser dans les autres routes.
  @ApiProperty({ example: 'satellite', description: 'Identifiant à utiliser dans les autres routes.' }) id: string;
  // label : son nom affiché.
  @ApiProperty({ example: 'Satellite' }) label: string;
  // description : ce qu'elle montre.
  @ApiProperty({ example: 'Photographie aérienne et satellite.' }) description: string;
  // Documente le champ suivant : nature du rendu, parmi cinq valeurs.
  @ApiProperty({ enum: ['imagery', 'map', 'relief', 'hybrid', 'overlay'], description: 'Nature du rendu. `overlay` = calque transparent à superposer.' })
  // kind : image, plan, relief, hybride ou calque transparent.
  kind: string;
  // provider : le fournisseur qui sert réellement les images, parmi les valeurs listées.
  @ApiProperty({ enum: ['gibs', 'nasa-trek', 'mars-trek', 'moon-trek', 'usgs-astro', 'lroc-lunaserv', 'usgs-astro-mars', 'opm-mars', 'murray-lab', 'satellite-trek', 'earth-hd', 'ign-lidar-hd'], description: 'Fournisseur qui sert réellement les images.' }) provider: string;
  // body : l'astre sur lequel la couche se pose, parmi les valeurs listées.
  @ApiProperty({ enum: ['earth', 'moon', 'mars', 'mercury', 'venus', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'charon', 'jupiter', 'saturn', 'uranus', 'neptune'], description: 'Astre sur lequel la couche se pose.' }) body: string;
  // Ouvre la documentation du champ projection :
  @ApiProperty({
    // deux valeurs possibles ;
    enum: ['mercator', 'equirectangular'],
    // sa description : le découpage en tuiles de chacune.
    description: 'Découpage : `mercator` = 2^z × 2^z tuiles Web Mercator ; `equirectangular` = 2^(z+1) × 2^z tuiles géographiques (pôle à pôle).',
  // Fin de la documentation.
  })
  // projection : Web Mercator ou géographique.
  projection: string;
  // minZoom : le niveau de zoom le plus large.
  @ApiProperty({ example: 0 }) minZoom: number;
  // maxZoom : le niveau de zoom le plus fin.
  @ApiProperty({ example: 22 }) maxZoom: number;
  // tileSize : le côté d'une tuile, en pixels.
  @ApiProperty({ example: 256, description: 'Taille d’une tuile, en pixels.' }) tileSize: number;
  // format : JPEG ou PNG.
  @ApiProperty({ enum: ['jpeg', 'png'] }) format: string;
  // transparent : vrai si les tuiles ont de la transparence.
  @ApiProperty({ description: 'Vrai si les tuiles ont de la transparence.' }) transparent: boolean;
  // experimental : vrai si le fournisseur n'a pas pu être vérifié.
  @ApiProperty({ description: 'Vrai si le fournisseur n’a pas pu être vérifié (voir README).' }) experimental: boolean;
// Fin de TileLayerDto.
}

// Forme de la réponse de GET /tiles/layers.
export class TileLayerListDto {
  // provider : le fournisseur actif pour la Terre.
  @ApiProperty({ enum: ['gibs'], description: 'Fournisseur actif de la Terre (les couches de la Lune ont `body: moon`).' }) provider: string;
  // fallback : vrai si ce fournisseur est un repli.
  @ApiProperty({ description: 'Vrai si la couche active est un fournisseur de repli.' }) fallback: boolean;
  // tileSize : le côté d'une tuile, en pixels.
  @ApiProperty({ example: 256 }) tileSize: number;
  // placeSearch : vrai si la recherche de lieux est disponible.
  @ApiProperty({ description: 'Recherche de villes et lieux du monde entier disponible (Photon/OpenStreetMap).' }) placeSearch: boolean;
  // layers : les couches disponibles.
  @ApiProperty({ type: [TileLayerDto] }) layers: TileLayerDto[];
// Fin de TileLayerListDto.
}

// Forme d'une mention de sources.
export class TileAttributionDto {
  // text : le texte à afficher.
  @ApiProperty({ example: 'NASA EOSDIS GIBS' }) text: string;
// Fin de TileAttributionDto.
}

// Forme d'une couche résolue : tous les champs d'une couche (extends), plus ceux qui suivent.
export class ResolvedTileLayerDto extends TileLayerDto {
  // Ouvre la documentation du champ urlTemplate :
  @ApiProperty({
    // un exemple de modèle d'adresse ;
    example: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/…/{z}/{y}/{x}.jpeg',
    // sa description.
    description: 'Modèle d’URL : remplacez {z}, {x}, {y}. À charger directement depuis le navigateur.',
  // Fin de la documentation.
  })
  // urlTemplate : le modèle d'adresse des tuiles, où remplacer {z}, {x} et {y}.
  urlTemplate: string;

  // Documente le champ suivant : date d'expiration, qui peut être null.
  @ApiProperty({ nullable: true, example: '2026-11-05T10:00:00.000Z', description: 'Date d’expiration du modèle (ISO 8601, UTC). `null` = permanent. Redemandez-le avant.' })
  // expiresAt : la date après laquelle le modèle n'est plus valable, ou null s'il est permanent.
  expiresAt: string | null;

  // Documente le champ suivant : mention de sources.
  @ApiProperty({ type: TileAttributionDto, description: 'Mention à afficher en permanence près de la carte.' })
  // attribution : la mention à afficher près de la carte.
  attribution: TileAttributionDto;

  // Ouvre la documentation du champ direct :
  @ApiProperty({
    // facultatif, une liste d'objets ;
    required: false, type: 'array', items: { type: 'object' },
    // début de sa description ;
    description: 'Couche unique de la Terre : sources d’imagerie dans l’ordre de priorité ({ id, minZoom, maxZoom, bboxes?, templates? }). '
      // fin de sa description.
      + 'Le navigateur charge lui-même les tuiles des sources qui ont des `templates` et ne demande que le reste à `urlTemplate`.',
  // Fin de la documentation.
  })
  // direct : les sources d'imagerie que le navigateur peut interroger lui-même, par ordre de priorité, avec leurs niveaux, leurs emprises et leurs modèles d'adresse.
  direct?: Array<{ id: string; minZoom: number; maxZoom: number; bboxes?: Array<[number, number, number, number]>; templates?: string[]; lowZoom?: number }>;

  // Ouvre la documentation du champ bounds :
  @ApiProperty({
    // facultatif, une liste de listes de nombres ;
    required: false, type: 'array', items: { type: 'array', items: { type: 'number' } },
    // sa description.
    description: 'Emprises [ouest, sud, est, nord] en degrés hors desquelles un calque n’est pas demandé (LiDAR HD : la France).',
  // Fin de la documentation.
  })
  // bounds : les emprises [ouest, sud, est, nord] hors desquelles le calque n'est pas demandé.
  bounds?: Array<[number, number, number, number]>;

  // Documente le champ suivant : accord des couleurs.
  @ApiProperty({ required: false, description: 'Couche unique de la Terre : accord des couleurs des sources nationales sur la mosaïque mondiale, fait par le navigateur.' })
  // colorMatch : vrai si le navigateur doit accorder les couleurs des sources nationales sur la mosaïque mondiale.
  colorMatch?: boolean;
// Fin de ResolvedTileLayerDto.
}

// Forme des paramètres de requête de l'attribution : la zone visible.
export class AttributionQueryDto {
  // Documente le champ suivant : zoom, de 0 au maximum.
  @ApiProperty({ example: 12, minimum: 0, maximum: MAX_ZOOM })
  // Validation : converti en nombre, entier, entre 0 et le zoom maximal.
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM)
  // zoom : le niveau de zoom de la vue.
  zoom: number;

  // Documente le champ suivant : bord nord.
  @ApiProperty({ example: 48.9, minimum: -90, maximum: 90 })
  // Validation : converti en nombre, entre −90 et 90.
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  // north : la latitude du bord nord.
  north: number;

  // Documente le champ suivant : bord sud.
  @ApiProperty({ example: 48.8, minimum: -90, maximum: 90 })
  // Validation : converti en nombre, entre −90 et 90.
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  // south : la latitude du bord sud.
  south: number;

  // Documente le champ suivant : bord est.
  @ApiProperty({ example: 2.4, minimum: -180, maximum: 180 })
  // Validation : converti en nombre, entre −180 et 180.
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  // east : la longitude du bord est.
  east: number;

  // Documente le champ suivant : bord ouest.
  @ApiProperty({ example: 2.3, minimum: -180, maximum: 180 })
  // Validation : converti en nombre, entre −180 et 180.
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  // west : la longitude du bord ouest.
  west: number;
// Fin de AttributionQueryDto.
}

// Forme de la réponse de l'attribution.
export class AttributionDto {
  // Documente le champ suivant : texte des sources.
  @ApiProperty({ example: 'Imagerie : NASA EOSDIS GIBS', description: 'Texte de sources de données pour la zone demandée.' })
  // copyright : le texte des sources pour la zone demandée.
  copyright: string;
  // provider : le fournisseur.
  @ApiProperty({ example: 'gibs' }) provider: string;
// Fin de AttributionDto.
}

// Forme des paramètres de requête de GET /tiles/locate.
export class LocateQueryDto {
  // Documente le champ suivant : latitude.
  @ApiProperty({ example: 48.8566, minimum: -90, maximum: 90, description: 'Latitude en degrés.' })
  // Validation : converti en nombre, entre −90 et 90.
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  // lat : la latitude du point.
  lat: number;

  // Documente le champ suivant : longitude.
  @ApiProperty({ example: 2.3522, minimum: -180, maximum: 180, description: 'Longitude en degrés.' })
  // Validation : converti en nombre, entre −180 et 180.
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  // lon : la longitude du point.
  lon: number;

  // Documente le champ suivant : zoom.
  @ApiProperty({ example: 12, minimum: 0, maximum: MAX_ZOOM })
  // Validation : converti en nombre, entier, entre 0 et le zoom maximal.
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM)
  // zoom : le niveau de zoom voulu.
  zoom: number;

  // Documente le champ suivant : couche, facultative.
  @ApiPropertyOptional({ example: 'satellite', description: 'Si présent, la réponse contient aussi l’URL de la tuile.' })
  // Validation : facultatif, un texte de 1 à 64 caractères parmi les minuscules, les chiffres et le tiret.
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]{1,64}$/)
  // layer : la couche dont on veut aussi l'adresse de la tuile.
  layer?: string;
// Fin de LocateQueryDto.
}

// Forme de l'emprise d'une tuile.
export class TileBoundsDto {
  // north : latitude du bord nord.
  @ApiProperty({ example: 48.92 }) north: number;
  // south : latitude du bord sud.
  @ApiProperty({ example: 48.84 }) south: number;
  // east : longitude du bord est.
  @ApiProperty({ example: 2.46 }) east: number;
  // west : longitude du bord ouest.
  @ApiProperty({ example: 2.37 }) west: number;
// Fin de TileBoundsDto.
}

// Forme de la réponse de GET /tiles/locate.
export class LocateDto {
  // z : le niveau de zoom de la tuile.
  @ApiProperty({ example: 12 }) z: number;
  // x : sa colonne.
  @ApiProperty({ example: 2074 }) x: number;
  // y : sa ligne.
  @ApiProperty({ example: 1409 }) y: number;
  // bounds : son emprise.
  @ApiProperty({ type: TileBoundsDto }) bounds: TileBoundsDto;
  // url : l'adresse directe de la tuile, si une couche a été demandée.
  @ApiProperty({ required: false, description: 'URL directe de la tuile (si `layer` demandé).' }) url?: string;
  // maxLatitude : la latitude maximale couverte par le Web Mercator.
  @ApiProperty({ example: MAX_LATITUDE, description: 'Latitude maximale couverte par le Web Mercator.' }) maxLatitude: number;
// Fin de LocateDto.
}

// Forme d'une ville de France proposée pour le LiDAR HD.
export class LidarHdCityDto {
  // name : son nom.
  @ApiProperty({ example: 'Paris' }) name: string;
  // region : sa région administrative.
  @ApiProperty({ example: 'Île-de-France' }) region: string;
  // lon : sa longitude en degrés.
  @ApiProperty({ example: 2.353 }) lon: number;
  // lat : sa latitude en degrés.
  @ApiProperty({ example: 48.858 }) lat: number;
// Fin de LidarHdCityDto.
}

// Forme de la réponse de GET /tiles/lidar-hd/cities.
export class LidarHdCitiesDto {
  // altitudeM : l'altitude d'arrivée conseillée au-dessus d'une ville, en mètres.
  @ApiProperty({ example: 2000, description: 'Altitude d’arrivée conseillée au-dessus d’une ville (m).' }) altitudeM: number;
  // items : les villes, dans l'ordre d'importance.
  @ApiProperty({ type: [LidarHdCityDto] }) items: LidarHdCityDto[];
// Fin de LidarHdCitiesDto.
}

// Forme des paramètres d'adresse d'une tuile.
export class TileParamsDto {
  // layerId : un texte de 1 à 64 caractères parmi les minuscules, les chiffres et le tiret.
  @IsString() @Matches(/^[a-z0-9-]{1,64}$/) layerId: string;
  // z : converti en nombre, entier, entre 0 et le zoom maximal.
  @Type(() => Number) @IsInt() @Min(0) @Max(MAX_ZOOM) z: number;
  // x : converti en nombre, entier, au moins 0.
  @Type(() => Number) @IsInt() @Min(0) x: number;
  // y : converti en nombre, entier, au moins 0.
  @Type(() => Number) @IsInt() @Min(0) y: number;
// Fin de TileParamsDto.
}

// Forme des paramètres d'adresse d'une tuile de la Lune.
export class MoonTileParamsDto {
  // layerId : doit commencer par « moon- », suivi de 1 à 27 caractères (minuscules, chiffres, tiret).
  @IsString() @Matches(/^moon-[a-z0-9-]{1,27}$/) layerId: string;
  // z : converti en nombre, entier, entre 0 et 10.
  @Type(() => Number) @IsInt() @Min(0) @Max(10) z: number;
  // x : converti en nombre, entier, au moins 0.
  @Type(() => Number) @IsInt() @Min(0) x: number;
  // y : converti en nombre, entier, au moins 0.
  @Type(() => Number) @IsInt() @Min(0) y: number;
// Fin de MoonTileParamsDto.
}

// Forme de l'avancement du préchargement de la Lune.
export class MoonPrefetchStatusDto {
  // running : vrai si le préchargement est en cours.
  @ApiProperty({ description: 'Préchargement en cours.' }) running: boolean;
  // maxZoom : le niveau maximal préchargé (−1 s'il est désactivé).
  @ApiProperty({ example: 4, description: 'Niveau maximal préchargé (-1 = désactivé).' }) maxZoom: number;
  // done : le nombre de tuiles déjà enregistrées.
  @ApiProperty({ example: 682 }) done: number;
  // total : le nombre de tuiles à enregistrer.
  @ApiProperty({ example: 1364 }) total: number;
  // failed : le nombre de tuiles en échec.
  @ApiProperty({ example: 0 }) failed: number;
// Fin de MoonPrefetchStatusDto.
}

// Expression régulière des identifiants de couche valides, exportée pour être réutilisée ailleurs.
export const LAYER_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
