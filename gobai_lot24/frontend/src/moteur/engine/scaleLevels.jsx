// Niveau d'échelle de la vue, du pas de la porte au système solaire : un mot qui dit ce que montre l'écran pendant
// que le zoom glisse sans coupure d'un niveau à l'autre. Seuils en km au-dessus de l'astre dominant.

// Niveaux d'échelle de la Terre : altitude maximale en km, puis nom (début du tableau).
const EARTH_LEVELS = [
  // Rue, quartier, ville, région, pays et continent.
  [0.4, 'Rue'], [3, 'Quartier'], [40, 'Ville'], [400, 'Région'], [2500, 'Pays'], [9000, 'Continent'],
// Fin du tableau.
];
// Niveaux des autres astres : sol, relief et région.
const OTHER_LEVELS = [[3, 'Sol'], [400, 'Relief'], [9000, 'Région']];
// Niveaux de l'espace (début du tableau).
const SPACE_LEVELS = [
  // Planète, planète et satellites, système solaire interne.
  [120_000, 'Planète'], [3_000_000, 'Planète et satellites'], [700_000_000, 'Système solaire interne'],
// Fin du tableau.
];
// Nom du niveau le plus large.
export const OUTER_LEVEL = 'Système solaire';

/**
 * @param altitudeKm distance à la surface de l'astre dominant
 * @param earth      vrai si cet astre est la Terre (rues et villes), faux pour un autre astre (sol et relief)
 * @param star       vrai si cet astre est le Soleil : pas de « planète » autour de lui
 */
// Déclare et exporte scaleLevel : l'altitude en km et la nature de l'astre.
export function scaleLevel(altitudeKm, { earth = false, star = false } = {}) {
  // L'altitude, convertie en nombre.
  const km = Number(altitudeKm);
  // Illisible : pas de niveau.
  if (!Number.isFinite(km)) return '';
  // Autour du Soleil : « Soleil », puis le système solaire interne, puis le niveau le plus large.
  if (star) return km < 3_000_000 ? 'Soleil' : km < 700_000_000 ? 'Système solaire interne' : OUTER_LEVEL;
  // Parcourt les niveaux de l'astre puis ceux de l'espace : le premier dont le seuil dépasse l'altitude.
  for (const [max, name] of [...(earth ? EARTH_LEVELS : OTHER_LEVELS), ...SPACE_LEVELS]) if (km < max) return name;
  // Au-delà de tous les seuils : le niveau le plus large.
  return OUTER_LEVEL;
// Fin de scaleLevel.
}
