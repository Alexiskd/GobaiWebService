// Villes de France couvertes par le programme LiDAR HD de l'IGN : métropole, Corse et les cinq départements et
// régions d'outre-mer. Sert de point d'entrée à l'affichage en direct des tuiles LiDAR HD (voir map-tiles/lidar-hd.ts) :
// l'app propose ces villes dans Paramètres, et s'y rend en allumant le calque.
//
// Coordonnées reprises du jeu Natural Earth 10m « populated places » déjà embarqué dans le dépôt
// (backend/data/vendor/natural-earth) : elles ne sont donc ni saisies à la main ni rechargées par le réseau.
// Les villes sont dans l'ordre d'importance du jeu de données, Paris en premier.

// Forme d'une ville de l'index.
export interface LidarHdCity {
  // name : son nom.
  name: string;
  /** Région administrative actuelle : distingue deux villes de même nom (les deux Saint-Denis). */
  // region : sa région.
  region: string;
  /** longitude en degrés (est positif) */
  // lon : sa longitude.
  lon: number;
  /** latitude en degrés (nord positif) */
  // lat : sa latitude.
  lat: number;
// Fin de LidarHdCity.
}

// Données brutes : une liste de quadruplets [nom, région, longitude, latitude], sur une seule ligne pour rester compacte.
const RAW: [string, string, number, number][] = [['Paris','Île-de-France',2.353,48.858],['Lyon','Auvergne-Rhône-Alpes',4.828,45.772],['Marseille','Provence-Alpes-Côte d\'Azur',5.373,43.292],['Lille','Hauts-de-France',3.078,50.652],['Nice','Provence-Alpes-Côte d\'Azur',7.263,43.717],['Toulouse','Occitanie',1.448,43.622],['Bordeaux','Nouvelle-Aquitaine',-0.597,44.852],['Rouen','Normandie',1.08,49.43],['Strasbourg','Grand Est',7.75,48.58],['Nantes','Pays de la Loire',-1.59,47.21],['Metz','Grand Est',6.18,49.12],['Grenoble','Auvergne-Rhône-Alpes',5.72,45.18],['Toulon','Provence-Alpes-Côte d\'Azur',5.919,43.134],['Montpellier','Occitanie',3.87,43.61],['Nancy','Grand Est',6.2,48.684],['Saint-Étienne','Auvergne-Rhône-Alpes',4.38,45.43],['Fort-de-France','Martinique',-61.08,14.61],['Melun','Île-de-France',2.667,48.533],['Le Havre','Normandie',0.105,49.505],['Tours','Centre-Val de Loire',0.7,47.38],['Clermont-Ferrand','Auvergne-Rhône-Alpes',3.08,45.78],['Orléans','Centre-Val de Loire',1.9,47.9],['Mulhouse','Grand Est',7.35,47.75],['Rennes','Bretagne',-1.67,48.1],['Reims','Grand Est',4.03,49.25],['Caen','Normandie',-0.35,49.184],['Saint-Denis','La Réunion',55.448,-20.879],['Angers','Pays de la Loire',-0.53,47.48],['Dijon','Bourgogne-Franche-Comté',5.03,47.33],['Nîmes','Occitanie',4.35,43.83],['Limoges','Nouvelle-Aquitaine',1.25,45.83],['Aix-en-Provence','Provence-Alpes-Côte d\'Azur',5.45,43.52],['Perpignan','Occitanie',2.9,42.7],['Pointe-à-Pitre','Guadeloupe',-61.533,16.241],['Biarritz','Nouvelle-Aquitaine',-1.562,43.473],['Brest','Bretagne',-4.495,48.39],['Le Mans','Pays de la Loire',0.203,48.004],['Amiens','Hauts-de-France',2.3,49.9],['Besançon','Bourgogne-Franche-Comté',6.03,47.23],['Annecy','Auvergne-Rhône-Alpes',6.117,45.9],['Calais','Hauts-de-France',1.833,50.95],['Poitiers','Nouvelle-Aquitaine',0.333,46.583],['Versailles','Île-de-France',2.133,48.8],['Lorient','Bretagne',-3.367,47.75],['Béziers','Occitanie',3.21,43.35],['La Rochelle','Nouvelle-Aquitaine',-1.15,46.167],['Roanne','Auvergne-Rhône-Alpes',4.067,46.033],['Bourges','Centre-Val de Loire',2.4,47.084],['Arras','Hauts-de-France',2.783,50.283],['Troyes','Grand Est',4.083,48.34],['Cayenne','Guyane',-52.33,4.933],['Cherbourg-en-Cotentin','Normandie',-1.65,49.65],['Agen','Nouvelle-Aquitaine',0.633,44.2],['Brive-la-Gaillarde','Nouvelle-Aquitaine',1.533,45.15],['Tarbes','Occitanie',0.083,43.233],['Ajaccio','Corse',8.728,41.927],['Saint-Brieuc','Bretagne',-2.783,48.517],['Nevers','Bourgogne-Franche-Comté',3.167,46.984],['Vichy','Auvergne-Rhône-Alpes',3.417,46.117],['Dieppe','Normandie',1.083,49.934],['Auxerre','Bourgogne-Franche-Comté',3.567,47.8],['Bastia','Corse',9.45,42.703],['Saint-Benoît','La Réunion',55.713,-21.034],['Dzaoudzi','Mayotte',45.275,-12.787],['Saint-Laurent-du-Maroni','Guyane',-54.033,5.498],['Kourou','Guyane',-52.65,5.16],['Sinnamary','Guyane',-52.96,5.38],['Saint-Georges-de-l\'Oyapock','Guyane',-51.81,3.91],['Roura','Guyane',-52.33,4.73],['Iracoubo','Guyane',-53.22,5.48],['Basse-Terre','Guadeloupe',-61.705,16.01]];

/** Les villes de l'index, prêtes à servir. */
// Liste des villes : chaque quadruplet devient un objet { name, region, lon, lat }.
export const LIDAR_HD_CITIES: LidarHdCity[] = RAW.map(([name, region, lon, lat]) => ({ name, region, lon, lat }));
