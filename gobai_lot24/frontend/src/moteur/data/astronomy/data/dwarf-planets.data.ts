/**
 * Planètes naines, importées de JPL Horizons — FICHIER PRODUIT PAR UN SCRIPT, à ne pas modifier à la main.
 *
 * Régénération : `npm run dwarf:import --prefix backend` (voir services/scripts/dwarf-planets-import.ts). Le script
 * demande à Horizons les éléments osculateurs de chaque planète naine reconnue par l'UAI, contrôle que la réponse
 * porte bien sur le corps demandé, les convertit au format de la table des planètes et réécrit ce fichier.
 *
 * Les entrées ci-dessous rejoignent PLANETS (voir bodies.data.ts) : l'app les traite donc comme les huit planètes,
 * orbite calculée localement par Kepler, sans jamais interroger Horizons à l'exécution.
 *
 * Pluton n'est pas ici : il est dans la table des planètes depuis l'origine, avec ses dérives séculaires ajustées
 * sur les observations, meilleures que la propagation à deux corps de cet import.
 */
// Type (effacé à la compilation) des données d'une planète.
import type { PlanetData } from './bodies.data';

/** Planètes naines importées, de la plus proche à la plus lointaine du Soleil. */
// Liste des planètes naines :
export const DWARF_PLANETS_DATA: PlanetData[] = [
  // Planète naine suivante :
  {
    // son nom, Cérès ;
    "name": "Cérès",
    // son rayon, en rayons terrestres (469,7 km mesurés par Horizons) ;
    "radius": 0.07372,
    // sa période de rotation, en jours (9,07417 heures) ;
    "rotation": 0.37809,
    // marque : planète naine ;
    "dwarf": true,
    // sa couleur dans l'interface ;
    "color": "#9b9289",
    // les éléments d'orbite de Cérès (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      2.766496019994375,
      // dérive de a par siècle : inconnue pour une planète naine ;
      0,
      // excentricité e ;
      0.0783756264716301,
      // dérive de e par siècle : inconnue ;
      0,
      // inclinaison I, en degrés ;
      10.58336045805628,
      // dérive de I par siècle : inconnue ;
      0,
      // longitude moyenne L, en degrés (Ω + ω + M à l'époque) ;
      160.5938747289855,
      // dérive de L par siècle : le moyen mouvement d'Horizons sur un siècle julien ;
      7823.46643894463,
      // longitude du périhélie ϖ, en degrés (Ω + ω) ;
      154.41722021580495,
      // dérive de ϖ par siècle : inconnue ;
      0,
      // longitude du nœud ascendant Ω, en degrés ;
      80.49435747295279,
      // dérive de Ω par siècle : inconnue.
      0
    // fin des éléments.
    ]
  // Fin de Cérès.
  }
// Fin de la liste.
];

/**
 * Commandes JPL Horizons des planètes naines : le numéro du petit corps suivi d'un point-virgule, qui dit à
 * Horizons de chercher parmi les astéroïdes et les transneptuniens et non parmi les planètes.
 */
// Commande Horizons de chaque planète naine :
export const DWARF_PLANET_HORIZONS: Record<string, string> = {
  // Cérès (1), Pluton (134340), Haumea (136108), Makemake (136472), Éris (136199).
  ceres: '1;', pluto: '134340;', haumea: '136108;', makemake: '136472;', eris: '136199;',
// Fin de la table.
};
