export interface PlanetData {
  name: string;
  /** rayon, en rayons terrestres */
  radius: number;
  /** période de rotation en jours (négatif = rétrograde) */
  rotation: number;
  earth?: true;
  mars?: true;
  mercury?: true;
  ring?: true;
  color: string;
  /** éléments képlériens JPL (J2000 + dérive par siècle) : a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω' */
  elements: number[];
}

export const SUN = { name: 'Soleil', radius: 109.2, color: '#ffb300' };
export const MOON = { name: 'Lune', radius: 0.273 };

export const PLANETS: PlanetData[] = [
  {
    "name": "Mercure",
    "radius": 0.383,
    "rotation": 58.65,
    "mercury": true,
    "color": "#b5b5b5",
    "elements": [
      0.38709927,
      3.7e-7,
      0.20563593,
      0.00001906,
      7.00497902,
      -0.00594749,
      252.2503235,
      149472.67411175,
      77.45779628,
      0.16047689,
      48.33076593,
      -0.12534081
    ]
  },
  {
    "name": "Vénus",
    "radius": 0.949,
    "rotation": -243,
    "color": "#e8c27a",
    "elements": [
      0.72333566,
      0.0000039,
      0.00677672,
      -0.00004107,
      3.39467605,
      -0.0007889,
      181.9790995,
      58517.81538729,
      131.60246718,
      0.00268329,
      76.67984255,
      -0.27769418
    ]
  },
  {
    "name": "Terre",
    "radius": 1,
    "rotation": 0.9973,
    "earth": true,
    "color": "#3d8bff",
    "elements": [
      1.00000261,
      0.00000562,
      0.01671123,
      -0.00004392,
      -0.00001531,
      -0.01294668,
      100.46457166,
      35999.37244981,
      102.93768193,
      0.32327364,
      0,
      0
    ]
  },
  {
    "name": "Mars",
    "radius": 0.532,
    "rotation": 1.026,
    "mars": true,
    "color": "#e0553a",
    "elements": [
      1.52371034,
      0.00001847,
      0.0933941,
      0.00007882,
      1.84969142,
      -0.00813131,
      -4.55343205,
      19140.30268499,
      -23.94362959,
      0.44441088,
      49.55953891,
      -0.29257343
    ]
  },
  {
    "name": "Jupiter",
    "radius": 11.21,
    "rotation": 0.4135,
    "color": "#d9a066",
    "elements": [
      5.202887,
      -0.00011607,
      0.04838624,
      -0.00013253,
      1.30439695,
      -0.00183714,
      34.39644051,
      3034.74612775,
      14.72847983,
      0.21252668,
      100.47390909,
      0.20469106
    ]
  },
  {
    "name": "Saturne",
    "radius": 9.45,
    "rotation": 0.444,
    "ring": true,
    "color": "#f0dc9a",
    "elements": [
      9.53667594,
      -0.0012506,
      0.05386179,
      -0.00050991,
      2.48599187,
      0.00193609,
      49.95424423,
      1222.49362201,
      92.59887831,
      -0.41897216,
      113.66242448,
      -0.28867794
    ]
  },
  {
    "name": "Uranus",
    "radius": 4.01,
    "rotation": -0.718,
    "color": "#7fe3ee",
    "elements": [
      19.18916464,
      -0.00196176,
      0.04725744,
      -0.00004397,
      0.77263783,
      -0.00242939,
      313.23810451,
      428.48202785,
      170.9542763,
      0.40805281,
      74.01692503,
      0.0424058
    ]
  },
  {
    "name": "Neptune",
    "radius": 3.88,
    "rotation": 0.671,
    "color": "#4a6bff",
    "elements": [
      30.06992276,
      0.00026291,
      0.00859048,
      0.00005105,
      1.77004347,
      0.00035372,
      -55.12002969,
      218.45945325,
      44.96476227,
      -0.32241464,
      131.78422574,
      -0.00508664
    ]
  }
];
