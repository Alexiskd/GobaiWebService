// Importe la distance minimale de la caméra quand des tuiles sont affichées, depuis tiles/tileManager.
import { MIN_DISTANCE_WITH_TILES } from '../MapEngine/tiles/tileManager.jsx';
// Importe l'application du profil d'affichage d'un astre (arbre de tuiles drapé sur le relief pour la Terre).
import { withGlobeProfile } from '../../../engines/earth-globe/index.js';
// Importe le réglage de la pollution lumineuse de la Terre (atlas 2025 de David Lorenz).
import { EARTH_NIGHT_LIGHTS } from '../MapEngine/earth/nightLights.jsx';

/**
 * Modèle commun des astres cartographiés en tuiles, construit sur le moteur lunaire.
 *
 * Chaque entrée décrit un astre ; le moteur (SolarEngine) en tire tout le reste, sans code propre à l'astre :
 * repère et éclairage des tuiles, caches (GPU, RAM ; rien sur le disque du navigateur), préchargement prédictif, altitude
 * minimale, survol d'un lieu, boussole, modèle 3D facultatif et état publié pour l'interface.
 * Ajouter un astre = ajouter une entrée ici (et ses couches `body: <id>` côté API).
 *
 * Champs :
 *  id               identifiant de l'astre (= bodyId de la planète, ou 'moon')
 *  hudKey           clé de l'état des tuiles dans le store HUD (lue par Attribution, TileStatus…)
 *  mapLabel         libellé des messages d'erreur (« Carte de Mars indisponible »)
 *  radiusKm         rayon réel (km) : altitudes affichées et survol
 *  minAltitudeKm    altitude minimale au-dessus du sol quand des tuiles sont affichées
 *  minAltitudeRadii idem en rayons de l'astre (prioritaire sur minAltitudeKm)
 *  siteAltitudeKm   altitude par défaut pour survoler un lieu (goToSite)
 *  obliquity        inclinaison de l'axe (rad) appliquée au groupe de la planète (la Terre et la Lune ont la leur)
 *  airless          astre sans atmosphère : terminateur net, réflexion de Lommel-Seeliger
 *  overlayMode      'blend' (calque transparent) ou 'relief' (ombrage qui module le fond)
 *  pinnedMaxZoom    niveaux 0 à n de tout l'astre chargés au départ et jamais évincés
 *  prefetch         préchargement prédictif (vue de la caméra dans 1,5 s, cône de 120°) vers le cache RAM
 *  ramCapacity      taille du cache RAM d'images décodées (préchargement), bureau ; plafonnée sur mobile
 *  surfaceMaterial  la sphère de fond prend l'éclairage et les couleurs des tuiles (au lieu d'une teinte unie)
 *  backdrop         couleur de la sphère de fond pendant le chargement des tuiles, au lieu de la couleur
 *                   d'interface de l'astre : un astre entièrement cartographié n'a pas à montrer sa teinte vive
 *                   dans les cellules hexagonales encore vides
 *  modelSwitchRadii distance (en rayons) au-delà de laquelle le modèle 3D, s'il est chargé, remplace les tuiles
 *  satellite        satellite naturel (Jupiter, Saturne) porté par satellites.jsx
 *  gas              géante gazeuse : pas de sol, la caméra peut traverser l'astre (voir SolarEngine.surfaceRatio)
 *  concurrency      téléchargements de tuiles simultanés (6 par défaut)
 *  detail           détail simulé au-delà de la résolution des images : 'gas' (stries zonales) ou 'rock' (grain, cratères)
 *  overzoom         niveaux affichés au-delà du niveau natif de la carte (3 par défaut ; plus avec `detail`)
 *  flattening       aplatissement (1 − rayon polaire / rayon équatorial) : géantes gazeuses
 *  pole             pôle Nord réel [ascension droite, déclinaison] (degrés, ICRF J2000, UAI) : oriente le groupe de la
 *                   planète, donc ses anneaux et ses tuiles, dans le même plan que les orbites de ses satellites
 *  lighting         'earth' : modèle d'éclairage physique de la Terre (surfaceLight.jsx) ; absent : modèle général
 *  waterMask        adresse du masque mondial de l'eau (reflet du Soleil sur la mer, modèle de la Terre)
 */
/** Altitude minimale au-dessus des nuages d'une géante gazeuse, en rayons (≈ 35 km pour Jupiter) ; plus bas, on entre dans l'astre. */
// Déclare et exporte l'altitude minimale au-dessus des nuages d'une géante gazeuse : 0,0005 rayon.
export const GAS_MIN_ALTITUDE_RADII = 5e-4;

/**
 * Zoom d'un satellite naturel : ses cartes s'arrêtent tôt (niveaux 5 à 8), le détail simulé prend la suite sur
 * 11 niveaux, ce qui permet de descendre à 250 m du sol (ou 0,05 % du rayon pour les plus gros).
 * Détail de type « sol » (grain, petits cratères).
 */
// satelliteZoom : les réglages de zoom d'un satellite d'après son rayon (début).
function satelliteZoom(id, radiusKm) {
  // Renvoie le rayon, une altitude minimale de 0,05 % du rayon (au moins 250 m), le détail de type « sol » et onze niveaux au-delà de la carte.
  return { radiusKm, minAltitudeKm: Math.max(0.25, radiusKm * 0.0005), detail: 'rock', overzoom: 11 };
// Fin de satelliteZoom.
}

// Déclare et exporte la liste des astres cartographiés (début).
export const TILED_BODIES = [
  // La Terre (début).
  {
    // Son identifiant, sa clé d'état et son libellé.
    id: 'earth', hudKey: 'tiles', mapLabel: 'Fond de la Terre',
    // Rayon de 6371 km, altitude minimale tirée de la distance minimale importée, survol d'un lieu à 2,5 km.
    radiusKm: 6371, minAltitudeRadii: MIN_DISTANCE_WITH_TILES - 1, siteAltitudeKm: 2.5,
    // Avec atmosphère, calque fondu par transparence.
    airless: false, overlayMode: 'blend',
    // Éclairage physique de la Terre (lumière du Soleil atténuée par l'air, ciel, relief éclairé par le Soleil) et reflet
    // du Soleil sur la mer, limité à l'eau par le masque mondial (Natural Earth, frontend/scripts/masque-eau.py).
    lighting: 'earth', waterMask: '/data/earth-water-mask.png',
    // Sphère de fond presque noire pendant le chargement : les cellules hexagonales pas encore remplies ne montrent
    // plus le bleu clair d'interface de la Terre (#3d8bff), qui les dessinait une par une au premier affichage.
    backdrop: '#0b0f16',
    // Fond instantané, sur le modèle de la Lune : toute la Terre aux niveaux 0 à 3 (85 tuiles) gardée en mémoire, sur
    // tous les appareils. Rien n'est gardé sur le disque du navigateur.
    // Préchargement prédictif comme la Lune : les tuiles de la zone vers laquelle la caméra se dirige sont chargées
    // d'avance, et celles qui sortent de l'écran restent en mémoire (300 images) pour revenir sans réseau.
    // Niveaux 0 à 3 gardés en mémoire, préchargement actif, 800 images en mémoire vive (300 avant) : la zone prédite et
    // les tuiles sorties de l'écran restent disponibles sur une plus grande étendue.
    pinnedMaxZoom: 3, prefetch: true, ramCapacity: 800,
    // Couche unique : tuiles chargées chez leurs fournisseurs (plusieurs serveurs, HTTP/2), le reste relayé par l'API :
    // 16 tuiles en parallèle au lieu de 6.
    // Seize téléchargements simultanés.
    concurrency: 16,
    // Pollution lumineuse 2025 (atlas de David Lorenz, couleurs naturelles), allumée côté nuit selon le Soleil.
    nightLights: EARTH_NIGHT_LIGHTS,
    // Relief à vraies altitudes, format Terrarium, sans clé. D'abord Mapterhorn (tuiles de 512 px : deux fois plus
    // fines à niveau égal, quatre fois moins de requêtes ; Copernicus GLO-30 jusqu'au niveau 12, ≈ 19 m par pixel à
    // l'équateur), dont l'adresse est lue dans sa fiche TileJSON. Si elle ne répond pas : AWS Terrain Tiles (Mapzen,
    // 256 px, ≈ 38 m par pixel). Niveaux 5 à 12, agrandis au-delà.
    // Relief (début).
    relief: {
      // Format Terrarium, niveaux 5 à 12, sans exagération.
      kind: 'terrarium', minZoom: 5, maxZoom: 12, exaggeration: 1,
      // Sources des altitudes, par ordre de préférence (début).
      sources: [
        // Mapterhorn, par sa fiche TileJSON, en tuiles de 512 pixels.
        { tilejson: 'https://tiles.mapterhorn.com/tilejson.json', tileSize: 512 },
        // AWS Terrain Tiles, en secours.
        { template: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png' },
      // Fin des sources.
      ],
      // Fond des océans : Mapterhorn ne décrit que les terres (mer à 0). Les profondeurs viennent d'AWS Terrain Tiles
      // (GEBCO et ETOPO1 sous la mer), prises au niveau 8 au plus (≈ 600 m par pixel, la finesse de la bathymétrie
      // mondiale) : le fond marin est creusé et ses pentes ombrées. Coupé par « gobai:relief-ocean » = « 0 ».
      // Fond des océans : AWS Terrain Tiles, jusqu'au niveau 8.
      ocean: { template: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', maxZoom: 8 },
    // Fin du relief.
    },
  // Fin de la Terre.
  },
  // La Lune (début).
  {
    // Son identifiant, sa clé d'état et son libellé.
    id: 'moon', hudKey: 'moonTiles', mapLabel: 'Carte de la Lune',
    // Rayon de 1737,4 km, altitude minimale de 500 m, survol d'un lieu à 52 km.
    radiusKm: 1737.4, minAltitudeKm: 0.5, siteAltitudeKm: 52,
    // Sans atmosphère, calque de relief.
    airless: true, overlayMode: 'relief',
    // Toute la Lune aux niveaux 0 à 3 (170 tuiles Kaguya) gardée en mémoire : aucune zone vide où que l'on regarde.
    // Niveaux 0 à 3 gardés en mémoire, préchargement actif, 400 images en mémoire vive.
    pinnedMaxZoom: 3, prefetch: true, ramCapacity: 400,
    // Tuiles servies par l'API seule (HTTP/2, fichiers légers) : 12 en parallèle au lieu de 6.
    // Douze téléchargements simultanés.
    concurrency: 12,
    // La sphère de fond prend l'éclairage des tuiles ; le modèle 3D remplace les tuiles au-delà de 2,2 rayons.
    surfaceMaterial: true, modelSwitchRadii: 2.2,
    // Relief en volume, sur le modèle de la Terre (Mapterhorn) : altitudes LOLA (LRO, NASA Moon Trek, ≈ 118 m)
    // réencodées en Terrarium par le serveur, dans le découpage géographique des images de la Lune. Altitudes signées :
    // les mers et les bassins (jusqu'à −9,1 km) creusent la surface, les reliefs (jusqu'à +10,8 km) la soulèvent.
    // Allumé et coupé par le même réglage que celui de la Terre (« relief en volume »).
    relief: {
      // Format Terrarium, niveaux 3 à 8 (au-delà, la tuile du niveau 8 est agrandie), sans exagération.
      kind: 'terrarium', minZoom: 3, maxZoom: 8, exaggeration: 1, signed: true,
      // Source unique : le relais du serveur (même origine que le site, comme le modèle de Phobos).
      sources: [{ template: '/api/v1/tiles/moon-relief/{z}/{x}/{y}.png' }],
    },
  // Fin de la Lune.
  },
  // Mars (début).
  {
    // Son identifiant, sa clé d'état et son libellé.
    id: 'mars', hudKey: 'marsTiles', mapLabel: 'Carte de Mars',
    // Rayon de 3389,5 km, altitude minimale de 3 km, survol à 300 km, axe incliné de 0,439 radian.
    radiusKm: 3389.5, minAltitudeKm: 3, siteAltitudeKm: 300, obliquity: 0.439, // 25,19°
    // Sans atmosphère pour l'éclairage des tuiles, calque fondu par transparence.
    airless: true, overlayMode: 'blend',
    // Niveaux 0 à 2 gardés en mémoire, préchargement actif, 200 images en mémoire vive.
    pinnedMaxZoom: 2, prefetch: true, ramCapacity: 200,
    // Relief en volume, sur le modèle de la Lune : altitudes MOLA (Mars Global Surveyor) mélangées à HRSC (Mars
    // Express), 200 m par pixel (NASA Mars Trek), réencodées en Terrarium par le serveur dans le découpage
    // géographique des images de Mars. Altitudes signées par rapport à la sphère de référence : Hellas (vers −8,2 km)
    // creuse la surface, Olympus Mons (vers +21,2 km) la soulève. Allumé et coupé par le réglage « relief en volume ».
    relief: {
      // Format Terrarium, niveaux 3 à 8 (au-delà, la tuile du niveau 8 est agrandie), sans exagération.
      kind: 'terrarium', minZoom: 3, maxZoom: 8, exaggeration: 1, signed: true,
      // Source unique : le relais du serveur (même origine que le site).
      sources: [{ template: '/api/v1/tiles/relief/mars/{z}/{x}/{y}.png' }],
      // Relief en volume coupé, ou altitude pas encore arrivée : l'ombrage estimé d'après l'image, force 0,4, comme avant.
      imageStrength: 0.4,
    },
    // Modèle 3D au-delà de 2,2 rayons.
    modelSwitchRadii: 2.2,
  // Fin de Mars.
  },
  // Mercure (début).
  {
    // Son identifiant, sa clé d'état et son libellé.
    id: 'mercury', hudKey: 'mercuryTiles', mapLabel: 'Carte de Mercure',
    // Rayon de 2439,7 km, altitude minimale de 3 km, survol à 200 km.
    radiusKm: 2439.7, minAltitudeKm: 3, siteAltitudeKm: 200,
    // Sans atmosphère, calque fondu par transparence.
    airless: true, overlayMode: 'blend',
    // Niveaux 0 à 2 gardés en mémoire, préchargement actif, 200 images en mémoire vive.
    pinnedMaxZoom: 2, prefetch: true, ramCapacity: 200,
    // Relief en volume, sur le modèle de la Lune : modèle numérique d'élévation global de MESSENGER (USGS, 665 m par
    // pixel, NASA Mercury Trek), réencodé en Terrarium par le serveur dans le découpage géographique des images de
    // Mercure. Altitudes signées par rapport à la sphère de 2 439,4 km (environ −5,4 km à +4,5 km).
    // Allumé et coupé par le réglage « relief en volume ».
    relief: {
      // Format Terrarium, niveaux 3 à 6 (la donnée ne porte pas plus fin : au-delà, la tuile du niveau 6 est agrandie).
      kind: 'terrarium', minZoom: 3, maxZoom: 6, exaggeration: 1, signed: true,
      // Source unique : le relais du serveur (même origine que le site).
      sources: [{ template: '/api/v1/tiles/relief/mercury/{z}/{x}/{y}.png' }],
      // Relief en volume coupé, ou altitude pas encore arrivée : l'ombrage estimé d'après l'image, force 0,4, comme avant.
      imageStrength: 0.4,
    },
    // Modèle 3D au-delà de 2,2 rayons.
    modelSwitchRadii: 2.2,
  // Fin de Mercure.
  },
  // Vénus (début).
  {
    // Son identifiant, sa clé d'état et son libellé.
    id: 'venus', hudKey: 'venusTiles', mapLabel: 'Carte de Vénus',
    // Rayon de 6051,8 km, altitude minimale de 3 km, survol à 300 km.
    radiusKm: 6051.8, minAltitudeKm: 3, siteAltitudeKm: 300,
    // Avec atmosphère, calque fondu par transparence.
    airless: false, overlayMode: 'blend', // pas de fond de carte : atmosphère et nuages dessinés par atmosphere.jsx
    // Niveaux 0 à 2 gardés en mémoire, préchargement actif, 200 images en mémoire vive.
    pinnedMaxZoom: 2, prefetch: true, ramCapacity: 200,
    // Modèle 3D au-delà de 2,2 rayons.
    modelSwitchRadii: 2.2,
  // Fin de Vénus.
  },
  // Satellites sphériques de Jupiter, Saturne, Uranus, Neptune et Pluton (mosaïques NASA Trek ou USGS relayées par l'API, voir satellite-tiles.service.ts).
  // Ajoute les satellites sphériques, à partir d'une table (début).
  ...[
    // Rayons moyens : JPL SSD « Planetary Satellite Physical Parameters ».
    // Les quatre satellites galiléens de Jupiter : identifiant, nom et rayon moyen.
    ['io', 'Io', 1821.49], ['europa', 'Europe', 1560.8], ['ganymede', 'Ganymède', 2631.2], ['callisto', 'Callisto', 2410.3],
    // Mimas, Encelade, Téthys et Dioné.
    ['mimas', 'Mimas', 198.2], ['enceladus', 'Encelade', 252.1], ['tethys', 'Téthys', 531.1], ['dione', 'Dioné', 561.4],
    // Rhéa, Titan et Japet.
    ['rhea', 'Rhéa', 763.5], ['titan', 'Titan', 2574.76], ['iapetus', 'Japet', 734.3],
    // Miranda, Ariel, Umbriel et Titania.
    ['miranda', 'Miranda', 235.8], ['ariel', 'Ariel', 578.9], ['umbriel', 'Umbriel', 584.7], ['titania', 'Titania', 788.9],
    // Obéron, Triton et Charon.
    ['oberon', 'Obéron', 761.4], ['triton', 'Triton', 1352.6], ['charon', 'Charon', 606.0],
  // Fin de la table ; pour chaque satellite (début).
  ].map(([id, name, radiusKm]) => ({
    // Son identifiant, sa clé d'état, son libellé, marqué comme satellite.
    id, hudKey: `${id}Tiles`, mapLabel: `Carte de ${name}`, satellite: true,
    // Ses réglages de zoom, et un survol à 15 % de son rayon.
    ...satelliteZoom(id, radiusKm), siteAltitudeKm: Math.round(radiusKm * 0.15),
    // Titan a une atmosphère épaisse : terminateur adouci ; les autres sont sans atmosphère.
    // Sans atmosphère, sauf Titan ; calque fondu par transparence.
    airless: id !== 'titan', overlayMode: 'blend',
    // Niveaux 0 et 1 gardés en mémoire, pas de préchargement.
    pinnedMaxZoom: 1, prefetch: false,
  // Fin du traitement d'un satellite.
  })),
  // Géantes gazeuses : cartes globales de l'USGS (pas de portail NASA Trek pour ces planètes). Pas de sol : la caméra
  // peut entrer dans l'astre et le traverser.
  // Ajoute les géantes gazeuses, à partir d'une table (début).
  ...[
    // Aplatissement : (rayon équatorial − rayon polaire) / rayon équatorial, à 1 bar (fiches NASA NSSDC).
    // Jupiter : identifiant, nom, rayon, pôle Nord et aplatissement.
    ['jupiter', 'Jupiter', 69911, [268.057, 64.495], 0.06487],
    // Saturne.
    ['saturn', 'Saturne', 58232, [40.589, 83.537], 0.09796],
    // Uranus.
    ['uranus', 'Uranus', 25362, [257.311, -15.175], 0.02293],
    // Neptune.
    ['neptune', 'Neptune', 24622, [299.36, 43.46], 0.01708],
  // Fin de la table ; pour chaque géante (début).
  ].map(([id, name, radiusKm, pole, flattening]) => ({
    // Son identifiant, sa clé d'état, son libellé, marquée comme gazeuse.
    id, hudKey: `${id}Tiles`, mapLabel: `Carte de ${name}`, gas: true,
    // Zoom modélisé : approche progressive jusqu'à GAS_MIN_ALTITUDE_RADII au-dessus des nuages, la carte USGS
    // (niveau 5) étant prolongée par un détail simulé sur 9 niveaux.
    // Détail de type « gaz », neuf niveaux au-delà de la carte, et son aplatissement.
    detail: 'gas', overzoom: 9, flattening,
    // Son rayon, aucune altitude minimale en kilomètres, un survol à 30 % du rayon, et son pôle.
    radiusKm, minAltitudeKm: 0, siteAltitudeKm: Math.round(radiusKm * 0.3), pole,
    // Avec atmosphère, calque fondu par transparence.
    airless: false, overlayMode: 'blend',
    // Niveaux 0 et 1 gardés en mémoire, pas de préchargement.
    pinnedMaxZoom: 1, prefetch: false,
    // Jupiter seule : modèle de couleur et de lumière photoréaliste (surfaceLight.jsx, JUPITER_LIGHT_GLSL).
    ...(id === 'jupiter' ? { lighting: 'jupiter' } : {}),
  // Fin du traitement d'une géante.
  })),
// Fin de la liste : chaque astre reçoit son profil d'affichage (engine earth-globe : la Terre en méthode « Earth Maps »).
].map((cfg) => withGlobeProfile(cfg));

// Déclare et exporte la table des astres cartographiés par identifiant.
export const TILED_BODY_BY_ID = Object.fromEntries(TILED_BODIES.map((b) => [b.id, b]));

/**
 * Satellites reconnus sphériques par observation (Io… Charon, 18 avec ceux d'Uranus, Triton et Charon ; la Lune est
 * gérée à part) : toujours affichés, même sans carte NASA Trek. Sans carte, ils gardent une sphère à leur couleur.
 * Calculé avant tout ajout dynamique (registerSatelliteBodies).
 */
// Déclare et exporte l'ensemble des identifiants des satellites sphériques de la liste.
export const SPHERICAL_SATELLITE_IDS = new Set(TILED_BODIES.filter((b) => b.satellite).map((b) => b.id));

/**
 * Satellites de forme irrégulière : leur modèle 3D officiel (NASA) remplace la sphère à toute distance.
 *  modelPath              fichier GLB statique embarqué dans frontend/public/models/
 *  modelAlways            le modèle reste affiché de près comme de loin (pas de retour aux tuiles sur une sphère)
 *  modelMinDistanceRadii  distance minimale de la caméra au centre, en rayons moyens : au-dessus du plus grand axe
 *  modelMaxRms            calage par les coordonnées de texture accepté jusqu'à cet écart (rad) ; au-delà, le
 *                         modèle garde son orientation d'origine
 *  modelNear              astres dont le ciblage déclenche le chargement du modèle (lui-même et sa planète)
 * Phobos : 26 × 23 × 18 km pour un rayon moyen de 11,08 km. Deimos : 15 × 12 × 11 km pour un rayon moyen de 6,2 km.
 */
// Déclare et exporte la table des modèles 3D des satellites irréguliers (début).
export const BODY_MODELS = {
  // Phobos (début).
  phobos: {
    // Adresse de son modèle, toujours affiché, à 1,35 rayon au moins, calage accepté jusqu'à 0,5 radian.
    modelPath: '/models/phobos.glb', modelAlways: true, modelMinDistanceRadii: 1.35, modelMaxRms: 0.5,
    // Chargé quand Phobos ou Mars est ciblé ; crédit du modèle.
    modelNear: ['phobos', 'mars'], modelCredit: 'NASA/JPL-Caltech',
  // Fin de Phobos.
  },
  // Deimos (début).
  deimos: {
    // Adresse de son modèle, toujours affiché, à 1,35 rayon au moins, calage accepté jusqu'à 0,5 radian.
    modelPath: '/models/deimos.glb', modelAlways: true, modelMinDistanceRadii: 1.35, modelMaxRms: 0.5,
    // Chargé quand Deimos ou Mars est ciblé ; crédit du modèle.
    modelNear: ['deimos', 'mars'], modelCredit: 'NASA/JPL-Caltech',
  // Fin de Deimos.
  },
// Fin de la table.
};

/** Réglages des tuiles d'un satellite naturel (même modèle pour tous, calculé depuis son rayon). */
// satelliteTiledBody : les réglages d'un satellite venu de l'API (début).
function satelliteTiledBody({ id, name, radiusKm }) {
  // Renvoie les réglages (début).
  return {
    // Ceux de son modèle 3D, s'il en a un.
    ...BODY_MODELS[id],
    // Son identifiant, sa clé d'état, son libellé, marqué comme satellite.
    id, hudKey: `${id}Tiles`, mapLabel: `Carte de ${name}`, satellite: true,
    // Ses réglages de zoom, et un survol à 15 % de son rayon.
    ...satelliteZoom(id, radiusKm), siteAltitudeKm: Math.round(radiusKm * 0.15),
    // Sans atmosphère, sauf Titan ; calque fondu par transparence.
    airless: id !== 'titan', overlayMode: 'blend',
    // Niveaux 0 et 1 gardés en mémoire, pas de préchargement.
    pinnedMaxZoom: 1, prefetch: false,
    // Pas de tuiles d'altitude branchées pour cet astre : relief estimé d'après l'image (ombrage seul, pas une mesure).
    // Relief estimé d'après l'image, force 0,4.
    relief: { kind: 'image', strength: 0.4 },
  // Fin des réglages.
  };
// Fin de satelliteTiledBody.
}

/**
 * Ajoute au moteur les satellites venus de l'API (ceux qui ont passé le test Horizons + Trek) et absents de la
 * liste ci-dessus : à appeler avant la création du moteur. Les déjà connus gardent leurs réglages.
 */
// Déclare et exporte registerSatelliteBodies : les satellites venus de l'API.
export function registerSatelliteBodies(satellites = []) {
  // Pour chacun (début).
  for (const s of satellites) {
    // Sans identifiant, déjà connu ou sans rayon positif : ignoré.
    if (!s?.id || TILED_BODY_BY_ID[s.id] || !(s.radiusKm > 0)) continue;
    // Ses réglages.
    const cfg = satelliteTiledBody(s);
    // Les ajoute à la liste.
    TILED_BODIES.push(cfg);
    // Et à la table par identifiant.
    TILED_BODY_BY_ID[s.id] = cfg;
  // Fin de la boucle.
  }
// Fin de registerSatelliteBodies.
}

/** Altitude minimale au-dessus du sol, en rayons de l'astre, quand ses tuiles sont affichées. */
// Déclare et exporte minAltitudeRadii : l'altitude minimale en rayons, ou celle en kilomètres divisée par le rayon.
export const minAltitudeRadii = (cfg) => cfg.minAltitudeRadii ?? cfg.minAltitudeKm / cfg.radiusKm;
