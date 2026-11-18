// Flux cognitif mondial : nombre de pensées humaines produites dans le monde, par seconde, par jour et par an.
//
// Relation :   F(t) = P(t) × p
//   P(t) : population mondiale à l'instant t (compteur en direct, voir worldPopulation) ;
//   p    : pensées par jour et par personne — 6 200, le nombre moyen de transitions de pensée mesuré chez l'adulte
//          par Tseng et Poppenk (Université Queen's, Nature Communications, 2020).
// F(t) est un flux par jour ; divisé par 86 400 il devient un flux par seconde, multiplié par 365,25 un flux par an.
// C'est un ordre de grandeur : la mesure porte sur des adultes éveillés, et elle est appliquée ici à toute la population.

/** Pensées par jour et par personne (Tseng et Poppenk, 2020). */
// Pensées par jour et par personne : 6 200.
export const PENSEES_PAR_JOUR = 6200;
/** Ancienne estimation haute, souvent citée et sans mesure directe : repère de comparaison seulement. */
// Ancienne estimation haute : 60 000.
export const PENSEES_PAR_JOUR_HAUTE = 60000;

// Secondes dans un jour.
const SECONDES_PAR_JOUR = 86400;
// Jours dans une année.
const JOURS_PAR_AN = 365.25;

/**
 * Population mondiale au 1er juillet de chaque année : Nations unies, World Population Prospects 2024 (variante
 * moyenne). Le compteur en direct est l'interpolation linéaire entre deux de ces dates — la méthode des compteurs
 * publics de population ; personne ne compte les habitants de la Terre en temps réel.
 */
// Table de la population mondiale, par année :
export const POPULATION_ONU: ReadonlyArray<readonly [year: number, population: number]> = [
  // 2024 à 2028 ;
  [2024, 8_161_972_572], [2025, 8_231_613_070], [2026, 8_300_678_395], [2027, 8_369_094_344], [2028, 8_436_618_886],
  // 2029 à 2033 ;
  [2029, 8_503_285_323], [2030, 8_569_124_911], [2031, 8_634_119_333], [2032, 8_698_229_812], [2033, 8_761_449_081],
  // 2034 à 2038 ;
  [2034, 8_823_784_909], [2035, 8_885_210_181], [2036, 8_945_686_614], [2037, 9_005_152_624], [2038, 9_063_572_926],
  // 2039 à 2043 ;
  [2039, 9_120_928_380], [2040, 9_177_190_203], [2041, 9_232_281_575], [2042, 9_286_110_371], [2043, 9_338_661_314],
  // 2044 à 2046.
  [2044, 9_389_873_693], [2045, 9_439_639_668], [2046, 9_487_889_604],
// Fin de la table.
];

// Fonction midYear : le 1er juillet d'une année, en millisecondes.
const midYear = (year: number): number => Date.UTC(year, 6, 1);

/**
 * Population mondiale estimée à l'instant `ms` (millisecondes Unix, maintenant par défaut). Hors des années de la
 * table, la pente du premier ou du dernier intervalle est prolongée.
 */
// Fonction worldPopulation.
export function worldPopulation(ms: number = Date.now()): number {
  // Rang du dernier intervalle de la table.
  const last = POPULATION_ONU.length - 2;
  // Rang de l'intervalle courant.
  let i = 0;
  // Avance tant que l'instant dépasse la date suivante.
  while (i < last && ms >= midYear(POPULATION_ONU[i + 1][0])) i++;
  // Année et population du début de l'intervalle.
  const [y0, p0] = POPULATION_ONU[i];
  // Année et population de sa fin.
  const [y1, p1] = POPULATION_ONU[i + 1];
  // Instant du début.
  const t0 = midYear(y0);
  // Interpolation entre les deux populations.
  return p0 + ((p1 - p0) * (ms - t0)) / (midYear(y1) - t0);
// Fin de worldPopulation.
}

/** Croissance de la population à l'instant `ms`, en personnes par seconde (naissances moins décès). */
// Fonction populationGrowthPerSecond.
export function populationGrowthPerSecond(ms: number = Date.now()): number {
  // Population dans une seconde, moins la population maintenant.
  return worldPopulation(ms + 1000) - worldPopulation(ms);
// Fin de populationGrowthPerSecond.
}

// Forme du flux cognitif.
export interface FluxCognitif {
  // population : la population.
  population: number;
  // penseesParJour : pensées par jour et par personne.
  penseesParJour: number;
  // parSeconde : le flux par seconde.
  parSeconde: number;
  // parJour : le flux par jour.
  parJour: number;
  // parAn : le flux par an.
  parAn: number;
// Fin de FluxCognitif.
}

/** La relation F = P × p, donnée par seconde, par jour et par an. */
// Fonction fluxCognitif.
export function fluxCognitif(population: number, penseesParJour: number = PENSEES_PAR_JOUR): FluxCognitif {
  // Flux par jour : la population fois les pensées par personne.
  const parJour = population * penseesParJour;
  // Renvoie les cinq valeurs.
  return { population, penseesParJour, parSeconde: parJour / SECONDES_PAR_JOUR, parJour, parAn: parJour * JOURS_PAR_AN };
// Fin de fluxCognitif.
}

/** Flux cognitif mondial à l'instant `ms`, avec la population du compteur en direct. */
// Fonction fluxCognitifEnDirect.
export function fluxCognitifEnDirect(ms: number = Date.now(), penseesParJour: number = PENSEES_PAR_JOUR): FluxCognitif {
  // Le flux pour la population de cet instant.
  return fluxCognitif(worldPopulation(ms), penseesParJour);
// Fin de fluxCognitifEnDirect.
}

/** Points de la courbe F(t), un par année de la table : [année (1er juillet), pensées par jour]. */
// Fonction fluxCurve.
export function fluxCurve(penseesParJour: number = PENSEES_PAR_JOUR): [year: number, parJour: number][] {
  // Un point par année : l'année et le flux par jour.
  return POPULATION_ONU.map(([year, population]) => [year, population * penseesParJour]);
// Fin de fluxCurve.
}

/** Année décimale d'un instant (2026,86 pour le 11 novembre 2026), pour placer « maintenant » sur la courbe. */
// Fonction decimalYear.
export function decimalYear(ms: number = Date.now()): number {
  // Année de l'instant.
  const year = new Date(ms).getUTCFullYear();
  // Début de cette année.
  const start = Date.UTC(year, 0, 1);
  // L'année, plus la part écoulée.
  return year + (ms - start) / (Date.UTC(year + 1, 0, 1) - start);
// Fin de decimalYear.
}
