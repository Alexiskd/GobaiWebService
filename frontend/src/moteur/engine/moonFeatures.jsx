// Lieux de la Lune (coordonnées sélénographiques, longitude Est positive). Sources : NASA NSSDCA (sites d'alunissage),
// nomenclature planétaire de l'UAI / USGS (mers et cratères).
// type : 'landing' (alunissage), 'mare' (mer, océan, bassin), 'crater' (cratère), 'region' (zone d'intérêt).
// native / script : nom dans l'écriture locale (les lieux russes s'affichent en cyrillique, le nom international reste
// dans l'infobulle).
// tier : 0 = repère majeur, 1 = important, 2 = secondaire. Il fixe la taille de l'étiquette et l'ordre
// d'affichage : les grands repères restent visibles de loin, les petits n'apparaissent qu'en zoomant.

// Liste brute des lieux de la Lune (début).
const RAW_FEATURES = [
  // Missions habitées Apollo
  // Apollo 11 : site d'alunissage, latitude 0,674°, longitude 23,473°, avec une note.
  { name: 'Apollo 11', type: 'landing', lat: 0.674, lon: 23.473, info: 'Juillet 1969 · Armstrong, Aldrin · Mer de la Tranquillité' },
  // Apollo 12 : site d'alunissage, latitude −3,012°, longitude −23,422°, avec une note.
  { name: 'Apollo 12', type: 'landing', lat: -3.012, lon: -23.422, info: 'Novembre 1969 · Conrad, Bean · Océan des Tempêtes' },
  // Apollo 14 : site d'alunissage, latitude −3,645°, longitude −17,471°, avec une note.
  { name: 'Apollo 14', type: 'landing', lat: -3.645, lon: -17.471, info: 'Février 1971 · Shepard, Mitchell · Fra Mauro' },
  // Apollo 15 : site d'alunissage, latitude 26,132°, longitude 3,634°, avec une note.
  { name: 'Apollo 15', type: 'landing', lat: 26.132, lon: 3.634, info: 'Juillet 1971 · Scott, Irwin · Hadley-Apennin' },
  // Apollo 16 : site d'alunissage, latitude −8,973°, longitude 15,5°, avec une note.
  { name: 'Apollo 16', type: 'landing', lat: -8.973, lon: 15.5, info: 'Avril 1972 · Young, Duke · Descartes' },
  // Apollo 17 : site d'alunissage, latitude 20,191°, longitude 30,772°, avec une note.
  { name: 'Apollo 17', type: 'landing', lat: 20.191, lon: 30.772, info: 'Décembre 1972 · Cernan, Schmitt · Taurus-Littrow' },
  // Sondes automatiques
  // Chang’e 4 : site d'alunissage, latitude −45,44°, longitude 177,6°, avec une note.
  { name: 'Chang’e 4', type: 'landing', lat: -45.44, lon: 177.6, info: 'Janvier 2019 · premier alunissage sur la face cachée (CNSA) · cratère Von Kármán' },
  // Chang’e 6 : site d'alunissage, latitude −41,64°, longitude −153,99°, avec une note.
  { name: 'Chang’e 6', type: 'landing', lat: -41.64, lon: -153.99, info: 'Juin 2024 · premiers échantillons de la face cachée (CNSA) · bassin Apollo' },
  // Chandrayaan-3 : site d'alunissage, latitude −69,37°, longitude 32,32°, avec une note.
  { name: 'Chandrayaan-3', type: 'landing', lat: -69.37, lon: 32.32, info: 'Août 2023 · Vikram et Pragyan (ISRO) · près du pôle Sud' },
  // Chang’e 5 : site d'alunissage, latitude 43,06°, longitude −51,92°, avec une note.
  { name: 'Chang’e 5', type: 'landing', lat: 43.06, lon: -51.92, info: 'Décembre 2020 · retour d’échantillons (CNSA) · Mons Rümker' },
  // Chang’e 3 : site d'alunissage, latitude 44,12°, longitude −19,51°, avec une note.
  { name: 'Chang’e 3', type: 'landing', lat: 44.12, lon: -19.51, info: 'Décembre 2013 · rover Yutu (CNSA) · Mer des Pluies' },
  // SLIM : site d'alunissage, latitude −13,32°, longitude 25,25°, avec une note.
  { name: 'SLIM', type: 'landing', lat: -13.32, lon: 25.25, info: 'Janvier 2024 · atterrisseur de précision (JAXA) · cratère Shioli' },
  // IM-1 Odysseus : site d'alunissage, latitude −80,13°, longitude 1,44°, avec une note.
  { name: 'IM-1 Odysseus', type: 'landing', lat: -80.13, lon: 1.44, info: 'Février 2024 · Intuitive Machines · Malapert A' },
  // Blue Ghost 1 : site d'alunissage, latitude 18,56°, longitude 61,81°, avec une note.
  { name: 'Blue Ghost 1', type: 'landing', lat: 18.56, lon: 61.81, info: 'Mars 2025 · Firefly Aerospace · Mer des Crises' },
  // Luna 9 : site d'alunissage, latitude 7,08°, longitude −64,37°, nom local en cyrillique, avec une note.
  { name: 'Luna 9', native: 'Луна-9', script: 'cyrillic', type: 'landing', lat: 7.08, lon: -64.37, info: 'Février 1966 · premier atterrissage en douceur (URSS)' },
  // Luna 16 : site d'alunissage, latitude −0,513°, longitude 56,364°, nom local en cyrillique, avec une note.
  { name: 'Luna 16', native: 'Луна-16', script: 'cyrillic', type: 'landing', lat: -0.513, lon: 56.364, info: 'Septembre 1970 · premier retour automatique d’échantillons (URSS)' },
  // Lunokhod 1 : site d'alunissage, latitude 38,24°, longitude −35,0°, nom local en cyrillique, avec une note.
  { name: 'Lunokhod 1', native: 'Луноход-1', script: 'cyrillic', type: 'landing', lat: 38.24, lon: -35.0, info: 'Novembre 1970 · premier rover (Luna 17, URSS)' },
  // Luna 24 : site d'alunissage, latitude 12,71°, longitude 62,21°, nom local en cyrillique, avec une note.
  { name: 'Luna 24', native: 'Луна-24', script: 'cyrillic', type: 'landing', lat: 12.71, lon: 62.21, info: 'Août 1976 · échantillons de la Mer des Crises (URSS)' },
  // Surveyor 1 : site d'alunissage, latitude −2,47°, longitude −43,34°, avec une note.
  { name: 'Surveyor 1', type: 'landing', lat: -2.47, lon: -43.34, info: 'Juin 1966 · premier atterrisseur américain' },

  // Mers, océan et bassins
  // Océan des Tempêtes : mer ou bassin, latitude 18,4°, longitude −57,4°, sans note.
  { name: 'Océan des Tempêtes', type: 'mare', lat: 18.4, lon: -57.4 },
  // Mer des Pluies : mer ou bassin, latitude 32,8°, longitude −15,6°, sans note.
  { name: 'Mer des Pluies', type: 'mare', lat: 32.8, lon: -15.6 },
  // Mer de la Tranquillité : mer ou bassin, latitude 8,5°, longitude 31,4°, sans note.
  { name: 'Mer de la Tranquillité', type: 'mare', lat: 8.5, lon: 31.4 },
  // Mer de la Sérénité : mer ou bassin, latitude 28,0°, longitude 17,5°, sans note.
  { name: 'Mer de la Sérénité', type: 'mare', lat: 28.0, lon: 17.5 },
  // Mer des Crises : mer ou bassin, latitude 17,0°, longitude 59,1°, sans note.
  { name: 'Mer des Crises', type: 'mare', lat: 17.0, lon: 59.1 },
  // Mer de la Fécondité : mer ou bassin, latitude −7,8°, longitude 51,3°, sans note.
  { name: 'Mer de la Fécondité', type: 'mare', lat: -7.8, lon: 51.3 },
  // Mer du Nectar : mer ou bassin, latitude −15,2°, longitude 35,5°, sans note.
  { name: 'Mer du Nectar', type: 'mare', lat: -15.2, lon: 35.5 },
  // Mer des Nuées : mer ou bassin, latitude −21,3°, longitude −16,6°, sans note.
  { name: 'Mer des Nuées', type: 'mare', lat: -21.3, lon: -16.6 },
  // Mer des Humeurs : mer ou bassin, latitude −24,4°, longitude −38,6°, sans note.
  { name: 'Mer des Humeurs', type: 'mare', lat: -24.4, lon: -38.6 },
  // Mer du Froid : mer ou bassin, latitude 56,0°, longitude 1,4°, sans note.
  { name: 'Mer du Froid', type: 'mare', lat: 56.0, lon: 1.4 },
  // Mer des Vapeurs : mer ou bassin, latitude 13,3°, longitude 3,6°, sans note.
  { name: 'Mer des Vapeurs', type: 'mare', lat: 13.3, lon: 3.6 },
  // Mer de Moscou : mer ou bassin, latitude 27,3°, longitude 147,9°, nom local en cyrillique, avec une note.
  { name: 'Mer de Moscou', native: 'Море Москвы', script: 'cyrillic', type: 'mare', lat: 27.3, lon: 147.9, info: 'Une des rares mers de la face cachée' },
  // Mer Orientale : mer ou bassin, latitude −19,4°, longitude −92,8°, avec une note.
  { name: 'Mer Orientale', type: 'mare', lat: -19.4, lon: -92.8, info: 'Bassin d’impact en anneaux, au bord ouest' },
  // Mer de Smyth : mer ou bassin, latitude 1,3°, longitude 87,5°, sans note.
  { name: 'Mer de Smyth', type: 'mare', lat: 1.3, lon: 87.5 },
  // Mer Australe : mer ou bassin, latitude −38,9°, longitude 93,0°, sans note.
  { name: 'Mer Australe', type: 'mare', lat: -38.9, lon: 93.0 },
  // Bassin Pôle Sud–Aitken : mer ou bassin, latitude −53,0°, longitude −169,0°, avec une note.
  { name: 'Bassin Pôle Sud–Aitken', type: 'mare', lat: -53.0, lon: -169.0, info: 'Plus grand bassin d’impact de la Lune (≈ 2 500 km)' },

  // Cratères
  // Tycho : cratère, latitude −43,31°, longitude −11,36°, avec une note.
  { name: 'Tycho', type: 'crater', lat: -43.31, lon: -11.36, info: '85 km · rayons brillants visibles à l’œil nu' },
  // Copernic : cratère, latitude 9,62°, longitude −20,08°, avec une note.
  { name: 'Copernic', type: 'crater', lat: 9.62, lon: -20.08, info: '93 km' },
  // Kepler : cratère, latitude 8,1°, longitude −38,0°, avec une note.
  { name: 'Kepler', type: 'crater', lat: 8.1, lon: -38.0, info: '31 km' },
  // Aristarque : cratère, latitude 23,7°, longitude −47,4°, avec une note.
  { name: 'Aristarque', type: 'crater', lat: 23.7, lon: -47.4, info: '40 km · point le plus brillant de la face visible' },
  // Platon : cratère, latitude 51,62°, longitude −9,38°, avec une note.
  { name: 'Platon', type: 'crater', lat: 51.62, lon: -9.38, info: '101 km' },
  // Clavius : cratère, latitude −58,4°, longitude −14,4°, avec une note.
  { name: 'Clavius', type: 'crater', lat: -58.4, lon: -14.4, info: '225 km' },
  // Ptolémée : cratère, latitude −9,2°, longitude −1,8°, avec une note.
  { name: 'Ptolémée', type: 'crater', lat: -9.2, lon: -1.8, info: '153 km' },
  // Théophile : cratère, latitude −11,4°, longitude 26,4°, avec une note.
  { name: 'Théophile', type: 'crater', lat: -11.4, lon: 26.4, info: '100 km' },
  // Langrenus : cratère, latitude −8,9°, longitude 61,1°, avec une note.
  { name: 'Langrenus', type: 'crater', lat: -8.9, lon: 61.1, info: '132 km' },
  // Petavius : cratère, latitude −25,1°, longitude 60,4°, avec une note.
  { name: 'Petavius', type: 'crater', lat: -25.1, lon: 60.4, info: '177 km' },
  // Grimaldi : cratère, latitude −5,2°, longitude −68,6°, avec une note.
  { name: 'Grimaldi', type: 'crater', lat: -5.2, lon: -68.6, info: '173 km' },
  // Tsiolkovski : cratère, latitude −20,4°, longitude 129,1°, nom local en cyrillique, avec une note.
  { name: 'Tsiolkovski', native: 'Циолковский', script: 'cyrillic', type: 'crater', lat: -20.4, lon: 129.1, info: '185 km · fond de lave sombre, face cachée' },
  // Von Kármán : cratère, latitude −44,5°, longitude 175,9°, avec une note.
  { name: 'Von Kármán', type: 'crater', lat: -44.5, lon: 175.9, info: '186 km' },
  // Apollo (bassin) : cratère, latitude −36,1°, longitude −151,8°, avec une note.
  { name: 'Apollo (bassin)', type: 'crater', lat: -36.1, lon: -151.8, info: '538 km' },
  // Korolev : cratère, latitude −4,4°, longitude −157,4°, nom local en cyrillique, avec une note.
  { name: 'Korolev', native: 'Королёв', script: 'cyrillic', type: 'crater', lat: -4.4, lon: -157.4, info: '437 km' },
  // Shackleton : cratère, latitude −89,67°, longitude 129,78°, avec une note.
  { name: 'Shackleton', type: 'crater', lat: -89.67, lon: 129.78, info: '21 km · fond dans l’ombre permanente, au pôle Sud' },

  // Zones d'intérêt
  // Pôle Sud : zone d'intérêt, latitude −90°, longitude 0°, avec une note.
  { name: 'Pôle Sud', type: 'region', lat: -90, lon: 0, info: 'Régions d’ombre permanente : glace d’eau probable' },
  // Pôle Nord : zone d'intérêt, latitude 90°, longitude 0°, sans note.
  { name: 'Pôle Nord', type: 'region', lat: 90, lon: 0 },
// Fin de la liste brute.
];

// Mers et bassins les plus étendus, plus les deux repères emblématiques de la face visible.
// Ensemble des noms de niveau 0, les repères majeurs (début).
const TIER_0 = new Set([
  // Les cinq plus grandes mers.
  'Océan des Tempêtes', 'Mer des Pluies', 'Mer de la Tranquillité', 'Mer de la Sérénité', 'Mer des Crises',
  // Le bassin Pôle Sud–Aitken, Tycho et le pôle Sud.
  'Bassin Pôle Sud–Aitken', 'Tycho', 'Pôle Sud',
// Fin de l'ensemble.
]);
// Cratères et bassins assez grands pour rester lisibles au-dessus du niveau des petits cratères.
// Ensemble des cratères de niveau 1 (début).
const TIER_1_CRATERS = new Set([
  // De Copernic à Petavius.
  'Copernic', 'Clavius', 'Platon', 'Ptolémée', 'Langrenus', 'Petavius',
  // De Grimaldi à Korolev.
  'Grimaldi', 'Tsiolkovski', 'Von Kármán', 'Apollo (bassin)', 'Korolev',
// Fin de l'ensemble.
]);
// Niveau par défaut de chaque type : 1 pour les alunissages, les mers et les zones, 2 pour les cratères.
const TYPE_TIER = { landing: 1, mare: 1, crater: 2, region: 1 };

// Déclare et exporte la liste des lieux, à partir de la liste brute.
export const MOON_FEATURES = RAW_FEATURES
  // Ajoute à chaque lieu son niveau : 0 s'il est dans le premier ensemble, 1 s'il est dans le second, sinon celui de son type, ou 2 pour un type inconnu.
  .map((f) => ({ ...f, tier: TIER_0.has(f.name) ? 0 : TIER_1_CRATERS.has(f.name) ? 1 : TYPE_TIER[f.type] ?? 2 }))
  // Trie les lieux par niveau croissant.
  .sort((a, b) => a.tier - b.tier);

// Déclare et exporte la table des types de lieux (début).
export const FEATURE_TYPES = {
  // Alunissages : libellé et couleur jaune.
  landing: { label: 'Sites d’alunissage', color: '#ffd166' },
  // Mers et bassins : libellé et couleur bleu clair.
  mare: { label: 'Mers et bassins', color: '#9ec5ff' },
  // Cratères : libellé et couleur gris clair.
  crater: { label: 'Cratères', color: '#e6e6e6' },
  // Zones d'intérêt : libellé et couleur verte.
  region: { label: 'Zones d’intérêt', color: '#7ee0b5' },
// Fin de la table.
};
