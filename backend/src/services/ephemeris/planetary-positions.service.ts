// Service injecté par NestJS.
import { Injectable } from '@nestjs/common';
// Table des planètes et de leurs éléments d'orbite.
import { PLANETS } from '../data/bodies.data';
// Calcul local des orbites : échelles de temps, positions, vitesses, centre de la Terre.
import { AU_KM, Vec3, centuriesTT, earthPosition, heliocentricState, julianDay } from './planet-orbits';

/** Minutes que met la lumière du Soleil pour parcourir une unité astronomique. */
const LIGHT_MINUTES_PER_AU = 8.316746;

/**
 * Positions des planètes à un instant donné, calculées sur place.
 *
 * Chaque état est rendu avec ses métadonnées — époque et échelle de temps, centre, repère, unités, modèle et
 * précision — comme le recommande le contrat de données du dossier « API & méthodes de calcul des orbites
 * planétaires » (§ 6) : deux positions ne se comparent que si l'on sait de quel repère et de quel instant elles
 * viennent. Aucun service d'éphémérides n'est interrogé : la table d'éléments est versionnée dans le dépôt.
 */
@Injectable()
// Classe du service des éphémérides planétaires.
export class EphemerisService {
  /** Jour julien d'un instant (ms depuis l'epoch Unix), en UTC. */
  julianDay(timeMs: number): number {
    // Délègue au module de calcul.
    return julianDay(timeMs);
  // Fin de julianDay.
  }

  /**
   * Position héliocentrique (UA) à `T` siècles juliens de Temps terrestre depuis J2000, dans le repère
   * de la scène (x, z-écliptique, −y).
   */
  heliocentric(el: readonly number[], T: number): Vec3 {
    // Position dans l'écliptique.
    const [x, y, z] = heliocentricState(el, T).position;
    // Rendue dans le repère de la scène.
    return [x, z, -y];
  // Fin de heliocentric.
  }

  /** Positions de toutes les planètes à l'instant donné (défaut : maintenant). */
  snapshot(timeMs: number = Date.now()) {
    // Jour julien UTC, et siècles de Temps terrestre : les éléments d'orbite se comptent en Temps terrestre.
    const jd = julianDay(timeMs);
    const T = centuriesTT(timeMs);
    // L'instantané complet.
    return {
      time: new Date(timeMs).toISOString(),
      julianDay: jd,
      // Métadonnées communes à tous les états (contrat de données).
      timeScale: 'UTC en entrée, Temps terrestre (TT) pour le calcul des orbites',
      center: 'Centre du Soleil',
      frame: 'Écliptique J2000, repère de la scène (x, z, −y de l’écliptique)',
      unit: 'UA et UA/jour',
      model: 'VSOP87A complet (Bretagnon & Francou, 1988) pour les huit planètes ; Kepler pour les corps non couverts ; Lune : ELP',
      accuracy: 'Écart mesuré de 7 708 km sur Mars face à la référence JPL au 1er janvier 2026 ; précision dépendante du corps et de l’époque',
      // Un état par planète.
      planets: PLANETS.map((p) => {
        // Position et vitesse dans l'écliptique.
        const { position, velocity } = heliocentricState(p.elements, T);
        // La Terre : le centre, et non le barycentre Terre–Lune de la table d'éléments.
        const ecl = p.earth ? earthPosition(p.elements, T) : position;
        // Repère de la scène.
        const au: Vec3 = [ecl[0], ecl[2], -ecl[1]];
        // Distance au Soleil.
        const distanceAu = Math.hypot(...au);
        // L'état de cette planète.
        return {
          name: p.name,
          au,
          auPerDay: [velocity[0], velocity[2], -velocity[1]] as Vec3,
          distanceAu,
          speedKmS: (Math.hypot(...velocity) * AU_KM) / 86_400,
          lightMinutes: distanceAu * LIGHT_MINUTES_PER_AU,
        };
      // Fin des planètes.
      }),
    };
  // Fin de snapshot.
  }
// Fin du service.
}
