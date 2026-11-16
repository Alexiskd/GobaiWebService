// ApiProperty décrit un champ obligatoire dans la documentation ; ApiPropertyOptional un champ facultatif.
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Forme des données du Soleil.
export class SunDto {
  // name : son nom.
  @ApiProperty({ example: 'Soleil' }) name: string;
  // radius : son rayon, en rayons terrestres.
  @ApiProperty({ example: 109.2, description: 'Rayon, en rayons terrestres.' }) radius: number;
  // color : sa couleur dans l'interface, en code hexadécimal.
  @ApiProperty({ example: '#ffb300', description: 'Couleur d’interface.' }) color: string;
// Fin de SunDto.
}

// Forme des données de la Lune.
export class MoonDto {
  // name : son nom.
  @ApiProperty({ example: 'Lune' }) name: string;
  // radius : son rayon, en rayons terrestres.
  @ApiProperty({ example: 0.273, description: 'Rayon, en rayons terrestres.' }) radius: number;
// Fin de MoonDto.
}

// Forme des données d'une planète.
export class PlanetDto {
  // name : son nom.
  @ApiProperty({ example: 'Terre' }) name: string;
  // radius : son rayon, en rayons terrestres.
  @ApiProperty({ example: 1, description: 'Rayon, en rayons terrestres.' }) radius: number;
  // Documente le champ suivant : période de rotation.
  @ApiProperty({ example: 0.9973, description: 'Période de rotation, en jours (négatif = rotation rétrograde).' })
  // rotation : durée d'un tour sur elle-même, en jours ; négative si la planète tourne à l'envers.
  rotation: number;
  // earth : présent (et vrai) pour la Terre seulement ; le « ? » rend le champ facultatif.
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour la Terre uniquement.' }) earth?: true;
  // mars : présent (et vrai) pour Mars seulement.
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour Mars uniquement.' }) mars?: true;
  // ring : présent (et vrai) pour Saturne seulement, la planète à anneaux.
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour Saturne uniquement.' }) ring?: true;
  // dwarf : présent (et vrai) pour une planète naine.
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour une planète naine.' }) dwarf?: true;
  // color : sa couleur dans l'interface.
  @ApiProperty({ example: '#3d8bff' }) color: string;
  // Ouvre la documentation du champ elements :
  @ApiProperty({
    // une liste de nombres ;
    type: [Number],
    // sa description, sur les deux lignes suivantes :
    description:
      // première moitié : éléments képlériens et leur dérive par siècle ;
      'Éléments képlériens JPL (J2000) suivis de leur dérive par siècle : ' +
      // seconde moitié : l'ordre des douze valeurs et leurs unités.
      '[a, a’, e, e’, I, I’, L, L’, ϖ, ϖ’, Ω, Ω’]. Angles en degrés, demi-grand axe en UA.',
  // Fin de la documentation.
  })
  // elements : les douze nombres qui décrivent l'orbite.
  elements: number[];
// Fin de PlanetDto.
}

// Forme des données d'un satellite naturel.
export class SatelliteDto {
  // id : son identifiant, utilisé par les couches de tuiles et les éphémérides.
  @ApiProperty({ example: 'io', description: 'Identifiant (couches de tuiles `body`, éphémérides).' }) id: string;
  // name : son nom.
  @ApiProperty({ example: 'Io' }) name: string;
  // parent : la planète autour de laquelle il tourne, parmi six valeurs.
  @ApiProperty({ example: 'jupiter', enum: ['mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] }) parent: 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
  // radius : son rayon, en rayons terrestres.
  @ApiProperty({ example: 0.28592, description: 'Rayon, en rayons terrestres.' }) radius: number;
  // radiusKm : son rayon moyen, en kilomètres.
  @ApiProperty({ example: 1821.6, description: 'Rayon moyen, en km.' }) radiusKm: number;
  // color : sa couleur dans l'interface.
  @ApiProperty({ example: '#d9c45c' }) color: string;
  // horizons : son code dans le catalogue JPL Horizons.
  @ApiProperty({ example: '501', description: 'Code JPL Horizons.' }) horizons: string;
  // parentHorizons : le code JPL Horizons du centre de sa planète.
  @ApiProperty({ example: '500@599', description: 'Centre de la planète (JPL Horizons).' }) parentHorizons: string;
  // aKm : demi-grand axe de son orbite, en kilomètres.
  @ApiProperty({ example: 421700, description: 'Demi-grand axe (km).' }) aKm: number;
  // periodDays : durée d'un tour autour de sa planète, en jours.
  @ApiProperty({ example: 1.769138, description: 'Période sidérale (jours).' }) periodDays: number;
// Fin de SatelliteDto.
}

// Forme d'un satellite naturel dans le listing d'affichage : l'essentiel pour le dessiner et le nommer.
export class BodyListingSatelliteDto {
  // id : son identifiant, vide pour la Lune, qui n'est pas dans la table des satellites.
  @ApiProperty({ example: 'io', description: 'Identifiant ; vide pour la Lune.' }) id: string;
  // name : son nom.
  @ApiProperty({ example: 'Io' }) name: string;
  // radius : son rayon, en rayons terrestres.
  @ApiProperty({ example: 0.28592, description: 'Rayon, en rayons terrestres.' }) radius: number;
  // radiusKm : son rayon moyen en kilomètres, absent pour la Lune.
  @ApiPropertyOptional({ example: 1821.6, description: 'Rayon moyen (km) ; absent pour la Lune.' }) radiusKm?: number;
  // color : sa couleur dans l'interface, absente pour la Lune.
  @ApiPropertyOptional({ example: '#d9c45c' }) color?: string;
  // aKm : demi-grand axe de son orbite en kilomètres, absent pour la Lune.
  @ApiPropertyOptional({ example: 421700, description: 'Demi-grand axe (km).' }) aKm?: number;
  // periodDays : durée d'un tour autour de sa planète, absente pour la Lune.
  @ApiPropertyOptional({ example: 1.769138, description: 'Période sidérale (jours).' }) periodDays?: number;
// Fin de BodyListingSatelliteDto.
}

// Forme d'une planète dans le listing d'affichage, avec ses satellites naturels.
export class BodyListingPlanetDto {
  // name : son nom.
  @ApiProperty({ example: 'Jupiter' }) name: string;
  // radius : son rayon, en rayons terrestres.
  @ApiProperty({ example: 10.97, description: 'Rayon, en rayons terrestres.' }) radius: number;
  // rotation : durée d'un tour sur elle-même, en jours ; négative si la rotation est rétrograde.
  @ApiProperty({ example: 0.41354, description: 'Période de rotation, en jours (négatif = rétrograde).' }) rotation: number;
  // color : sa couleur dans l'interface.
  @ApiProperty({ example: '#d8a46b' }) color: string;
  // aAu : le demi-grand axe de son orbite, en unités astronomiques.
  @ApiProperty({ example: 5.202887, description: 'Demi-grand axe (UA) : distance moyenne au Soleil.' }) aAu: number;
  // dwarf : présent et vrai pour une planète naine.
  @ApiPropertyOptional({ example: true, description: 'Présent et vrai pour une planète naine.' }) dwarf?: true;
  // satellites : ses satellites naturels, du plus proche au plus lointain.
  @ApiProperty({ type: [BodyListingSatelliteDto], description: 'Du plus proche au plus lointain de la planète.' }) satellites: BodyListingSatelliteDto[];
// Fin de BodyListingPlanetDto.
}

/**
 * Forme de la réponse de GET /bodies/listing : la liste d'affichage, allégée. Les planètes y portent directement
 * leurs satellites naturels, pour que l'interface n'ait aucun rapprochement à faire ni aucune table à embarquer.
 */
// Forme de la réponse du listing.
export class BodyListingDto {
  // planets : les planètes, naines comprises, de la plus proche à la plus lointaine du Soleil.
  @ApiProperty({ type: [BodyListingPlanetDto], description: 'Du plus proche au plus lointain du Soleil ; planètes naines comprises.' }) planets: BodyListingPlanetDto[];
  // counts : le nombre de planètes, de planètes naines et de satellites naturels.
  @ApiProperty({ example: { planets: 10, dwarfPlanets: 2, satellites: 19 }, description: 'Nombres, pour l’affichage.' }) counts: { planets: number; dwarfPlanets: number; satellites: number };
// Fin de BodyListingDto.
}

// Forme de la réponse de GET /bodies.
export class BodiesDto {
  // sun : le Soleil.
  @ApiProperty({ type: SunDto }) sun: SunDto;
  // moon : la Lune.
  @ApiProperty({ type: MoonDto }) moon: MoonDto;
  // planets : les planètes, de la plus proche à la plus lointaine du Soleil.
  @ApiProperty({ type: [PlanetDto], description: 'Du plus proche au plus lointain du Soleil.' }) planets: PlanetDto[];
  // satellites : les satellites naturels.
  @ApiProperty({ type: [SatelliteDto], description: 'Satellites naturels de Jupiter et Saturne affichés comme la Lune.' }) satellites: SatelliteDto[];
// Fin de BodiesDto.
}
