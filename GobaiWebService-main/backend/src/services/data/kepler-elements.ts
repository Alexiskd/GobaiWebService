/**
 * Éléments képlériens de chaque astre (fournis par Alexis) : sert au calcul local des orbites, sans JPL Horizons.
 *  a        demi-grand axe (`unit` : au pour les planètes, km pour les satellites)
 *  e        excentricité ; i, om (Ω), w (ω), M0 : degrés ; M0 = anomalie moyenne à l'époque J2000
 *  frame    plan de référence : écliptique J2000, équateur de la planète mère, ou plan de Laplace
 *  horizons, trek, ready : résultat du test de disponibilité au moment de l'export (informatif ; le serveur refait
 *           le test Trek en direct, voir BodyAvailabilityService).
 */
// Forme des éléments d'une orbite.
export interface KeplerElements {
  // a : demi-grand axe, la moitié de la plus grande longueur de l'ellipse.
  a: number;
  // e : excentricité, de 0 (cercle) à presque 1 (ellipse très allongée).
  e: number;
  // i : inclinaison de l'orbite sur le plan de référence.
  i: number;
  // om : longitude du nœud ascendant, la direction où l'orbite traverse le plan de référence en montant.
  om: number;
  // w : argument du périastre, l'angle entre ce nœud et le point le plus proche de l'astre central.
  w: number;
  // M0 : anomalie moyenne à J2000, la position de l'astre sur son orbite à cette date.
  M0: number;
  // unit : l'unité de a.
  unit: 'au' | 'km';
  // frame : le plan de référence.
  frame: string;
  /** Dérives séculaires optionnelles (degrés par siècle julien) : Ω, ω et anomalie moyenne (sinon 3e loi de Kepler). */
  // omDot : dérive du nœud par siècle.
  omDot?: number;
  // wDot : dérive du périastre par siècle.
  wDot?: number;
  // MDot : vitesse de l'anomalie moyenne par siècle.
  MDot?: number;
// Fin de KeplerElements.
}

// Forme d'un astre de la table.
export interface Astre {
  // id : son identifiant.
  id: string;
  // nom : son nom français.
  nom: string;
  // type : planète ou satellite.
  type: 'planet' | 'satellite';
  // parent : sa planète, vide pour une planète.
  parent: string;
  // horizons : connu de JPL Horizons au moment de l'export.
  horizons: boolean;
  // trek : carte NASA Trek trouvée au moment de l'export.
  trek: boolean;
  // ready : les deux à la fois.
  ready: boolean;
  // kepler : ses éléments d'orbite.
  kepler: KeplerElements;
// Fin de Astre.
}

// Table des astres : les neuf planètes, puis les satellites.
export const ASTRES: Astre[] = [
  // Mercure, planète : demi-grand axe 0,38709927 UA, excentricité 0,20563593, inclinaison 7,00497902°, nœud 48,33076593°, périastre 29,12703035°, anomalie moyenne 174,79252722°, dans l'écliptique ; test à l'export : Horizons oui, Trek oui.
  { id: 'mercury', nom: 'Mercure', type: 'planet', parent: '', horizons: true, trek: true, ready: true, kepler: { a: 0.38709927, e: 0.20563593, i: 7.00497902, om: 48.33076593, w: 29.12703035, M0: 174.79252722, unit: 'au', frame: 'ecliptic' } },
  // Vénus, planète : demi-grand axe 0,72333566 UA, excentricité 0,00677672, inclinaison 3,39467605°, nœud 76,67984255°, périastre 54,92262463°, anomalie moyenne 50,37663232°, dans l'écliptique ; test à l'export : Horizons oui, Trek oui.
  { id: 'venus', nom: 'Vénus', type: 'planet', parent: '', horizons: true, trek: true, ready: true, kepler: { a: 0.72333566, e: 0.00677672, i: 3.39467605, om: 76.67984255, w: 54.92262463, M0: 50.37663232, unit: 'au', frame: 'ecliptic' } },
  // Terre, planète : demi-grand axe 1,00000261 UA, excentricité 0,01671123, inclinaison -0,00001531°, nœud 0,0°, périastre 102,93768193°, anomalie moyenne 357,52688973°, dans l'écliptique ; test à l'export : Horizons oui, Trek oui.
  { id: 'earth', nom: 'Terre', type: 'planet', parent: '', horizons: true, trek: true, ready: true, kepler: { a: 1.00000261, e: 0.01671123, i: -0.00001531, om: 0.0, w: 102.93768193, M0: 357.52688973, unit: 'au', frame: 'ecliptic' } },
  // Mars, planète : demi-grand axe 1,52371034 UA, excentricité 0,09339410, inclinaison 1,84969142°, nœud 49,55953891°, périastre 286,49683150°, anomalie moyenne 19,39019754°, dans l'écliptique ; test à l'export : Horizons oui, Trek oui.
  { id: 'mars', nom: 'Mars', type: 'planet', parent: '', horizons: true, trek: true, ready: true, kepler: { a: 1.52371034, e: 0.09339410, i: 1.84969142, om: 49.55953891, w: 286.49683150, M0: 19.39019754, unit: 'au', frame: 'ecliptic' } },
  // Jupiter, planète : demi-grand axe 5,20288700 UA, excentricité 0,04838624, inclinaison 1,30439695°, nœud 100,47390909°, périastre 274,25457074°, anomalie moyenne 19,66796068°, dans l'écliptique ; test à l'export : Horizons non, Trek non.
  { id: 'jupiter', nom: 'Jupiter', type: 'planet', parent: '', horizons: false, trek: false, ready: false, kepler: { a: 5.20288700, e: 0.04838624, i: 1.30439695, om: 100.47390909, w: 274.25457074, M0: 19.66796068, unit: 'au', frame: 'ecliptic' } },
  // Saturne, planète : demi-grand axe 9,53667594 UA, excentricité 0,05386179, inclinaison 2,48599187°, nœud 113,66242448°, périastre 338,93645383°, anomalie moyenne 317,35536592°, dans l'écliptique ; test à l'export : Horizons oui, Trek non.
  { id: 'saturn', nom: 'Saturne', type: 'planet', parent: '', horizons: true, trek: false, ready: false, kepler: { a: 9.53667594, e: 0.05386179, i: 2.48599187, om: 113.66242448, w: 338.93645383, M0: 317.35536592, unit: 'au', frame: 'ecliptic' } },
  // Uranus, planète : demi-grand axe 19,18916464 UA, excentricité 0,04725744, inclinaison 0,77263783°, nœud 74,01692503°, périastre 96,93735127°, anomalie moyenne 142,28382821°, dans l'écliptique ; test à l'export : Horizons non, Trek non.
  { id: 'uranus', nom: 'Uranus', type: 'planet', parent: '', horizons: false, trek: false, ready: false, kepler: { a: 19.18916464, e: 0.04725744, i: 0.77263783, om: 74.01692503, w: 96.93735127, M0: 142.28382821, unit: 'au', frame: 'ecliptic' } },
  // Neptune, planète : demi-grand axe 30,06992276 UA, excentricité 0,00859048, inclinaison 1,77004347°, nœud 131,78422574°, périastre 273,18053653°, anomalie moyenne 259,91520804°, dans l'écliptique ; test à l'export : Horizons non, Trek non.
  { id: 'neptune', nom: 'Neptune', type: 'planet', parent: '', horizons: false, trek: false, ready: false, kepler: { a: 30.06992276, e: 0.00859048, i: 1.77004347, om: 131.78422574, w: 273.18053653, M0: 259.91520804, unit: 'au', frame: 'ecliptic' } },
  // Pluton, planète : demi-grand axe 39,571 UA, excentricité 0,24944850, inclinaison 17,23565302°, nœud 110,03993995°, périastre 115,17866598°, anomalie moyenne 14,14365454°, dans l'écliptique ; test à l'export : Horizons oui, Trek non.
  { id: 'pluto', nom: 'Pluton', type: 'planet', parent: '', horizons: true, trek: false, ready: false, kepler: { a: 39.571, e: 0.24944850, i: 17.23565302, om: 110.03993995, w: 115.17866598, M0: 14.14365454, unit: 'au', frame: 'ecliptic' } },
  // Io, satellite de Jupiter : demi-grand axe 421800 km, excentricité 0,004, inclinaison 0,0°, nœud 0,0°, périastre 49,1°, anomalie moyenne 330,9°, dans l'équateur de Jupiter ; test à l'export : Horizons oui, Trek oui.
  { id: 'io', nom: 'Io', type: 'satellite', parent: 'jupiter', horizons: true, trek: true, ready: true, kepler: { a: 421800, e: 0.004, i: 0.0, om: 0.0, w: 49.1, M0: 330.9, unit: 'km', frame: 'jupiter-equatorial' } },
  // Europe, satellite de Jupiter : demi-grand axe 671100 km, excentricité 0,009, inclinaison 0,5°, nœud 184,0°, périastre 45,0°, anomalie moyenne 345,4°, dans l'équateur de Jupiter ; test à l'export : Horizons oui, Trek oui.
  { id: 'europa', nom: 'Europe', type: 'satellite', parent: 'jupiter', horizons: true, trek: true, ready: true, kepler: { a: 671100, e: 0.009, i: 0.5, om: 184.0, w: 45.0, M0: 345.4, unit: 'km', frame: 'jupiter-equatorial' } },
  // Ganymède, satellite de Jupiter : demi-grand axe 1070400 km, excentricité 0,001, inclinaison 0,2°, nœud 58,5°, périastre 198,3°, anomalie moyenne 324,8°, dans l'équateur de Jupiter ; test à l'export : Horizons oui, Trek oui.
  { id: 'ganymede', nom: 'Ganymède', type: 'satellite', parent: 'jupiter', horizons: true, trek: true, ready: true, kepler: { a: 1070400, e: 0.001, i: 0.2, om: 58.5, w: 198.3, M0: 324.8, unit: 'km', frame: 'jupiter-equatorial' } },
  // Callisto, satellite de Jupiter : demi-grand axe 1882700 km, excentricité 0,007, inclinaison 0,3°, nœud 309,1°, périastre 43,8°, anomalie moyenne 87,4°, dans l'équateur de Jupiter ; test à l'export : Horizons oui, Trek oui.
  { id: 'callisto', nom: 'Callisto', type: 'satellite', parent: 'jupiter', horizons: true, trek: true, ready: true, kepler: { a: 1882700, e: 0.007, i: 0.3, om: 309.1, w: 43.8, M0: 87.4, unit: 'km', frame: 'jupiter-equatorial' } },
  // Mimas, satellite de Saturne : demi-grand axe 186000 km, excentricité 0,020, inclinaison 1,6°, nœud 66,2°, périastre 160,4°, anomalie moyenne 275,3°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'mimas', nom: 'Mimas', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 186000, e: 0.020, i: 1.6, om: 66.2, w: 160.4, M0: 275.3, unit: 'km', frame: 'saturn-equatorial' } },
  // Encelade, satellite de Saturne : demi-grand axe 238400 km, excentricité 0,005, inclinaison 0,0°, nœud 0,0°, périastre 119,5°, anomalie moyenne 57,0°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek oui.
  { id: 'enceladus', nom: 'Encelade', type: 'satellite', parent: 'saturn', horizons: true, trek: true, ready: true, kepler: { a: 238400, e: 0.005, i: 0.0, om: 0.0, w: 119.5, M0: 57.0, unit: 'km', frame: 'saturn-equatorial' } },
  // Téthys, satellite de Saturne : demi-grand axe 295000 km, excentricité 0,001, inclinaison 1,1°, nœud 273,0°, périastre 335,3°, anomalie moyenne 0,0°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'tethys', nom: 'Téthys', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 295000, e: 0.001, i: 1.1, om: 273.0, w: 335.3, M0: 0.0, unit: 'km', frame: 'saturn-equatorial' } },
  // Dioné, satellite de Saturne : demi-grand axe 377700 km, excentricité 0,002, inclinaison 0,0°, nœud 0,0°, périastre 116,0°, anomalie moyenne 212,0°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'dione', nom: 'Dioné', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 377700, e: 0.002, i: 0.0, om: 0.0, w: 116.0, M0: 212.0, unit: 'km', frame: 'saturn-equatorial' } },
  // Rhéa, satellite de Saturne : demi-grand axe 527200 km, excentricité 0,001, inclinaison 0,3°, nœud 133,7°, périastre 44,3°, anomalie moyenne 31,5°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'rhea', nom: 'Rhéa', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 527200, e: 0.001, i: 0.3, om: 133.7, w: 44.3, M0: 31.5, unit: 'km', frame: 'saturn-equatorial' } },
  // Titan, satellite de Saturne : demi-grand axe 1221900 km, excentricité 0,029, inclinaison 0,3°, nœud 78,6°, périastre 78,3°, anomalie moyenne 11,7°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek oui.
  { id: 'titan', nom: 'Titan', type: 'satellite', parent: 'saturn', horizons: true, trek: true, ready: true, kepler: { a: 1221900, e: 0.029, i: 0.3, om: 78.6, w: 78.3, M0: 11.7, unit: 'km', frame: 'saturn-equatorial' } },
  // Japet, satellite de Saturne : demi-grand axe 3561700 km, excentricité 0,028, inclinaison 7,6°, nœud 86,5°, périastre 254,5°, anomalie moyenne 74,8°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'iapetus', nom: 'Japet', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 3561700, e: 0.028, i: 7.6, om: 86.5, w: 254.5, M0: 74.8, unit: 'km', frame: 'saturn-equatorial' } },
  // Miranda, satellite de Uranus : demi-grand axe 129872 km, excentricité 0,00150980, inclinaison 175,572234°, nœud 259,171287°, périastre 344,673011°, anomalie moyenne 62,061891°, dans l'équateur de Uranus ; test à l'export : Horizons oui, Trek non.
  { id: 'miranda', nom: 'Miranda', type: 'satellite', parent: 'uranus', horizons: true, trek: false, ready: false, kepler: { a: 129872, e: 0.00150980, i: 175.572234, om: 259.171287, w: 344.673011, M0: 62.061891, unit: 'km', frame: 'uranus-equatorial' } },
  // Ariel, satellite de Uranus : demi-grand axe 190941 km, excentricité 0,00152081, inclinaison 179,997279°, nœud 150,621428°, périastre 21,036938°, anomalie moyenne 152,794368°, dans l'équateur de Uranus ; test à l'export : Horizons oui, Trek non.
  { id: 'ariel', nom: 'Ariel', type: 'satellite', parent: 'uranus', horizons: true, trek: false, ready: false, kepler: { a: 190941, e: 0.00152081, i: 179.997279, om: 150.621428, w: 21.036938, M0: 152.794368, unit: 'km', frame: 'uranus-equatorial' } },
  // Umbriel, satellite de Uranus : demi-grand axe 266012 km, excentricité 0,00417017, inclinaison 179,943636°, nœud 166,348704°, périastre 326,360127°, anomalie moyenne 271,223379°, dans l'équateur de Uranus ; test à l'export : Horizons oui, Trek non.
  { id: 'umbriel', nom: 'Umbriel', type: 'satellite', parent: 'uranus', horizons: true, trek: false, ready: false, kepler: { a: 266012, e: 0.00417017, i: 179.943636, om: 166.348704, w: 326.360127, M0: 271.223379, unit: 'km', frame: 'uranus-equatorial' } },
  // Titania, satellite de Uranus : demi-grand axe 436293 km, excentricité 0,00247900, inclinaison 179,899284°, nœud 11,436396°, périastre 38,615690°, anomalie moyenne 74,416776°, dans l'équateur de Uranus ; test à l'export : Horizons oui, Trek non.
  { id: 'titania', nom: 'Titania', type: 'satellite', parent: 'uranus', horizons: true, trek: false, ready: false, kepler: { a: 436293, e: 0.00247900, i: 179.899284, om: 11.436396, w: 38.615690, M0: 74.416776, unit: 'km', frame: 'uranus-equatorial' } },
  // Obéron, satellite de Uranus : demi-grand axe 583550 km, excentricité 0,00055232, inclinaison 179,811951°, nœud 319,956156°, périastre 39,006728°, anomalie moyenne 93,496291°, dans l'équateur de Uranus ; test à l'export : Horizons oui, Trek non.
  { id: 'oberon', nom: 'Obéron', type: 'satellite', parent: 'uranus', horizons: true, trek: false, ready: false, kepler: { a: 583550, e: 0.00055232, i: 179.811951, om: 319.956156, w: 39.006728, M0: 93.496291, unit: 'km', frame: 'uranus-equatorial' } },
  // Triton, satellite de Neptune : demi-grand axe 354766 km, excentricité 0,00014611, inclinaison 156,827887°, nœud 177,866923°, périastre 75,135076°, anomalie moyenne 343,460671°, dans l'équateur de Neptune ; test à l'export : Horizons oui, Trek non.
  { id: 'triton', nom: 'Triton', type: 'satellite', parent: 'neptune', horizons: true, trek: false, ready: false, kepler: { a: 354766, e: 0.00014611, i: 156.827887, om: 177.866923, w: 75.135076, M0: 343.460671, unit: 'km', frame: 'neptune-equatorial' } },
  // Charon, satellite de Pluton : demi-grand axe 19596 km, excentricité 0,00016107, inclinaison 0,084138°, nœud 9,442463°, périastre 146,013275°, anomalie moyenne 148,665134°, dans l'équateur de Pluton ; test à l'export : Horizons oui, Trek non.
  { id: 'charon', nom: 'Charon', type: 'satellite', parent: 'pluto', horizons: true, trek: false, ready: false, kepler: { a: 19596, e: 0.00016107, i: 0.084138, om: 9.442463, w: 146.013275, M0: 148.665134, unit: 'km', frame: 'pluto-equatorial' } },
  // Phobos, satellite de Mars : demi-grand axe 9375 km, excentricité 0,015, inclinaison 1,1°, nœud 169,2°, périastre 216,3°, anomalie moyenne 189,7°, dans l'équateur de Mars ; test à l'export : Horizons oui, Trek oui.
  { id: 'phobos', nom: 'Phobos', type: 'satellite', parent: 'mars', horizons: true, trek: true, ready: true, kepler: { a: 9375, e: 0.015, i: 1.1, om: 169.2, w: 216.3, M0: 189.7, unit: 'km', frame: 'mars-equatorial' } },
  // Deimos, satellite de Mars : demi-grand axe 23457 km, excentricité 0,000, inclinaison 1,8°, nœud 54,3°, périastre 0,0°, anomalie moyenne 205,0°, dans l'équateur de Mars ; test à l'export : Horizons oui, Trek non.
  { id: 'deimos', nom: 'Deimos', type: 'satellite', parent: 'mars', horizons: true, trek: false, ready: false, kepler: { a: 23457, e: 0.000, i: 1.8, om: 54.3, w: 0.0, M0: 205.0, unit: 'km', frame: 'mars-equatorial' } },
  // Amalthée, satellite de Jupiter : demi-grand axe 181400 km, excentricité 0,003, inclinaison 0,4°, nœud 282,9°, périastre 180,1°, anomalie moyenne 310,6°, dans l'équateur de Jupiter ; test à l'export : Horizons oui, Trek non.
  { id: 'amalthea', nom: 'Amalthée', type: 'satellite', parent: 'jupiter', horizons: true, trek: false, ready: false, kepler: { a: 181400, e: 0.003, i: 0.4, om: 282.9, w: 180.1, M0: 310.6, unit: 'km', frame: 'jupiter-equatorial' } },
  // Himalia, satellite de Jupiter : demi-grand axe 11439000 km, excentricité 0,160, inclinaison 28,4°, nœud 64,2°, périastre 321,1°, anomalie moyenne 78,3°, dans le plan de Laplace de Jupiter ; test à l'export : Horizons oui, Trek non.
  { id: 'himalia', nom: 'Himalia', type: 'satellite', parent: 'jupiter', horizons: true, trek: false, ready: false, kepler: { a: 11439000, e: 0.160, i: 28.4, om: 64.2, w: 321.1, M0: 78.3, unit: 'km', frame: 'jupiter-laplace' } },
  // Thébé, satellite de Jupiter : demi-grand axe 221900 km, excentricité 0,018, inclinaison 1,1°, nœud 340,4°, périastre 26,6°, anomalie moyenne 182,1°, dans l'équateur de Jupiter ; test à l'export : Horizons oui, Trek non.
  { id: 'thebe', nom: 'Thébé', type: 'satellite', parent: 'jupiter', horizons: true, trek: false, ready: false, kepler: { a: 221900, e: 0.018, i: 1.1, om: 340.4, w: 26.6, M0: 182.1, unit: 'km', frame: 'jupiter-equatorial' } },
  // Hypérion, satellite de Saturne : demi-grand axe 1481500 km, excentricité 0,105, inclinaison 0,6°, nœud 87,1°, périastre 214,0°, anomalie moyenne 122,9°, dans l'équateur de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'hyperion', nom: 'Hypérion', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 1481500, e: 0.105, i: 0.6, om: 87.1, w: 214.0, M0: 122.9, unit: 'km', frame: 'saturn-equatorial' } },
  // Phœbé, satellite de Saturne : demi-grand axe 12929400 km, excentricité 0,164, inclinaison 175,2°, nœud 192,7°, périastre 240,3°, anomalie moyenne 308,0°, dans le plan de Laplace de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'phoebe', nom: 'Phœbé', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 12929400, e: 0.164, i: 175.2, om: 192.7, w: 240.3, M0: 308.0, unit: 'km', frame: 'saturn-laplace' } },
  // Janus, satellite de Saturne : demi-grand axe 151500 km, excentricité 0,007, inclinaison 0,2°, nœud 159,9°, périastre 11,1°, anomalie moyenne 111,7°, dans le plan de Laplace de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'janus', nom: 'Janus', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 151500, e: 0.007, i: 0.2, om: 159.9, w: 11.1, M0: 111.7, unit: 'km', frame: 'saturn-laplace' } },
  // Épiméthée, satellite de Saturne : demi-grand axe 151400 km, excentricité 0,020, inclinaison 0,3°, nœud 189,8°, périastre 96,3°, anomalie moyenne 197,2°, dans le plan de Laplace de Saturne ; test à l'export : Horizons oui, Trek non.
  { id: 'epimetheus', nom: 'Épiméthée', type: 'satellite', parent: 'saturn', horizons: true, trek: false, ready: false, kepler: { a: 151400, e: 0.020, i: 0.3, om: 189.8, w: 96.3, M0: 197.2, unit: 'km', frame: 'saturn-laplace' } },
  // Puck, satellite de Uranus : demi-grand axe 49835 km, excentricité 0,00132230, inclinaison 179,849276°, nœud 105,293087°, périastre 119,886970°, anomalie moyenne 347,902957°, dans l'équateur de Uranus ; test à l'export : Horizons oui, Trek non.
  { id: 'puck', nom: 'Puck', type: 'satellite', parent: 'uranus', horizons: true, trek: false, ready: false, kepler: { a: 49835, e: 0.00132230, i: 179.849276, om: 105.293087, w: 119.886970, M0: 347.902957, unit: 'km', frame: 'uranus-equatorial' } },
  // Protée, satellite de Neptune : demi-grand axe 62005 km, excentricité 0,00100812, inclinaison 0,514387°, nœud 2,006895°, périastre 75,412521°, anomalie moyenne 6,563796°, dans l'équateur de Neptune ; test à l'export : Horizons oui, Trek non.
  { id: 'proteus', nom: 'Protée', type: 'satellite', parent: 'neptune', horizons: true, trek: false, ready: false, kepler: { a: 62005, e: 0.00100812, i: 0.514387, om: 2.006895, w: 75.412521, M0: 6.563796, unit: 'km', frame: 'neptune-equatorial' } },
  // Néréide, satellite de Neptune : demi-grand axe 5511155 km, excentricité 0,75065094, inclinaison 28,412104°, nœud 215,206619°, périastre 17,938407°, anomalie moyenne 215,625552°, dans l'équateur de Neptune ; test à l'export : Horizons oui, Trek non.
  { id: 'nereid', nom: 'Néréide', type: 'satellite', parent: 'neptune', horizons: true, trek: false, ready: false, kepler: { a: 5511155, e: 0.75065094, i: 28.412104, om: 215.206619, w: 17.938407, M0: 215.625552, unit: 'km', frame: 'neptune-equatorial' } },
  // Nix, satellite de Pluton : demi-grand axe 39326 km, excentricité 0,20417744, inclinaison 0,096367°, nœud 23,725609°, périastre 263,923781°, anomalie moyenne 154,755465°, dans l'équateur de Pluton ; test à l'export : Horizons oui, Trek non.
  { id: 'nix', nom: 'Nix', type: 'satellite', parent: 'pluto', horizons: true, trek: false, ready: false, kepler: { a: 39326, e: 0.20417744, i: 0.096367, om: 23.725609, w: 263.923781, M0: 154.755465, unit: 'km', frame: 'pluto-equatorial' } },
  // Hydra, satellite de Pluton : demi-grand axe 98706 km, excentricité 0,36686881, inclinaison 0,237579°, nœud 105,691488°, périastre 160,431626°, anomalie moyenne 345,975587°, dans l'équateur de Pluton ; test à l'export : Horizons oui, Trek non.
  { id: 'hydra', nom: 'Hydra', type: 'satellite', parent: 'pluto', horizons: true, trek: false, ready: false, kepler: { a: 98706, e: 0.36686881, i: 0.237579, om: 105.691488, w: 160.431626, M0: 345.975587, unit: 'km', frame: 'pluto-equatorial' } },
  // Kerberos, satellite de Pluton : demi-grand axe 133084 km, excentricité 0,55549274, inclinaison 0,434960°, nœud 329,406082°, périastre 312,243799°, anomalie moyenne 356,988893°, dans l'équateur de Pluton ; test à l'export : Horizons oui, Trek non.
  { id: 'kerberos', nom: 'Kerberos', type: 'satellite', parent: 'pluto', horizons: true, trek: false, ready: false, kepler: { a: 133084, e: 0.55549274, i: 0.434960, om: 329.406082, w: 312.243799, M0: 356.988893, unit: 'km', frame: 'pluto-equatorial' } },
  // Styx, satellite de Pluton : demi-grand axe 42207 km, excentricité 0,10083580, inclinaison 0,050040°, nœud 333,699644°, périastre 305,468202°, anomalie moyenne 285,846456°, dans l'équateur de Pluton ; test à l'export : Horizons oui, Trek non.
  { id: 'styx', nom: 'Styx', type: 'satellite', parent: 'pluto', horizons: true, trek: false, ready: false, kepler: { a: 42207, e: 0.10083580, i: 0.050040, om: 333.699644, w: 305.468202, M0: 285.846456, unit: 'km', frame: 'pluto-equatorial' } },
// Fin de la table.
];
/**
 * Lune (centre de la Terre → centre de la Lune, écliptique) : éléments moyens à J2000 et dérives séculaires
 * (J. Meeus, « Astronomical Algorithms », chap. 47) ; nœud et périgée tournent (18,6 ans et 8,85 ans).
 */
// La Lune, à part : ses éléments ont des dérives.
export const MOON_KEPLER: Astre = {
  // Identité : satellite de la Terre ; absente de Horizons dans ce test, carte Trek présente.
  id: 'moon', nom: 'Lune', type: 'satellite', parent: 'earth', horizons: false, trek: true, ready: true,
  // Ses éléments d'orbite :
  kepler: {
    // demi-grand axe 384 400 km, excentricité 0,0549, inclinaison 5,145°, nœud, périgée et anomalie moyenne à J2000, dans l'écliptique ;
    a: 384_400, e: 0.0549, i: 5.145, om: 125.0445479, w: 318.0634, M0: 134.9633964, unit: 'km', frame: 'ecliptic',
    // dérives par siècle : le nœud recule, le périgée avance, et l'anomalie moyenne fait environ 1 325 tours.
    omDot: -1934.1362891, wDot: 6003.1500178, MDot: 477198.8675055,
  // Fin des éléments.
  },
// Fin de la Lune.
};

// Table identifiant → astre, pour retrouver un astre directement ; elle réunit la table et la Lune.
export const ASTRE_BY_ID = new Map([...ASTRES, MOON_KEPLER].map((a) => [a.id, a]));
