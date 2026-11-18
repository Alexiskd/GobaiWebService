// Injectable : rend le service injectable ; NotFoundException : erreur 404.
import { Injectable, NotFoundException } from '@nestjs/common';
// Fonction qui retire les accents et les majuscules d'un texte.
import { normalize } from '../../common/text';
// Données des astres : tous les satellites, la Lune, le nom des planètes mères, les planètes et le Soleil.
import { ALL_SATELLITES, MOON, PARENT_PLANET_NAME, PLANETS, SUN } from '../data/bodies.data';
// Type (effacé à la compilation) des données d'une planète.
import type { PlanetData } from '../data/bodies.data';

/**
 * Forme d'un satellite dans le listing d'affichage. Les champs facultatifs sont ceux que la Lune n'a pas : elle
 * n'est pas dans la table des satellites et ne porte qu'un nom et un rayon. Déclarer la forme évite que les deux
 * cas forment une union où ces champs deviendraient inaccessibles.
 */
// Forme d'un satellite du listing.
interface ListingSatellite {
  // id : son identifiant, vide pour la Lune.
  id: string;
  // name : son nom.
  name: string;
  // radius : son rayon, en rayons terrestres.
  radius: number;
  // radiusKm : son rayon moyen en kilomètres, absent pour la Lune.
  radiusKm?: number;
  // color : sa couleur, absente pour la Lune.
  color?: string;
  // aKm : le demi-grand axe de son orbite, absent pour la Lune.
  aKm?: number;
  // periodDays : la durée d'un tour, absente pour la Lune.
  periodDays?: number;
// Fin de ListingSatellite.
}

// Rend la classe injectable par NestJS.
@Injectable()
// Classe du service des astres.
export class BodiesService {
  // Méthode all.
  all() {
    // Renvoie le Soleil, la Lune, les planètes et tous les satellites.
    return { sun: SUN, moon: MOON, planets: PLANETS, satellites: ALL_SATELLITES };
  // Fin de all.
  }

  /**
   * Listing d'affichage : les planètes, naines comprises, chacune portant ses satellites naturels, du plus proche
   * au plus lointain. Allégé par rapport à GET /bodies — ni éléments képlériens, ni codes Horizons — et déjà
   * rapproché, pour que l'interface n'embarque aucune table d'astres : elle affiche ce que cette réponse contient.
   *
   * La Lune n'est pas dans la table des satellites (sa place dans le moteur est à part) : elle est reprise de ses
   * propres données et rattachée à la planète marquée « earth », avec les seuls champs qu'elle possède.
   */
  // Méthode listing : la liste d'affichage des astres.
  listing() {
    // Les planètes, chacune avec ses satellites.
    const planets = PLANETS.map((p) => ({
      // son nom, son rayon, sa rotation et sa couleur ;
      name: p.name, radius: p.radius, rotation: p.rotation, color: p.color,
      // son demi-grand axe, le premier de ses douze éléments d'orbite ;
      aAu: p.elements[0],
      // la marque de planète naine, seulement si elle en est une ;
      ...(p.dwarf ? { dwarf: true as const } : {}),
      // ses satellites naturels : la Lune pour la Terre, sinon ceux de la table, classés par distance.
      satellites: ([
        // La Lune, rattachée à la planète marquée « earth » ; elle n'a qu'un nom et un rayon.
        ...(p.earth ? [{ id: '', name: MOON.name, radius: MOON.radius }] : []),
        // Les satellites de cette planète, reconnus par le nom de leur planète mère, sans accents ni majuscules.
        // Liste complète (affichés et candidats), comme GET /bodies : le listing dit ce qui existe, pas ce qui est
        // allumé en ce moment — sans quoi Phobos, Deimos et Triton en seraient absents.
        ...ALL_SATELLITES.filter((sat) => normalize(PARENT_PLANET_NAME[sat.parent]) === normalize(p.name))
          // classés du plus proche au plus lointain de la planète ;
          .sort((a, b) => a.aKm - b.aKm)
          // chacun réduit à ce qu'il faut pour l'afficher.
          .map((sat) => ({ id: sat.id, name: sat.name, radius: sat.radius, radiusKm: sat.radiusKm, color: sat.color, aKm: sat.aKm, periodDays: sat.periodDays })),
      // Fin des satellites.
      ] as ListingSatellite[]),
    // Fin de la planète.
    }));
    // Renvoie les planètes et les nombres, utiles à l'affichage.
    return {
      // les planètes ;
      planets,
      // les nombres : planètes, planètes naines et satellites naturels.
      counts: {
        // le nombre de planètes,
        planets: planets.length,
        // celui des planètes naines,
        dwarfPlanets: planets.filter((p) => 'dwarf' in p).length,
        // et le total des satellites.
        satellites: planets.reduce((n, p) => n + p.satellites.length, 0),
      // Fin des nombres.
      },
    // Fin de la réponse.
    };
  // Fin de listing.
  }

  // Méthode planet : reçoit un nom et renvoie la planète.
  planet(name: string): PlanetData {
    // Nom demandé, sans accents ni majuscules.
    const wanted = normalize(name);
    // Cherche la planète dont le nom, traité de la même façon, est identique.
    const found = PLANETS.find((p) => normalize(p.name) === wanted);
    // Si aucune ne correspond :
    if (!found) {
      // erreur 404 qui cite le nom reçu et liste les noms possibles.
      throw new NotFoundException(`Planète inconnue : « ${name} ». Valeurs possibles : ${PLANETS.map((p) => p.name).join(', ')}.`);
    // Fin du cas.
    }
    // Renvoie la planète trouvée.
    return found;
  // Fin de planet.
  }
// Fin du service.
}
