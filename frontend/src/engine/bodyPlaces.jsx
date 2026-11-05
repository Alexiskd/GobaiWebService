// Lieux remarquables par corps (longitude Est positive). Sources : nomenclature UAI/USGS (Mercure, Vénus, Mars),
// observations publiques pour les géantes gazeuses (les longitudes atmosphériques dérivent avec le temps).

const NAME_TO_ID = {
  Mercure: 'mercury',
  Vénus: 'venus',
  Terre: 'earth',
  Mars: 'mars',
  Jupiter: 'jupiter',
  Saturne: 'saturn',
  Uranus: 'uranus',
  Neptune: 'neptune',
};

/** Identifiant stable d'une planète à partir de sa définition renvoyée par l'API. */
export function bodyId(def) {
  return NAME_TO_ID[def.name] || def.name.toLowerCase();
}

const MARS = [
  { name: 'Olympus Mons', kind: 'Volcan', lat: 18.65, lon: 226.2, info: 'Plus haut volcan du système solaire (≈ 22 km)' },
  { name: 'Valles Marineris', kind: 'Canyon', lat: -14.0, lon: 300.8, info: '≈ 4 000 km de long, jusqu’à 7 km de profondeur' },
  { name: 'Tharsis', kind: 'Région volcanique', lat: 0.0, lon: 253.0, info: 'Renflement portant les plus grands volcans de Mars' },
  { name: 'Arsia Mons', kind: 'Volcan', lat: -8.9, lon: 239.9 },
  { name: 'Pavonis Mons', kind: 'Volcan', lat: 1.5, lon: 247.0 },
  { name: 'Ascraeus Mons', kind: 'Volcan', lat: 11.8, lon: 255.5 },
  { name: 'Elysium Mons', kind: 'Volcan', lat: 25.0, lon: 147.2 },
  { name: 'Hellas Planitia', kind: 'Bassin', lat: -42.4, lon: 70.5, info: 'Plus grand bassin d’impact visible de Mars' },
  { name: 'Utopia Planitia', kind: 'Plaine', lat: 46.7, lon: 117.5, info: 'Site d’atterrissage de Viking 2' },
  { name: 'Chryse Planitia', kind: 'Plaine', lat: 26.7, lon: 310.0, info: 'Site d’atterrissage de Viking 1' },
  { name: 'Jezero', kind: 'Site d’atterrissage', lat: 18.38, lon: 77.58, info: 'Cratère exploré par Perseverance (NASA, 2021)' },
  { name: 'Gale', kind: 'Site d’atterrissage', lat: -5.4, lon: 137.8, info: 'Cratère exploré par Curiosity (NASA, 2012)' },
  { name: 'Gusev', kind: 'Site d’atterrissage', lat: -14.5, lon: 175.4, info: 'Cratère exploré par Spirit (NASA, 2004)' },
  { name: 'Meridiani Planum', kind: 'Site d’atterrissage', lat: -1.95, lon: 354.47, info: 'Plaine explorée par Opportunity (NASA, 2004)' },
  { name: 'Pôle Nord', kind: 'Pôle', lat: 85.0, lon: 0.0, info: 'Calotte de glace d’eau et de CO₂' },
  { name: 'Pôle Sud', kind: 'Pôle', lat: -85.0, lon: 0.0, info: 'Calotte résiduelle de CO₂' },
];

const MERCURY = [
  { name: 'Caloris Planitia', kind: 'Bassin', lat: 30.5, lon: 170.2, info: 'Bassin d’impact de ≈ 1 550 km' },
  { name: 'Rachmaninoff', kind: 'Bassin', lat: 27.6, lon: 302.4, info: 'Bassin volcanique de ≈ 290 km' },
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0, info: 'Dépôts de glace dans les cratères jamais éclairés' },
];

const VENUS = [
  { name: 'Maxwell Montes', kind: 'Montagne', lat: 65.2, lon: 3.3, info: 'Plus haut relief de Vénus (≈ 11 km)' },
  { name: 'Ishtar Terra', kind: 'Région', lat: 70.0, lon: 27.0, info: 'Haut plateau de l’hémisphère nord' },
  { name: 'Aphrodite Terra', kind: 'Région', lat: -10.0, lon: 80.0, info: 'Vaste haut plateau équatorial' },
  { name: 'Atla Regio', kind: 'Région volcanique', lat: 5.0, lon: 200.0 },
  { name: 'Mead', kind: 'Cratère', lat: 12.5, lon: 57.2, info: 'Plus grand cratère d’impact de Vénus' },
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0 },
];

const JUPITER = [
  { name: 'Grande Tache rouge', kind: 'Anticyclone', lat: -22.0, lon: 0.0, info: 'Tempête plus large que la Terre · longitude variable' },
  { name: 'Oval BA', kind: 'Anticyclone', lat: -33.0, lon: 0.0, info: '« Tache rouge junior » · longitude variable' },
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0, info: 'Cyclones polaires groupés en anneau' },
];

const SATURN = [
  { name: 'Hexagone polaire', kind: 'Structure atmosphérique', lat: 78.0, lon: 0.0, info: 'Courant-jet hexagonal stable autour du pôle nord' },
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0 },
];

const URANUS = [
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0, info: 'Axe de rotation presque couché dans le plan orbital' },
  { name: 'Tache sombre de 1986', kind: 'Observation', lat: -27.0, lon: 0.0, info: 'Tache observée par Voyager 2' },
];

const NEPTUNE = [
  { name: 'Grande Tache sombre', kind: 'Observation', lat: -22.0, lon: 0.0, info: 'Tempête observée par Voyager 2 en 1989' },
  { name: 'Pôle Sud', kind: 'Pôle', lat: -90.0, lon: 0.0 },
];

export const BODY_PLACES = {
  mercury: MERCURY,
  venus: VENUS,
  mars: MARS,
  jupiter: JUPITER,
  saturn: SATURN,
  uranus: URANUS,
  neptune: NEPTUNE,
};
