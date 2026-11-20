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
  @ApiProperty({ enum: ['nasa-trek', 'mars-trek', 'moon-trek', 'usgs-astro', 'lroc-lunaserv', 'usgs-astro-mars', 'opm-mars', 'murray-lab', 'satellite-trek', 'earth-hd', 'ign-lidar-hd'], description: 'Fournisseur qui sert réellement les images.' }) provider: string;
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
  // provider : le fournisseur de la Terre.
  @ApiProperty({ enum: ['earth-hd'], description: 'Fournisseur de la Terre : sa couche unique (les couches de la Lune ont `body: moon`).' }) provider: string;
  // fallback : toujours faux, la Terre n'a plus de fournisseur de repli (gardé pour les clients existants).
  @ApiProperty({ description: 'Toujours faux : la Terre n’a qu’une couche, sans fournisseur de repli.' }) fallback: boolean;
  // tileSize : le côté d'une tuile, en pixels.
  @ApiProperty({ example: 256 }) tileSize: number;
  // placeSearch : vrai si la recherche de lieux est disponible.
  @ApiProperty({ description: 'Recherche de villes et lieux du monde entier disponible (moteur interne, GeoNames).' }) placeSearch: boolean;
  // layers : les couches disponibles.
  @ApiProperty({ type: [TileLayerDto] }) layers: TileLayerDto[];
// Fin de TileLayerListDto.
}

// Forme d'une mention de sources.
export class TileAttributionDto {
  // text : le texte à afficher.
  @ApiProperty({ example: 'Orthophotos : IGN (Géoplateforme) · Sentinel-2 cloudless 2016 (EOX, CC BY 4.0)' }) text: string;
// Fin de TileAttributionDto.
}

// Forme d'une couche résolue : tous les champs d'une couche (extends), plus ceux qui suivent.
export class ResolvedTileLayerDto extends TileLayerDto {
  // Ouvre la documentation du champ urlTemplate :
  @ApiProperty({
    // un exemple de modèle d'adresse ;
    example: '/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}',
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

  // Documente le champ suivant : adresse de la table de priorité, couche unique de la Terre seulement.
  @ApiProperty({ required: false, example: '/api/v1/tiles/earth/plan', description: 'Couche unique de la Terre : adresse de la table de priorité des sources (GET /tiles/earth/plan). Le navigateur la lit, choisit la source de chaque cellule et charge lui-même les sources qui le permettent ; le reste passe par `urlTemplate`.' })
  // plan : l'adresse de la table de priorité des sources.
  plan?: string;

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

  // Ouvre la documentation du champ seafloor :
  @ApiProperty({
    // facultatif, un objet ;
    required: false, type: 'object',
    // sa description.
    description: 'Couche unique de la Terre : fonds marins fondus dans l’imagerie par le navigateur ({ template, maxZoom, mask: { template, maxZoom } }) : '
      // suite : là où les altitudes de `mask` sont sous la mer, l'image de `template` remplace peu à peu l'imagerie.
      + 'là où les altitudes Terrarium de `mask` sont sous la mer, l’image des fonds (`template`) remplace peu à peu l’imagerie.',
  // Fin de la documentation.
  })
  // seafloor : les tuiles des fonds marins et celles des altitudes qui disent où est la mer.
  seafloor?: { template: string; maxZoom: number; mask: { template: string; maxZoom: number } };
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
  @ApiProperty({ example: 'Orthophotos : IGN (Géoplateforme) · Sentinel-2 cloudless 2016 (EOX, CC BY 4.0)', description: 'Texte de sources de données pour la zone demandée.' })
  // copyright : le texte des sources pour la zone demandée.
  copyright: string;
  // provider : le fournisseur.
  @ApiProperty({ example: 'earth-hd' }) provider: string;
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

// Forme d'une ligne de la table de priorité des sources de la Terre.
export class EarthPlanSourceDto {
  // id : l'identifiant de la source.
  @ApiProperty({ example: 'ign' }) id: string;
  // label : son nom.
  @ApiProperty({ example: 'IGN (France)' }) label: string;
  // attribution : sa mention.
  @ApiProperty({ example: 'Orthophotos : IGN (Géoplateforme)' }) attribution: string;
  // priority : son rang, 1 pour la plus prioritaire.
  @ApiProperty({ example: 11, description: 'Rang dans la table : 1 = la plus prioritaire.' }) priority: number;
  // minZoom : son niveau natif le moins fin.
  @ApiProperty({ example: 12 }) minZoom: number;
  // maxZoom : son niveau natif le plus fin.
  @ApiProperty({ example: 19 }) maxZoom: number;
  // bboxes : ses emprises, absentes pour une source mondiale.
  @ApiProperty({ required: false, type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Emprises [ouest, sud, est, nord] en degrés ; absentes = monde entier.' }) bboxes?: number[][];
  // templates : ses modèles d'adresse pour le navigateur.
  @ApiProperty({ required: false, type: [String], description: 'Modèles d’adresse {z}/{x}/{y} chargeables par le navigateur ; absents = relais du serveur.' }) templates?: string[];
  // lowZoom : niveau bas de la vue de loin.
  @ApiProperty({ required: false, example: 8, description: 'Niveau à partir duquel la source sert sa mosaïque réduite, vue de loin.' }) lowZoom?: number;
// Fin de EarthPlanSourceDto.
}

// Forme des détails affichés à un palier de zoom.
export class EarthTierDetailsDto {
  // oceans : teinte des profondeurs ou relief des fonds.
  @ApiProperty({ enum: ['teinte', 'relief'] }) oceans: string;
  // coasts : littoraux tracés.
  @ApiProperty() coasts: boolean;
  // roads : rues et routes demandées.
  @ApiProperty() roads: boolean;
  // names : noms des villes et des pays.
  @ApiProperty() names: boolean;
  // marine : carte marine NOAA, fondu NOAA vers GEBCO, ou GEBCO seule.
  @ApiProperty({ enum: ['noaa', 'fondu', 'gebco'] }) marine: string;
// Fin de EarthTierDetailsDto.
}

// Forme d'un palier de zoom.
export class EarthTierDto {
  // id : l'identifiant du palier.
  @ApiProperty({ example: 'ville' }) id: string;
  // label : son nom affiché.
  @ApiProperty({ example: 'Ville' }) label: string;
  // maxKm : la distance jusqu'à laquelle il s'applique.
  @ApiProperty({ nullable: true, example: 40, description: 'Altitude au-dessus du sol (km) jusqu’à laquelle le palier s’applique ; null pour le dernier.' }) maxKm: number | null;
  // source : la source prioritaire.
  @ApiProperty({ example: 'orthophotos nationales' }) source: string;
  // maxZoom : le niveau de tuile le plus fin.
  @ApiProperty({ example: 17 }) maxZoom: number;
  // maxTiles : le nombre maximal de tuiles chargées.
  @ApiProperty({ example: { desktop: 280, phone: 210 }, description: 'Nombre maximal de tuiles chargées en même temps, sur ordinateur et sur téléphone.' }) maxTiles: { desktop: number; phone: number };
  // details : les détails affichés.
  @ApiProperty({ type: EarthTierDetailsDto }) details: EarthTierDetailsDto;
// Fin de EarthTierDto.
}

// Forme d'une couche d'images de la carte marine.
export class EarthMarineLayerDto {
  // template : le modèle d'adresse, par le relais du serveur.
  @ApiProperty({ example: '/api/v1/tiles/earth/earth-gebco/{z}/{x}/{y}' }) template: string;
  // maxZoom : le niveau le plus fin demandé (au-delà, l'image est découpée dans un ancêtre).
  @ApiProperty({ example: 10 }) maxZoom: number;
// Fin de EarthMarineLayerDto.
}

// Forme des isobathes de la carte marine.
export class EarthIsobathsDto {
  // bands : nombre de bandes de couleur de la carte plate (une isobathe à chaque limite).
  @ApiProperty({ example: 12 }) bands: number;
  // strength : force du trait, de 0 à 1.
  @ApiProperty({ example: 0.45 }) strength: number;
// Fin de EarthIsobathsDto.
}

// Forme de la carte marine de la Terre.
export class EarthMarineDto {
  // noaa : teinte des océans vue de l'espace (NOAA NCEI, ETOPO 2022).
  @ApiProperty({ type: EarthMarineLayerDto }) noaa: EarthMarineLayerDto;
  // gebco : relief ombré des fonds (GEBCO_2026).
  @ApiProperty({ type: EarthMarineLayerDto }) gebco: EarthMarineLayerDto;
  // flat : carte plate colorée de GEBCO, source des isobathes.
  @ApiProperty({ type: EarthMarineLayerDto }) flat: EarthMarineLayerDto;
  // mask : altitudes Terrarium qui disent où est la mer.
  @ApiProperty({ type: EarthMarineLayerDto }) mask: EarthMarineLayerDto;
  // fadeMs : durée du fondu entre deux niveaux de la Terre.
  @ApiProperty({ example: 600, description: 'Durée du fondu entre deux niveaux de la Terre, dont le passage NOAA → GEBCO (ms).' }) fadeMs: number;
  // isobaths : réglage des isobathes.
  @ApiProperty({ type: EarthIsobathsDto }) isobaths: EarthIsobathsDto;
  // credits : mentions des sources de la carte marine.
  @ApiProperty({ type: [String] }) credits: string[];
// Fin de EarthMarineDto.
}

// Forme de la table de priorité des sources de la Terre (GET /tiles/earth/plan).
export class EarthPlanDto {
  // version : la version de la table.
  @ApiProperty({ example: 1 }) version: number;
  // layerId : la couche décrite.
  @ApiProperty({ example: 'earth-hd' }) layerId: string;
  // relay : le modèle d'adresse du relais du serveur.
  @ApiProperty({ example: '/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}' }) relay: string;
  // colorMatch : l'accord des couleurs des sources.
  @ApiProperty({ description: 'Accord des couleurs des sources sur la mosaïque mondiale.' }) colorMatch: boolean;
  // sources : les lignes, dans l'ordre de priorité.
  @ApiProperty({ type: [EarthPlanSourceDto] }) sources: EarthPlanSourceDto[];
  // tiers : les paliers de zoom.
  @ApiProperty({ type: [EarthTierDto] }) tiers: EarthTierDto[];
  // fieldOnly : chargement limité au champ de la caméra.
  @ApiProperty({ description: 'Seules les tuiles du champ de la caméra sont chargées ; les autres sont déchargées.' }) fieldOnly: boolean;
  // marine : la carte marine, ou null si les fonds marins sont coupés.
  @ApiProperty({ type: EarthMarineDto, nullable: true, description: 'Carte marine : NOAA vue de l’espace, fondu vers GEBCO, GEBCO seule avec isobathes ; seuils dans la colonne « marine » des paliers.' }) marine: EarthMarineDto | null;
// Fin de EarthPlanDto.
}

// Expression régulière des identifiants de couche valides, exportée pour être réutilisée ailleurs.
export const LAYER_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
