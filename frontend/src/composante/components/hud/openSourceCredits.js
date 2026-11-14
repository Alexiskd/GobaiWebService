// Importe HIDDEN, l'ensemble des boutons masqués de la barre d'outils (module sans import, voir hiddenActions).
import { HIDDEN } from '../toolbar/hiddenActions';

/**
 * Dépôt de l'application, puis dépôts GitHub dont elle dépend (dépendances npm du frontend et du backend, moteurs
 * de génération 3D, données chargées depuis GitHub) ;
 * une entrée sans `repo` est une méthode publiée (`source`), réécrite pour l'application. `people` alimente l'onglet « Générique », `org` l'onglet « Sources et Entreprises ».
 * À tenir à jour avec les package.json.
 *
 * `updated` = date du dernier envoi sur GitHub, relevée le 11 novembre 2026. `local` = fichiers du dépôt importés dans
 * le projet (backend/data/vendor) et lus sur le serveur : ce qu'ils fournissent et leur version. Aucun dépôt n'est
 * chargé en direct.
 *
 * `feature` = identifiant du bouton de la barre d'outils qui donne accès à la fonction utilisant ce dépôt : si ce
 * bouton est masqué (HIDDEN dans toolbar/hiddenActions), le dépôt n'apparaît pas dans la fenêtre Node.
 */
// Déclare et exporte la liste des crédits, classés par groupe (début du tableau).
export const OPEN_SOURCE_CREDITS = [
  // Début d'un groupe.
  {
    // Nom du groupe : « Application ».
    group: 'Application',
    // Les entrées du groupe (début de la liste).
    items: [
      // Dépôt « GobaiWebService » (Alexiskd/GobaiWebService), dernier envoi relevé le 11 novembre 2026.
      { name: 'GobaiWebService', repo: 'Alexiskd/GobaiWebService', updated: '2026-11-11', people: ['Alexis Bouvet-Mallet'] },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « 3D et nuages de points ».
    group: '3D et nuages de points',
    // Les entrées du groupe (début de la liste).
    items: [
      // Dépôt « three.js » (mrdoob/three.js), dernier envoi relevé le 10 novembre 2026, avec des fichiers importés dans le projet.
      { name: 'three.js', repo: 'mrdoob/three.js', updated: '2026-11-10', local: 'texture de secours de la Lune, version r180', people: ['Ricardo Cabello (mrdoob)'] },
      // Dépôt « Draco » (google/draco), dernier envoi relevé le 16 octobre 2026 ; organisation : Google.
      { name: 'Draco', repo: 'google/draco', updated: '2026-10-16', people: ['Ondrej Stava', 'Frank Galligan'], org: 'Google' },
      // Dépôt « meshoptimizer » (zeux/meshoptimizer), dernier envoi relevé le 14 octobre 2026.
      { name: 'meshoptimizer', repo: 'zeux/meshoptimizer', updated: '2026-10-14', people: ['Arseny Kapoulkine (zeux)'] },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Atmosphères, nuages et météo : code écrit pour l'application (aucun dépôt copié), d'après ces travaux publiés.
    // Nom du groupe : « Méthodes de rendu (atmosphères et météo) ».
    group: 'Méthodes de rendu (atmosphères et météo)',
    // Les entrées du groupe (début de la liste).
    items: [
      // Méthode « Diffusion atmosphérique (Rayleigh et Mie) », d'après SIGGRAPH 1993.
      { name: 'Diffusion atmosphérique (Rayleigh et Mie)', source: 'SIGGRAPH 1993', people: ['Tomoyuki Nishita', 'Takao Sirai', 'Katsumi Tadamura', 'Eihachiro Nakamae'] },
      // Méthode « Fonction de phase des brumes », d'après Astrophysical Journal, 1941.
      { name: 'Fonction de phase des brumes', source: 'Astrophysical Journal, 1941', people: ['Louis Henyey', 'Jesse Greenstein'] },
      // Méthode « Mouvement des nuages par carte de flux », d'après Valve, SIGGRAPH 2010.
      { name: 'Mouvement des nuages par carte de flux', source: 'Valve, SIGGRAPH 2010', people: ['Alex Vlachos'] },
      // Méthode « Bruit fractal des nuages simulés », d'après bruit de Perlin, hachage d’Inigo Quilez.
      { name: 'Bruit fractal des nuages simulés', source: 'bruit de Perlin, hachage d’Inigo Quilez', people: ['Ken Perlin', 'Inigo Quilez'] },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Interface ».
    group: 'Interface',
    // Les entrées du groupe (début de la liste).
    items: [
      // Dépôt « React » (facebook/react), dernier envoi relevé le 10 novembre 2026 ; organisation : Meta.
      { name: 'React', repo: 'facebook/react', updated: '2026-11-10', people: ['Jordan Walke'], org: 'Meta' },
      // Dépôt « MUI » (mui/material-ui), dernier envoi relevé le 11 novembre 2026 ; organisation : MUI.
      { name: 'MUI', repo: 'mui/material-ui', updated: '2026-11-11', people: ['Hai Nguyen', 'Olivier Tassinari'], org: 'MUI' },
      // Dépôt « Emotion » (emotion-js/emotion), dernier envoi relevé le 4 novembre 2025.
      { name: 'Emotion', repo: 'emotion-js/emotion', updated: '2025-11-04', people: ['Kye Hohenberger', 'Mitchell Hamilton'] },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Serveur ».
    group: 'Serveur',
    // Les entrées du groupe (début de la liste).
    items: [
      // Dépôt « Node.js » (nodejs/node), dernier envoi relevé le 11 novembre 2026 ; organisation : OpenJS Foundation.
      { name: 'Node.js', repo: 'nodejs/node', updated: '2026-11-11', people: ['Ryan Dahl'], org: 'OpenJS Foundation' },
      // Dépôt « NestJS » (nestjs/nest), dernier envoi relevé le 10 novembre 2026.
      { name: 'NestJS', repo: 'nestjs/nest', updated: '2026-11-10', people: ['Kamil Myśliwiec'] },
      // Dépôt « Express » (expressjs/express), dernier envoi relevé le 2 novembre 2026 ; organisation : OpenJS Foundation.
      { name: 'Express', repo: 'expressjs/express', updated: '2026-11-02', people: ['TJ Holowaychuk'], org: 'OpenJS Foundation' },
      // Dépôt « Nest Swagger » (nestjs/swagger), dernier envoi relevé le 10 novembre 2026.
      { name: 'Nest Swagger', repo: 'nestjs/swagger', updated: '2026-11-10', people: ['Kamil Myśliwiec'] },
      // Dépôt « Nest Throttler » (nestjs/throttler), dernier envoi relevé le 3 novembre 2026.
      { name: 'Nest Throttler', repo: 'nestjs/throttler', updated: '2026-11-03', people: ['Kamil Myśliwiec'] },
      // Dépôt « class-validator » (typestack/class-validator), dernier envoi relevé le 26 février 2026 ; organisation : TypeStack.
      { name: 'class-validator', repo: 'typestack/class-validator', updated: '2026-02-26', people: ['Umed Khudoiberdiev (pleerock)'], org: 'TypeStack' },
      // Dépôt « class-transformer » (typestack/class-transformer), dernier envoi relevé le 17 janvier 2025 ; organisation : TypeStack.
      { name: 'class-transformer', repo: 'typestack/class-transformer', updated: '2025-01-17', people: ['Umed Khudoiberdiev (pleerock)'], org: 'TypeStack' },
      // Dépôt « RxJS » (ReactiveX/rxjs), dernier envoi relevé le 5 août 2026 ; organisation : Microsoft.
      { name: 'RxJS', repo: 'ReactiveX/rxjs', updated: '2026-08-05', people: ['Erik Meijer', 'Ben Lesh'], org: 'Microsoft' },
      // Dépôt « reflect-metadata » (rbuckton/reflect-metadata), dernier envoi relevé le 24 août 2026 ; organisation : Microsoft.
      { name: 'reflect-metadata', repo: 'rbuckton/reflect-metadata', updated: '2026-08-24', people: ['Ron Buckton'], org: 'Microsoft' },
      // Dépôt « node-postgres » (brianc/node-postgres), dernier envoi relevé le 22 octobre 2026.
      { name: 'node-postgres', repo: 'brianc/node-postgres', updated: '2026-10-22', people: ['Brian Carlson'] },
      // Dépôt « sharp » (lovell/sharp), dernier envoi relevé le 10 novembre 2026.
      { name: 'sharp', repo: 'lovell/sharp', updated: '2026-11-10', people: ['Lovell Fuller'] },
      // Dépôt « dotenv » (motdotla/dotenv), dernier envoi relevé le 8 novembre 2026.
      { name: 'dotenv', repo: 'motdotla/dotenv', updated: '2026-11-08', people: ['Scott Motte'] },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Outillage ».
    group: 'Outillage',
    // Les entrées du groupe (début de la liste).
    items: [
      // Dépôt « Vite » (vitejs/vite), dernier envoi relevé le 11 novembre 2026.
      { name: 'Vite', repo: 'vitejs/vite', updated: '2026-11-11', people: ['Evan You'] },
      // Dépôt « Nest CLI » (nestjs/nest-cli), dernier envoi relevé le 11 novembre 2026.
      { name: 'Nest CLI', repo: 'nestjs/nest-cli', updated: '2026-11-11', people: ['Kamil Myśliwiec'] },
      // Dépôt « Vite plugin React » (vitejs/vite-plugin-react), dernier envoi relevé le 11 novembre 2026.
      { name: 'Vite plugin React', repo: 'vitejs/vite-plugin-react', updated: '2026-11-11', people: ['Evan You'] },
      // Dépôt « TypeScript » (microsoft/TypeScript), dernier envoi relevé le 10 novembre 2026 ; organisation : Microsoft.
      { name: 'TypeScript', repo: 'microsoft/TypeScript', updated: '2026-11-10', people: ['Anders Hejlsberg'], org: 'Microsoft' },
      // Dépôt « tsx » (privatenumber/tsx), dernier envoi relevé le 24 septembre 2026.
      { name: 'tsx', repo: 'privatenumber/tsx', updated: '2026-09-24', people: ['Hiroki Osame'] },
      // Dépôt « Jest » (jestjs/jest), dernier envoi relevé le 11 novembre 2026 ; organisation : Meta.
      { name: 'Jest', repo: 'jestjs/jest', updated: '2026-11-11', people: ['Jeff Morrison', 'Christoph Nakazawa'], org: 'Meta' },
      // Dépôt « ts-jest » (kulshekhar/ts-jest), dernier envoi relevé le 8 novembre 2026.
      { name: 'ts-jest', repo: 'kulshekhar/ts-jest', updated: '2026-11-08', people: ['Kulshekhar Kabra'] },
      // Dépôt « DefinitelyTyped » (DefinitelyTyped/DefinitelyTyped), dernier envoi relevé le 10 novembre 2026.
      { name: 'DefinitelyTyped', repo: 'DefinitelyTyped/DefinitelyTyped', updated: '2026-11-10', people: ['Boris Yankov'] },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
  // Début d'un groupe.
  {
    // Nom du groupe : « Données ».
    group: 'Données',
    // Les entrées du groupe (début de la liste).
    items: [
      // Dépôt « Natural Earth » (nvkelso/natural-earth-vector), dernier envoi relevé le 2 juin 2022, avec des fichiers importés dans le projet.
      { name: 'Natural Earth', repo: 'nvkelso/natural-earth-vector', updated: '2022-06-02', local: 'villes (version 5.1.2) et pays au 1:50m (version 4.1.0)', people: ['Nathaniel Vaughn Kelso', 'Tom Patterson'] },
      // Dépôt « TopoJSON » (topojson/topojson-specification), dernier envoi relevé le 17 novembre 2018.
      { name: 'TopoJSON', repo: 'topojson/topojson-specification', updated: '2018-11-17', people: ['Mike Bostock'] },
      // Dépôt « World Atlas » (topojson/world-atlas), dernier envoi relevé le 5 septembre 2019, avec des fichiers importés dans le projet.
      { name: 'World Atlas', repo: 'topojson/world-atlas', updated: '2019-09-05', local: 'frontières, recette de la version 2.0.2', people: ['Mike Bostock'] },
      // Dépôt « Yale Bright Star Catalog (JSON) » (brettonw/YaleBrightStarCatalog), dernier envoi relevé le 16 juin 2023.
      { name: 'Yale Bright Star Catalog (JSON)', repo: 'brettonw/YaleBrightStarCatalog', updated: '2023-06-16', people: ['Bretton Wade'] },
      // Dépôt « iso-639-3 » (wooorm/iso-639-3), dernier envoi relevé le 1er novembre 2023.
      { name: 'iso-639-3', repo: 'wooorm/iso-639-3', updated: '2023-11-01', people: ['Titus Wormer (wooorm)'] },
      // Dépôt « CLDR JSON » (unicode-org/cldr-json), dernier envoi relevé le 26 octobre 2026 ; organisation : Unicode Consortium.
      { name: 'CLDR JSON', repo: 'unicode-org/cldr-json', updated: '2026-10-26', people: [], org: 'Unicode Consortium' },
    // Fin de la liste des entrées du groupe.
    ],
  // Fin du groupe.
  },
// Fin de la liste des groupes.
];

/**
 * Entreprises et organisations dont l'application utilise les données ou les services, relevées dans le code
 * (appels du backend et du frontend, mentions de source). Chaque entrée : ce qu'elles fournissent.
 */
// Déclare et exporte la liste des organisations dont l'application utilise les données ou les services (début du tableau).
export const SERVICE_ORGS = [
  // La NASA et ce qu'elle fournit (début de la liste).
  { org: 'NASA', what: [
    // Les paramètres des lunes (JPL SSD), dont les orbites sont calculées par les lois de Kepler.
    'JPL SSD (paramètres des lunes) ; orbites calculées par Kepler',
    // Les éléments orbitaux des planètes naines (JPL Horizons).
    'JPL Horizons (éléments orbitaux des planètes naines)',
    // Les cartes de Mars, de la Lune et des satellites (NASA Trek).
    'NASA Trek (cartes de Mars, de la Lune et des satellites)',
    // L'imagerie de la Terre (EOSDIS GIBS).
    'EOSDIS GIBS (imagerie de la Terre)',
    // Les couleurs de la Lune (Scientific Visualization Studio).
    'Scientific Visualization Studio (couleurs de la Lune)',
    // Les fiches des astres (NSSDC).
    'NSSDC (fiches des astres)',
    // Les images de la galerie (Image and Video Library).
    'Image and Video Library (galerie)',
    // Les volcans en éruption dans le monde, en direct (EONET).
    'EONET (volcans en éruption dans le monde, en direct)',
    // Les éruptions solaires observées (DONKI, hébergé par le CCMC).
    'DONKI, hébergé par le CCMC (éruptions solaires observées et leurs régions actives)',
  // Fin de la liste de la NASA.
  ] },
  // « USGS Astrogeology Science Center » et ce que cette organisation fournit.
  { org: 'USGS Astrogeology Science Center', what: ['Cartes de la Lune, de Mars et de Mercure (MESSENGER, Viking)'] },
  // « USGS (The National Map) » et ce que cette organisation fournit.
  { org: 'USGS (The National Map)', what: ['Imagerie aérienne des États-Unis'] },
  // « Smithsonian Institution (Global Volcanism Program) » et ce que cette organisation fournit.
  { org: 'Smithsonian Institution (Global Volcanism Program)', what: ['Fiches des volcans liées aux éruptions en direct'] },
  // « Arizona State University » et ce que cette organisation fournit.
  { org: 'Arizona State University', what: ['LROC et LunaServ (Lune)', 'ShadowCam (pôles lunaires)'] },
  // « KARI (Corée) » et ce que cette organisation fournit.
  { org: 'KARI (Corée)', what: ['Sonde Danuri, porteuse de ShadowCam'] },
  // « JAXA » et ce que cette organisation fournit.
  { org: 'JAXA', what: ['Kaguya (relief de la Lune)'] },
  // « Caltech, Murray Lab » et ce que cette organisation fournit.
  { org: 'Caltech, Murray Lab', what: ['Mosaïque CTX de Mars'] },
  // « Esri » et ce que cette organisation fournit.
  { org: 'Esri', what: ['ArcGIS (hébergement de cartes de Mars et de Mercure)'] },
  // « OpenPlanetaryMap » et ce que cette organisation fournit.
  { org: 'OpenPlanetaryMap', what: ['Fond de carte lunaire communautaire (hébergé par CARTO)'] },
  // « EOX IT Services » et ce que cette organisation fournit.
  { org: 'EOX IT Services', what: ['Sentinel-2 cloudless, données Copernicus (ESA, Union européenne)'] },
  // « EUMETSAT » et ce que cette organisation fournit.
  { org: 'EUMETSAT', what: ['Meteosat : image de la Terre à l’instant T (Europe, Afrique), une toutes les 10 minutes'] },
  // « IGN » et ce que cette organisation fournit.
  { org: 'IGN', what: ['Orthophotos de la Géoplateforme', 'LiDAR HD : modèles de surface, de terrain et de hauteur (Licence Ouverte 2.0)', 'LiDAR HD : nuage de points 3D de la dalle de Paris LHD_FXX_0652_6863, relevé du 3 mars 2023, colorisé avec les orthophotos de la Géoplateforme (Licence Ouverte 2.0)'] },
  // « Mapterhorn (© Mapterhorn, mapterhorn.com/attribution) » et ce que cette organisation fournit.
  { org: 'Mapterhorn (© Mapterhorn, mapterhorn.com/attribution)', what: ['Altitudes de la Terre en tuiles Terrarium, d’après Copernicus GLO-30 (ESA) et des relevés nationaux ouverts'] },
  // « Mapzen / Tilezen (Terrain Tiles, hébergées par AWS Open Data) » et ce que cette organisation fournit.
  { org: 'Mapzen / Tilezen (Terrain Tiles, hébergées par AWS Open Data)', what: ['Altitudes de la Terre, d’après SRTM, GMTED2010, ETOPO1 et d’autres sources ouvertes'] },
  // « swisstopo, IGN España, PDOK, IGN/NGI Belgique, ACT Luxembourg, basemap.at, ČÚZK, GUGiK, GSI » et ce que cette organisation fournit.
  { org: 'swisstopo, IGN España, PDOK, IGN/NGI Belgique, ACT Luxembourg, basemap.at, ČÚZK, GUGiK, GSI', what: ['Orthophotos nationales (Suisse, Espagne, Pays-Bas, Belgique, Luxembourg, Autriche, Tchéquie, Pologne, Japon)'] },
  // « Geobasis NRW, LDBV, GeoSN, HVBG, Geoportale Nazionale, NSW Spatial Services » et ce que cette organisation fournit.
  { org: 'Geobasis NRW, LDBV, GeoSN, HVBG, Geoportale Nazionale, NSW Spatial Services', what: ['Orthophotos découpées en tuiles (quatre Länder allemands, Italie, Nouvelle-Galles du Sud)'] },
  // « Natural Earth » et ce que cette organisation fournit.
  { org: 'Natural Earth', what: ['Villes et frontières'] },
  // « OpenStreetMap et komoot » et ce que cette organisation fournit.
  { org: 'OpenStreetMap et komoot', what: ['Recherche de lieux (Photon)'] },
  // « OpenFreeMap et OpenMapTiles » et ce que cette organisation fournit.
  { org: 'OpenFreeMap et OpenMapTiles', what: ['Rues et routes du monde, avec leurs noms (données OpenStreetMap)'] },
  // « U.S. Naval Observatory (USNO) » et ce que cette organisation fournit.
  { org: 'U.S. Naval Observatory (USNO)', what: ['Éphémérides'] },
  // « NOAA » et ce que cette organisation fournit.
  { org: 'NOAA', what: ['Space Weather Prediction Center (activité solaire et régions actives du Soleil)', 'NESDIS Satellite Maps (mosaïque GOES la plus récente, en secours)'] },
  // « Open-Meteo (CC BY 4.0) » et ce que cette organisation fournit.
  { org: 'Open-Meteo (CC BY 4.0)', what: ['Météo des villes', 'Vents en altitude (mouvement des nuages)', 'Couverture nuageuse du moment (position des nuages)'] },
  // « Xweather (Vaisala) » et ce que cette organisation fournit.
  { org: 'Xweather (Vaisala)', what: ['Images satellite des nuages de la Terre'] },
  // « Worldometers » et ce que cette organisation fournit.
  { org: 'Worldometers', what: ['Statistiques des villes'] },
  // « Université Yale » et ce que cette organisation fournit.
  { org: 'Université Yale', what: ['Bright Star Catalogue (étoiles du ciel)'] },
  // « Google » et ce que cette organisation fournit.
  { org: 'Google', what: ['Google Fonts (polices)', 'Décodeur Draco des modèles 3D, servi par gstatic.com'] },
  // « MyMemory (Translated) » et ce que cette organisation fournit.
  { org: 'MyMemory (Translated)', what: ['Traduction automatique de l’interface'] },
  // « Nations unies (DAES) » et ce que cette organisation fournit.
  { org: 'Nations unies (DAES)', what: ['World Population Prospects 2024 : population mondiale du compteur en direct'] },
  // « Université Queen’s » et ce que cette organisation fournit.
  { org: 'Université Queen’s', what: ['Tseng et Poppenk (2020) : 6 200 transitions de pensée par jour'] },
  // « Stripe » et ce que cette organisation fournit.
  { org: 'Stripe', what: ['Paiement des dons par carte bancaire'] },
  // « Anthropic » et ce que cette organisation fournit.
  { org: 'Anthropic', what: ['Claude : aide à la génération du code de l’application', 'API Claude : assistant de la barre d’outils'] },
// Fin de la liste des organisations.
];

/** Un dépôt est affiché si la fonction qui l'utilise est accessible dans l'interface. */
// isShown : vrai sauf si l'entrée dépend d'un bouton masqué de la barre d'outils.
const isShown = (item) => !(item.feature && HIDDEN.has(item.feature));

/** Générique réellement affiché : sans les dépôts des fonctions masquées, sans les groupes devenus vides. */
// Déclare et exporte visibleCredits, la liste réellement affichée.
export function visibleCredits() {
  // Part de la liste complète…
  return OPEN_SOURCE_CREDITS
    // … ne garde dans chaque groupe que les entrées affichées…
    .map(({ group, items }) => ({ group, items: items.filter(isShown) }))
    // … et retire les groupes devenus vides.
    .filter(({ items }) => items.length);
// Fin de visibleCredits.
}

/** Organisations → dépôts affichés qu'elles maintiennent, triées par nom. */
/** « 2026-11-10 » ou date ISO complète → « 10 nov. 2026 » ; chaîne vide si la date est illisible. */
// Déclare et exporte formatRepoDate : reçoit une date sous forme de texte.
export function formatRepoDate(value) {
  // Convertit le texte en date.
  const date = new Date(value);
  // Texte vide ou date illisible : chaîne vide.
  if (!value || Number.isNaN(date.getTime())) return '';
  // Écrit la date en français (jour, mois abrégé, année), en temps universel.
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
// Fin de formatRepoDate.
}

// Déclare et exporte orgsFromRepos : les organisations et leurs dépôts affichés.
export function orgsFromRepos() {
  // Table : organisation → liste de ses dépôts.
  const byOrg = new Map();
  // Parcourt les groupes affichés.
  for (const { items } of visibleCredits()) {
    // Parcourt les entrées du groupe.
    for (const item of items) {
      // Entrée sans organisation : ignorée.
      if (!item.org) continue;
      // Première entrée de cette organisation : crée sa liste.
      if (!byOrg.has(item.org)) byOrg.set(item.org, []);
      // Ajoute l'entrée à la liste de son organisation.
      byOrg.get(item.org).push(item);
    // Fin du parcours des entrées.
    }
  // Fin du parcours des groupes.
  }
  // Trie les organisations par nom (ordre alphabétique français) et renvoie des objets { org, items }.
  return [...byOrg.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr')).map(([org, items]) => ({ org, items }));
// Fin de orgsFromRepos.
}
