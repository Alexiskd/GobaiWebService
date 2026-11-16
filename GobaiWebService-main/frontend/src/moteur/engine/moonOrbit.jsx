// Tracé de l'orbite de la Lune autour de la Terre.
//
// Cas particulier du tracé générique BodyOrbit (bodyOrbit.jsx) : seule la Lune a ses positions calculées par le
// moteur lui-même (table JPL Horizons quand elle couvre l'instant, sinon théorie ELP), au lieu du moteur
// képlérien du backend. Tout le reste — fenêtre d'un mois sidéral centrée sur l'instant simulé, dégradé
// d'opacité, fermeture de la boucle, recalcul au fil du temps — est celui du tracé générique.
//
// Un mois sidéral centré sur l'instant simulé (½ mois passé, ½ mois à venir), calculé avec la même source que la
// position de la Lune : la ligne passe donc exactement par la Lune, et suit la précession de l'orbite au lieu
// d'être figée au chargement de la page. La ligne est la plus claire au niveau de la Lune et s'estompe en
// s'éloignant, dans les deux sens.

// Importe le tracé générique d'orbite.
import { BodyOrbit } from './bodyOrbit';
// Importe la durée du mois sidéral, le nombre de segments et l'intervalle de recalcul du tracé lunaire.
import { SIDEREAL_MONTH_MS, ORBIT_SAMPLES, ORBIT_REFRESH_MS } from './moonOrbitMath';

/**
 * Ligne de l'orbite lunaire, dans le repère écliptique de la scène centré sur la Terre (rayons terrestres).
 * @param positionAt (ms, out) => THREE.Vector3  position Terre → Lune à cet instant (mêmes calculs que la Lune affichée)
 */
// Déclare et exporte la classe MoonOrbit (début).
export class MoonOrbit extends BodyOrbit {
  // Constructeur : la couleur de la ligne (bleu-gris par défaut) et la fonction qui donne la position de la Lune à un instant.
  constructor({ color = 0x8fa3d0, positionAt }) {
    // Le tracé générique, réglé sur la Lune (début) :
    super({
      // la fonction qui donne sa position ;
      positionAt,
      // la couleur de la ligne ;
      color,
      // la durée d'un tour : le mois sidéral ;
      periodMs: SIDEREAL_MONTH_MS,
      // le nombre de segments du tracé ;
      samples: ORBIT_SAMPLES,
      // l'intervalle de recalcul : une heure simulée ;
      refreshMs: ORBIT_REFRESH_MS,
      // le nom de la ligne dans la scène.
      name: 'moon-orbit',
    // Fin du tracé générique.
    });
  // Fin du constructeur.
  }
// Fin de la classe MoonOrbit.
}
