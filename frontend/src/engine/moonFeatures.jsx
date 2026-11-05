// Lieux de la Lune (coordonnées sélénographiques, longitude Est positive). Sources : NASA NSSDCA (sites d'alunissage),
// nomenclature planétaire de l'UAI / USGS (mers et cratères).
// type : 'landing' (alunissage), 'mare' (mer, océan, bassin), 'crater' (cratère), 'region' (zone d'intérêt).
// native / script : nom dans l'écriture locale (les lieux russes s'affichent en cyrillique, le nom international reste
// dans l'infobulle).
// tier : 0 = repère majeur, 1 = important, 2 = secondaire. Il fixe la taille de l'étiquette et l'ordre
// d'affichage : les grands repères restent visibles de loin, les petits n'apparaissent qu'en zoomant.

const RAW_FEATURES = [
  // Missions habitées Apollo
  { name: 'Apollo 11', type: 'landing', lat: 0.674, lon: 23.473, info: 'Juillet 1969 · Armstrong, Aldrin · Mer de la Tranquillité' },
  { name: 'Apollo 12', type: 'landing', lat: -3.012, lon: -23.422, info: 'Novembre 1969 · Conrad, Bean · Océan des Tempêtes' },
  { name: 'Apollo 14', type: 'landing', lat: -3.645, lon: -17.471, info: 'Février 1971 · Shepard, Mitchell · Fra Mauro' },
  { name: 'Apollo 15', type: 'landing', lat: 26.132, lon: 3.634, info: 'Juillet 1971 · Scott, Irwin · Hadley-Apennin' },
  { name: 'Apollo 16', type: 'landing', lat: -8.973, lon: 15.5, info: 'Avril 1972 · Young, Duke · Descartes' },
  { name: 'Apollo 17', type: 'landing', lat: 20.191, lon: 30.772, info: 'Décembre 1972 · Cernan, Schmitt · Taurus-Littrow' },
  // Sondes automatiques
  { name: 'Chang’e 4', type: 'landing', lat: -45.44, lon: 177.6, info: 'Janvier 2019 · premier alunissage sur la face cachée (CNSA) · cratère Von Kármán' },
  { name: 'Chang’e 6', type: 'landing', lat: -41.64, lon: -153.99, info: 'Juin 2024 · premiers échantillons de la face cachée (CNSA) · bassin Apollo' },
  { name: 'Chandrayaan-3', type: 'landing', lat: -69.37, lon: 32.32, info: 'Août 2023 · Vikram et Pragyan (ISRO) · près du pôle Sud' },
  { name: 'Chang’e 5', type: 'landing', lat: 43.06, lon: -51.92, info: 'Décembre 2020 · retour d’échantillons (CNSA) · Mons Rümker' },
  { name: 'Chang’e 3', type: 'landing', lat: 44.12, lon: -19.51, info: 'Décembre 2013 · rover Yutu (CNSA) · Mer des Pluies' },
  { name: 'SLIM', type: 'landing', lat: -13.32, lon: 25.25, info: 'Janvier 2024 · atterrisseur de précision (JAXA) · cratère Shioli' },
  { name: 'IM-1 Odysseus', type: 'landing', lat: -80.13, lon: 1.44, info: 'Février 2024 · Intuitive Machines · Malapert A' },
  { name: 'Blue Ghost 1', type: 'landing', lat: 18.56, lon: 61.81, info: 'Mars 2025 · Firefly Aerospace · Mer des Crises' },
  { name: 'Luna 9', native: 'Луна-9', script: 'cyrillic', type: 'landing', lat: 7.08, lon: -64.37, info: 'Février 1966 · premier atterrissage en douceur (URSS)' },
  { name: 'Luna 16', native: 'Луна-16', script: 'cyrillic', type: 'landing', lat: -0.513, lon: 56.364, info: 'Septembre 1970 · premier retour automatique d’échantillons (URSS)' },
  { name: 'Lunokhod 1', native: 'Луноход-1', script: 'cyrillic', type: 'landing', lat: 38.24, lon: -35.0, info: 'Novembre 1970 · premier rover (Luna 17, URSS)' },
  { name: 'Luna 24', native: 'Луна-24', script: 'cyrillic', type: 'landing', lat: 12.71, lon: 62.21, info: 'Août 1976 · échantillons de la Mer des Crises (URSS)' },
  { name: 'Surveyor 1', type: 'landing', lat: -2.47, lon: -43.34, info: 'Juin 1966 · premier atterrisseur américain' },

  // Mers, océan et bassins
  { name: 'Océan des Tempêtes', type: 'mare', lat: 18.4, lon: -57.4 },
  { name: 'Mer des Pluies', type: 'mare', lat: 32.8, lon: -15.6 },
  { name: 'Mer de la Tranquillité', type: 'mare', lat: 8.5, lon: 31.4 },
  { name: 'Mer de la Sérénité', type: 'mare', lat: 28.0, lon: 17.5 },
  { name: 'Mer des Crises', type: 'mare', lat: 17.0, lon: 59.1 },
  { name: 'Mer de la Fécondité', type: 'mare', lat: -7.8, lon: 51.3 },
  { name: 'Mer du Nectar', type: 'mare', lat: -15.2, lon: 35.5 },
  { name: 'Mer des Nuées', type: 'mare', lat: -21.3, lon: -16.6 },
  { name: 'Mer des Humeurs', type: 'mare', lat: -24.4, lon: -38.6 },
  { name: 'Mer du Froid', type: 'mare', lat: 56.0, lon: 1.4 },
  { name: 'Mer des Vapeurs', type: 'mare', lat: 13.3, lon: 3.6 },
  { name: 'Mer de Moscou', native: 'Море Москвы', script: 'cyrillic', type: 'mare', lat: 27.3, lon: 147.9, info: 'Une des rares mers de la face cachée' },
  { name: 'Mer Orientale', type: 'mare', lat: -19.4, lon: -92.8, info: 'Bassin d’impact en anneaux, au bord ouest' },
  { name: 'Mer de Smyth', type: 'mare', lat: 1.3, lon: 87.5 },
  { name: 'Mer Australe', type: 'mare', lat: -38.9, lon: 93.0 },
  { name: 'Bassin Pôle Sud–Aitken', type: 'mare', lat: -53.0, lon: -169.0, info: 'Plus grand bassin d’impact de la Lune (≈ 2 500 km)' },

  // Cratères
  { name: 'Tycho', type: 'crater', lat: -43.31, lon: -11.36, info: '85 km · rayons brillants visibles à l’œil nu' },
  { name: 'Copernic', type: 'crater', lat: 9.62, lon: -20.08, info: '93 km' },
  { name: 'Kepler', type: 'crater', lat: 8.1, lon: -38.0, info: '31 km' },
  { name: 'Aristarque', type: 'crater', lat: 23.7, lon: -47.4, info: '40 km · point le plus brillant de la face visible' },
  { name: 'Platon', type: 'crater', lat: 51.62, lon: -9.38, info: '101 km' },
  { name: 'Clavius', type: 'crater', lat: -58.4, lon: -14.4, info: '225 km' },
  { name: 'Ptolémée', type: 'crater', lat: -9.2, lon: -1.8, info: '153 km' },
  { name: 'Théophile', type: 'crater', lat: -11.4, lon: 26.4, info: '100 km' },
  { name: 'Langrenus', type: 'crater', lat: -8.9, lon: 61.1, info: '132 km' },
  { name: 'Petavius', type: 'crater', lat: -25.1, lon: 60.4, info: '177 km' },
  { name: 'Grimaldi', type: 'crater', lat: -5.2, lon: -68.6, info: '173 km' },
  { name: 'Tsiolkovski', native: 'Циолковский', script: 'cyrillic', type: 'crater', lat: -20.4, lon: 129.1, info: '185 km · fond de lave sombre, face cachée' },
  { name: 'Von Kármán', type: 'crater', lat: -44.5, lon: 175.9, info: '186 km' },
  { name: 'Apollo (bassin)', type: 'crater', lat: -36.1, lon: -151.8, info: '538 km' },
  { name: 'Korolev', native: 'Королёв', script: 'cyrillic', type: 'crater', lat: -4.4, lon: -157.4, info: '437 km' },
  { name: 'Shackleton', type: 'crater', lat: -89.67, lon: 129.78, info: '21 km · fond dans l’ombre permanente, au pôle Sud' },

  // Zones d'intérêt
  { name: 'Pôle Sud', type: 'region', lat: -90, lon: 0, info: 'Régions d’ombre permanente : glace d’eau probable' },
  { name: 'Pôle Nord', type: 'region', lat: 90, lon: 0 },
];

// Mers et bassins les plus étendus, plus les deux repères emblématiques de la face visible.
const TIER_0 = new Set([
  'Océan des Tempêtes', 'Mer des Pluies', 'Mer de la Tranquillité', 'Mer de la Sérénité', 'Mer des Crises',
  'Bassin Pôle Sud–Aitken', 'Tycho', 'Pôle Sud',
]);
// Cratères et bassins assez grands pour rester lisibles au-dessus du niveau des petits cratères.
const TIER_1_CRATERS = new Set([
  'Copernic', 'Clavius', 'Platon', 'Ptolémée', 'Langrenus', 'Petavius',
  'Grimaldi', 'Tsiolkovski', 'Von Kármán', 'Apollo (bassin)', 'Korolev',
]);
const TYPE_TIER = { landing: 1, mare: 1, crater: 2, region: 1 };

export const MOON_FEATURES = RAW_FEATURES
  .map((f) => ({ ...f, tier: TIER_0.has(f.name) ? 0 : TIER_1_CRATERS.has(f.name) ? 1 : TYPE_TIER[f.type] ?? 2 }))
  .sort((a, b) => a.tier - b.tier);

export const FEATURE_TYPES = {
  landing: { label: 'Sites d’alunissage', color: '#ffd166' },
  mare: { label: 'Mers et bassins', color: '#9ec5ff' },
  crater: { label: 'Cratères', color: '#e6e6e6' },
  region: { label: 'Zones d’intérêt', color: '#7ee0b5' },
};
