// Planètes naines importées de JPL Horizons (fichier produit par « npm run dwarf:import »). Ce fichier-là ne nous
// emprunte qu'un type, effacé à la compilation : il n'y a donc aucun cycle à l'exécution.
import { DWARF_PLANETS_DATA } from './dwarf-planets.data';

// Forme des données d'une planète.
export interface PlanetData {
  // name : son nom.
  name: string;
  /** rayon, en rayons terrestres */
  // radius : son rayon, en rayons terrestres.
  radius: number;
  /** période de rotation en jours (négatif = rétrograde) */
  // rotation : durée d'un tour sur elle-même, en jours.
  rotation: number;
  // earth : présent et vrai pour la Terre seulement.
  earth?: true;
  // mars : présent et vrai pour Mars seulement.
  mars?: true;
  // mercury : présent et vrai pour Mercure seulement.
  mercury?: true;
  // ring : présent et vrai pour la planète à anneaux.
  ring?: true;
  /** planète naine (Pluton) */
  // dwarf : présent et vrai pour une planète naine.
  dwarf?: true;
  // color : sa couleur dans l'interface.
  color: string;
  /** éléments képlériens JPL (J2000 + dérive par siècle) : a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω' */
  // elements : les douze nombres de son orbite.
  elements: number[];
// Fin de PlanetData.
}

// Le Soleil : son nom, son rayon (109,2 rayons terrestres) et sa couleur.
export const SUN = { name: 'Soleil', radius: 109.2, color: '#ffb300' };
// La Lune : son nom et son rayon (0,273 rayon terrestre).
export const MOON = { name: 'Lune', radius: 0.273 };

// Liste des huit planètes et de Pluton, de la plus proche à la plus lointaine du Soleil.
const MAJOR_PLANETS: PlanetData[] = [
  // Planète suivante :
  {
    // son nom, Mercure ;
    "name": "Mercure",
    // le rayon de Mercure, en rayons terrestres ;
    "radius": 0.383,
    // sa période de rotation, en jours ;
    "rotation": 58.65,
    // marque : c'est Mercure ;
    "mercury": true,
    // sa couleur dans l'interface ;
    "color": "#b5b5b5",
    // les éléments d'orbite de Mercure (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      0.38709927,
      // dérive de a par siècle ;
      3.7e-7,
      // excentricité e ;
      0.20563593,
      // dérive de e par siècle ;
      0.00001906,
      // inclinaison I, en degrés ;
      7.00497902,
      // dérive de I par siècle ;
      -0.00594749,
      // longitude moyenne L, en degrés ;
      252.2503235,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      149472.67411175,
      // longitude du périhélie ϖ, en degrés ;
      77.45779628,
      // dérive de ϖ par siècle ;
      0.16047689,
      // longitude du nœud ascendant Ω, en degrés ;
      48.33076593,
      // dérive de Ω par siècle.
      -0.12534081
    // fin des éléments.
    ]
  // Fin de Mercure.
  },
  // Planète suivante :
  {
    // son nom, Vénus ;
    "name": "Vénus",
    // le rayon de Vénus, en rayons terrestres ;
    "radius": 0.949,
    // sa période de rotation, en jours (négative : elle tourne à l'envers) ;
    "rotation": -243,
    // sa couleur dans l'interface ;
    "color": "#e8c27a",
    // les éléments d'orbite de Vénus (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      0.72333566,
      // dérive de a par siècle ;
      0.0000039,
      // excentricité e ;
      0.00677672,
      // dérive de e par siècle ;
      -0.00004107,
      // inclinaison I, en degrés ;
      3.39467605,
      // dérive de I par siècle ;
      -0.0007889,
      // longitude moyenne L, en degrés ;
      181.9790995,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      58517.81538729,
      // longitude du périhélie ϖ, en degrés ;
      131.60246718,
      // dérive de ϖ par siècle ;
      0.00268329,
      // longitude du nœud ascendant Ω, en degrés ;
      76.67984255,
      // dérive de Ω par siècle.
      -0.27769418
    // fin des éléments.
    ]
  // Fin de Vénus.
  },
  // Planète suivante :
  {
    // son nom, Terre ;
    "name": "Terre",
    // le rayon de Terre, en rayons terrestres ;
    "radius": 1,
    // sa période de rotation, en jours ;
    "rotation": 0.9973,
    // marque : c'est la Terre ;
    "earth": true,
    // sa couleur dans l'interface ;
    "color": "#3d8bff",
    // les éléments d'orbite de Terre (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      1.00000261,
      // dérive de a par siècle ;
      0.00000562,
      // excentricité e ;
      0.01671123,
      // dérive de e par siècle ;
      -0.00004392,
      // inclinaison I, en degrés ;
      -0.00001531,
      // dérive de I par siècle ;
      -0.01294668,
      // longitude moyenne L, en degrés ;
      100.46457166,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      35999.37244981,
      // longitude du périhélie ϖ, en degrés ;
      102.93768193,
      // dérive de ϖ par siècle ;
      0.32327364,
      // longitude du nœud ascendant Ω, en degrés ;
      0,
      // dérive de Ω par siècle.
      0
    // fin des éléments.
    ]
  // Fin de Terre.
  },
  // Planète suivante :
  {
    // son nom, Mars ;
    "name": "Mars",
    // le rayon de Mars, en rayons terrestres ;
    "radius": 0.532,
    // sa période de rotation, en jours ;
    "rotation": 1.026,
    // marque : c'est Mars ;
    "mars": true,
    // sa couleur dans l'interface ;
    "color": "#e0553a",
    // les éléments d'orbite de Mars (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      1.52371034,
      // dérive de a par siècle ;
      0.00001847,
      // excentricité e ;
      0.0933941,
      // dérive de e par siècle ;
      0.00007882,
      // inclinaison I, en degrés ;
      1.84969142,
      // dérive de I par siècle ;
      -0.00813131,
      // longitude moyenne L, en degrés ;
      -4.55343205,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      19140.30268499,
      // longitude du périhélie ϖ, en degrés ;
      -23.94362959,
      // dérive de ϖ par siècle ;
      0.44441088,
      // longitude du nœud ascendant Ω, en degrés ;
      49.55953891,
      // dérive de Ω par siècle.
      -0.29257343
    // fin des éléments.
    ]
  // Fin de Mars.
  },
  // Planète suivante :
  {
    // son nom, Jupiter ;
    "name": "Jupiter",
    // le rayon de Jupiter, en rayons terrestres ;
    "radius": 11.21,
    // sa période de rotation, en jours ;
    "rotation": 0.4135,
    // sa couleur dans l'interface ;
    "color": "#d9a066",
    // les éléments d'orbite de Jupiter (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      5.202887,
      // dérive de a par siècle ;
      -0.00011607,
      // excentricité e ;
      0.04838624,
      // dérive de e par siècle ;
      -0.00013253,
      // inclinaison I, en degrés ;
      1.30439695,
      // dérive de I par siècle ;
      -0.00183714,
      // longitude moyenne L, en degrés ;
      34.39644051,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      3034.74612775,
      // longitude du périhélie ϖ, en degrés ;
      14.72847983,
      // dérive de ϖ par siècle ;
      0.21252668,
      // longitude du nœud ascendant Ω, en degrés ;
      100.47390909,
      // dérive de Ω par siècle.
      0.20469106
    // fin des éléments.
    ]
  // Fin de Jupiter.
  },
  // Planète suivante :
  {
    // son nom, Saturne ;
    "name": "Saturne",
    // le rayon de Saturne, en rayons terrestres ;
    "radius": 9.45,
    // sa période de rotation, en jours ;
    "rotation": 0.444,
    // marque : elle a des anneaux ;
    "ring": true,
    // sa couleur dans l'interface ;
    "color": "#f0dc9a",
    // les éléments d'orbite de Saturne (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      9.53667594,
      // dérive de a par siècle ;
      -0.0012506,
      // excentricité e ;
      0.05386179,
      // dérive de e par siècle ;
      -0.00050991,
      // inclinaison I, en degrés ;
      2.48599187,
      // dérive de I par siècle ;
      0.00193609,
      // longitude moyenne L, en degrés ;
      49.95424423,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      1222.49362201,
      // longitude du périhélie ϖ, en degrés ;
      92.59887831,
      // dérive de ϖ par siècle ;
      -0.41897216,
      // longitude du nœud ascendant Ω, en degrés ;
      113.66242448,
      // dérive de Ω par siècle.
      -0.28867794
    // fin des éléments.
    ]
  // Fin de Saturne.
  },
  // Planète suivante :
  {
    // son nom, Uranus ;
    "name": "Uranus",
    // le rayon de Uranus, en rayons terrestres ;
    "radius": 4.01,
    // sa période de rotation, en jours (négative : elle tourne à l'envers) ;
    "rotation": -0.718,
    // sa couleur dans l'interface ;
    "color": "#7fe3ee",
    // les éléments d'orbite de Uranus (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      19.18916464,
      // dérive de a par siècle ;
      -0.00196176,
      // excentricité e ;
      0.04725744,
      // dérive de e par siècle ;
      -0.00004397,
      // inclinaison I, en degrés ;
      0.77263783,
      // dérive de I par siècle ;
      -0.00242939,
      // longitude moyenne L, en degrés ;
      313.23810451,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      428.48202785,
      // longitude du périhélie ϖ, en degrés ;
      170.9542763,
      // dérive de ϖ par siècle ;
      0.40805281,
      // longitude du nœud ascendant Ω, en degrés ;
      74.01692503,
      // dérive de Ω par siècle.
      0.0424058
    // fin des éléments.
    ]
  // Fin de Uranus.
  },
  // Planète suivante :
  {
    // son nom, Neptune ;
    "name": "Neptune",
    // le rayon de Neptune, en rayons terrestres ;
    "radius": 3.88,
    // sa période de rotation, en jours ;
    "rotation": 0.671,
    // sa couleur dans l'interface ;
    "color": "#4a6bff",
    // les éléments d'orbite de Neptune (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      30.06992276,
      // dérive de a par siècle ;
      0.00026291,
      // excentricité e ;
      0.00859048,
      // dérive de e par siècle ;
      0.00005105,
      // inclinaison I, en degrés ;
      1.77004347,
      // dérive de I par siècle ;
      0.00035372,
      // longitude moyenne L, en degrés ;
      -55.12002969,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      218.45945325,
      // longitude du périhélie ϖ, en degrés ;
      44.96476227,
      // dérive de ϖ par siècle ;
      -0.32241464,
      // longitude du nœud ascendant Ω, en degrés ;
      131.78422574,
      // dérive de Ω par siècle.
      -0.00508664
    // fin des éléments.
    ]
  // Fin de Neptune.
  },
  // Planète suivante :
  {
    // son nom, Pluton ;
    "name": "Pluton",
    // le rayon de Pluton, en rayons terrestres ;
    "radius": 0.18647,
    // sa période de rotation, en jours (négative : elle tourne à l'envers) ;
    "rotation": -6.38723,
    // marque : planète naine ;
    "dwarf": true,
    // sa couleur dans l'interface ;
    "color": "#d8b894",
    // les éléments d'orbite de Pluton (élément puis dérive par siècle) :
    "elements": [
      // demi-grand axe a, en UA ;
      39.48211675,
      // dérive de a par siècle ;
      -0.00031596,
      // excentricité e ;
      0.2488273,
      // dérive de e par siècle ;
      0.0000517,
      // inclinaison I, en degrés ;
      17.14001206,
      // dérive de I par siècle ;
      0.00004818,
      // longitude moyenne L, en degrés ;
      238.92903833,
      // dérive de L par siècle : l'angle parcouru en cent ans ;
      145.20780515,
      // longitude du périhélie ϖ, en degrés ;
      224.06891629,
      // dérive de ϖ par siècle ;
      -0.04062942,
      // longitude du nœud ascendant Ω, en degrés ;
      110.30393684,
      // dérive de Ω par siècle.
      -0.01183482
    // fin des éléments.
    ]
  // Fin de Pluton.
  }
// Fin de la liste.
];

/**
 * Tous les astres en orbite autour du Soleil que l'app affiche : les huit planètes et Pluton ci-dessus, puis les
 * planètes naines importées de JPL Horizons (voir dwarf-planets.data.ts, fichier produit par `npm run dwarf:import`).
 * La liste est classée par demi-grand axe croissant, si bien qu'une planète naine se place à sa distance réelle du
 * Soleil : Cérès entre Mars et Jupiter, les transneptuniennes après Neptune.
 */
// Liste des planètes : les majeures et les naines réunies, classées par distance au Soleil.
export const PLANETS: PlanetData[] = [...MAJOR_PLANETS, ...DWARF_PLANETS_DATA]
  // Classement par demi-grand axe, le premier des douze éléments d'orbite.
  .sort((a, b) => a.elements[0] - b.elements[0]);

/**
 * Orbites des planètes : la table ci-dessus est celle des « Keplerian Elements for Approximate Positions of the
 * Major Planets », valable de 1800 à 2050, au format [a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω'] — chaque élément
 * suivi de sa dérive par siècle julien. Ce sont des données statiques du dépôt : le calcul est entièrement local,
 * aucun service d'éphémérides n'est interrogé à l'exécution (voir moteur/engine/planetOrbits.jsx).
 *
 * Les dérives séculaires et la dérive de la longitude moyenne L' sont ajustées sur les observations : elles ne se
 * retrouvent pas par la troisième loi de Kepler. Les remplacer par le moyen mouvement à deux corps décalait les
 * planètes de 0,13 à 1,36 degré par siècle, soit 93 000 km sur Mercure et 4,8 millions de km sur Jupiter en 2026.
 */

/**
 * Satellites naturels affichés sur le modèle de la Lune (tuiles, position exacte, rotation synchrone).
 *  id        identifiant de l'astre côté client et des couches de tuiles (`body`)
 *  parent    identifiant de la planète (mars, jupiter, saturn, uranus, neptune, pluto)
 *  radius    rayon en rayons terrestres (6 371 km) ; radiusKm : rayon moyen (km), JPL SSD « Planetary Satellite Physical Parameters »
 *  horizons  code JPL Horizons du satellite ; parentHorizons : centre de la planète
 *  aKm, periodDays : demi-grand axe et période sidérale (orbite de repli si Horizons est injoignable) ;
 *            période négative = orbite rétrograde (Triton). Sources : JPL SSD (Jupiter, Saturne), NASA NSSDC (au-delà)
 */
// Type SatelliteParent : les six planètes qui ont des satellites dans l'application.
export type SatelliteParent = 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';
// Code JPL Horizons du centre de chaque planète mère :
const PARENT_HORIZONS: Record<SatelliteParent, string> = {
  // Mars, Jupiter, Saturne, Uranus, Neptune, Pluton.
  mars: '500@499', jupiter: '500@599', saturn: '500@699', uranus: '500@799', neptune: '500@899', pluto: '500@999',
// Fin de la table.
};

/**
 * Nom français de la planète mère de chaque satellite : l'identifiant du parent est en anglais (`saturn`, `pluto`)
 * alors que la table des planètes porte des noms français. Cette table fait le lien, pour rapprocher un satellite
 * de sa planète sans deviner.
 */
// Nom de la planète mère, pour chaque identifiant de parent :
export const PARENT_PLANET_NAME: Record<SatelliteParent, string> = {
  // Mars, Jupiter, Saturne, Uranus, Neptune, Pluton.
  mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturne', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluton',
// Fin de la table.
};

// Forme des données d'un satellite.
export interface SatelliteData {
  // id : son identifiant.
  id: string;
  // name : son nom.
  name: string;
  // parent : sa planète.
  parent: SatelliteParent;
  // radius : son rayon, en rayons terrestres.
  radius: number;
  // radiusKm : son rayon moyen, en kilomètres.
  radiusKm: number;
  // color : sa couleur dans l'interface.
  color: string;
  // horizons : son code JPL Horizons.
  horizons: string;
  // parentHorizons : le code du centre de sa planète.
  parentHorizons: string;
  // aKm : demi-grand axe de son orbite, en kilomètres.
  aKm: number;
  // periodDays : durée d'un tour, en jours.
  periodDays: number;
// Fin de SatelliteData.
}

// Rayon moyen de la Terre, en kilomètres.
const EARTH_KM = 6371;
// Fonction sat : fabrique un satellite à partir de ses huit valeurs.
const sat = (id: string, name: string, parent: SatelliteParent, radiusKm: number, color: string, horizons: string, aKm: number, periodDays: number): SatelliteData => ({
  // Reprend les valeurs ; le rayon en rayons terrestres est calculé depuis les kilomètres et arrondi à 5 décimales ;
  id, name, parent, radiusKm, radius: Math.round((radiusKm / EARTH_KM) * 100000) / 100000, color, horizons,
  // le code du centre de la planète est tiré de la table ci-dessus.
  parentHorizons: PARENT_HORIZONS[parent], aKm, periodDays,
// Fin de sat.
});

// Satellites affichés par l'application.
export const SATELLITES: SatelliteData[] = [
  // Jupiter
  // Io, satellite de Jupiter : rayon 1821,49 km, couleur #d9c45c, code Horizons 501, demi-grand axe 421 800 km, période 1,769138 jours.
  sat('io', 'Io', 'jupiter', 1821.49, '#d9c45c', '501', 421_800, 1.769138),
  // Europe, satellite de Jupiter : rayon 1560,8 km, couleur #cdbca3, code Horizons 502, demi-grand axe 671 100 km, période 3,551181 jours.
  sat('europa', 'Europe', 'jupiter', 1560.8, '#cdbca3', '502', 671_100, 3.551181),
  // Ganymède, satellite de Jupiter : rayon 2631,2 km, couleur #8e8476, code Horizons 503, demi-grand axe 1 070 400 km, période 7,154553 jours.
  sat('ganymede', 'Ganymède', 'jupiter', 2631.2, '#8e8476', '503', 1_070_400, 7.154553),
  // Callisto, satellite de Jupiter : rayon 2410,3 km, couleur #6c6053, code Horizons 504, demi-grand axe 1 882 700 km, période 16,689018 jours.
  sat('callisto', 'Callisto', 'jupiter', 2410.3, '#6c6053', '504', 1_882_700, 16.689018),
  // Saturne
  // Mimas, satellite de Saturne : rayon 198,2 km, couleur #bcbcbc, code Horizons 601, demi-grand axe 186 000 km, période 0,942422 jours.
  sat('mimas', 'Mimas', 'saturn', 198.2, '#bcbcbc', '601', 186_000, 0.942422),
  // Encelade, satellite de Saturne : rayon 252,1 km, couleur #f1f3f6, code Horizons 602, demi-grand axe 238 400 km, période 1,370218 jours.
  sat('enceladus', 'Encelade', 'saturn', 252.1, '#f1f3f6', '602', 238_400, 1.370218),
  // Téthys, satellite de Saturne : rayon 531,1 km, couleur #d8d8d4, code Horizons 603, demi-grand axe 295 000 km, période 1,887802 jours.
  sat('tethys', 'Téthys', 'saturn', 531.1, '#d8d8d4', '603', 295_000, 1.887802),
  // Dioné, satellite de Saturne : rayon 561,4 km, couleur #c9c9c5, code Horizons 604, demi-grand axe 377 700 km, période 2,736915 jours.
  sat('dione', 'Dioné', 'saturn', 561.4, '#c9c9c5', '604', 377_700, 2.736915),
  // Rhéa, satellite de Saturne : rayon 763,5 km, couleur #bdbab4, code Horizons 605, demi-grand axe 527 200 km, période 4,518212 jours.
  sat('rhea', 'Rhéa', 'saturn', 763.5, '#bdbab4', '605', 527_200, 4.518212),
  // Titan, satellite de Saturne : rayon 2574,76 km, couleur #d6a446, code Horizons 606, demi-grand axe 1 221 900 km, période 15,945421 jours.
  sat('titan', 'Titan', 'saturn', 2574.76, '#d6a446', '606', 1_221_900, 15.945421),
  // Japet, satellite de Saturne : rayon 734,3 km, couleur #9b9081, code Horizons 608, demi-grand axe 3 561 700 km, période 79,3215 jours.
  sat('iapetus', 'Japet', 'saturn', 734.3, '#9b9081', '608', 3_561_700, 79.3215),
  // Uranus
  // Miranda, satellite de Uranus : rayon 235,8 km, couleur #a9a7a3, code Horizons 705, demi-grand axe 129 900 km, période 1,413479 jours.
  sat('miranda', 'Miranda', 'uranus', 235.8, '#a9a7a3', '705', 129_900, 1.413479),
  // Ariel, satellite de Uranus : rayon 578,9 km, couleur #b8b4ad, code Horizons 701, demi-grand axe 190 900 km, période 2,520379 jours.
  sat('ariel', 'Ariel', 'uranus', 578.9, '#b8b4ad', '701', 190_900, 2.520379),
  // Umbriel, satellite de Uranus : rayon 584,7 km, couleur #6f6c68, code Horizons 702, demi-grand axe 266 000 km, période 4,144176 jours.
  sat('umbriel', 'Umbriel', 'uranus', 584.7, '#6f6c68', '702', 266_000, 4.144176),
  // Titania, satellite de Uranus : rayon 788,9 km, couleur #a39a8f, code Horizons 703, demi-grand axe 436 300 km, période 8,705867 jours.
  sat('titania', 'Titania', 'uranus', 788.9, '#a39a8f', '703', 436_300, 8.705867),
  // Obéron, satellite de Uranus : rayon 761,4 km, couleur #958a80, code Horizons 704, demi-grand axe 583 500 km, période 13,463234 jours.
  sat('oberon', 'Obéron', 'uranus', 761.4, '#958a80', '704', 583_500, 13.463234),
  // Neptune (Triton : orbite rétrograde)
  // Triton, satellite de Neptune : rayon 1352,6 km, couleur #d9c9c0, code Horizons 801, demi-grand axe 354 760 km, période -5,876854 jours (négative : orbite rétrograde).
  sat('triton', 'Triton', 'neptune', 1352.6, '#d9c9c0', '801', 354_760, -5.876854),
  // Pluton
  // Charon, satellite de Pluton : rayon 606,0 km, couleur #9a9590, code Horizons 901, demi-grand axe 19 596 km, période 6,3872 jours.
  sat('charon', 'Charon', 'pluto', 606.0, '#9a9590', '901', 19_596, 6.3872),
// Fin de la liste.
];

/**
 * Candidats supplémentaires : connus de JPL Horizons, affichés seulement s'ils ont AUSSI une carte NASA Trek
 * (test `ready = horizons && trek`, voir BodyAvailabilityService). Valeurs approchées (orbite de repli seulement).
 */
// Satellites candidats, affichés seulement s'ils ont une carte.
export const SATELLITE_CANDIDATES: SatelliteData[] = [
  // Phobos, satellite de Mars : rayon 11,08 km, couleur #7d7064, code Horizons 401, demi-grand axe 9 376 km, période 0,31891 jours.
  sat('phobos', 'Phobos', 'mars', 11.08, '#7d7064', '401', 9_376, 0.31891),
  // Deimos, satellite de Mars : rayon 6,2 km, couleur #8a7d70, code Horizons 402, demi-grand axe 23 463 km, période 1,26244 jours.
  sat('deimos', 'Deimos', 'mars', 6.2, '#8a7d70', '402', 23_463, 1.26244),
  // Amalthée, satellite de Jupiter : rayon 83,5 km, couleur #a5584a, code Horizons 505, demi-grand axe 181 366 km, période 0,498179 jours.
  sat('amalthea', 'Amalthée', 'jupiter', 83.5, '#a5584a', '505', 181_366, 0.498179),
  // Himalia, satellite de Jupiter : rayon 69,8 km, couleur #8c8378, code Horizons 506, demi-grand axe 11 460 000 km, période 250,56 jours.
  sat('himalia', 'Himalia', 'jupiter', 69.8, '#8c8378', '506', 11_460_000, 250.56),
  // Thébé, satellite de Jupiter : rayon 49,3 km, couleur #97705f, code Horizons 514, demi-grand axe 221 889 km, période 0,6745 jours.
  sat('thebe', 'Thébé', 'jupiter', 49.3, '#97705f', '514', 221_889, 0.6745),
  // Hypérion, satellite de Saturne : rayon 135 km, couleur #b39e85, code Horizons 607, demi-grand axe 1 481 500 km, période 21,276609 jours.
  sat('hyperion', 'Hypérion', 'saturn', 135, '#b39e85', '607', 1_481_500, 21.276609),
  // Phœbé, satellite de Saturne : rayon 106,5 km, couleur #5e5a55, code Horizons 609, demi-grand axe 12 947 780 km, période -550,31 jours (négative : orbite rétrograde).
  sat('phoebe', 'Phœbé', 'saturn', 106.5, '#5e5a55', '609', 12_947_780, -550.31),
  // Janus, satellite de Saturne : rayon 89,5 km, couleur #b9b5ae, code Horizons 610, demi-grand axe 151 460 km, période 0,69466 jours.
  sat('janus', 'Janus', 'saturn', 89.5, '#b9b5ae', '610', 151_460, 0.69466),
  // Épiméthée, satellite de Saturne : rayon 58,1 km, couleur #b4b0a9, code Horizons 611, demi-grand axe 151 410 km, période 0,694333 jours.
  sat('epimetheus', 'Épiméthée', 'saturn', 58.1, '#b4b0a9', '611', 151_410, 0.694333),
  // Puck, satellite de Uranus : rayon 81 km, couleur #7b7874, code Horizons 715, demi-grand axe 86 004 km, période 0,761833 jours.
  sat('puck', 'Puck', 'uranus', 81, '#7b7874', '715', 86_004, 0.761833),
  // Protée, satellite de Neptune : rayon 210 km, couleur #6e6a66, code Horizons 808, demi-grand axe 117 647 km, période 1,122315 jours.
  sat('proteus', 'Protée', 'neptune', 210, '#6e6a66', '808', 117_647, 1.122315),
  // Néréide, satellite de Neptune : rayon 170 km, couleur #9b958d, code Horizons 802, demi-grand axe 5 513 400 km, période 360,13 jours.
  sat('nereid', 'Néréide', 'neptune', 170, '#9b958d', '802', 5_513_400, 360.13),
  // Nix, satellite de Pluton : rayon 19 km, couleur #c9c6c2, code Horizons 902, demi-grand axe 48 694 km, période 24,8546 jours.
  sat('nix', 'Nix', 'pluto', 19, '#c9c6c2', '902', 48_694, 24.8546),
  // Hydra, satellite de Pluton : rayon 25 km, couleur #c6c3bf, code Horizons 903, demi-grand axe 64 738 km, période 38,2018 jours.
  sat('hydra', 'Hydra', 'pluto', 25, '#c6c3bf', '903', 64_738, 38.2018),
  // Kerberos, satellite de Pluton : rayon 6 km, couleur #8f8b86, code Horizons 904, demi-grand axe 57 783 km, période 32,1678 jours.
  sat('kerberos', 'Kerberos', 'pluto', 6, '#8f8b86', '904', 57_783, 32.1678),
  // Styx, satellite de Pluton : rayon 5 km, couleur #a8a4a0, code Horizons 905, demi-grand axe 42 656 km, période 20,1617 jours.
  sat('styx', 'Styx', 'pluto', 5, '#a8a4a0', '905', 42_656, 20.1617),
// Fin de la liste.
];

/** Tous les satellites testés (affichés + candidats). */
// Tous les satellites : les affichés, puis les candidats.
export const ALL_SATELLITES: SatelliteData[] = [...SATELLITES, ...SATELLITE_CANDIDATES];

/** Codes JPL Horizons des planètes (centre de l'astre). */
// Code JPL Horizons du centre de chaque planète :
export const PLANET_HORIZONS: Record<string, string> = {
  // de Mercure (199) à Pluton (999).
  mercury: '199', venus: '299', earth: '399', mars: '499', jupiter: '599', saturn: '699', uranus: '799', neptune: '899', pluto: '999',
// Fin de la table.
};
