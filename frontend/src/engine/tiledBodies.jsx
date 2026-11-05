import { MIN_DISTANCE_WITH_TILES } from './tiles/tileManager';

/**
 * Modèle commun des astres cartographiés en tuiles, construit sur le moteur lunaire.
 *
 * Chaque entrée décrit un astre ; le moteur (SolarEngine) en tire tout le reste, sans code propre à l'astre :
 * repère et éclairage des tuiles, caches (GPU, RAM, disque du navigateur), préchargement prédictif, altitude
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
 *  persistentCache  cache persistant du navigateur (Cache Storage) pour les fichiers de tuiles
 *  surfaceMaterial  la sphère de fond prend l'éclairage et les couleurs des tuiles (au lieu d'une teinte unie)
 *  modelSwitchRadii distance (en rayons) au-delà de laquelle le modèle 3D, s'il est chargé, remplace les tuiles
 */
export const TILED_BODIES = [
  {
    id: 'earth', hudKey: 'tiles', mapLabel: 'Fond de la Terre',
    radiusKm: 6371, minAltitudeRadii: MIN_DISTANCE_WITH_TILES - 1, siteAltitudeKm: 2.5,
    airless: false, overlayMode: 'blend',
    // Images servies par des fournisseurs tiers (adresses à durée limitée) : pas de cache disque du navigateur.
    pinnedMaxZoom: 2, prefetch: false,
  },
  {
    id: 'moon', hudKey: 'moonTiles', mapLabel: 'Carte de la Lune',
    radiusKm: 1737.4, minAltitudeKm: 0.5, siteAltitudeKm: 52,
    airless: true, overlayMode: 'relief',
    // Toute la Lune aux niveaux 0 à 3 (170 tuiles Kaguya) gardée en mémoire : aucune zone vide où que l'on regarde.
    pinnedMaxZoom: 3, prefetch: true, ramCapacity: 400, persistentCache: 'moon-tiles-v1',
    surfaceMaterial: true, modelSwitchRadii: 2.2,
  },
  {
    id: 'mars', hudKey: 'marsTiles', mapLabel: 'Carte de Mars',
    radiusKm: 3389.5, minAltitudeKm: 3, siteAltitudeKm: 300, obliquity: 0.439, // 25,19°
    airless: true, overlayMode: 'blend',
    pinnedMaxZoom: 2, prefetch: true, ramCapacity: 200, persistentCache: 'mars-tiles-v1',
    modelSwitchRadii: 2.2,
  },
  {
    id: 'mercury', hudKey: 'mercuryTiles', mapLabel: 'Carte de Mercure',
    radiusKm: 2439.7, minAltitudeKm: 3, siteAltitudeKm: 200,
    airless: true, overlayMode: 'blend',
    pinnedMaxZoom: 2, prefetch: true, ramCapacity: 200, persistentCache: 'mercury-tiles-v1',
    modelSwitchRadii: 2.2,
  },
  {
    id: 'venus', hudKey: 'venusTiles', mapLabel: 'Carte de Vénus',
    radiusKm: 6051.8, minAltitudeKm: 3, siteAltitudeKm: 300,
    airless: true, overlayMode: 'blend', // mosaïques radar Magellan : vues « sans atmosphère »
    pinnedMaxZoom: 2, prefetch: true, ramCapacity: 200, persistentCache: 'venus-tiles-v1',
    modelSwitchRadii: 2.2,
  },
];

export const TILED_BODY_BY_ID = Object.fromEntries(TILED_BODIES.map((b) => [b.id, b]));

/** Altitude minimale au-dessus du sol, en rayons de l'astre, quand ses tuiles sont affichées. */
export const minAltitudeRadii = (cfg) => cfg.minAltitudeRadii ?? cfg.minAltitudeKm / cfg.radiusKm;
