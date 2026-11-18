// ApiProperty décrit un champ obligatoire ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Forme de la réponse de GET /world-atlas.
export class WorldAtlasInfoDto {
  // source : le jeu de données utilisé.
  @ApiProperty({ example: 'Natural Earth 1:50m · world-atlas 2.0.2', description: 'Jeu de données utilisé.' }) source: string;
  // attribution : la mention à afficher avec la carte.
  @ApiProperty({ example: 'Frontières : Natural Earth', description: 'Mention à afficher avec la carte.' }) attribution: string;
  // object : le nom de l'objet TopoJSON qui contient les pays.
  @ApiProperty({ example: 'countries', description: 'Objet TopoJSON qui contient les pays.' }) object: string;
  // countries : le nombre de pays et territoires.
  @ApiProperty({ example: 241, description: 'Nombre de pays et territoires.' }) countries: number;
  // arcs : le nombre d'arcs du fichier.
  @ApiProperty({ example: 1961, description: 'Nombre d’arcs (frontières et littoraux, chacun enregistré une seule fois).' }) arcs: number;
  // quantized : vrai si les coordonnées sont des entiers à décoder.
  @ApiProperty({ example: true, description: 'Coordonnées quantifiées (entiers codés en delta, à décoder avec `transform`).' }) quantized: boolean;
  // Ouvre la documentation du champ bbox :
  @ApiPropertyOptional({
    // un exemple de quatre nombres ;
    example: [-180, -89.99893, 180, 83.59961],
    // sa description ;
    description: 'Emprise [ouest, sud, est, nord] en degrés.',
    // son type : une liste,
    type: 'array',
    // de nombres.
    items: { type: 'number' },
  // Fin de la documentation.
  })
  // bbox : l'emprise [ouest, sud, est, nord] en degrés, absente si le fichier ne la donne pas.
  bbox?: number[];
// Fin de WorldAtlasInfoDto.
}
