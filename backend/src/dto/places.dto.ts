// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// Type : indique en quel type convertir une valeur reçue en texte.
import { Type } from 'class-transformer';
// Règles de validation : entier, facultatif, texte, longueur comprise entre deux bornes, maximum, minimum.
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

// Forme des paramètres de requête de GET /places.
export class FindPlacesQueryDto {
  // Documente le champ suivant : texte recherché.
  @ApiProperty({ example: 'Conflans', description: 'Texte recherché (début de nom accepté).' })
  // Validation : un texte de 2 à 120 caractères.
  @IsString() @Length(2, 120)
  // q : le texte cherché, obligatoire.
  q: string;

  // Documente le champ suivant : nombre de résultats.
  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 10 })
  // Validation : facultatif, converti en nombre, entier, entre 1 et 10.
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10)
  // limit : le nombre maximal de lieux renvoyés.
  limit?: number;
// Fin de FindPlacesQueryDto.
}

// Forme d'un lieu trouvé.
export class PlaceDto {
  // name : son nom.
  @ApiProperty({ example: 'Conflans-Sainte-Honorine' }) name: string;
  // context : où il se trouve (région, pays).
  @ApiProperty({ example: 'Yvelines, France', description: 'Contexte (région, pays).' }) context: string;
  // lon : sa longitude.
  @ApiProperty({ example: 2.0967 }) lon: number;
  // lat : sa latitude.
  @ApiProperty({ example: 48.9992 }) lat: number;
  // kind : présent et égal à « address » quand le lieu est une adresse précise.
  @ApiPropertyOptional({ example: 'address', enum: ['address'], description: 'Présent pour une adresse (rue ou numéro) : à survoler de plus près qu’une ville.' }) kind?: 'address';
// Fin de PlaceDto.
}

// Forme du nom d'une ville affiché sur la carte.
export class CityLabelDto {
  // name : son nom en caractères latins.
  @ApiProperty({ example: 'Tokyo' }) name: string;
  // nameFr : son nom français, seulement s'il diffère.
  @ApiPropertyOptional({ example: 'Le Caire', description: 'Nom français, absent quand il est identique au nom Natural Earth.' }) nameFr?: string;
  // native : son nom dans l'écriture du pays, s'il est connu.
  @ApiPropertyOptional({ example: '東京都', description: 'Nom dans l’écriture locale, absent quand Natural Earth ne le fournit pas.' }) native?: string;
  // script : l'écriture de ce nom, pour choisir la police.
  @ApiPropertyOptional({ example: 'japanese', description: 'Écriture de `native` (typographie à appliquer côté client).' }) script?: string;
  // country : son pays.
  @ApiProperty({ example: 'Japan' }) country: string;
  // countryFr : le nom français du pays, seulement s'il diffère.
  @ApiPropertyOptional({ example: 'Japon', description: 'Nom français du pays, absent quand il est identique.' }) countryFr?: string;
  // region : sa région ou son État.
  @ApiPropertyOptional({ example: 'Tokyo', description: 'Région ou État (Natural Earth `adm1name`).' }) region?: string;
  // timezone : son fuseau horaire.
  @ApiPropertyOptional({ example: 'Asia/Tokyo', description: 'Fuseau horaire IANA.' }) timezone?: string;
  // areaKm2 : la surface de son aire urbaine, en km².
  @ApiPropertyOptional({ example: 5750, description: 'Aire urbaine maximale en km² (Natural Earth `max_areakm`).' }) areaKm2?: number;
  // lon : sa longitude.
  @ApiProperty({ example: 139.7494 }) lon: number;
  // lat : sa latitude.
  @ApiProperty({ example: 35.6869 }) lat: number;
  // pop : sa population (agglomération).
  @ApiProperty({ example: 35676000, description: 'Population (agglomération, Natural Earth `pop_max`).' }) pop: number;
  // capital : vrai si c'est la capitale d'un État.
  @ApiProperty({ description: 'Capitale d’État.' }) capital: boolean;
  // rank : son rang mondial par population, de 1 à 5 000, absent au-delà.
  @ApiProperty({ required: false, example: 23, description: 'Rang mondial par population d’agglomération (1 à 5000), absent au-delà du top 5000.' }) rank?: number;
// Fin de CityLabelDto.
}

// Forme de la réponse de GET /places/labels.
export class CityLabelsDto {
  // source : le jeu de données.
  @ApiProperty({ example: 'Natural Earth 1:10m populated places' }) source: string;
  // attribution : la mention à afficher.
  @ApiProperty({ example: 'Villes : Natural Earth' }) attribution: string;
  // count : le nombre de villes.
  @ApiProperty({ example: 7342 }) count: number;
  // items : les villes, de la plus peuplée à la moins peuplée.
  @ApiProperty({ type: [CityLabelDto], description: 'Triées de la plus peuplée à la moins peuplée.' }) items: CityLabelDto[];
// Fin de CityLabelsDto.
}

// Forme de la réponse de GET /places.
export class PlacesDto {
  // provider : le géocodeur utilisé.
  @ApiProperty({ example: 'photon' }) provider: string;
  // items : les lieux trouvés.
  @ApiProperty({ type: [PlaceDto] }) items: PlaceDto[];
  // attribution : la mention à afficher.
  @ApiProperty({ example: '© contributeurs OpenStreetMap · Photon (komoot)' }) attribution: string;
// Fin de PlacesDto.
}
