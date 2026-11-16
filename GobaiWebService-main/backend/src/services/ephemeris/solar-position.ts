/**
 * Position du Soleil vue de la Terre, calculée sur place.
 *
 * Le Soleil est au centre du repère héliocentrique : il n'a donc pas d'orbite à calculer. Ce que l'on vend et
 * ce que l'on affiche, c'est sa position **apparente** depuis la Terre, qui est l'opposé de la position
 * héliocentrique de la Terre. Le calcul enchaîne :
 *
 *   1. position héliocentrique de la Terre par la série VSOP87A (planet-orbits) ;
 *   2. vecteur Terre → Soleil : l'opposé du précédent ;
 *   3. longitude et latitude écliptiques, puis ascension droite et déclinaison par l'obliquité J2000 ;
 *   4. point de la Terre où le Soleil est au zénith, par le temps sidéral de Greenwich.
 *
 * Aucun service d'éphémérides n'est interrogé : même série VSOP87A et même échelle de temps (Temps terrestre) que
 * la scène 3D, donc les mêmes chiffres partout.
 *
 * Précision du vecteur héliocentrique : celle de VSOP87A. Le point sous-solaire dépend aussi du modèle de rotation
 * du corps et de l'approximation UT1 = UTC pour le temps sidéral.
 */
import { AU_KM, J2000_JD, Vec3, centuriesTT, earthPosition, julianDay } from './planet-orbits';
import { eclipticToEquatorial, wrap180 } from '../sun/subsolar';

/** Degrés par radian. */
const DEG = 180 / Math.PI;

/** Angle ramené dans [0, 360[. */
const wrap360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Temps sidéral moyen de Greenwich, en degrés, pour un instant UTC.
 *
 * Formule de l'IERS (Aoki et al. 1982, reprise par l'Almanach astronomique) : le terme linéaire vaut
 * 360,985 647 366 29° par jour, soit un tour sidéral en 23 h 56 min 4 s. UT1 est confondu avec UTC : l'écart
 * (moins d'une seconde) vaut moins de 0,005° sur le résultat.
 */
export function gmstDeg(ms: number): number {
  // Jours écoulés depuis J2000, en temps universel.
  const d = julianDay(ms) - J2000_JD;
  // Siècles juliens, pour les deux petits termes.
  const T = d / 36_525;
  // L'angle, ramené dans un tour.
  return wrap360(280.460_618_37 + 360.985_647_366_29 * d + 0.000_387_933 * T * T - (T * T * T) / 38_710_000);
// Fin de gmstDeg.
}

/** Position apparente du Soleil, vue du centre de la Terre. */
export interface SolarPosition {
  /** Vecteur Terre → Soleil, en unités astronomiques, dans l'écliptique J2000. */
  au: Vec3;
  /** Le même vecteur, en kilomètres. */
  km: Vec3;
  /** Distance Terre–Soleil, en unités astronomiques. */
  distanceAu: number;
  /** Distance Terre–Soleil, en kilomètres. */
  distanceKm: number;
  /** Longitude écliptique apparente, en degrés [0, 360[. */
  eclipticLonDeg: number;
  /** Latitude écliptique apparente, en degrés (toujours très proche de zéro). */
  eclipticLatDeg: number;
  /** Ascension droite, en degrés [0, 360[. */
  rightAscensionDeg: number;
  /** Déclinaison, en degrés : elle donne la saison (±23,44° aux solstices). */
  declinationDeg: number;
  /** Point de la Terre où le Soleil est au zénith : longitude est dans [-180, 180[, latitude en degrés. */
  subSolar: { lon: number; lat: number };
}

/**
 * Position apparente du Soleil pour un instant donné.
 * `earthElements` : identifiant historique du tableau d'éléments de la Terre, utilisé pour sélectionner la série VSOP87A.
 */
export function solarPosition(earthElements: readonly number[], ms: number): SolarPosition {
  // Siècles de Temps terrestre depuis J2000.
  const T = centuriesTT(ms);
  // Position héliocentrique du centre de la Terre (et non du barycentre Terre–Lune).
  const earth = earthPosition(earthElements, T);
  // Vecteur Terre → Soleil : l'opposé.
  const au: Vec3 = [-earth[0], -earth[1], -earth[2]];
  // Distance, en unités astronomiques.
  const r = Math.hypot(au[0], au[1], au[2]);
  // Longitude écliptique.
  const eclipticLonDeg = wrap360(Math.atan2(au[1], au[0]) * DEG);
  // Latitude écliptique.
  const eclipticLatDeg = Math.asin(au[2] / r) * DEG;
  // Passage dans l'équateur céleste J2000 : la rotation garde la longueur du vecteur.
  const [X, Y, Z] = eclipticToEquatorial(au);
  // Ascension droite.
  const rightAscensionDeg = wrap360(Math.atan2(Y, X) * DEG);
  // Déclinaison.
  const declinationDeg = Math.asin(Z / r) * DEG;
  // La position complète.
  return {
    au,
    km: [au[0] * AU_KM, au[1] * AU_KM, au[2] * AU_KM],
    distanceAu: r,
    distanceKm: r * AU_KM,
    eclipticLonDeg,
    eclipticLatDeg,
    rightAscensionDeg,
    declinationDeg,
    // Le Soleil est au zénith là où son angle horaire est nul : longitude = ascension droite − temps sidéral.
    subSolar: { lon: wrap180(rightAscensionDeg - gmstDeg(ms)), lat: declinationDeg },
  };
// Fin de solarPosition.
}
