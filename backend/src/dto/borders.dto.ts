// ApiProperty : décrit un champ dans la documentation Swagger.
import { ApiProperty } from '@nestjs/swagger';

// Forme de la réponse de GET /borders.
export class BordersDto {
  // source : le jeu de données utilisé.
  @ApiProperty({ example: 'Natural Earth 1:50m · world-atlas 2.0.2', description: 'Jeu de données utilisé.' }) source: string;
  // attribution : la mention à afficher avec la carte.
  @ApiProperty({ example: 'Frontières : Natural Earth', description: 'Mention à afficher avec la carte.' }) attribution: string;
  // count : le nombre de polylignes de frontières.
  @ApiProperty({ example: 512, description: 'Nombre de polylignes de frontières (`lines`).' }) count: number;
  // Ouvre la documentation du champ lines :
  @ApiProperty({
    // sa description, sur les deux lignes suivantes :
    description:
      // première moitié : le format d'une polyligne ;
      'Frontières terrestres entre pays. Chaque polyligne est une liste plate `[lon1, lat1, lon2, lat2, …]` en degrés ' +
      // seconde moitié : la précision, et où sont les littoraux.
      '(3 décimales, ≈ 100 m). Les littoraux sont dans `coastlines`.',
    // un exemple : une polyligne de deux points ;
    example: [[2.545, 51.089, 2.66, 50.82]],
    // son type : une liste,
    type: 'array',
    // de listes de nombres.
    items: { type: 'array', items: { type: 'number' } },
  // Fin de la documentation.
  })
  // lines : les frontières terrestres, une liste plate de longitudes et latitudes par polyligne.
  lines: number[][];

  // Ouvre la documentation du champ coastlines :
  @ApiProperty({
    // sa description ;
    description: 'Littoraux (mers, océans, Caspienne), même format que `lines`. Les découpes de la carte à ±180° et au pôle Sud sont exclues.',
    // un exemple ;
    example: [[-1.79, 43.39, -1.66, 43.4]],
    // son type : une liste,
    type: 'array',
    // de listes de nombres.
    items: { type: 'array', items: { type: 'number' } },
  // Fin de la documentation.
  })
  // coastlines : les littoraux, au même format que lines.
  coastlines: number[][];

  // Ouvre la documentation du champ countries :
  @ApiProperty({
    // sa description, sur les trois lignes suivantes :
    description:
      // ce qu'est le milieu d'un pays ;
      'Milieu de chaque pays calculé depuis ses frontières (pôle d’inaccessibilité : point intérieur le plus éloigné des ' +
      // un élément par morceau du pays, et ses champs ;
      'frontières). Un élément par morceau (continent, îles) : { lon, lat, r (distance à la frontière la plus proche, ' +
      // fin de la liste des champs, et l'ordre des morceaux.
      'degrés), area (degrés²), ring (contour extérieur simplifié, liste plate lon/lat) }, du plus grand au plus petit.',
    // un exemple : la France ;
    example: [{ id: '250', name: 'France', parts: [{ lon: 2.4, lat: 46.6, r: 2.9, area: 54.1, ring: [2.54, 51.09, 2.66, 50.82] }] }],
    // son type : une liste,
    type: 'array',
    // d'objets.
    items: { type: 'object' },
  // Fin de la documentation.
  })
  // countries : pour chaque pays, son identifiant, son nom et ses morceaux (milieu, distance à la frontière, aire, contour).
  countries: { id: string; name: string; parts: { lon: number; lat: number; r: number; area: number; ring: number[] }[] }[];
// Fin de BordersDto.
}
