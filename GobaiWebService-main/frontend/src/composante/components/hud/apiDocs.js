/**
 * Documentation de l'API gratuite de Go白ناन्टех, affichée dans l'onglet « Documentation API » de la fenêtre Node.
 * Chaque route listée existe réellement dans le backend (backend/src/controllers) ; chemins relatifs à /api/v1.
 */

// Adresse publique de l'API (même origine que le site).
export const API_DOC_BASE = 'https://www.gobaispace.com/api/v1';
// Documentation interactive Swagger, générée depuis le code.
export const API_DOC_SWAGGER = 'https://www.gobaispace.com/api/docs';
// Document OpenAPI brut (JSON), pour générer un client.
export const API_DOC_OPENAPI = 'https://www.gobaispace.com/api/docs-json';

/** Règles d'usage, en une ligne chacune. */
export const API_DOC_RULES = [
  // Gratuité.
  ['Prix', 'Gratuit, sans inscription ni clé d’API.'],
  // CORS.
  ['CORS', 'Ouvert : appelable depuis n’importe quel site, directement dans le navigateur.'],
  // Limite.
  ['Limite', '300 requêtes par minute et par adresse IP (réponse 429 au-delà).'],
  // Format.
  ['Format', 'JSON en UTF-8 ; tuiles en image (JPEG/PNG) ; modèles 3D en glTF binaire (.glb).'],
  // Dates.
  ['Dates', 'ISO 8601 en UTC, par exemple 2026-11-15T12:00:00Z.'],
  // Erreurs.
  ['Erreurs', 'Toujours { statusCode, error, message } avec le code HTTP correspondant.'],
  // Version.
  ['Version', 'Dans l’adresse : /api/v1/…'],
];

/** Exemples prêts à copier. */
export const API_DOC_EXAMPLES = [
  // JavaScript dans le navigateur.
  {
    label: 'JavaScript',
    code: `const res = await fetch('${API_DOC_BASE}/ephemeris');\nconst { planets } = await res.json();\nconsole.log(planets);`,
  },
  // Ligne de commande.
  { label: 'curl', code: `curl "${API_DOC_BASE}/ephemeris/kepler/mars?time=2026-11-15T12:00:00Z"` },
  // Python.
  {
    label: 'Python',
    code: `import requests\nr = requests.get("${API_DOC_BASE}/places", params={"q": "Paris"})\nprint(r.json())`,
  },
];

/** Groupes de routes : méthode, chemin, description. */
export const API_DOC_GROUPS = [
  {
    group: 'Astres',
    routes: [
      ['GET', '/bodies', 'Soleil, Lune et les 8 planètes, avec leurs paramètres physiques et orbitaux.'],
      ['GET', '/bodies/listing', 'Listing complet des astres affichés par l’app (orbites et paramètres physiques).'],
      ['GET', '/bodies/planets/{name}', 'Une planète ; nom insensible à la casse et aux accents (venus, TERRE).'],
    ],
  },
  {
    group: 'Orbites et positions',
    routes: [
      ['GET', '/ephemeris?time=', 'Positions héliocentriques des planètes, en UA, à l’instant donné (par défaut : maintenant).'],
      ['GET', '/ephemeris/kepler/{id}?time=', 'État képlérien d’un corps : position, vitesse, distance, anomalies, période.'],
      ['GET', '/ephemeris/moon?time=', 'Position de la Lune (calcul local de Kepler).'],
      ['GET', '/ephemeris/satellites?time=', 'Positions des satellites naturels.'],
      ['GET', '/ephemeris/moon/phases', 'Prochaines phases de la Lune, dates et heures UTC (USNO).'],
    ],
  },
  {
    group: 'Soleil',
    routes: [
      ['GET', '/sun', 'Panorama du module Soleil.'],
      ['GET', '/sun/activity', 'Activité solaire en direct : indice Kp, taches, vent solaire, éruptions sur 7 jours (NOAA SWPC).'],
      ['GET', '/sun/regions', 'Régions actives en direct, avec position héliographique et probabilités d’éruption.'],
      ['GET', '/sun/{body}', 'Point sous-solaire d’un astre, pour éclairer son globe.'],
    ],
  },
  {
    group: 'Tuiles et cartes',
    routes: [
      ['GET', '/tiles/layers', 'Liste des couches de tuiles disponibles.'],
      ['GET', '/tiles/layers/{layerId}', 'Modèle d’URL {z}/{x}/{y} d’une couche, prêt pour Leaflet, MapLibre ou three.js.'],
      ['GET', '/tiles/layers/{layerId}/attribution', 'Sources de données de la zone visible, à afficher avec la carte.'],
      ['GET', '/tiles/locate', 'Quelle tuile contient ce point ?'],
      ['GET', '/tiles/earth/sources', 'Sources d’imagerie de la couche unique de la Terre.'],
      // La table de priorité des sources de la Terre, gardée un jour par le navigateur.
      ['GET', '/tiles/earth/plan', 'Table de priorité des sources de la Terre : le navigateur choisit la source de chaque cellule hexagonale ; paliers de zoom et carte marine (NOAA, GEBCO).'],
      ['GET', '/tiles/earth/{layerId}/{z}/{x}/{y}', 'Tuile satellite HD de la Terre.'],
      ['GET', '/tiles/moon/{layerId}/{z}/{x}/{y}', 'Tuile de la Lune.'],
      ['GET', '/tiles/moon-relief/{z}/{x}/{y}.png', 'Relief de la Lune en Terrarium (altitudes LOLA, ≈ 118 m) : R × 256 + G + B / 256 − 32768.'],
      ['GET', '/tiles/moon-relief/model.glb?cols=&exaggeration=', 'Modèle 3D du relief de la Lune (glTF binaire, km, Y vers le nord), pour Blender ou Three.js.'],
      ['GET', '/tiles/moon-relief/status', 'Préchargement du relief de la Lune dans la base du serveur.'],
      ['GET', '/tiles/moon-blend/{1|5|10}/model.glb', 'Blend de la Lune : modèle 3D complet (carte réelle SVS × Kaguya sur le relief LOLA), texture intégrée.'],
      ['GET', '/tiles/moon-blend/status', 'Variantes du blend de la Lune enregistrées dans la base du serveur.'],
      ['GET', '/tiles/satellite/{body}/{z}/{x}/{y}', 'Tuile d’un satellite ou d’une géante gazeuse (paramètre layer : couche NASA Trek).'],
      ['GET', '/tiles/bodies/availability', 'Astres dont la carte NASA Trek est disponible.'],
      ['GET', '/moon · /mars · /mercury', 'Fournisseurs, couches, capacités WMTS/WMS et tuiles relayées de chaque astre.'],
    ],
  },
  {
    group: 'Terre en direct',
    routes: [
      ['GET', '/tiles/earth-wind', 'Vents réels du moment (Open-Meteo).'],
      ['GET', '/tiles/earth-clouds/cover', 'Couverture nuageuse du moment (Open-Meteo).'],
      ['GET', '/volcanoes', 'Volcans en éruption dans le monde, avec leurs coordonnées (NASA EONET).'],
      // Moteur atmosphérique : incendies (agrégés, puis par tuile), cyclones, événements au format commun, fournisseurs, contrôle.
      ['GET', '/atmosphere/fires', 'Incendies : points chauds satellite des 24 h (agrégés) et incendies confirmés (NASA FIRMS, NASA EONET).'],
      // Détail d'une tuile.
      ['GET', '/atmosphere/fires/tiles/{tx}/{ty}', 'Points chauds d’une tuile de 10°, un par un.'],
      // Cyclones.
      ['GET', '/atmosphere/cyclones', 'Cyclones actifs confirmés : position, vent, catégorie, trajectoire (NOAA NHC, JTWC, GDACS).'],
      // Foudre autour d'un point, et couche mondiale.
      ['GET', '/atmosphere/lightning', 'Foudre : impacts des 5 dernières minutes dans 100 km autour d’un point (Xweather).'],
      // Tuiles de la couche mondiale de la foudre.
      ['GET', '/atmosphere/lightning/tiles/{z}/{x}/{y}', 'Foudre : couche mondiale des impacts récents (Xweather Raster Maps).'],
      // Radar des précipitations : index et tuiles décodées.
      ['GET', '/atmosphere/radar', 'Radar : images disponibles (Rain Viewer, 2 dernières heures, toutes les 10 minutes) et codage des tuiles.'],
      // Tuiles radar décodées.
      ['GET', '/atmosphere/radar/{id}/{z}/{x}/{y}', 'Radar : tuile décodée (PNG RVB : pluie, neige en dBZ codés, couverture radar), niveaux 0 à 7.'],
      // Orages.
      ['GET', '/atmosphere/storms', 'Orages : cellules convectives estimées d’après le radar et avertissements officiels du NWS.'],
      // Aérosols.
      ['GET', '/atmosphere/aerosols', 'Aérosols : épaisseur optique et indice absorbant observés (NASA GIBS), zones de forte charge, heures de la prévision CAMS.'],
      // Image observée d'un produit.
      ['GET', '/atmosphere/aerosols/observed/{product}', 'Aérosols : image observée décodée (aod ou ai ; rouge = jour, vert = veille).'],
      // Prévision CAMS.
      ['GET', '/atmosphere/aerosols/forecast/{time}', 'Aérosols : prévision CAMS des poussières à une heure de validité ; /legend pour la légende.'],
      // Vents et courants-jets.
      ['GET', '/atmosphere/winds', 'Vents du moment au sol, à 850, 500 et 250 hPa (Open-Meteo) et axes des courants-jets.'],
      // Événements au format commun.
      ['GET', '/atmosphere/events', 'Événements atmosphériques au format commun (filtres types, bbox, limit).'],
      // Registre et contrôle.
      ['GET', '/atmosphere/providers', 'Registre des fournisseurs : licence, quota, rafraîchissement, présence des clés.'],
      // Contrôle des calques.
      ['GET', '/atmosphere/health', 'Contrôle : événements écartés, contradictions entre sources, données périmées.'],
      ['GET', '/borders', 'Frontières des pays et littoraux.'],
      ['GET', '/world-atlas', 'Pays du monde en TopoJSON.'],
    ],
  },
  {
    group: 'Lieux et villes',
    routes: [
      ['GET', '/places?q=&limit=', 'Recherche d’un lieu dans le monde entier (1 à 10 résultats).'],
      ['GET', '/places/labels', 'Noms des villes du monde, pour les étiquettes de carte.'],
      ['GET', '/cities?q=&limit=&offset=', 'Villes du globe, avec recherche et pagination.'],
    ],
  },
  {
    group: 'LiDAR et modèles 3D',
    routes: [
      ['GET', '/lidar?lon=&lat=', 'Dalles LiDAR HD de l’IGN autour d’un point, lues en direct.'],
      ['GET', '/lidar/{tile}/{node}', 'Points d’un nœud de l’octree d’une dalle.'],
      ['GET', '/tiles/lidar-hd/cities', 'Villes de France couvertes par le LiDAR HD.'],
      ['GET', '/pointclouds', 'Nuages de points disponibles (COPC/LAS, servis par plages HTTP Range).'],
      ['GET', '/tiles/moon-model.glb', 'Modèle 3D de la Lune (NASA, glTF binaire).'],
      ['GET', '/tiles/mars-relief/{z}/{x}/{y}.png', 'Altitudes MOLA de Mars (Terrarium, DEM numérique).'],
      ['GET', '/tiles/mars-relief/model.glb', 'Modèle 3D de Mars à partir du DEM MOLA.'],
      ['GET', '/tiles/models/{file}', 'Modèle 3D d’un astre irrégulier, comme Phobos ou Deimos (NASA).'],
      ['GET', '/engine/body.js', 'Moteur 3D de l’app en script : expose window.GobaiEngine.'],
    ],
  },
  {
    group: 'Galerie',
    routes: [
      ['GET', '/galerie', 'Photos et vidéos de la galerie.'],
      ['GET', '/galerie/media/{id}', 'Fichier d’un média (vidéo par plages Range).'],
      ['GET', '/galerie/media/{id}/vignette', 'Vignette JPEG de 640 px.'],
    ],
  },
  {
    group: 'Service',
    routes: [
      ['GET', '/api/health', 'État du service (adresse sans /v1).'],
    ],
  },
];

/** Nombre total de routes documentées. */
export const countDocRoutes = () => API_DOC_GROUPS.reduce((n, g) => n + g.routes.length, 0);
