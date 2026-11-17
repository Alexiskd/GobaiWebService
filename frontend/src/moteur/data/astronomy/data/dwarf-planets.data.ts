/**
 * Planètes naines : données statiques versionnées dans le frontend. Les positions sont calculées localement ;
 * aucune requête Horizons ou backend n'est nécessaire à l'exécution. Pluton reste dans la table principale.
 */
// Type (effacé à la compilation) des données d'une planète.
import type { PlanetData } from './bodies.data';

/**
 * Orbites statiques embarquées, calculées localement par le moteur Kepler de Gobai.
 * Les éléments osculateurs ont pour époque JD 2460800.5 (2025-05-05 TDB),
 * puis sont ramenés à J2000 dans le format séculaire commun de la scène.
 * Source des solutions orbitales : LESIA / Lucky Star (solutions NIMA récentes,
 * objets 136108, 136472 et 136199). La propagation à deux corps est une
 * approximation de visualisation : ce n'est pas une intégration N-corps Horizons.
 */
export const DWARF_PLANETS_DATA: PlanetData[] = [
  {
    name: 'Cérès', radius: 0.07372, rotation: 0.37809, dwarf: true, color: '#9b9289',
    elements: [2.766496019994375, 0, 0.0783756264716301, 0, 10.58336045805628, 0, 160.5938747289855, 7823.46643894463, 154.41722021580495, 0, 80.49435747295279, 0],
  },
  {
    name: 'Hauméa', radius: 0.1280803642, rotation: 0.1631, dwarf: true, color: '#c7b9a5',
    // a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω' ; époque des données source : JD 2460800.5.
    elements: [42.961036, 0, 0.197030920, 0, 28.208341270, 0, 191.970929695, 127.845449057, 2.801686, 0, 121.825350, 0],
  },
  {
    name: 'Makémaké', radius: 0.1122272799, rotation: 0.9366, dwarf: true, color: '#c9a77b',
    elements: [45.449541, 0, 0.161939389, 0, 29.033860700, 0, 155.265298629, 117.489638067, 16.211170, 0, 79.259662, 0],
  },
  {
    name: 'Éris', radius: 0.1825459112, rotation: 15.8, dwarf: true, color: '#d7dce2',
    elements: [68.051454, 0, 0.435672472, 0, 43.821688673, 0, 21.545627873, 64.126543045, 186.757795, 0, 36.045998, 0],
  },
];

