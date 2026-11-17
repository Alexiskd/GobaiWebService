// Lieux remarquables par corps (longitude Est positive). Sources : nomenclature UAI/USGS (Mercure, Vénus, Mars),
// observations publiques pour les géantes gazeuses (les longitudes atmosphériques dérivent avec le temps).

// Table qui associe le nom français d'une planète à son identifiant (début).
const NAME_TO_ID = {
  // Mercure : identifiant « mercury ».
  Mercure: 'mercury',
  // Vénus : identifiant « venus ».
  Vénus: 'venus',
  // Terre : identifiant « earth ».
  Terre: 'earth',
  // Mars : identifiant « mars ».
  Mars: 'mars',
  // Jupiter : identifiant « jupiter ».
  Jupiter: 'jupiter',
  // Saturne : identifiant « saturn ».
  Saturne: 'saturn',
  // Uranus : identifiant « uranus ».
  Uranus: 'uranus',
  // Neptune : identifiant « neptune ».
  Neptune: 'neptune',
  // Pluton : identifiant « pluto ».
  Pluton: 'pluto',
  // Planètes naines importées de JPL Horizons : leur nom français porte des accents, leur identifiant non.
  // Cérès : identifiant « ceres ».
  'Cérès': 'ceres',
  // Haumea : identifiant « haumea ».
  Haumea: 'haumea',
  // Makemake : identifiant « makemake ».
  Makemake: 'makemake',
  // Éris : identifiant « eris ».
  'Éris': 'eris',
// Fin de la table.
};

/** Identifiant stable d'une planète à partir de sa définition renvoyée par l'API. */
// Déclare et exporte bodyId : la définition de la planète.
export function bodyId(def) {
  // Renvoie l'identifiant de la table, ou à défaut le nom en minuscules.
  return NAME_TO_ID[def.name] || def.name.toLowerCase();
// Fin de bodyId.
}

// Lieux de Mars (début de la liste).
const MARS = [
  // Olympus Mons : type « Volcan », latitude 18,65°, longitude est 226,2°, avec une note.
  { name: 'Olympus Mons', kind: 'Volcan', lat: 18.65, lon: 226.2, info: 'Plus haut volcan du système solaire (≈ 22 km)' },
  // Valles Marineris : type « Canyon », latitude −14,0°, longitude est 300,8°, avec une note.
  { name: 'Valles Marineris', kind: 'Canyon', lat: -14.0, lon: 300.8, info: '≈ 4 000 km de long, jusqu’à 7 km de profondeur' },
  // Tharsis : type « Région volcanique », latitude 0,0°, longitude est 253,0°, avec une note.
  { name: 'Tharsis', kind: 'Région volcanique', lat: 0.0, lon: 253.0, info: 'Renflement portant les plus grands volcans de Mars' },
  // Arsia Mons : type « Volcan », latitude −8,9°, longitude est 239,9°, sans note.
  { name: 'Arsia Mons', kind: 'Volcan', lat: -8.9, lon: 239.9 },
  // Pavonis Mons : type « Volcan », latitude 1,5°, longitude est 247,0°, sans note.
  { name: 'Pavonis Mons', kind: 'Volcan', lat: 1.5, lon: 247.0 },
  // Ascraeus Mons : type « Volcan », latitude 11,8°, longitude est 255,5°, sans note.
  { name: 'Ascraeus Mons', kind: 'Volcan', lat: 11.8, lon: 255.5 },
  // Elysium Mons : type « Volcan », latitude 25,0°, longitude est 147,2°, sans note.
  { name: 'Elysium Mons', kind: 'Volcan', lat: 25.0, lon: 147.2 },
  // Hellas Planitia : type « Bassin », latitude −42,4°, longitude est 70,5°, avec une note.
  { name: 'Hellas Planitia', kind: 'Bassin', lat: -42.4, lon: 70.5, info: 'Plus grand bassin d’impact visible de Mars' },
  // Utopia Planitia : type « Plaine », latitude 46,7°, longitude est 117,5°, avec une note.
  { name: 'Utopia Planitia', kind: 'Plaine', lat: 46.7, lon: 117.5, info: 'Site d’atterrissage de Viking 2' },
  // Chryse Planitia : type « Plaine », latitude 26,7°, longitude est 310,0°, avec une note.
  { name: 'Chryse Planitia', kind: 'Plaine', lat: 26.7, lon: 310.0, info: 'Site d’atterrissage de Viking 1' },
  // Jezero : type « Site d’atterrissage », latitude 18,38°, longitude est 77,58°, avec une note.
  { name: 'Jezero', kind: 'Site d’atterrissage', lat: 18.38, lon: 77.58, info: 'Cratère exploré par Perseverance (NASA, 2021)' },
  // Gale : type « Site d’atterrissage », latitude −5,4°, longitude est 137,8°, avec une note.
  { name: 'Gale', kind: 'Site d’atterrissage', lat: -5.4, lon: 137.8, info: 'Cratère exploré par Curiosity (NASA, 2012)' },
  // Gusev : type « Site d’atterrissage », latitude −14,5°, longitude est 175,4°, avec une note.
  { name: 'Gusev', kind: 'Site d’atterrissage', lat: -14.5, lon: 175.4, info: 'Cratère exploré par Spirit (NASA, 2004)' },
  // Meridiani Planum : type « Site d’atterrissage », latitude −1,95°, longitude est 354,47°, avec une note.
  { name: 'Meridiani Planum', kind: 'Site d’atterrissage', lat: -1.95, lon: 354.47, info: 'Plaine explorée par Opportunity (NASA, 2004)' },
  // Pôle Nord : type « Pôle », latitude 85,0°, longitude est 0,0°, avec une note.
  { name: 'Pôle Nord', kind: 'Pôle', lat: 85.0, lon: 0.0, info: 'Calotte de glace d’eau et de CO₂' },
  // Pôle Sud : type « Pôle », latitude −85,0°, longitude est 0,0°, avec une note.
  { name: 'Pôle Sud', kind: 'Pôle', lat: -85.0, lon: 0.0, info: 'Calotte résiduelle de CO₂' },
// Fin de la liste.
];

// Lieux de Mercure (début de la liste).
const MERCURY = [
  // Caloris Planitia : type « Bassin », latitude 30,5°, longitude est 170,2°, avec une note.
  { name: 'Caloris Planitia', kind: 'Bassin', lat: 30.5, lon: 170.2, info: 'Bassin d’impact de ≈ 1 550 km' },
  // Rachmaninoff : type « Bassin », latitude 27,6°, longitude est 302,4°, avec une note.
  { name: 'Rachmaninoff', kind: 'Bassin', lat: 27.6, lon: 302.4, info: 'Bassin volcanique de ≈ 290 km' },
  // Pôle Nord : type « Pôle », latitude 90,0°, longitude est 0,0°, avec une note.
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0, info: 'Dépôts de glace dans les cratères jamais éclairés' },
// Fin de la liste.
];

// Lieux de Vénus (début de la liste).
const VENUS = [
  // Maxwell Montes : type « Montagne », latitude 65,2°, longitude est 3,3°, avec une note.
  { name: 'Maxwell Montes', kind: 'Montagne', lat: 65.2, lon: 3.3, info: 'Plus haut relief de Vénus (≈ 11 km)' },
  // Ishtar Terra : type « Région », latitude 70,0°, longitude est 27,0°, avec une note.
  { name: 'Ishtar Terra', kind: 'Région', lat: 70.0, lon: 27.0, info: 'Haut plateau de l’hémisphère nord' },
  // Aphrodite Terra : type « Région », latitude −10,0°, longitude est 80,0°, avec une note.
  { name: 'Aphrodite Terra', kind: 'Région', lat: -10.0, lon: 80.0, info: 'Vaste haut plateau équatorial' },
  // Atla Regio : type « Région volcanique », latitude 5,0°, longitude est 200,0°, sans note.
  { name: 'Atla Regio', kind: 'Région volcanique', lat: 5.0, lon: 200.0 },
  // Mead : type « Cratère », latitude 12,5°, longitude est 57,2°, avec une note.
  { name: 'Mead', kind: 'Cratère', lat: 12.5, lon: 57.2, info: 'Plus grand cratère d’impact de Vénus' },
  // Pôle Nord : type « Pôle », latitude 90,0°, longitude est 0,0°, sans note.
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0 },
// Fin de la liste.
];

// Lieux de Jupiter (début de la liste).
const JUPITER = [
  // Grande Tache rouge : type « Anticyclone », latitude −22,0°, longitude est 0,0°, avec une note.
  { name: 'Grande Tache rouge', kind: 'Anticyclone', lat: -22.0, lon: 0.0, info: 'Tempête plus large que la Terre · longitude variable' },
  // Oval BA : type « Anticyclone », latitude −33,0°, longitude est 0,0°, avec une note.
  { name: 'Oval BA', kind: 'Anticyclone', lat: -33.0, lon: 0.0, info: '« Tache rouge junior » · longitude variable' },
  // Pôle Nord : type « Pôle », latitude 90,0°, longitude est 0,0°, avec une note.
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0, info: 'Cyclones polaires groupés en anneau' },
// Fin de la liste.
];

// Lieux de Saturne (début de la liste).
const SATURN = [
  // Hexagone polaire : type « Structure atmosphérique », latitude 78,0°, longitude est 0,0°, avec une note.
  { name: 'Hexagone polaire', kind: 'Structure atmosphérique', lat: 78.0, lon: 0.0, info: 'Courant-jet hexagonal stable autour du pôle nord' },
  // Pôle Nord : type « Pôle », latitude 90,0°, longitude est 0,0°, sans note.
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0 },
// Fin de la liste.
];

// Lieux de Uranus (début de la liste).
const URANUS = [
  // Pôle Nord : type « Pôle », latitude 90,0°, longitude est 0,0°, avec une note.
  { name: 'Pôle Nord', kind: 'Pôle', lat: 90.0, lon: 0.0, info: 'Axe de rotation presque couché dans le plan orbital' },
  // Tache sombre de 1986 : type « Observation », latitude −27,0°, longitude est 0,0°, avec une note.
  { name: 'Tache sombre de 1986', kind: 'Observation', lat: -27.0, lon: 0.0, info: 'Tache observée par Voyager 2' },
// Fin de la liste.
];

// Lieux de Neptune (début de la liste).
const NEPTUNE = [
  // Grande Tache sombre : type « Observation », latitude −22,0°, longitude est 0,0°, avec une note.
  { name: 'Grande Tache sombre', kind: 'Observation', lat: -22.0, lon: 0.0, info: 'Tempête observée par Voyager 2 en 1989' },
  // Pôle Sud : type « Pôle », latitude −90,0°, longitude est 0,0°, sans note.
  { name: 'Pôle Sud', kind: 'Pôle', lat: -90.0, lon: 0.0 },
// Fin de la liste.
];

// Déclare et exporte la table des lieux par identifiant d'astre (début).
export const BODY_PLACES = {
  // mercury : les lieux de Mercure.
  mercury: MERCURY,
  // venus : les lieux de Vénus.
  venus: VENUS,
  // mars : les lieux de Mars.
  mars: MARS,
  // jupiter : les lieux de Jupiter.
  jupiter: JUPITER,
  // saturn : les lieux de Saturne.
  saturn: SATURN,
  // uranus : les lieux de Uranus.
  uranus: URANUS,
  // neptune : les lieux de Neptune.
  neptune: NEPTUNE,
// Fin de la table.
};
