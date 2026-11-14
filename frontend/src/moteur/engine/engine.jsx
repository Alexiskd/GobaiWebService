// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe LidarGlobe et pickEarthAt, les nuages LiDAR calés sur le globe et le point de la Terre sous un pixel.
import { LidarGlobe, pickEarthAt } from './lidarGlobe';
// Importe LidarPoints, les dalles LiDAR en points 3D.
import { LidarPoints } from './lidarPoints';
// Importe hiddenByAny, le test d'un point masqué par un astre.
import { hiddenByAny } from './labelOcclusion';
// Importe le moteur de chargement planétaire : budgets, taille apparente, niveau de détail, plan des tuiles, satellites, champ de vue.
import {
  // Les deux budgets d'astres à tuiles, la taille apparente et le niveau de détail d'un astre ;
  MAX_TILED_BODIES, MAX_TILED_BODIES_LITE, apparentPx, bodyLevel,
  // l'échelle en pixels, le plan des tuiles, l'apparition des satellites, le test du champ et le cône de vue.
  pixelScale, planTiledBodies, satelliteShown, sphereInView, viewConeHalfAngle,
// Fin de l'import.
} from './bodyLoading';
// Importe nearestIndex et saveCamera, l'astre le plus proche et la sauvegarde de la caméra.
import { nearestIndex, saveCamera } from './viewLock';
// Importe les constantes et les calculs de position des astres, depuis ephemeris.
import { AU_UNITS, D, centuriesTT, earthPosition, heliocentric, orbitPositions, lonLatToVec, moonGeocentric, moonToScene, MOON_EQUATOR_TILT_DEG } from './ephemeris';
// Importe layoutLabels, le placement des étiquettes sans chevauchement.
import { layoutLabels } from './labelLayout';
// Importe bindInput, le branchement de la souris, du clavier et du tactile.
import { bindInput } from './input';
// Importe les calculs de la vue inclinée à l'approche du sol, depuis cameraTilt.
import { TILT_MAX_ANGLE, approachAngle, approachTilt, tiltEngagement, tiltPose } from './cameraTilt';
// Importe RELIEF_KEY et TileManager, la clé du choix du relief et le gestionnaire des tuiles d'un astre.
import { RELIEF_KEY, TileManager } from './tiles/tileManager';
// Importe xyzToLonLat, la conversion d'un point en longitude et latitude.
import { xyzToLonLat } from './tiles/mercator';
// Importe buildBorderSegments et borderLift, les segments des frontières et leur hauteur.
import { BORDER_STYLE, COAST_STYLE, buildBorderSegments, borderLift } from './bordersGeometry';
// Importe WorldLabels, les noms de lieux posés sur un astre.
import { WorldLabels } from './worldLabels';
// Importe CityCard, la fiche d'une ville au survol.
import { CityCard } from './cityCard';
// Importe CountryLabels, les noms des pays.
import { CountryLabels } from './countryLabels';
// Importe eclipticOf et interpolateState, la conversion vers l'écliptique et l'interpolation d'une table de positions.
import { eclipticOf, interpolateState } from './moonEphemeris';
// Importe moonState et orbiterMetrics, l'état de la Lune et les mesures d'une sonde.
import { moonState, orbiterMetrics } from './moonLive';
// Importe MOON_FEATURES et FEATURE_TYPES, les lieux de la Lune et leurs types.
import { MOON_FEATURES, FEATURE_TYPES } from './moonFeatures';
// Importe bodyId, l'identifiant d'un astre.
import { bodyId } from './bodyPlaces';
// Importe MoonOrbiters, les sondes en orbite lunaire.
import { MoonOrbiters } from './moonOrbiters';
// Importe MoonOrbit, le tracé de l'orbite de la Lune.
import { MoonOrbit } from './moonOrbit';
// Importe le matériau de la surface de la Lune et le chargement d'un modèle 3D.
import { createMoonSurfaceMaterial, loadMoonModel } from './moonModel';
// Importe ShadowCamLayer, les mosaïques polaires de ShadowCam.
import { ShadowCamLayer } from './shadowcam';
// Importe la liste des astres tuilés et leurs altitudes minimales, depuis tiledBodies.
import { GAS_MIN_ALTITUDE_RADII, TILED_BODIES, TILED_BODY_BY_ID, minAltitudeRadii } from './tiledBodies';
// Importe UserMarker, le point de la position de l'utilisateur.
import { UserMarker } from './userMarker';
// Importe flightDistance et flightPlan, le zoom d'arrivée.
import { flightDistance, flightPlan } from './zoomFlight';
// Importe scaleLevel, le niveau de l'échelle affichée.
import { scaleLevel } from './scaleLevels';
// Importe le rayon de la Terre en mètres et les coordonnées des coins de l'écran, depuis gps.
import { EARTH_RADIUS_M, insetCorners, screenGeo } from './gps';
// Importe tileRadius, le rayon auquel un niveau de tuiles est posé.
import { tileRadius } from './tiles/tileGeometry';
// Importe SkyLayer, le ciel lointain.
import { SkyLayer } from './sky/skyLayer';
// Importe SatelliteSystem, les satellites des planètes.
import { SatelliteSystem } from './satellites';
// Importe les calculs du ciel : voile du jour, conversion équatoriale, visibilité et éblouissement.
import { daySkyVeil, equatorialDegToScene, skyVisibility, sunGlare } from './sky/skyMath';
// Importe defaultDistance, la distance de vue par défaut d'un astre.
import { defaultDistance } from './focusMath';
// Importe isKindHidden et planetKind, les familles d'astres.
import { isKindHidden, planetKind } from './bodyKinds';
// Importe createSaturnRings, les anneaux de Saturne.
import { createSaturnRings } from './saturnRings';
// Importe createSunSurface, la surface animée du Soleil et ses éruptions.
import { createSunSurface } from './sunSurface';
// Importe sitesFromRegions, qui place les régions actives réelles dans le repère propre du Soleil.
import { sitesFromRegions } from './sunSurfaceMath';
// Importe VolcanoLayer, les volcans en éruption sur la Terre.
import { VolcanoLayer } from './volcanoes';
// Importe createShadedSphereMaterial, le matériau d'une sphère unie ombrée.
import { createShadedSphereMaterial } from './sphereShade';
// Importe createAtmosphere, l'atmosphère d'une planète.
import { createAtmosphere } from './atmosphere';
// Importe underCloudFloorRadii, la hauteur du plancher sous les nuages.
import { underCloudFloorRadii } from './atmosphereData';
// Importe la masse d'un astre, l'astre dominant et la mise en forme d'une distance.
import { bodyMassKg, dominantBody, formatDistanceKm } from './gravityMath';
// Importe createGasInterior, l'intérieur d'une géante gazeuse.
import { createGasInterior } from './gasInterior';
// Importe cloudZoomFactor et interiorReadout, le zoom près des nuages et la lecture de l'intérieur.
import { cloudZoomFactor, interiorReadout } from './gasInteriorMath';
// Importe les calculs de la boussole, depuis deviceCompassMath.
import { arrowSign, crossPole, moveOnSphere } from './deviceCompassMath';
// Importe dragRadPerPx et dragStep, la conversion d'un glissement en rotation.
import { dragRadPerPx, dragStep } from './touchMath';
// Importe les réglages de rythme d'images et d'économie d'énergie, depuis powerSaver.
import { IDLE_AFTER_MS, normalizedFrameMs, paceFrame, renderProfile, targetFrameMs } from './powerSaver';
// Importe PerfProbe, la sonde de performance.
import { PerfProbe } from './perfProbe';

// TAU : un tour complet, 2π arrondi.
const TAU = 6.2832;
/** Délai entre deux replacements des régions actives réelles du Soleil, en millisecondes : une minute. */
// Déclare REGIONS_REPLACE_MS : la rotation du Soleil déplace les régions, on les remet en place à ce rythme.
const REGIONS_REPLACE_MS = 60_000;
// UP_Y : l'axe vertical de la scène.
const UP_Y = new THREE.Vector3(0, 1, 0);
// Rayon de la Terre en kilomètres.
const EARTH_RADIUS_KM = TILED_BODY_BY_ID.earth.radiusKm;
// Distance de la vue globale : 1,3 million de rayons terrestres.
const VIEW_DISTANCE = 1.3e6;     // distance de la vue globale
// Distance maximale de la caméra.
const MAX_DISTANCE = 6e7;
// Distance de départ : 9 rayons terrestres.
const START_DISTANCE = 9;        // vue de départ à l'ouverture de l'app : Terre à 9× (neuf rayons terrestres)
// Vitesse de rotation au clavier : 1,1 rad/s.
const KEY_ROTATE_SPEED = 1.1;    // rad/s : rotation caméra avec les flèches maintenues
// Obliquité de l'axe terrestre : 0,409 rad.
const EARTH_TILT = 0.409;        // obliquité de l'axe terrestre (rad)
// Minutes-lumière par unité astronomique.
const LIGHT_MINUTES_PER_AU = 8.317;
// Couleur unie de la Lune.
const MOON_COLOR = 0x8f8d88;
// Couleur de l'orbite de la Lune.
const MOON_ORBIT_COLOR = 0x8fa3d0;
// Distance au-delà de laquelle l'orbite de la Lune est masquée.
const MOON_ORBIT_MAX_DIST = 3e3;  // seuil inverse des orbites héliocentriques : au-delà, l'anneau n'est que quelques pixels
// Limite de la vue polaire pour le modèle 3D : sinus de 55°.
const MODEL_POLAR_LIMIT = Math.sin(55 * D); // vue polaire : tuiles plutôt que modèle 3D (pôles des modèles NASA pincés)
// Altitude minimale d'affichage des frontières.
const BORDERS_MIN_ALTITUDE = 2.5e-4; // ≈ 1,6 km : plus bas, les frontières 1:50m s'écartent trop de l'imagerie
// Mouvements lissés indépendants de la cadence (mêmes réglages qu'avant à 60 images/s, mais identiques à 30 ou 144).
const ZOOM_TAU_MS = 96;          // lissage du zoom : ≈ 16 % du chemin restant par image à 60 i/s
// Vitesse de la transition vers un astre.
const FOCUS_RATE = 1.2;          // transition vers un astre : 0 → 1 en ≈ 0,83 s
// Vitesse de la rotation automatique : 0,072 rad/s.
const AUTO_ROTATE_SPEED = 0.072; // rad/s
// Latitude maximale de la vue.
const POLE_LIMIT = Math.PI / 2 - 1e-4; // latitude maximale de la vue : au ras du pôle
// Lumière d'ambiance quand l'ombre est active.
const AMBIENT_SHADED = 0.045;     // lumière d'ambiance quand l'ombre est activée (face nuit presque noire)
// Intensité de la lumière du Soleil.
const SUN_LIGHT = 1.7;            // intensité du Soleil sur les objets éclairés par la scène
// Durée du fondu de l'ombre : 600 ms.
const SHADE_FADE_MS = 600;       // fondu de l'ombre jour/nuit (bouton Jour / Nuit), comme le thème de l'interface (App.jsx)
// Signes infini sur la trajectoire de la caméra en rotation automatique : petite amplitude (rad), un ∞ toutes les 9 s.
const INFINITY_AMPLITUDE = 0.035;
// Période d'un signe infini : 9 secondes.
const INFINITY_PERIOD_S = 9;
// Caméra solidaire de la rotation de la planète en dessous de cette altitude (en rayons au-dessus du sol).
const SPIN_LOCK_RADII = 2;
// Géante gazeuse : même chose, mais seulement tout près des nuages (à 12 km/s, ils défileraient sous la caméra).
const GAS_SPIN_LOCK_RADII = 0.25;
// Géante gazeuse : distance au centre (en rayons locaux) où l'on arrive en traversant la couche de nuages.
const GAS_ENTRY_RADII = 0.97;
// Points du tracé de chaque orbite de planète (voir ephemeris.orbitPositions).
const ORBIT_POINTS = 2048;
// Seuil de taille des astres tuilés, budget d'astres mis à jour à la fois et apparition des satellites : voir
// bodyLoading.jsx (moteur de chargement planétaire).
// Résolution adaptative : si les images ralentissent, on rend moins de pixels (et on demande moins de tuiles).
const DPR_STEP = 0.25;
// Densité de pixels minimale : 0,75.
const DPR_MIN = 0.75;            // plancher : en dessous l'image devient trop floue
// Durée d'image au-dessus de laquelle la résolution baisse : 18,6 ms.
const DPR_SLOW_MS = 18.6;        // moyenne au-dessus (≈ 45 images par seconde pour 50 visées) : on baisse la résolution
// Durée d'image en dessous de laquelle elle remonte : 17,2 ms.
const DPR_FAST_MS = 17.2;        // moyenne en dessous (rythme visé tenu) pendant DPR_RAISE_AFTER_MS : on la remonte d'un cran
// Délai avant de remonter : 4 secondes.
const DPR_RAISE_AFTER_MS = 4000;
// Délai entre deux contrôles : 1 seconde.
const DPR_CHECK_MS = 1000;
// fmtAltitude : met une altitude en forme (début).
const fmtAltitude = (radii, radiusKm) => {
  // Altitude en mètres, jamais négative.
  const m = Math.max(0, radii * radiusKm * 1000);
  // En mètres sous 1 km, sinon en kilomètres, avec une décimale sous 10 km.
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
// Fin de fmtAltitude.
};     // teinte unie de la Lune tant que ses tuiles ne couvrent pas la vue

// clamp : borne une valeur entre a et b.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Y_AXIS : l'axe vertical.
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Noms des huit phases de la Lune (début).
const MOON_PHASES = [
  // De la nouvelle lune à la gibbeuse croissante.
  'Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
  // De la pleine lune au dernier croissant.
  'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
// Fin des phases.
];

/**
 * Moteur 3D du système solaire (three.js). Aucune dépendance à React :
 * le composant lui fournit un conteneur, les éléments d'étiquettes et un store HUD.
 * Aucun rendu procédural pour les astres : la Terre et la Lune affichent les tuiles NASA ; les autres
 * astres, et la Terre et la Lune tant que leurs tuiles chargent, sont des sphères de couleur unie.
 * Seule exception, signalée à l'écran : le détail simulé qui prolonge les cartes des géantes gazeuses et des satellites
 * au-delà de leur résolution réelle (tiles/tileShaders.jsx), désactivable par setTileDetail(false).
 * Le ciel lointain (étoiles réelles, Voie lactée procédurale, galaxies proches) est rendu à part, voir sky/skyLayer.
 *
 * @param {object} opts
 *  container       élément DOM qui reçoit le <canvas>
 *  data            { bodies, cities } tels que renvoyés par l'API NestJS
 *  labels          { sun, planets[], cities[] } éléments HTML positionnés par le moteur
 *  hud             store { set({ date, focusText, zoomText, tiles }) }
 *  tilesApi        client de l'API de tuiles ({ layer(id) }) ; sans lui, la Terre et la Lune restent des sphères unies
 *  onFocusChange   (index) => void
 *  onTilesChange   () => void, appelé quand l'état des tuiles change (fournisseur, erreur…)
 */
// Déclare et exporte la classe SolarEngine (début).
export class SolarEngine {
  // Constructeur : le conteneur, les données, les étiquettes, le HUD, l'API des tuiles et les deux fonctions de changement (début).
  constructor({ container, data, labels, hud, tilesApi, onFocusChange, onTilesChange }) {
    // Garde le conteneur.
    this.container = container;
    // Garde les données.
    this.data = data;
    // Garde les étiquettes.
    this.labels = labels;
    // Garde le HUD.
    this.hud = hud;
    // Garde la fonction de changement de cible, ou une fonction vide.
    this.onFocusChange = onFocusChange || (() => {});
    // Garde l'API des tuiles.
    this.tilesApi = tilesApi;
    // Garde la fonction de changement des tuiles, ou une fonction vide.
    this.onTilesChange = onTilesChange || (() => {});

    // Largeur de la fenêtre.
    this.W = innerWidth;
    // Hauteur de la fenêtre.
    this.H = innerHeight;
    // Moteur pas arrêté.
    this.stopped = false;
    // Identifiant de la prochaine image.
    this.rafId = 0;

    // État de la caméra orbitale
    this.focus = 0;
    // Point visé.
    this.target = new THREE.Vector3();
    // Point visé au début d'une transition.
    this.targetStart = new THREE.Vector3();
    // Transition terminée.
    this.focusT = 1;                 // progression de la transition vers l'astre ciblé
    // Azimut de la caméra.
    this.az = 0.8;
    // Élévation de la caméra.
    this.el = 0.8;
    // Distance de la caméra.
    this.dist = VIEW_DISTANCE;
    // Distance voulue.
    this.distGoal = VIEW_DISTANCE;
    // Coordonnées GPS des coins affichées.
    this.gpsOn = true;               // coordonnées GPS des coins de l'écran (Terre)
    // Matrice inverse pour ces coordonnées.
    this.gpsInv = new THREE.Matrix4();
    // Marges de la zone utile.
    this.gpsInsets = { top: 0, right: 0, bottom: 0, left: 0 }; // zone utile (px CSS), voir setGpsInsets
    // Pas de glissement en cours.
    this.drag = false;
    // Aucune flèche enfoncée.
    this.keyRotate = { left: false, right: false, up: false, down: false };
    // Rotation automatique active.
    this.autoRotate = true;
    // Multiplicateur de la rotation automatique : 1.
    this.rotateSpeed = 1; // multiplicateur de la rotation automatique (Paramètres) : 1 = vitesse d'origine
    // Signes infini : amplitude et temps à zéro.
    this.infinityAmp = 0; this.infinityT = 0; // signes infini de la trajectoire (enveloppe 0..1, temps en s)
    // Quaternion et vecteur de travail pour la vue du globe.
    this.globeQ = new THREE.Quaternion(); this.globeV = new THREE.Vector3();
    // Inclinaison pilotée : aucune.
    this.pilotTilt = null; // inclinaison pilotée depuis la navball (radians) ; null = vue 3/4 automatique
    // Nord non verrouillé.
    this.northLock = false; // boussole verrouillée : nord en haut de l'écran en permanence (setNorthLock)
    // Rotation propre de l'astre à l'image précédente : inconnue.
    this.spinRef = null; // rotation propre de l'astre ciblé à l'image précédente (followSpin)
    // Vecteur de travail : axe de rotation.
    this.spinAxis = new THREE.Vector3();
    // Vecteur de travail : direction.
    this.spinDir = new THREE.Vector3();
    // Quaternion de travail.
    this.spinQ = new THREE.Quaternion();
    // Vecteurs de travail du rayon local.
    this.radN = new THREE.Vector3(); this.radAxis = new THREE.Vector3(); // rayon local (localRadius)
    // Orbites affichées.
    this.orbitsOn = true;            // lignes d'orbite des planètes et de la Lune
    // Familles d'astres masquées : aucune.
    this.hiddenKinds = new Set();    // familles d'astres masquées (Paramètres) : 'solid', 'gas', 'dwarf', 'satellite'
    // Lune non masquée.
    this.moonHidden = false;
    // Astres masqués un par un : aucun.
    this.hiddenTargets = new Set();  // astres masqués un par un (Paramètres) : indices de focusTargets
    // Repères des astres affichés.
    this.bodyMarkersOn = true;       // points et noms du Soleil et des planètes
    // Repères des satellites masqués.
    this.satelliteMarkersOn = false; // points et noms des satellites naturels masqués au départ
    // Vue inclinée automatique active.
    this.tiltOn = true;              // vue 3/4 automatique à l'approche du sol
    // Vue verrouillée : aucune.
    this.viewLock = null;            // vue verrouillée sur l'astre le plus proche de l'astre focus : { index, focus, saved }
    // Vecteur de travail : visée verrouillée.
    this.lockAim = new THREE.Vector3();
    // Vecteur de travail : position à l'écran.
    this.lockNdc = new THREE.Vector3();
    // Inclinaison en cours.
    this.tiltV = 0;
    // Point visé par la vue inclinée.
    this.tiltAim = new THREE.Vector3();
    // Haut de l'image de la vue inclinée.
    this.tiltUp = new THREE.Vector3(0, 1, 0);
    // Cap de la boussole : rotation de la vue autour de la verticale locale (0 = nord de scène en haut).
    this.heading = 0;
    // Cap voulu.
    this.headingGoal = 0;
    // Vecteur de travail : verticale locale.
    this.compassN = new THREE.Vector3();
    // Vecteur de travail : axe de l'astre.
    this.compassAxis = new THREE.Vector3();
    // Vecteur de travail : nord.
    this.compassNorth = new THREE.Vector3();
    // Vecteurs de travail de la navball : haut, axe et nord.
    this.navUp = new THREE.Vector3(); this.navAxis = new THREE.Vector3(); this.navNorth = new THREE.Vector3();
    // Est et sud.
    this.navEast = new THREE.Vector3(); this.navSouth = new THREE.Vector3();
    // Trois vecteurs de la caméra.
    this.navCam = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    // Vecteur de travail : droite.
    this.compassRight = new THREE.Vector3();
    // Ville suivie : aucune.
    this.lockCity = null;            // ville suivie quand la Terre est ciblée (les autres astres : entrée.lock)
    // Zoom d'arrivée : aucun.
    this.zoomFlight = null;          // zoom d'arrivée en cours ({ plan, t }), voir zoomFlight.jsx
    // Matrice inverse de la Lune.
    this.moonInv = new THREE.Matrix4();
    // Vecteur de travail : lieu suivi.
    this.lockN = new THREE.Vector3();

    // Temps simulé (temps réel pour l'instant : speed = 1)
    this.simMs = Date.now();
    // Vitesse du temps : 1.
    this.speed = 1;
    // Instant de la dernière image.
    this.lastNow = performance.now();
    // Instant de la dernière mise à jour du HUD.
    this.hudAt = 0;

    // Crée le moteur de rendu.
    this.initRenderer();
    // Crée le Soleil.
    this.initSun();
    // Crée les planètes.
    this.initPlanets();
    // Crée la Lune.
    this.initMoon();
    // Crée les satellites.
    this.initSatellites();
    // Crée les tuiles.
    this.initTiles();
    // Crée les frontières.
    this.initBorders();
    // Volcans en éruption (liste posée plus tard par setVolcanoes) : calque dans le groupe de la Terre, allégé sur téléphone.
    this.volcanoes = new VolcanoLayer({ lite: this.power.lite });
    // L'ajoute au groupe de la Terre.
    this.earth.group.add(this.volcanoes.root);
    // Nuages LiDAR calés par GPS.
    this.lidar = new LidarGlobe(this); // nuages LiDAR calés par GPS, sur la Terre
    // Dalles LiDAR en points 3D.
    this.lidarPoints = new LidarPoints(this); // dalles LiDAR en vrais points 3D (GET /lidar)
    // Noms des pays posés à plat sur le globe, au milieu de chaque pays, visibles avant les villes.
    this.countryLabels = new CountryLabels({
      // Parent : celui du conteneur, ou la page.
      parent: this.container.parentNode || document.body,
      // Le maillage de la Terre.
      earthMesh: this.earth.mesh,
      // Le moteur de rendu.
      renderer: this.renderer,
    // Fin des noms des pays.
    });
    // Point bleu de la position de l'utilisateur (posé par « Ma position », voir setUserPosition).
    this.userMarker = new UserMarker({ parent: this.container.parentNode || document.body });
    // Fiche monochrome au survol d'une ville (population, aire urbaine, heure locale, soleil…).
    this.cityCard = new CityCard({
      // Parent : celui du conteneur, ou la page.
      parent: this.container.parentNode || document.body,
      // Lecture de l'instant simulé.
      getSimMs: () => this.simMs,
      // Hauteur du Soleil en un lieu.
      sunAltitude: (lon, lat) => this.sunAltitudeAt(lon, lat),
    // Fin de la fiche de ville.
    });
    // Noms des villes du monde entier (GET /places/labels), à côté du canvas. Ils n'apparaissent qu'en zoomant.
    this.worldLabels = new WorldLabels({
      // Parent : celui du conteneur, ou la page.
      parent: this.container.parentNode || document.body,
      // Au clic : va à la ville.
      onPick: (c) => this.goTo(c),
      // Par paliers.
      tiered: true,
      // Altitude d'apparition.
      revealAltitude: 1.9,
      // Altitude du fondu.
      fadeAltitude: 0.45,
      // Infobulle : la fiche de ville.
      tooltip: this.cityCard,
    // Fin des noms de villes.
    });
    // Crée la Lune en direct.
    this.initMoonLive();
    // Crée la liste des cibles.
    this.initFocusTargets();
    // Crée les étiquettes.
    this.initLabels();

    // Branche les entrées et garde la fonction de débranchement.
    this.removeInput = bindInput(this);
    // Au chargement, on démarre directement sur la Terre (pas de transition depuis la vue globale).
    this.setFocus(this.earthFocus);
    // Sans transition.
    this.focusT = 1;
    // À la distance de départ.
    this.dist = START_DISTANCE;
    // Distance voulue : la même.
    this.distGoal = START_DISTANCE;
    // Lie frame à l'instance.
    this.frame = this.frame.bind(this);
    // Demande la première image.
    this.rafId = requestAnimationFrame(this.frame);
    // Onglet ou app en arrière-plan : la boucle d'affichage est arrêtée net (aucun calcul, aucun dessin), puis
    // relancée au retour sans saut de temps.
    this.paused = false;
    // Scène non suspendue.
    this.suspended = false; // scène mise à l'arrêt par setSuspended
    // onVisibility : au changement de visibilité de l'onglet (début).
    this.onVisibility = () => {
      // Moteur arrêté : rien.
      if (this.stopped) return;
      // Onglet caché (début).
      if (document.hidden) {
        // Annule l'image demandée.
        cancelAnimationFrame(this.rafId);
        // En pause.
        this.paused = true;
      // Onglet de retour après une pause (début).
      } else if (this.paused) {
        // Plus en pause.
        this.paused = false;
        // Scène suspendue : rien de plus.
        if (this.suspended) return; // scène à l'arrêt : la boucle repart avec setSuspended(false)
        // L'horloge repart de maintenant.
        this.lastNow = performance.now();
        // Note l'activité.
        this.markActive();
        // Demande une image.
        this.rafId = requestAnimationFrame(this.frame);
      // Fin du choix.
      }
    // Fin de onVisibility.
    };
    // Écoute le changement de visibilité.
    document.addEventListener('visibilitychange', this.onVisibility);
  // Fin du constructeur.
  }

  // canvas : le canevas du moteur de rendu.
  get canvas() { return this.renderer.domElement; }
  // focusTarget : la cible en cours.
  focusTarget() { return this.focusTargets[this.focus]; }

  // ---------------------------------------------------------------- construction

  // initRenderer : crée le moteur de rendu, la scène et la caméra (début).
  initRenderer() {
    // Téléphone et tablette : rendu allégé pour ne pas faire chauffer l'appareil (voir powerSaver.jsx).
    this.power = renderProfile();
    // Moteur de rendu WebGL, avec profondeur logarithmique.
    const r = new THREE.WebGLRenderer({ antialias: this.power.antialias, logarithmicDepthBuffer: true });
    // Plafond : la densité de l'écran (≤ 2, ≤ 1,5 sur téléphone) ; la résolution adaptative (adaptResolution) descend
    // jusqu'à 1 si besoin.
    this.dprMax = Math.min(devicePixelRatio || 1, this.power.dprMax);
    // Téléphone : départ à la densité 1 ; la résolution adaptative remonte ensuite si l'appareil suit.
    this.dpr = Math.min(this.dprMax, this.power.dprStart);
    // Garde le plafond d'origine.
    this.dprMaxFull = this.dprMax;
    // Durée visée d'une image.
    this.frameMs = this.power.frameMs; // durée visée d'une image (0 = sans limite), voir refreshFrameMs
    // Compteur d'images par seconde, à zéro.
    this.fps = 0; this.fpsSince = 0; this.fpsFrames = 0; // compteur d'images par seconde, voir countFps
    // Pas d'écran de chargement par-dessus.
    this.covered = false;              // écran de chargement par-dessus la scène (setCovered)
    // Pas d'économie d'énergie.
    this.saving = false;               // mode économie d'énergie des Paramètres (setPowerSaving)
    // Instant du dernier geste.
    this.activeAt = performance.now(); // dernier geste de l'utilisateur (markActive)
    // Durée moyenne d'une image : 16,7 ms au départ.
    this.dprFrameMs = 16.7;
    // Instant du prochain contrôle.
    this.dprCheckAt = 0;
    // Début de la période rapide.
    this.dprFastSince = 0;
    // Aucun cran de résolution bloqué.
    this.dprBlockedAbove = Infinity; // cran qui a déjà fait ralentir : on n'y remonte pas tout de suite
    // Fin du blocage.
    this.dprBlockUntil = 0;
    // Règle la densité de pixels.
    r.setPixelRatio(this.dpr);
    // Règle la taille.
    r.setSize(this.W, this.H);
    // Fond noir.
    r.setClearColor(0x000000); // fond de l'espace : noir pur, sous le ciel lointain (désactivable)
    // Effacement manuel.
    r.autoClear = false;       // effacement manuel : ciel lointain d'abord, puis la scène par-dessus
    // Ajoute le canevas au conteneur.
    this.container.appendChild(r.domElement);
    // Garde le moteur de rendu.
    this.renderer = r;
    // Scène.
    this.scene = new THREE.Scene();
    // Caméra : champ de 45°, du plan proche 0,00001 au plan lointain 1e10.
    this.cam = new THREE.PerspectiveCamera(45, this.W / this.H, 0.00001, 1e10);
    // Ciel au-delà du Système solaire, dans sa propre scène (indépendant de l'origine flottante et du plan proche).
    this.sky = new SkyLayer({ lite: this.power.lite });
    // Vecteur de travail du ciel : visée.
    this.skyFwd = new THREE.Vector3();
    // Vecteur de travail du ciel : direction du Soleil.
    this.skyToSun = new THREE.Vector3();
    // Vecteur de travail du ciel : haut.
    this.skyUp = new THREE.Vector3();
  // Fin de initRenderer.
  }

  // initSun : crée le Soleil, son halo et les lumières (début).
  initSun() {
    // Le Soleil des données.
    const { sun } = this.data.bodies;
    // Sphère du Soleil (début) :
    // surface animée (convection, granulation, régions actives) et éruptions de matière, voir sunSurface.jsx ;
    // rendu allégé sur téléphone.
    this.sunMesh = createSunSurface(sun.radius, { lite: this.power.lite });
    // Fin de la sphère.
    // L'ajoute à la scène.
    this.scene.add(this.sunMesh);
    // Régions actives réelles reçues du serveur : aucune au départ, le Soleil éclate avec ses régions simulées.
    this.solarRegionsData = null;
    // Instant de la dernière pose des régions réelles, en millisecondes du chronomètre de la page.
    this.solarRegionsAt = 0;
    // Vecteur de travail : direction du Soleil vers la Terre, pour placer les régions.
    this.sunToEarth = new THREE.Vector3();
    // Quaternion de travail : rotation propre du Soleil, pour passer du repère du monde au sien.
    this.sunSpin = new THREE.Quaternion();

    // Canevas du halo.
    const gc = document.createElement('canvas');
    // Carré de 256 px.
    gc.width = gc.height = 256;
    // Son contexte de dessin.
    const gx = gc.getContext('2d');
    // Dégradé radial.
    const gg = gx.createRadialGradient(128, 128, 10, 128, 128, 128);
    // Jaune clair au centre.
    gg.addColorStop(0, 'rgba(255,220,140,.95)');
    // Orange au quart.
    gg.addColorStop(0.25, 'rgba(255,160,50,.35)');
    // Transparent au bord.
    gg.addColorStop(1, 'rgba(255,120,20,0)');
    // Remplissage avec le dégradé.
    gx.fillStyle = gg;
    // Remplit le carré.
    gx.fillRect(0, 0, 256, 256);
    // Halo, toujours face à la caméra (début) :
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      // la texture du canevas, en mélange additif, sans écriture de profondeur.
      map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    // Fin du halo.
    }));
    // Sa taille : 16 unités.
    this.glow.scale.set(16, 16, 1);
    // L'ajoute à la scène.
    this.scene.add(this.glow);

    // Lumière ponctuelle du Soleil, sans atténuation.
    this.sunLight = new THREE.PointLight(0xffffff, SUN_LIGHT, 0, 0);
    // L'ajoute à la scène.
    this.scene.add(this.sunLight);
    // Réglages d'ombre des anneaux.
    this.ringShades = this.ringShades || []; // réglage « Ombre » des anneaux (uniform `shade` de chaque disque)
    // Lumière d'ambiance très faible : la face d'un astre opposée au Soleil est presque noire (ombre bien marquée),
    // au lieu d'un gris bleuté qui laissait voir toute la face nuit (avant : 0x303848).
    this.ambientLight = new THREE.AmbientLight(0xffffff, AMBIENT_SHADED);
    // L'ajoute à la scène.
    this.scene.add(this.ambientLight);
  // Fin de initSun.
  }

  // initPlanets : crée les planètes et leurs orbites (début).
  initPlanets() {
    // Direction du Soleil dans le repère caméra, partagée par les tuiles de la Terre et son atmosphère.
    this.sunDir = new THREE.Vector3(1, 0, 0);

    // Intérieurs traversables (Jupiter) : ponts nuageux, hydrogène moléculaire puis métallique, noyau dilué.
    this.gasInteriors = [];
    // Siècles de Temps terrestre écoulés depuis J2000 : l'échelle de temps des éléments d'orbite.
    const orbitT = centuriesTT(Date.now());
    // Pour chaque planète des données (début).
    this.planets = this.data.bodies.planets.map((def) => {
      // Sphère de couleur unie (couleur fournie par l'API). Pour la Terre : fond visible tant que les tuiles chargent.
      // Géantes gazeuses : sphère visible aussi de l'intérieur, la caméra pouvant traverser l'astre.
      const gas = Boolean(TILED_BODY_BY_ID[bodyId(def)]?.gas);
      // Sphère de la planète (début) :
      const mesh = new THREE.Mesh(
        // sa géométrie, plus fine pour la Terre ;
        new THREE.SphereGeometry(def.radius, def.earth ? 128 : 48, def.earth ? 96 : 32),
        // son matériau, de sa couleur, visible des deux côtés pour une géante gazeuse.
        new THREE.MeshLambertMaterial({ color: def.color || '#888888', side: gas ? THREE.DoubleSide : THREE.FrontSide })
      // Fin de la sphère.
      );
      // Groupe de la planète.
      const group = new THREE.Group();
      // Y ajoute la sphère.
      group.add(mesh);
      // Ajoute le groupe à la scène.
      this.scene.add(group);
      // Intérieur d'une géante gazeuse, ou aucun.
      const interior = gas ? createGasInterior(bodyId(def), def.radius) : null;
      // S'il y en a un (début).
      if (interior) {
        // Géante aplatie : l'intérieur prend la même forme que le globe, sinon il dépasserait aux pôles.
        const flattening = TILED_BODY_BY_ID[bodyId(def)]?.flattening;
        // Aplatissement appliqué à l'intérieur.
        if (flattening) interior.group.scale.y = 1 - flattening;
        // L'ajoute au groupe.
        group.add(interior.group);
        // Le note dans la liste des intérieurs.
        this.gasInteriors.push({ interior, group, mesh, radius: def.radius });
      // Fin de ce cas.
      }

      // Si la planète a des anneaux (début).
      if (def.ring) {
        // Saturne : anneaux modélisés (D, C, B, division de Cassini, A, F), éclairés par le Soleil et ombrés par la planète.
        // Tout autre astre à anneaux garde un disque uni.
        const ring = bodyId(def) === 'saturn'
          // Saturne : anneaux modélisés, éclairés depuis la position du Soleil ;
          ? createSaturnRings(def.radius, () => this.sunMesh.position)
          // sinon un disque uni (début) :
          : new THREE.Mesh(
            // de 1,25 à 2,3 rayons,
            new THREE.RingGeometry(def.radius * 1.25, def.radius * 2.3, 96),
            // beige, visible des deux côtés, à moitié transparent.
            new THREE.MeshBasicMaterial({ color: 0xd8c79a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
          // Fin du disque.
          );
        // Anneaux dans le plan équatorial : le pôle réel de la planète (tiledBodies.jsx) oriente déjà son groupe.
        ring.rotation.x = Math.PI / 2 + (TILED_BODY_BY_ID[bodyId(def)]?.pole ? 0 : 0.46);
        // Ajoute les anneaux au groupe.
        group.add(ring);
        // Note leur réglage d'ombre, s'ils en ont un.
        if (ring.material.uniforms?.shade) (this.ringShades = this.ringShades || []).push(ring.material.uniforms.shade);
      // Fin de ce cas.
      }

      // Orbite : ellipse fermée de 2048 points (éléments à la date du jour), assez fine pour passer par la planète.
      const orbitGeometry = new THREE.BufferGeometry();
      // Positions de l'orbite, en 2 048 points.
      orbitGeometry.setAttribute('position', new THREE.BufferAttribute(orbitPositions(def.elements, orbitT, ORBIT_POINTS), 3));
      // Ligne fermée de l'orbite (début) :
      const orbit = new THREE.LineLoop(
        // sa géométrie ;
        orbitGeometry,
        // son matériau, bleu-gris, à moitié transparent.
        new THREE.LineBasicMaterial({ color: 0x5a6fa8, transparent: true, opacity: 0.45 })
      // Fin de la ligne.
      );
      // L'ajoute à la scène.
      this.scene.add(orbit);

      // Renvoie la planète : ses données, ses objets, sa famille, son état et ses positions.
      return { def, mesh, group, orbit, kind: planetKind(def), hidden: false, w: new THREE.Vector3(), ecl: [0, 0, 0] };
    // Fin de la boucle.
    });

    // Indice de la Terre.
    const earthIndex = this.planets.findIndex((p) => p.def.earth);
    // La Terre.
    this.earth = this.planets[earthIndex];
    // Sa cible : son indice plus 1.
    this.earthFocus = earthIndex + 1; // le Soleil est à l'indice 0
    // Les astres tuilés (Terre, Lune, Mars, Mercure, Vénus…) sont décrits dans tiledBodies.jsx : voir initTiles.

    // Atmosphères modélisées, par astre (Vénus, Terre, Mars) : créées dans initTiles, voir setAtmospheresVisible.
    this.atmospheres = {};
  // Fin de initPlanets.
  }

  /**
   * Un TileManager par astre décrit dans tiledBodies.jsx (modèle commun issu du moteur lunaire). Chaque entrée garde
   * tout ce dont le moteur a besoin : repère (groupe + maillage), direction du Soleil, lieu survolé, modèle 3D.
   */
  // initTiles : crée le gestionnaire de tuiles de chaque astre tuilé (début).
  initTiles() {
    // onChange : prévient l'interface.
    const onChange = () => this.onTilesChange();
    // Astres tuilés, en liste.
    this.tiledBodies = [];
    // Les mêmes, par identifiant.
    this.tiledById = {};
    // Pour chaque astre décrit (début).
    for (const cfg of TILED_BODIES) {
      // Son repère.
      const host = this.tiledHost(cfg.id);
      // Sans repère : astre suivant.
      if (!host) continue; // astre absent des données de l'API
      // La Terre et la Lune partagent leur direction du Soleil avec l'atmosphère et la lumière cendrée.
      const sunDir = cfg.id === 'earth' ? this.sunDir : cfg.id === 'moon' ? this.moonSunDir : new THREE.Vector3(1, 0, 0);
      // Gestionnaire de tuiles (début) :
      const tiles = new TileManager({
        // le moteur, l'API et la fonction de changement ;
        engine: this, api: this.tilesApi, onChange,
        // la description de l'astre (début) :
        body: {
          // son nom, son repère, son maillage, son rayon et la direction du Soleil ;
          name: cfg.id, parent: host.group, mesh: host.mesh, radius: host.radius, sunDir,
          // sans air ou non, et le mode de son calque ;
          airless: cfg.airless, overlayMode: cfg.overlayMode,
          // les chargements simultanés, le détail simulé, le sur-zoom et l'aplatissement ;
          concurrency: cfg.concurrency, detail: cfg.detail, overzoom: cfg.overzoom, polarScale: cfg.flattening ? 1 - cfg.flattening : 1,
          // les niveaux gardés, le préchargement et la mémoire vive ;
          pinnedMaxZoom: cfg.pinnedMaxZoom, prefetch: cfg.prefetch, ramCapacity: cfg.ramCapacity,
          // le cache persistant ;
          persistentCache: cfg.persistentCache,
          // le cache des tuiles directes ;
          directCache: cfg.directCache,
          // le relief et le rayon en kilomètres ;
          relief: cfg.relief, radiusKm: cfg.radiusKm,
          // Planètes : le repère des tuiles suit la rotation propre (le maillage), pas l'inclinaison portée par le groupe.
          // Lune : le groupe est déjà orienté (rotation synchrone, libration).
          syncRotation: host.syncMesh ? (root) => { root.rotation.y = host.mesh.rotation.y; } : undefined,
        // fin de la description.
        },
      // Fin du gestionnaire.
      });
      // Atmosphère des planètes solides (Vénus, Terre, Mars) : diffusion de la lumière du Soleil, voir atmosphere.jsx.
      const atmosphere = createAtmosphere(cfg.id, host.radius, tiles.uniforms, host.syncMesh ? () => host.mesh.rotation.y : null, { lite: this.power.lite });
      // S'il y a une atmosphère (début).
      if (atmosphere) {
        // L'ajoute au groupe.
        host.group.add(atmosphere);
        // La garde par identifiant.
        this.atmospheres[cfg.id] = atmosphere;
      // Fin de ce cas.
      }
      // Géante gazeuse aplatie : la sphère de fond prend la même forme que les tuiles.
      if (cfg.flattening) host.mesh.scale.y = 1 - cfg.flattening;
      // Sphère de fond (visible tant que les tuiles ne couvrent pas tout) : même éclairage et mêmes couleurs que les
      // tuiles et le modèle 3D, au lieu d'une teinte unie.
      if (cfg.surfaceMaterial) {
        // Libère l'ancien matériau.
        host.mesh.material.dispose();
        // Pose le matériau de surface de la Lune.
        host.mesh.material = createMoonSurfaceMaterial(tiles.uniforms);
      // Sinon, si la sphère a une couleur unie (début).
      } else if (host.mesh.material?.color) {
        // Sphère unie (géantes gazeuses, satellites sans carte, fond des planètes) : même ombre jour/nuit que les
        // cartes et même réglage « Ombre », au lieu de l'éclairage de la scène.
        const old = host.mesh.material;
        // Couleur du fond : celle du champ `backdrop` de l'astre quand il en a une (astre entièrement
        // cartographié : son fond ne sert qu'au chargement et reste discret), sinon sa couleur d'interface
        // (géantes gazeuses, satellites sans carte : la sphère unie est leur aspect réel).
        // Pose le matériau de sphère ombrée, de la couleur de fond.
        host.mesh.material = createShadedSphereMaterial(cfg.backdrop || old.color, tiles.uniforms, old.side);
        // Libère l'ancien.
        old.dispose();
      // Fin du choix.
      }
      // Fiche de l'astre tuilé (début) :
      const entry = {
        // son identifiant, sa description, son repère, la direction du Soleil et ses tuiles ;
        id: cfg.id, cfg, ...host, sunDir, tiles,
        // sa cible, pas encore connue ;
        focus: -1,          // indice dans focusTargets (fixé par initFocusTargets)
        // son lieu survolé : aucun ;
        lock: null,         // lieu survolé { lon, lat, lv }
        // son modèle 3D : aucun, voulu, pas en chargement.
        model: null, modelWanted: true, modelLoading: null,
      // Fin de la fiche.
      };
      // L'ajoute à la liste.
      this.tiledBodies.push(entry);
      // La range par identifiant.
      this.tiledById[cfg.id] = entry;
    // Fin de la boucle.
    }
    // Raccourcis gardés pour les couches propres à la Terre (frontières, villes) et à la Lune (ShadowCam, lumière cendrée).
    this.tiles = this.tiledById.earth.tiles;
    // Raccourci vers les tuiles de la Lune.
    this.moonTiles = this.tiledById.moon.tiles;
  // Fin de initTiles.
  }

  /**
   * Astre dont la gravité domine à l'endroit de la caméra : { name, r, distance } (rayon et distance au centre en
   * unités de la scène, soit en rayons terrestres), ou null avant le premier rendu.
   */
  // dominantBodyNow : l'astre dont la gravité domine à l'endroit de la caméra (début).
  dominantBodyNow() {
    // Si la liste des astres n'existe pas (début).
    if (!this.gravityBodies) {
      // Le Soleil et la Lune des données.
      const { sun, moon } = this.data.bodies;
      // Rayons de la scène → kilomètres : l'unité de la scène est le rayon terrestre.
      const entry = (id, name, r, pos) => ({ name, r, pos, massKg: bodyMassKg(id, r * EARTH_RADIUS_KM), distance: 0 });
      // Liste des astres (début) :
      this.gravityBodies = [
        // le Soleil,
        entry('sun', sun.name, sun.radius, this.sunMesh.position),
        // les planètes,
        ...this.planets.map((p) => entry(bodyId(p.def), p.def.name, p.def.radius, p.group.position)),
        // la Lune,
        entry('moon', moon.name, moon.radius, this.moonGroup.position),
        // les satellites.
        ...this.satellites.list.map((s) => entry(s.def.id, s.def.name, s.def.radius, s.group.position)),
      // Fin de la liste.
      ];
    // Fin de ce cas.
    }
    // Position de la caméra.
    const cam = this.cam.position;
    // Distance de chaque astre à la caméra.
    for (const b of this.gravityBodies) b.distance = cam.distanceTo(b.pos);
    // Renvoie l'astre dominant.
    return dominantBody(this.gravityBodies);
  // Fin de dominantBodyNow.
  }

  /** Repère qui porte les tuiles d'un astre : groupe (position, inclinaison), maillage de fond, rayon (scène). */
  // tiledHost : le repère qui porte les tuiles d'un astre (début).
  tiledHost(id) {
    // La Lune : son groupe, sa sphère et son rayon.
    if (id === 'moon') return { group: this.moonGroup, mesh: this.moon, radius: this.data.bodies.moon.radius, syncMesh: false };
    // Satellite de cet identifiant.
    const sat = this.satellites.byId.get(id);
    // Satellites : comme la Lune, le groupe est déjà orienté (rotation synchrone).
    if (sat) return { satellite: sat, group: sat.group, mesh: sat.mesh, radius: sat.def.radius, syncMesh: false };
    // Planète de cet identifiant.
    const planet = this.planets.find((p) => bodyId(p.def) === id);
    // Son groupe, sa sphère et son rayon ; null si elle est inconnue.
    return planet ? { planet, group: planet.group, mesh: planet.mesh, radius: planet.def.radius, syncMesh: true } : null;
  // Fin de tiledHost.
  }

  /**
   * Relief en volume de la Terre (vraies altitudes) : allumé ou coupé, et exagération des hauteurs (1 = réelles).
   * Coupé par défaut : la carte est à plat et s'affiche plus vite. Le choix est gardé dans le navigateur
   * (« gobai:relief-3d ») et s'applique tout de suite. L'ombrage des autres astres, estimé d'après l'image, ne
   * demande aucun téléchargement : il reste toujours actif.
   */
  // setRelief : allume ou coupe le relief en volume, avec son exagération (début).
  setRelief(on, exaggeration = 1) {
    // Garde le choix dans le navigateur ; un refus est ignoré.
    try { globalThis.localStorage?.setItem(RELIEF_KEY, on ? String(exaggeration) : '0'); } catch { /* stockage refusé : valable pour la session */ }
    // L'applique à chaque astre au relief Terrarium.
    for (const tb of this.tiledBodies) if (tb.tiles.relief?.kind === 'terrarium') tb.tiles.setRelief({ on, exaggeration });
  // Fin de setRelief.
  }

  /** Astre tuilé actuellement ciblé, ou null (Soleil, géantes gazeuses). */
  // focusedTiled : l'astre tuilé ciblé, ou null.
  focusedTiled() { return this.focusTarget().tiled || null; }

  // Frontières des pays et littoraux : repère dans le groupe de la Terre, qui suit sa rotation propre (comme les tuiles).
  // La géométrie arrive plus tard (setBorders) depuis GET /borders.
  initBorders() {
    // Repère des frontières.
    this.bordersRoot = new THREE.Object3D();
    // Son nom.
    this.bordersRoot.name = 'borders';
    // Masqué au départ.
    this.bordersRoot.visible = false;
    // L'ajoute au groupe de la Terre.
    this.earth.group.add(this.bordersRoot);
    // Frontières permises.
    this.bordersOn = true;
    // Frontières pas encore demandées.
    this.bordersWanted = false;
    // Littoraux permis.
    this.coastsOn = true;
    // Littoraux du globe remplacés par ceux des tuiles (calque des rues affiché).
    this.coastsFromTiles = false;
    // Lignes des frontières : aucune.
    this.borders = null;   // THREE.LineSegments des frontières terrestres
    // Lignes des littoraux : aucune.
    this.coasts = null;    // THREE.LineSegments des littoraux
  // Fin de initBorders.
  }

  // initMoon : crée la Lune et son orbite (début).
  initMoon() {
    // La Lune des données.
    const { moon } = this.data.bodies;
    // Groupe = repère sélénographique (longitude 0 vers la Terre, Nord en +Y) ; il porte la sphère de fond et les tuiles.
    this.moonGroup = new THREE.Group();
    // Son nom.
    this.moonGroup.name = 'moon';
    // L'ajoute à la scène.
    this.scene.add(this.moonGroup);
    // Direction du Soleil vue de la Lune.
    this.moonSunDir = new THREE.Vector3(1, 0, 0);
    // Sphère de la Lune (début) :
    this.moon = new THREE.Mesh(
      // sa géométrie, à son rayon ;
      new THREE.SphereGeometry(moon.radius, 96, 64),
      // son matériau, de couleur unie.
      new THREE.MeshLambertMaterial({ color: MOON_COLOR })
    // Fin de la sphère.
    );
    // L'ajoute au groupe.
    this.moonGroup.add(this.moon);

    // Orbite géocentrique de la Lune : un mois sidéral centré sur l'instant simulé, mêmes calculs que la Lune
    // affichée (JPL Horizons ou ELP), recalculé au fil du temps (voir moonOrbit.jsx). Repère écliptique de la scène ;
    // la ligne suit ensuite la Terre à chaque image.
    this.moonOrbitTrail = new MoonOrbit({ color: MOON_ORBIT_COLOR, positionAt: (ms, out) => this.moonRelAt(ms, out) });
    // La ligne de l'orbite.
    this.moonOrbit = this.moonOrbitTrail.line;
    // L'ajoute à la scène.
    this.scene.add(this.moonOrbit);
    // Position de la Lune dans la scène.
    this.moonW = new THREE.Vector3();
    // Vecteur de la Terre à la Lune.
    this.moonRel = new THREE.Vector3();   // Terre → Lune
    // Dernière position géocentrique : aucune.
    this.moonGeo = null;                  // dernière position géocentrique calculée
    // Table de positions du serveur : aucune.
    this.moonTable = null;                // table Kepler du serveur (GET /ephemeris/moon), sinon théorie ELP
    // Source des positions : la théorie ELP.
    this.moonSource = 'ELP';
    // Quaternion de travail : inclinaison.
    this.qTilt = new THREE.Quaternion();
    // Vecteur de travail : Soleil.
    this.tmpSun = new THREE.Vector3();
    // Vecteur de travail : Terre.
    this.tmpEarth = new THREE.Vector3();
    // Quaternion de travail : rotation.
    this.qSpin = new THREE.Quaternion();
    // Vecteur de travail : axe des nœuds.
    this.nodeAxis = new THREE.Vector3();
  // Fin de initMoon.
  }

  // Satellites sphériques (Jupiter à Pluton) (Io, Europe… Titan, Japet), sur le modèle de la Lune : voir satellites.jsx.
  initSatellites() {
    // Pôles des planètes, dans le repère de la scène.
    const poles = {};
    // Pour les quatre géantes (début).
    for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
      // Son pôle, s'il est décrit.
      const pole = TILED_BODY_BY_ID[id]?.pole;
      // Le convertit vers la scène.
      if (pole) poles[id] = equatorialDegToScene(pole[0], pole[1]);
    // Fin de la boucle.
    }
    // Système des satellites (début) :
    this.satellites = new SatelliteSystem({
      // la scène, leurs données, les planètes, la fonction d'identifiant et les pôles.
      scene: this.scene, defs: this.data.bodies.satellites || [], planets: this.planets, bodyId, poles,
    // Fin du système.
    });
  // Fin de initSatellites.
  }

  /** Tables JPL Horizons des satellites (GET /ephemeris/satellites). */
  // setSatelliteEphemeris : transmet les tables de positions des satellites.
  setSatelliteEphemeris(list) { this.satellites.setEphemeris(list); }

  // Lune en direct : lieux (alunissages, mers, cratères), sondes en orbite (JPL Horizons), modèle 3D NASA.
  initMoonLive() {
    // Parent des étiquettes : celui du conteneur, ou la page.
    const parent = this.container.parentNode || document.body;
    // Noms des lieux de la Lune (début).
    this.moonLabels = new WorldLabels({
      // Leur parent.
      parent,
      // Leur classe CSS.
      className: 'l map-label moon-label',
      // Altitude maximale d'affichage : 9 rayons lunaires.
      maxAltitude: 9,                                           // en rayons lunaires
      // Nombre de noms selon l'altitude : de 14 de loin à 90 de près.
      budget: (alt) => (alt > 3 ? 14 : alt > 1 ? 30 : alt > 0.2 ? 60 : 90),
      // Par paliers.
      tiered: true,
      // decorate : prépare une étiquette (début).
      decorate: (el, f) => {
        // Son texte : le nom d'origine, sinon le nom.
        el.textContent = f.native || f.name;
        // Son écriture, latine par défaut.
        el.dataset.script = f.script || 'latin';
        // Sa couleur, selon le type du lieu.
        el.style.setProperty('--c', FEATURE_TYPES[f.type]?.color || '#fff');
        // Son infobulle : le nom, le nom d'origine, l'information et l'invitation à cliquer.
        el.title = `${f.name}${f.native ? ` · ${f.native}` : ''}${f.info ? ` · ${f.info}` : ''} · cliquer pour survoler`;
      // Fin de decorate.
      },
      // Au clic : va au lieu.
      onPick: (f) => this.goToSite('moon', f),
    // Fin des noms.
    });
    // Types de lieux affichés : tous.
    this.moonFeatureTypes = new Set(Object.keys(FEATURE_TYPES));
    // Applique les lieux.
    this.applyMoonFeatures();
    // Sondes en orbite lunaire ; au clic, la sonde est sélectionnée.
    this.orbiters = new MoonOrbiters({ scene: this.scene, parentEl: parent, onPick: (id) => this.selectOrbiter(id) });
    // Données des sondes : aucune.
    this.orbiterData = null;
    // Sonde sélectionnée : aucune.
    this.selectedOrbiter = null;
    // Quaternion de travail : inverse de la rotation de la Lune.
    this.moonQInv = new THREE.Quaternion();
    // Vecteur de travail.
    this.tmpV = new THREE.Vector3();
    // Pôles vus par Danuri : mosaïques ShadowCam des cratères en ombre permanente (au-dessus des tuiles).
    this.shadowcam = new ShadowCamLayer({ root: this.moonTiles.root, api: null, getGap: () => this.moonTiles.base?.layer.gap ?? 1e-6 });
  // Fin de initMoonLive.
  }

  // Astres sélectionnables, dans l'ordre des boutons : Soleil, planètes, Lune.
  initFocusTargets() {
    // Le Soleil et la Lune des données.
    const { sun, moon } = this.data.bodies;
    // Origine de la scène.
    const zero = new THREE.Vector3();
    // Cibles (début) :
    this.focusTargets = [
      // le Soleil, à l'origine ;
      { name: sun.name, r: sun.radius, get: () => zero },
      // chaque planète (début) :
      ...this.planets.map((p) => ({
        // son nom, son rayon, sa fiche et sa position ;
        name: p.def.name, r: p.def.radius, body: p, get: () => p.w,
        // traversable pour une géante gazeuse ;
        passable: Boolean(TILED_BODY_BY_ID[bodyId(p.def)]?.gas), // géante gazeuse : pas de sol
      // fin de la planète ;
      })),
      // la Lune.
      { name: moon.name, r: moon.radius, moon: true, get: () => this.moonW },
    // Fin des cibles.
    ];
    // Indice de la Lune : le dernier.
    this.moonFocus = this.focusTargets.length - 1;
    // Satellites sphériques (Jupiter à Pluton), après la Lune (indices suivants).
    for (const sat of this.satellites.list) {
      // Son indice.
      sat.focus = this.focusTargets.length;
      // Ajoute sa cible.
      this.focusTargets.push({ name: sat.def.name, r: sat.def.radius, satellite: sat, get: () => sat.w });
    // Fin de la boucle.
    }
    // Lien cible ↔ astre tuilé, dans les deux sens.
    for (const tb of this.tiledBodies) {
      // Indice de la cible : la Lune, le satellite, ou la planète plus 1.
      tb.focus = tb.id === 'moon' ? this.moonFocus : tb.satellite ? tb.satellite.focus : this.planets.indexOf(tb.planet) + 1;
      // Lie la cible à l'astre tuilé.
      this.focusTargets[tb.focus].tiled = tb;
    // Fin de la boucle.
    }
  // Fin de initFocusTargets.
  }

  // initLabels : prépare les étiquettes et les repères (début).
  initLabels() {
    // Les étiquettes reçues.
    const L = this.labels;
    // surfaceItem : la fiche d'une étiquette posée sur un astre (début) :
    const surfaceItem = (el, name, lon, lat) => ({
      // son élément, son nom, ses coordonnées, sa direction et son état à l'écran.
      el, name, lon, lat, lv: lonLatToVec([lon, lat]), ok: false, x: 0, y: 0, w: 0,
    // Fin de surfaceItem.
    });
    // Fiches des villes.
    this.cityItems = this.data.cities.map((c, i) => surfaceItem(L.cities[i], c.name, c.lon, c.lat));
    // Repères des astres : point de la couleur de l'astre posé à son emplacement, et son nom. Ils servent seulement
    // à situer les astres trop petits pour être vus ; dès qu'un astre fait quelques pixels, son repère s'efface.
    const { sun, moon } = this.data.bodies;
    // Parent des repères : celui du conteneur, ou la page.
    const parent = this.container.parentNode || document.body;
    // marker : l'élément d'un repère (début).
    const marker = (existing, name, color) => {
      // Déjà fourni : c'est lui.
      if (existing) return existing;
      // Sinon : crée un div.
      const el = document.createElement('div');
      // Sa classe.
      el.className = 'l body-marker';
      // Son texte : le nom.
      el.textContent = name;
      // Sa couleur.
      el.style.setProperty('--c', color);
      // Caché au départ.
      el.style.display = 'none';
      // L'ajoute au parent.
      parent.appendChild(el);
      // Le note parmi les repères créés.
      this.markerEls.push(el);
      // Le renvoie.
      return el;
    // Fin de marker.
    };
    // Repères créés ici.
    this.markerEls = [];
    // Repères des astres (début) :
    this.bodyLabels = [
      // le Soleil ;
      { el: marker(L.sun, sun.name, sun.color || '#ffb300'), name: sun.name, pos: this.sunMesh.position, radius: sun.radius, kind: 'planet' },
      // chaque planète (début) :
      ...this.planets.map((p, i) => ({
        // son repère, son nom, sa position, son rayon et sa famille ;
        el: marker(L.planets[i], p.def.name, p.def.color || '#8b97b3'), name: p.def.name, pos: p.group.position, radius: p.def.radius, kind: 'planet',
        // masquée ou non ;
        isHidden: () => p.hidden,
      // fin de la planète ;
      })),
      // la Lune ;
      { el: marker(null, moon.name, '#d8d2c4'), name: moon.name, pos: this.moonGroup.position, radius: moon.radius, kind: 'satellite', isHidden: () => this.moonHidden },
      // chaque satellite (début) :
      ...this.satellites.list.map((sat) => ({
        // son repère, son nom, sa position, son rayon et sa famille ;
        el: marker(null, sat.def.name, sat.def.color || '#d8d2c4'), name: sat.def.name, pos: sat.group.position, radius: sat.def.radius, kind: 'satellite',
        // masqué ou non ;
        isHidden: () => Boolean(sat.hidden || sat.lodHidden),
      // fin du satellite.
      })),
    // Fin des repères.
    ];
    // Lanceur de rayons, pour les clics.
    this.raycaster = new THREE.Raycaster();
    // Position du pointeur.
    this.pointer = new THREE.Vector2();
  // Fin de initLabels.
  }

  // ------------------------------------------------------------------- commandes

  // `planetOnly` (navigation, menu des satellites replié) : cadre la planète seule au lieu de tout son système.
  setFocus(i, { planetOnly = false } = {}) {
    // Note l'activité.
    this.markActive?.();
    // Arrête le zoom d'arrivée.
    this.zoomFlight = null;
    // Borne l'indice.
    i = clamp(i, 0, this.focusTargets.length - 1);
    // Astre d'une famille masquée (Paramètres) : on n'y va pas.
    if (this.isTargetHidden(this.focusTargets[i])) return;
    // Se téléporter sur un astre (même celui où l'on est déjà) ramène toujours au zoom par défaut de cet astre.
    // Les trajets vers un lieu (ville, site) fixent ensuite leur propre altitude.
    this.releaseLocks();
    // Si la cible change (début).
    if (i !== this.focus) {
      // Le verrouillage de la vue est lié à l'astre focus : il tombe quand on en change.
      this.viewLock = null;
      // Le cap de la boussole est propre à l'astre : on repart du nord de scène.
      this.heading = 0;
      // Cap voulu : le nord.
      this.headingGoal = 0;
      // Plus d'inclinaison pilotée.
      this.pilotTilt = null;
    // Fin de ce cas.
    }
    // Garde la cible.
    this.focus = i;
    // Point de départ de la transition.
    this.targetStart.copy(this.target);
    // Transition au début.
    this.focusT = 0;
    // La cible.
    const t = this.focusTargets[i];
    // Distance voulue : celle par défaut de l'astre.
    this.distGoal = defaultDistance(t.body ? bodyId(t.body.def) : undefined, t.r, MAX_DISTANCE, Boolean(planetOnly) && Boolean(t.body));
    // HUD à mettre à jour.
    this.hudAt = 0;
    // Prévient l'interface.
    this.onFocusChange(i);
  // Fin de setFocus.
  }

  // Page d'un astre (/mars, /titan…) : l'adresse est le nom français sans accent ni majuscule. Faux si aucun astre.
  focusBySlug(slug) {
    // fold : met un nom sans accent ni majuscule.
    const fold = (v) => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    // Cible de ce nom.
    const i = this.focusTargets.findIndex((t) => fold(t.name) === fold(slug));
    // Aucune : faux.
    if (i < 0) return false;
    // Cible différente : y va.
    if (i !== this.focus) this.setFocus(i);
    // Vrai.
    return true;
  // Fin de focusBySlug.
  }

  // f < 1 rapproche la caméra, f > 1 l'éloigne ; appliqué à l'altitude visée au-dessus de l'astre (cumulable).
  // De loin c'est la même chose que la distance ; de près, le zoom reste progressif jusqu'au sol (Terre comme Lune).
  zoom(f) {
    // Note l'activité.
    this.markActive();
    // Arrête le zoom d'arrivée.
    this.zoomFlight = null; // zoom repris à la main : le zoom d'arrivée s'arrête là
    // Rayon de la cible.
    const radius = this.focusTarget().r || 1;
    // Géante gazeuse : pas de sol. Dehors, le zoom porte sur l'altitude au-dessus des nuages, comme pour un sol :
    // l'approche reste progressive jusqu'à GAS_MIN_ALTITUDE_RADII. Zoomer encore à ce plancher fait traverser la
    // couche de nuages ; dedans, le zoom porte sur la distance au centre, et dézoomer fait ressortir.
    if (this.focusTarget().passable) {
      // Rayon local.
      const local = this.localRadius();
      // Plancher au-dessus des nuages.
      const floor = local * (1 + GAS_MIN_ALTITUDE_RADII);
      // Hors des nuages (début).
      if (this.distGoal > local) {
        // « Au plancher » : visé ET atteint par la caméra, pour qu'un zoom continu s'arrête d'abord au ras des nuages.
        const atFloor = this.distGoal <= floor * (1 + 1e-9) && this.dist <= floor * 1.02;
        // Altitude au-dessus des nuages.
        const altitude = Math.max(this.distGoal, floor) - local;
        // Au plancher en zoomant : entre dans les nuages ; sinon l'altitude est multipliée, bornée.
        this.distGoal = f < 1 && atFloor ? local * GAS_ENTRY_RADII : clamp(local + altitude * f, floor, MAX_DISTANCE);
      // Dans les nuages (début).
      } else {
        // Dans les nuages (Jupiter), le pas est adouci : un cran traverse à peu près un pont nuageux.
        const next = this.distGoal * cloudZoomFactor(bodyId(this.focusTarget().body.def), this.distGoal / local, f);
        // Ressortie au-dessus des nuages, ou distance au centre, 2 % du rayon au moins.
        this.distGoal = next > local * GAS_ENTRY_RADII ? local * (1 + 4 * GAS_MIN_ALTITUDE_RADII) : Math.max(next, radius * 0.02);
      // Fin du choix.
      }
      // Terminé.
      return;
    // Fin du cas « géante gazeuse ».
    }
    // Distance minimale : 1,03 rayon pour le Soleil, 1,08 sinon.
    let minDistance = radius * (this.focus === 0 ? 1.03 : 1.08);
    // Astre tuilé ciblé.
    const tb = this.focusedTiled();
    // Avec une carte : l'altitude minimale de l'astre.
    if (tb?.tiles.active) minDistance = radius * (1 + minAltitudeRadii(tb.cfg));
    // Couche de nuages opaque sans carte du sol (Vénus sans fond Trek) : on peut quand même traverser l'atmosphère.
    else if (tb && underCloudFloorRadii(tb.cfg.id)) minDistance = radius * (1 + underCloudFloorRadii(tb.cfg.id));
    // Modèle irrégulier affiché : la caméra reste au-dessus de son plus grand axe (plus long que le rayon moyen).
    if (tb?.model && tb.modelWanted && tb.cfg.modelMinDistanceRadii) minDistance = Math.max(minDistance, radius * tb.cfg.modelMinDistanceRadii);
    // Altitude visée au-dessus de l'astre.
    const altitude = Math.max(this.distGoal, minDistance) - radius;
    // Nouvelle distance voulue, bornée.
    this.distGoal = clamp(radius + altitude * f, minDistance, MAX_DISTANCE);
  // Fin de zoom.
  }

  /**
   * Distance à la caméra rapportée au rayon de l'astre ciblé, mesurée depuis le sol (0 au sol) ; depuis le centre
   * pour une géante gazeuse, qui n'a pas de sol (la rotation reste possible à l'intérieur).
   */
  // surfaceRatio : la distance à la caméra rapportée au rayon de l'astre (début).
  surfaceRatio() {
    // La cible.
    const f = this.focusTarget();
    // Astre à sol : distance au sol, en rayons.
    if (!f.passable) return this.dist / (f.r || 1) - 1;
    // Géante gazeuse : au-dessus des nuages, altitude en rayons locaux (rotation et glisser d'autant plus fins qu'on
    // est près) ; à l'intérieur, distance au centre.
    const local = this.localRadius();
    // Au-dessus des nuages : altitude en rayons locaux ; dedans : distance au centre en rayons.
    return this.dist > local ? Math.max(this.dist / local - 1, 1e-6) : this.dist / (f.r || 1);
  // Fin de surfaceRatio.
  }

  /**
   * Rayon de l'astre ciblé à la verticale de la caméra (scène). Sphère : son rayon. Géante gazeuse aplatie : rayon de
   * l'ellipsoïde à la latitude survolée (plus court vers les pôles : 10 % de moins pour Saturne).
   */
  // localRadius : le rayon de l'astre à la verticale de la caméra (début).
  localRadius() {
    // La cible.
    const f = this.focusTarget();
    // Son rayon.
    const r = f.r || 1;
    // Son aplatissement.
    const flattening = f.tiled?.cfg.flattening;
    // Sans aplatissement : le rayon.
    if (!flattening) return r;
    // Cosinus de l'élévation.
    const ce = Math.cos(this.el);
    // Direction de la caméra.
    const n = this.radN.set(Math.sin(this.az) * ce, Math.sin(this.el), Math.cos(this.az) * ce);
    // Sinus de la latitude survolée.
    const s = n.dot(this.northAxis(this.radAxis)); // sinus de la latitude survolée
    // Rapport des deux axes.
    const b = 1 - flattening;
    // Rayon de l'ellipsoïde à cette latitude.
    return (r * b) / Math.sqrt(b * b * (1 - s * s) + s * s);
  // Fin de localRadius.
  }

  // resetView : revient à la vue globale (début).
  resetView() {
    // Cible : le Soleil.
    this.setFocus(0);
    // Azimut d'origine.
    this.az = 0.8;
    // Élévation d'origine.
    this.el = 0.8;
    // Distance de la vue globale.
    this.distGoal = VIEW_DISTANCE;
  // Fin de resetView.
  }

  // ------------------------------------------------------------------ boussole

  /** Pôle nord géographique de l'astre ciblé, en coordonnées de scène (Terre, Lune et Mars sont inclinées). */
  /** Nord de l'astre ciblé (axe de rotation propre) ; Soleil, vue d'ensemble et astres sans axe : nord du système (pôle de l'écliptique). */
  // northAxis : l'axe nord de l'astre ciblé (début).
  northAxis(out = new THREE.Vector3()) {
    // Nord de la scène.
    out.set(0, 1, 0);
    // Astre tuilé ciblé.
    const tb = this.focusedTiled();
    // S'il y en a un : tourné selon son orientation.
    if (tb) out.applyQuaternion(tb.group.quaternion);
    // Le renvoie.
    return out;
  // Fin de northAxis.
  }

  /**
   * État de la boussole : angle du nord vrai à l'écran (0 = en haut, positif vers la droite) et cap à appliquer
   * pour le remettre en haut. Sur le Soleil, le nord est celui du système (pôle de l'écliptique). `null` aux pôles,
   * où le nord n'a pas de direction.
   */
  // compassState : l'angle du nord à l'écran et le cap qui le remet en haut (début).
  compassState() {
    // Sinus et cosinus de l'azimut.
    const sa = Math.sin(this.az), ca = Math.cos(this.az);
    // Sinus et cosinus de l'élévation.
    const se = Math.sin(this.el), ce = Math.cos(this.el);
    // Verticale locale du point visé.
    const n = this.compassN.set(ce * sa, se, ce * ca);
    // Projection du pôle sur le plan tangent au point visé : direction du nord géographique local.
    const axis = this.northAxis(this.compassAxis);
    // Nord local : l'axe projeté sur le plan tangent.
    const north = this.compassNorth.copy(axis).addScaledVector(n, -axis.dot(n));
    // Sa longueur.
    const len = north.length();
    // Nulle, au pôle : null.
    if (len < 1e-6) return null;
    // Rendu unitaire.
    north.divideScalar(len);

    // Droite de l'image = haut × normale (colinéaire à la tangente est) ; le haut inclut la verticale locale.
    const right = this.compassRight.copy(this.tiltUp).cross(n);
    // Sa longueur.
    const rl = right.length();
    // Nulle : null.
    if (rl < 1e-9) return null;
    // Rendue unitaire.
    right.divideScalar(rl);
    // Angle du nord à l'écran.
    const angle = Math.atan2(north.dot(right), north.dot(this.tiltUp));

    // Cap (dans la base nord/est de la scène) qui amène ce nord en haut de l'image.
    const tX = -se * sa, tZ = -se * ca;
    // Cap qui amène le nord en haut.
    const bearing = Math.atan2(north.x * ca - north.z * sa, north.x * tX + north.y * ce + north.z * tZ);
    // Renvoie l'angle, le cap et si c'est le nord du système.
    return { angle, bearing, system: !this.focusedTiled() };
  // Fin de compassState.
  }

  /** Recale la caméra sur le nord géographique de l'astre ciblé. Renvoie false si le nord est indéfini. */
  // recalibrateNorth : remet le nord en haut de l'écran (début).
  recalibrateNorth() {
    // État de la boussole.
    const state = this.compassState();
    // Nord indéfini : faux.
    if (!state) return false;
    // Cap voulu : celui qui remet le nord en haut.
    this.headingGoal = state.bearing;
    // Vrai.
    return true;
  // Fin de recalibrateNorth.
  }

  /**
   * Attitude de la caméra pour la navball : matrice 3 × 3 (lignes = droite, haut, avant de la caméra ; colonnes =
   * est, haut local, sud) dans le repère local du point survolé de l'astre ciblé. Nord = axe propre de l'astre,
   * ou nord du système (écliptique) pour le Soleil. Renvoie `out` (9 nombres, ligne par ligne) ou null.
   */
  // navballAttitude : l'attitude de la caméra dans le repère local du point survolé (début).
  navballAttitude(out = new Array(9)) {
    // Sinus et cosinus de l'azimut.
    const sa = Math.sin(this.az), ca = Math.cos(this.az);
    // Sinus et cosinus de l'élévation.
    const se = Math.sin(this.el), ce = Math.cos(this.el);
    // Verticale locale.
    const up = this.navUp.set(ce * sa, se, ce * ca);
    // Axe nord de l'astre.
    const axis = this.northAxis(this.navAxis);
    // Nord local : l'axe projeté sur le plan tangent.
    const north = this.navNorth.copy(axis).addScaledVector(up, -axis.dot(up));
    // Au pôle : un nord arbitraire.
    if (north.lengthSq() < 1e-12) north.set(0, 0, -1).addScaledVector(up, up.z); // pôle : nord arbitraire
    // Rendu unitaire.
    north.normalize();
    // Est local.
    const east = this.navEast.copy(north).cross(up).normalize();
    // Sud local.
    const south = this.navSouth.copy(north).negate();
    // Matrice de la caméra.
    const m = this.cam.matrixWorld.elements;
    // Sa droite.
    const right = this.navCam[0].set(m[0], m[1], m[2]);
    // Son haut.
    const camUp = this.navCam[1].set(m[4], m[5], m[6]);
    // Son avant.
    const forward = this.navCam[2].set(-m[8], -m[9], -m[10]);
    // Pour chacun des trois (début) :
    [right, camUp, forward].forEach((c, i) => {
      // ses composantes sur l'est, le haut et le sud.
      out[i * 3] = c.dot(east); out[i * 3 + 1] = c.dot(up); out[i * 3 + 2] = c.dot(south);
    // Fin de la boucle.
    });
    // Renvoie le tableau.
    return out;
  // Fin de navballAttitude.
  }

  /**
   * Vue du globe de l'astre ciblé, pour la navball « globe » : droite, haut de la caméra et direction extérieure
   * (du centre de l'astre vers la caméra) exprimés dans le repère fixe de l'astre — N = (lat 0, lon 0),
   * E = (lat 0, lon 90° E), U = pôle Nord. La boule tourne donc avec l'astre et avec les déplacements de la caméra.
   * Renvoie { f, r, u } (tableaux [N, E, U]) ou null.
   */
  // globeView : la vue du globe dans le repère fixe de l'astre (début).
  globeView() {
    // La cible.
    const f = this.focusTarget();
    // Son maillage : tuilé, planète, Lune, satellite ou Soleil.
    const mesh = f.tiled?.mesh || f.body?.mesh || (f.moon ? this.moon : null) || f.satellite?.mesh || (this.focus === 0 ? this.sunMesh : null);
    // Aucun : null.
    if (!mesh) return null;
    // Met à jour sa matrice.
    mesh.updateWorldMatrix(true, false);
    // Inverse de son orientation.
    const q = mesh.getWorldQuaternion(this.globeQ).invert();
    // Matrice de la caméra.
    const m = this.cam.matrixWorld.elements;
    // toBody : passe un vecteur dans le repère de l'astre, en [N, E, U].
    const toBody = (v) => { v.applyQuaternion(q); return [v.x, -v.z, v.y]; };
    // Renvoie (début)
    return {
      // la droite de la caméra,
      r: toBody(this.globeV.set(m[0], m[1], m[2]).normalize()),
      // son haut
      u: toBody(this.globeV.set(m[4], m[5], m[6]).normalize()),
      // et la direction vers l'œil.
      f: toBody(this.globeV.set(m[8], m[9], m[10]).normalize()), // arrière de la caméra = vers l'œil
    // Fin du résultat.
    };
  // Fin de globeView.
  }

  /**
   * Pilotage de la caméra depuis la navball (degrés) : `dh` tourne la vue autour de la verticale locale (cap),
   * `dp` incline la caméra (tangage : −90° = regard vertical, −30° = inclinaison maximale vers l'horizon).
   * L'inclinaison pilotée remplace la vue 3/4 automatique jusqu'au prochain changement d'astre ou recentrage.
   */
  // pilot : pilote la caméra depuis la navball, en degrés (début).
  pilot({ dh = 0, dp = 0 } = {}) {
    // Un mouvement : note l'activité.
    if (dh || dp) this.markActive();
    // Changement de cap (début).
    if (dh) {
      // Tourne le cap voulu.
      this.headingGoal += dh * D;
      // Et le cap, sans transition.
      this.heading += dh * D;
    // Fin de ce cas.
    }
    // Changement d'inclinaison (début).
    if (dp) {
      // Inclinaison de départ : la pilotée, sinon l'actuelle.
      const base = this.pilotTilt ?? this.tiltV;
      // Nouvelle inclinaison, bornée.
      this.pilotTilt = Math.max(0, Math.min(TILT_MAX_ANGLE, base + dp * D));
    // Fin de ce cas.
    }
  // Fin de pilot.
  }

  /**
   * Déplace la vue autour de l'astre le long des axes de l'écran (radians) : `right` vers la droite, `forward` vers
   * le haut (le nord quand il est verrouillé en haut). Comme un glisser : d'autant plus fin qu'on est proche du sol,
   * et il reprend la main sur un lieu suivi.
   */
  // moveBy : déplace la vue le long des axes de l'écran, en radians (début).
  moveBy(right = 0, forward = 0) {
    // Aucun mouvement : rien.
    if (!right && !forward) return;
    // Lâche les lieux suivis.
    this.releaseLocks();
    // Finesse du pas selon la proximité du sol.
    const k = Math.max(1e-9, Math.min(1, this.surfaceRatio() * 0.9));
    // Nouvelle position sur la sphère.
    const next = moveOnSphere({ az: this.az, el: this.el, heading: this.heading }, right * k, forward * k);
    // Nouvel azimut.
    this.az = next.az;
    // Nouvelle élévation.
    this.el = next.el;
  // Fin de moveBy.
  }

  /**
   * Glisser au doigt ou à la souris de (dx, dy) pixels : le sol reste sous le doigt à tout niveau de zoom, le long
   * des axes de l'écran (cap et vue 3/4 compris). Ne touche pas aux lieux suivis : l'appelant décide de les lâcher.
   */
  // dragBy : glisse la vue de quelques pixels (début).
  dragBy(dx, dy) {
    // Aucun mouvement : rien.
    if (!dx && !dy) return;
    // Pas de rotation correspondant aux pixels, vue inclinée comprise.
    const step = dragStep(dx, dy, dragRadPerPx(this.surfaceRatio(), this.cam.fov, this.H), this.tiltV || 0);
    // Nouvelle position sur la sphère.
    const next = moveOnSphere({ az: this.az, el: this.el, heading: this.heading }, step.right, step.forward);
    // Nouvel azimut.
    this.az = next.az;
    // Nouvelle élévation.
    this.el = next.el;
  // Fin de dragBy.
  }

  /** Verrou du nord : tant qu'il est actif, le nord reste en haut de l'écran (le sud en bas), même en tournant. */
  // setNorthLock : verrouille ou libère le nord en haut de l'écran (début).
  setNorthLock(on) {
    // Garde l'état.
    this.northLock = Boolean(on);
    // Recalage instantané : le cap saute directement sur le nord, sans transition.
    if (this.northLock && this.recalibrateNorth()) this.heading = this.headingGoal;
    // Renvoie l'état.
    return this.northLock;
  // Fin de setNorthLock.
  }

  // goCity : va à une ville de la liste (début).
  goCity(index) {
    // Cible : la Terre.
    this.setFocus(this.earthFocus);
    // Distance voulue : plus près avec une carte.
    this.distGoal = this.tiles.active ? 1.0004 : 1.004; // ≈ 2,5 km d'altitude avec une carte
    // Suit la ville.
    this.lockCity = this.cityItems[index];
  // Fin de goCity.
  }

  /**
   * Va vers n'importe quel lieu de la Terre (ex. résultat de la recherche mondiale).
   * `follow` : le lieu est la position de l'utilisateur, la caméra le suit quand il se déplace (setUserPosition).
   * `fly` : zoom d'arrivée — la caméra se place à la verticale du lieu, part de haut et descend d'un seul mouvement.
   */
  // goTo : va à un lieu de la Terre (début).
  goTo({ name, lon, lat, altitudeM, follow = false, fly = false }) {
    // Cible : la Terre.
    this.setFocus(this.earthFocus);
    // Si une altitude est demandée (début).
    if (Number.isFinite(altitudeM) && altitudeM > 0) {
      // Altitude demandée (ex. point GPS à l'échelle de 10 m), jamais sous le plancher autorisé avec une carte.
      const floor = this.tiles.active ? minAltitudeRadii(TILED_BODY_BY_ID.earth) : 0.004;
      // Distance voulue : l'altitude demandée, jamais sous le plancher.
      this.distGoal = 1 + Math.max(floor, altitudeM / EARTH_RADIUS_M);
    // Sinon (début).
    } else {
      // Distance par défaut : plus près avec une carte.
      this.distGoal = this.tiles.active ? 1.0004 : 1.004;
    // Fin du choix.
    }
    // Suit le lieu ; « user » s'il s'agit de la position de l'utilisateur.
    this.lockCity = { name, lon, lat, lv: lonLatToVec([lon, lat]), user: Boolean(follow) };
    // Pas de zoom d'arrivée, a priori.
    this.zoomFlight = null;
    // Animations réduites demandées dans le système : pas de zoom d'arrivée, la vue se pose directement.
    if (fly && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      // Plan du zoom d'arrivée.
      const plan = flightPlan(this.dist, this.distGoal);
      // S'il y en a un : la caméra part de haut.
      if (plan) { this.dist = plan.from; this.zoomFlight = { plan, t: 0 }; }
    // Fin de ce cas.
    }
  // Fin de goTo.
  }

  /** Point bleu de la position de l'utilisateur sur la Terre : { lat, lon, accuracyM?, headingDeg? }, ou null pour l'enlever. */
  // setUserPosition : pose ou enlève le point de la position de l'utilisateur (début).
  setUserPosition(position) {
    // Met à jour le point.
    this.userMarker.set(position);
    // Caméra posée sur « Ma position » : elle suit l'utilisateur quand il se déplace.
    const lock = this.lockCity;
    // Latitude et longitude reçues.
    const lat = Number(position?.lat), lon = Number(position?.lon);
    // Si la caméra suit l'utilisateur et que la position est valable (début).
    if (lock?.user && position && Number.isFinite(lat) && Number.isFinite(lon)) {
      // Nouvelle latitude du lieu suivi.
      lock.lat = lat;
      // Nouvelle longitude.
      lock.lon = lon;
      // Nouvelle direction.
      lock.lv = lonLatToVec([lon, lat]);
    // Fin de ce cas.
    }
  // Fin de setUserPosition.
  }

  /** Marges (px CSS) de la zone dont on donne les coins : le bas de l'écran mobile est couvert par la barre d'outils. */
  // setGpsInsets : règle les marges de la zone utile (début).
  setGpsInsets(insets) {
    // Les garde, à zéro par défaut.
    this.gpsInsets = { top: 0, right: 0, bottom: 0, left: 0, ...insets };
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de setGpsInsets.
  }

  /** Affiche ou masque les coordonnées GPS des coins de l'écran. */
  // setGpsVisible : affiche ou masque les coordonnées des coins (début).
  setGpsVisible(on) {
    // Garde l'état.
    this.gpsOn = Boolean(on);
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de setGpsVisible.
  }

  /**
   * Coordonnées GPS des quatre coins et du centre de l'écran, et échelle au centre (Terre suivie seulement).
   * Le rayon de chaque coin est intersecté avec la surface réellement dessinée (rayon des tuiles du niveau affiché,
   * légèrement au-dessus de la sphère) : le point affiché est celui qu'on voit à l'écran, au centimètre près.
   */
  // gpsState : les coordonnées des coins et du centre de l'écran (début).
  gpsState() {
    // Coordonnées masquées, ou cible autre que la Terre : null.
    if (!this.gpsOn || this.focus !== this.earthFocus) return null;
    // La Terre.
    const E = this.earth;
    // La caméra.
    const cam = this.cam;
    // Met à jour la matrice de la Terre.
    E.mesh.updateWorldMatrix(true, false);
    // Matrice de la caméra.
    const c = cam.matrixWorld.elements;
    // Matrice de la Terre.
    const m = E.mesh.matrixWorld.elements;
    // Couche de tuiles affichée, s'il y a une carte.
    const layer = this.tiles.active ? this.tiles.base?.layer : null;
    // Rayon du sol dessiné : celui du niveau affiché, ou 1.
    const ground = layer ? tileRadius(layer.visibleZoom, layer.gap) : 1;
    // Échelle de la Terre dans la scène.
    const scale = Math.hypot(m[0], m[1], m[2]);
    // Calcule les coordonnées (début) :
    const geo = screenGeo({
      // position de la caméra,
      origin: [c[12], c[13], c[14]],
      // sa droite,
      right: [c[0], c[1], c[2]],
      // son haut,
      up: [c[4], c[5], c[6]],
      // son avant,
      forward: [-c[8], -c[9], -c[10]],
      // tangente du demi-champ vertical,
      tanY: Math.tan((cam.fov * D) / 2),
      // format de l'image,
      aspect: cam.aspect,
      // centre de la Terre,
      center: [m[12], m[13], m[14]],
      // rayon du sol dans la scène,
      radius: (E.def.radius || 1) * scale * ground,
      // matrice vers le repère de la Terre,
      toLocal: this.gpsInv.copy(E.mesh.matrixWorld).invert().elements,
      // largeur de l'écran,
      widthPx: this.W,
      // rayon du sol en mètres,
      radiusM: EARTH_RADIUS_M * ground,
      // points de la zone utile.
      points: insetCorners(this.gpsInsets, this.W, this.H),
    // Fin du calcul.
    });
    // Rien à afficher tant que l'écran ne touche pas la Terre.
    if (!geo.center && geo.corners.every((k) => k.lat === null)) return null;
    // Renvoie les coordonnées.
    return geo;
  // Fin de gpsState.
  }

  // setAutoRotate : active ou coupe la rotation automatique.
  setAutoRotate(on) { this.autoRotate = on; }
  /** Vitesse de la rotation automatique autour de l'astre : multiplicateur de la vitesse d'origine (0,25 à 8). */
  // setRotateSpeed : règle le multiplicateur, entre 0,25 et 8 ; 1 s'il est illisible.
  setRotateSpeed(k) { const n = Number(k); this.rotateSpeed = Number.isFinite(n) ? clamp(n, 0.25, 8) : 1; }

  // ------------------------------------------------------------ Lune en direct

  /**
   * Survole un lieu d'un astre tuilé (clic sur un nom, repère du catalogue). Altitude par défaut : `siteAltitudeKm`
   * du modèle (≈ 50 km pour la Lune, 200 à 300 km pour les planètes).
   */
  // goToSite : survole un lieu d'un astre tuilé (début).
  goToSite(id, { lon, lat }, altitudeKm) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu ou sans cible : rien.
    if (!tb || tb.focus < 0) return;
    // Le cible.
    this.setFocus(tb.focus);
    // Altitude : celle demandée, sinon celle de l'astre.
    const km = altitudeKm ?? tb.cfg.siteAltitudeKm;
    // Distance voulue : cette altitude avec une carte, sinon 1,15 rayon.
    this.distGoal = tb.radius * (tb.tiles.active ? 1 + km / tb.cfg.radiusKm : 1.15);
    // Suit le lieu.
    tb.lock = { lon, lat, lv: lonLatToVec([lon, lat]) };
  // Fin de goToSite.
  }

  /** Libère la caméra de tout lieu suivi (ville de la Terre, lieu survolé d'un astre). */
  // releaseLocks : lâche tout lieu suivi (début).
  releaseLocks() {
    // Plus de ville suivie.
    this.lockCity = null;
    // Plus de lieu suivi sur les astres tuilés.
    for (const tb of this.tiledBodies) tb.lock = null;
  // Fin de releaseLocks.
  }

  /** Face visible (tournée vers la Terre) ou face cachée. */
  // viewMoonSide : montre la face visible ou la face cachée de la Lune (début).
  viewMoonSide(side = 'near') {
    // Cible la Lune si besoin.
    if (this.focus !== this.moonFocus) this.setFocus(this.moonFocus);
    // Lâche le lieu suivi.
    this.tiledById.moon.lock = null;
    // Met à jour la matrice de la Lune.
    this.moonGroup.updateMatrixWorld(true);
    // Direction du centre de la face, dans la scène.
    const n = lonLatToVec([side === 'far' ? 180 : 0, 0]).applyQuaternion(this.moonGroup.quaternion).normalize();
    // Élévation correspondante.
    this.el = Math.asin(clamp(n.y, -1, 1));
    // Azimut correspondant.
    this.az = Math.atan2(n.x, n.z);
    // Rayon de la Lune.
    const r = this.data.bodies.moon.radius;
    // Trop près : recule à 3,2 rayons.
    if (this.distGoal < r * 2.5) this.distGoal = r * 3.2;
  // Fin de viewMoonSide.
  }

  // setMoonFeatureTypes : choisit les types de lieux affichés.
  setMoonFeatureTypes(types) { this.moonFeatureTypes = new Set(types); this.applyMoonFeatures(); }
  // applyMoonFeatures : applique ce choix (début).
  applyMoonFeatures() {
    // Lieux des types choisis.
    const items = MOON_FEATURES.filter((f) => this.moonFeatureTypes.has(f.type));
    // Les donne aux étiquettes.
    this.moonLabels.setCities(items);
    // Aucun : cache les étiquettes.
    if (!items.length) this.moonLabels.hideFrom(0);
  // Fin de applyMoonFeatures.
  }

  /** Danuri / ShadowCam : catalogue (GET /danuri/shadowcam) et accès aux images. */
  // setShadowCam : reçoit le catalogue ShadowCam et l'accès aux images.
  setShadowCam(items, api) { this.shadowcam.api = api; this.shadowcam.setCatalog(items || []); this.hudAt = 0; }
  // setShadowCamVisible : affiche ou masque les mosaïques.
  setShadowCamVisible(on) { this.shadowcam.setVisible(on); }

  /** Sondes en orbite : réponse de GET /ephemeris/moon/orbiters. */
  // setMoonOrbiters : reçoit les sondes.
  setMoonOrbiters(data) { this.orbiterData = data; this.orbiters.setData(data?.items || []); }
  // setMoonOrbitersVisible : affiche ou masque les sondes.
  setMoonOrbitersVisible(on) { this.orbiters.setVisible(on); }
  // selectOrbiter : sélectionne ou désélectionne une sonde (début).
  selectOrbiter(id) {
    // La même sonde une seconde fois : désélection.
    this.selectedOrbiter = this.selectedOrbiter === id ? null : id;
    // Transmet la sélection.
    this.orbiters.select(this.selectedOrbiter);
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de selectOrbiter.
  }

  // ------------------------------------------------- astres tuilés (modèle commun)

  /**
   * Modèle 3D (glTF) d'un astre pour la vue d'ensemble ; les tuiles prennent le relais en zoomant.
   * Même éclairage et mêmes couleurs que ses tuiles (uniforms partagés). Aujourd'hui : la Lune (NASA SVS).
   */
  // loadBodyModel, asynchrone : charge le modèle 3D d'un astre (début).
  async loadBodyModel(id, url) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu : null.
    if (!tb) return null;
    // Déjà chargé ou en chargement : la promesse en cours.
    if (tb.model || tb.modelLoading) return tb.modelLoading;
    // Charge le modèle ; à l'arrivée (début).
    tb.modelLoading = loadMoonModel(url, tb.radius, tb.tiles.uniforms, { maxRms: tb.cfg.modelMaxRms }).then(({ object, info }) => {
      // Moteur arrêté : rien de plus.
      if (this.stopped) return info;
      // Garde le modèle.
      tb.model = object;
      // Masqué au départ.
      object.visible = false;
      // L'ajoute au groupe.
      tb.group.add(object);
      // Renvoie ses informations.
      return info;
    // Dans tous les cas : plus de chargement en cours.
    }).finally(() => { tb.modelLoading = null; });
    // Renvoie la promesse.
    return tb.modelLoading;
  // Fin de loadBodyModel.
  }
  // setBodyModelVisible : note si le modèle d'un astre est voulu.
  setBodyModelVisible(id, on) { const tb = this.tiledById[id]; if (tb) tb.modelWanted = on; }
  // loadMoonModel : charge le modèle de la Lune.
  loadMoonModel(url) { return this.loadBodyModel('moon', url); }
  // setMoonModelVisible : note si le modèle de la Lune est voulu.
  setMoonModelVisible(on) { this.setBodyModelVisible('moon', on); }

  /** Après la mise à jour des tuiles : modèle de loin, tuiles de près (pour chaque astre qui a un modèle). */
  // updateBodyModel : choisit entre le modèle et les tuiles (début).
  updateBodyModel(tb) {
    // Le modèle.
    const m = tb.model;
    // Aucun : rien.
    if (!m) return;
    // Planètes : le modèle tourne avec la planète, comme ses tuiles (la Lune est orientée par son groupe).
    if (tb.syncMesh) m.rotation.y = tb.mesh.rotation.y;
    // Les pôles des modèles sont pincés (défaut connu des modèles NASA SVS) : vue polaire → tuiles, toujours nettes.
    const rel = this.tmpV.copy(this.cam.position).sub(tb.group.position);
    // Distance de la caméra à l'astre.
    const dist = rel.length();
    // Sinus de la latitude survolée.
    const localUp = rel.applyQuaternion(this.moonQInv.copy(tb.group.quaternion).invert()).y / (dist || 1);
    // Astre irrégulier (Phobos) : le modèle est sa vraie forme, il reste affiché de près et sous tous les angles.
    const far = tb.modelWanted && (tb.cfg.modelAlways
      // ou de loin, hors vue polaire.
      || (dist > tb.radius * (tb.cfg.modelSwitchRadii ?? 2.2) && Math.abs(localUp) < MODEL_POLAR_LIMIT));
    // Modèle visible de loin.
    m.visible = far;
    // Tuiles visibles de près.
    tb.tiles.root.visible = !far;
    // De loin : la sphère de fond est masquée.
    if (far) tb.mesh.visible = false;
  // Fin de updateBodyModel.
  }

  /**
   * Satellites selon le zoom : un satellite n'est dessiné (sphère, repère, clic) que si le rayon de son orbite est
   * assez grand à l'écran pour qu'il se détache de sa planète, ou s'il est l'astre ciblé. Vu de loin, un système
   * planétaire se réduit ainsi à sa planète. Le réglage « masqué » de Paramètres reste prioritaire.
   */
  // updateSatelliteLod : applique le niveau de zoom aux satellites (début).
  updateSatelliteLod(pxScale) {
    // Position de la caméra.
    const cp = this.cam.position;
    // Pour chaque satellite (début).
    for (const s of this.satellites.list) {
      // Rayon apparent de son orbite, vu depuis la caméra.
      const orbitPx = apparentPx(s.rel.length(), cp.distanceTo(s.parent.group.position), pxScale);
      // Dessiné ou non, d'après ce rayon, l'astre ciblé et son état à l'image précédente.
      const shown = satelliteShown({ orbitPx, focused: s.focus === this.focus, shown: !s.lodHidden });
      // Garde l'état pour l'image suivante, les repères et les clics.
      s.lodHidden = !shown;
      // Règle son groupe : dessiné, et non masqué dans Paramètres.
      s.group.visible = shown && !s.hidden;
    // Fin de la boucle.
    }
  // Fin de updateSatelliteLod.
  }

  /**
   * Plan des tuiles de cette image : identifiants des astres dont les tuiles sont mises à jour. Un astre masqué,
   * hors du champ de la caméra ou trop petit à l'écran n'en fait pas partie ; l'astre ciblé en fait toujours partie.
   * Le nombre d'astres servis à la fois est borné (deux sur téléphone, trois sur ordinateur, plus un à tour de rôle).
   */
  // planTiles : calcule le plan des tuiles (début).
  planTiles(pxScale) {
    // Direction de visée de la caméra.
    const fwd = this.cam.getWorldDirection(this.tmpV);
    // La même, en tableau de trois nombres.
    const dir = [fwd.x, fwd.y, fwd.z];
    // Demi-angle du cône qui contient tout le champ de la caméra.
    const half = viewConeHalfAngle(this.cam.fov * D, this.cam.aspect);
    // Position de la caméra.
    const cp = this.cam.position;
    // Candidats.
    const candidates = [];
    // Pour chaque astre tuilé (début).
    for (const tb of this.tiledBodies) {
      // Ciblé ou non.
      const focused = tb.focus === this.focus;
      // Masqué (Paramètres, ou satellite trop près de sa planète) et non ciblé : ignoré.
      if (!focused && !tb.group.visible) continue;
      // Sa position.
      const p = tb.group.position;
      // Sa position par rapport à la caméra.
      const rel = [p.x - cp.x, p.y - cp.y, p.z - cp.z];
      // Son rayon apparent en pixels.
      const px = apparentPx(tb.radius, Math.hypot(rel[0], rel[1], rel[2]), pxScale);
      // L'ajoute aux candidats, avec son niveau de détail.
      candidates.push({ id: tb.id, px, focused, level: bodyLevel({ px, inView: sphereInView(rel, dir, tb.radius, half), focused }) });
    // Fin de la boucle.
    }
    // Numéro de l'image, pour le tour de rôle.
    this.loadTick = (this.loadTick || 0) + 1;
    // Renvoie le plan, avec le budget du téléphone ou de l'ordinateur.
    return planTiledBodies(candidates, this.power.lite ? MAX_TILED_BODIES_LITE : MAX_TILED_BODIES, this.loadTick);
  // Fin de planTiles.
  }

  /** Fond cartographique d'un astre (id de couche `body: <id>` de l'API) ; null = aucun (sphère de fond seule). */
  // setBodyTileBase, asynchrone : choisit le fond de carte d'un astre (début).
  async setBodyTileBase(id, layerId) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu : null.
    if (!tb) return null;
    // Essai (début).
    try {
      // Change le fond.
      return await tb.tiles.setBase(layerId);
    // Dans tous les cas (début).
    } finally {
      // Sans carte, l'altitude minimale remonte : on recale le zoom si l'astre est ciblé.
      if (tb.tiles.active === false && this.focus === tb.focus) this.zoom(1);
    // Fin de l'essai.
    }
  // Fin de setBodyTileBase.
  }
  /** Source de tuiles du fond actif d'un astre (TileSource), ou null : sert au globe du plateau tournant. */
  // bodyBaseSource : la source du fond actif d'un astre, ou null.
  bodyBaseSource(id) { return this.tiledById?.[id]?.tiles.base?.source ?? null; }
  /** Calque optionnel (routes et noms pour la Terre, teinte d'un autre relief en mode composite), ou null. */
  // setBodyTileOverlay : choisit le calque d'un astre.
  setBodyTileOverlay(id, layerId) { return this.tiledById[id]?.tiles.setOverlay(layerId) ?? Promise.resolve(); }
  /** Mode composite : couleurs naturelles (texture globale) + détail en gris (si `pan`) + ombrage du relief. */
  // setBodyComposite : active ou coupe le mode composite d'un astre.
  setBodyComposite(id, on, opts) { this.tiledById[id]?.tiles.setComposite(on, opts); }

  /** Texture globale des couleurs naturelles (2:1 équirectangulaire) : tuiles, sphère de fond et modèle 3D. */
  // loadBodyColor : charge la texture globale des couleurs d'un astre (début).
  loadBodyColor(id, url) {
    // L'astre.
    const tb = this.tiledById[id];
    // Inconnu : promesse rejetée.
    if (!tb) return Promise.reject(new Error(`astre inconnu : ${id}`));
    // Renvoie une promesse (début).
    return new Promise((resolve, reject) => {
      // Chargeur de textures.
      const loader = new THREE.TextureLoader();
      // Sans identifiants.
      loader.setCrossOrigin('anonymous');
      // Charge l'image ; à l'arrivée (début).
      loader.load(url, (tex) => {
        // Moteur arrêté : la texture est libérée.
        if (this.stopped) { tex.dispose(); return; }
        // Répétition horizontale.
        tex.wrapS = THREE.RepeatWrapping; // continuité au méridien ±180°
        // Filtrage anisotrope, borné par la carte graphique.
        tex.anisotropy = Math.min(this.power.anisotropy, this.renderer.capabilities.getMaxAnisotropy());
        // La donne aux tuiles.
        tb.tiles.setColorTexture(tex);
        // Tient la promesse.
        resolve(tex);
      // En cas d'échec : promesse rejetée.
      }, undefined, () => reject(new Error(`texture des couleurs introuvable (${tb.cfg.mapLabel})`)));
    // Fin de la promesse.
    });
  // Fin de loadBodyColor.
  }
  // loadMoonColor : charge la texture des couleurs de la Lune.
  loadMoonColor(url) { return this.loadBodyColor('moon', url); }

  /** Détail simulé au-delà de la résolution des images (géantes gazeuses, satellites) : activé par défaut. */
  // setTileDetail : active ou coupe le détail simulé de tous les astres.
  setTileDetail(on) { for (const tb of this.tiledBodies) tb.tiles.setDetail(on); }

  /** Éclairage jour/nuit sur les cartes de tous les astres. */
  // setTileShade : active ou coupe l'ombre jour/nuit (début).
  setTileShade(on) {
    // Valeur visée : 1 ou 0.
    this.shadeGoal = on ? 1 : 0;
    // Premier réglage (ouverture de l'app) ou mouvement réduit demandé au système : immédiat. Ensuite, l'ombre
    // apparaît ou s'efface en fondu, image par image (voir updateShadeFade), en même temps que le thème de l'interface.
    const instant = this.shadeNow === undefined
      // ou animations réduites.
      || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    // Immédiat : applique la valeur.
    if (instant) this.applyShade(this.shadeGoal);
  // Fin de setTileShade.
  }

  /** Intensité de l'ombre jour/nuit (0 = astres entièrement éclairés, 1 = face nuit dans l'ombre) sur toutes les cartes. */
  // applyShade : applique une intensité d'ombre (début).
  applyShade(value) {
    // La garde.
    this.shadeNow = value;
    // La transmet aux tuiles de chaque astre.
    for (const tb of this.tiledBodies) tb.tiles.uniforms.shade.value = value;
    // Anneaux de Saturne : même réglage (ombre de la planète sur les anneaux, face éclairée ou non).
    for (const u of this.ringShades || []) u.value = value;
    // Objets éclairés par les lumières de la scène (astres sans carte ni réglage propre) : ombre coupée = lumière
    // d'ambiance pleine et Soleil éteint, donc éclairés partout ; ombre activée = Soleil seul.
    if (this.ambientLight) this.ambientLight.intensity = AMBIENT_SHADED + (1 - AMBIENT_SHADED) * (1 - value);
    // Lumière du Soleil : proportionnelle à l'ombre.
    if (this.sunLight) this.sunLight.intensity = SUN_LIGHT * value;
  // Fin de applyShade.
  }

  /** Fondu linéaire de l'ombre vers sa valeur visée, sur SHADE_FADE_MS (même durée que le fondu du thème). */
  // updateShadeFade : avance le fondu de l'ombre (début).
  updateShadeFade(dt) {
    // Pas d'ombre réglée, ou valeur atteinte : rien.
    if (this.shadeNow === undefined || this.shadeNow === this.shadeGoal) return;
    // Pas de cette image.
    const step = dt / SHADE_FADE_MS;
    // Valeur suivante : en montant,
    const next = this.shadeGoal > this.shadeNow
      // sans dépasser la valeur visée ;
      ? Math.min(this.shadeGoal, this.shadeNow + step)
      // ou en descendant, sans passer dessous.
      : Math.max(this.shadeGoal, this.shadeNow - step);
    // L'applique.
    this.applyShade(next);
  // Fin de updateShadeFade.
  }

  /** Indice (focusTargets) de l'astre affiché le plus proche de l'astre focus, ou −1. */
  // nearestToFocus : l'astre affiché le plus proche de la cible (début).
  nearestToFocus() {
    // Cherche parmi les positions des astres non masqués.
    return nearestIndex(this.focusTargets.map((t) => (this.isTargetHidden(t) ? null : t.get())), this.focus);
  // Fin de nearestToFocus.
  }

  /**
   * Verrouille la vue sur l'astre le plus proche de l'astre focus (true), ou la rend (false).
   * Verrouiller : possible que cet astre soit ou non dans le champ de la caméra. La caméra tourne aussitôt son
   * regard vers lui ; elle reste autour de l'astre focus, vers lequel le zoom continue d'avancer.
   * Rendre : la caméra retrouve aussitôt la position et le zoom qu'elle avait au moment du verrouillage.
   */
  // setViewLock : verrouille la vue sur l'astre le plus proche, ou la rend (début).
  setViewLock(on) {
    // Note l'activité.
    this.markActive?.();
    // HUD à mettre à jour.
    this.hudAt = 0;
    // Pour rendre la vue (début).
    if (!on) {
      // Le verrou en place.
      const lock = this.viewLock;
      // Plus de verrou.
      this.viewLock = null;
      // Même cible qu'au verrouillage : la caméra reprend sa position sauvegardée.
      if (lock && lock.focus === this.focus) { this.zoomFlight = null; Object.assign(this, lock.saved); }
      // Faux.
      return false;
    // Fin de ce cas.
    }
    // Déjà verrouillée : vrai.
    if (this.viewLock) return true;
    // Astre le plus proche.
    const index = this.nearestToFocus();
    // Aucun : faux.
    if (index < 0) return false;
    // Verrou : l'astre, la cible et la caméra sauvegardée.
    this.viewLock = { index, focus: this.focus, saved: saveCamera(this) };
    // Vrai.
    return true;
  // Fin de setViewLock.
  }

  /** État du verrouillage pour l'interface : { on, name (astre verrouillé ou à verrouiller), focusName }. */
  // viewLockState : l'état du verrouillage pour l'interface (début).
  viewLockState() {
    // Verrouillée ?
    const on = Boolean(this.viewLock);
    // Astre verrouillé, ou à verrouiller.
    const index = on ? this.viewLock.index : this.nearestToFocus();
    // Sa cible.
    const t = this.focusTargets[index];
    // Aucune : null.
    if (!t) return null;
    // Renvoie l'état, son nom et celui de la cible.
    return { on, name: t.name, focusName: this.focusTarget().name };
  // Fin de viewLockState.
  }

  /** Vue 3/4 automatique : inclinaison progressive près du sol (true par défaut), ou regard vertical (false). */
  // setTilt : active ou coupe la vue inclinée automatique.
  setTilt(on) { this.tiltOn = on; this.pilotTilt = null; }

  /** Frontières et littoraux : polylignes [lon, lat, …] de GET /borders (remplacent les précédentes). */
  // setBorders : reçoit les frontières, les littoraux et les pays (début).
  setBorders({ lines = [], coastlines = [], countries = [] }) {
    // build : remplace un jeu de lignes par de nouvelles, dans son style (début).
    const build = (old, polylines, style) => {
      // S'il y a un ancien jeu (début).
      if (old) {
        // Le retire du repère.
        this.bordersRoot.remove(old);
        // Libère sa géométrie.
        old.geometry.dispose();
        // Libère son matériau.
        old.material.dispose();
      // Fin de ce cas.
      }
      // Géométrie.
      const geometry = new THREE.BufferGeometry();
      // Positions : les segments des lignes.
      geometry.setAttribute('position', new THREE.BufferAttribute(buildBorderSegments(polylines), 3));
      // Segments de ligne (début) :
      const obj = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        // Couleur et opacité du style (frontières ou littoraux), sans écriture de profondeur.
        color: style.color, transparent: true, opacity: style.opacity, depthWrite: false,
      // Fin des segments.
      }));
      // Jamais écartés par le champ de vision.
      obj.frustumCulled = false;
      // Les ajoute au repère.
      this.bordersRoot.add(obj);
      // Les renvoie.
      return obj;
    // Fin de build.
    };
    // Frontières.
    this.borders = build(this.borders, lines, BORDER_STYLE);
    // Littoraux.
    this.coasts = build(this.coasts, coastlines, COAST_STYLE);
    // Milieu de chaque pays calculé depuis ses frontières : les noms s'y posent.
    this.countryLabels.setCountries(countries);
    // Applique la visibilité.
    this.applyBorders();
  // Fin de setBorders.
  }
  // setBordersVisible : affiche ou masque les frontières.
  setBordersVisible(on) { this.bordersOn = on; this.applyBorders(); }

  /** Dalles LiDAR en points 3D : manifestes de l'API (GET /lidar → items), puis affichage ou non. */
  // setLidarPointTiles : reçoit les dalles LiDAR.
  setLidarPointTiles(items) { this.lidarPoints.setTiles(items); }
  // setLidarPointsVisible : affiche ou masque les points LiDAR.
  setLidarPointsVisible(on) { this.lidarPoints.setEnabled(on); }
  /** Couleur des points : « photo » (orthophoto drapée sur le nuage) ou « classes ». */
  // setLidarPointsColor : choisit la couleur des points.
  setLidarPointsColor(mode) { this.lidarPoints.setColorMode(mode); }

  /** Noms des villes du monde : [{ name, lon, lat, pop, capital }] triés par population. */
  // setCityLabels : reçoit les villes du monde.
  setCityLabels(cities) { this.worldLabels.setCities(cities); }
  // setCityLabelsVisible : affiche ou masque les noms des villes.
  setCityLabelsVisible(on) { this.worldLabels.setVisible(on); }
  // setCountryLabelsVisible : affiche ou masque les noms des pays.
  setCountryLabelsVisible(on) { this.countryLabels.setVisible(on); }
  /** Lignes d'orbite (planètes et Lune). */
  // setOrbitsVisible : affiche ou masque les orbites.
  setOrbitsVisible(on) { this.orbitsOn = Boolean(on); }

  /** Cible de téléportation masquée par sa famille (le Soleil ne l'est jamais). */
  // isTargetHidden : la cible est-elle masquée (début).
  isTargetHidden(t) {
    // Sans cible : faux.
    if (!t) return false;
    // Planète : son état.
    if (t.body) return t.body.hidden;
    // Lune : son état.
    if (t.moon) return this.moonHidden;
    // Satellite : son état.
    if (t.satellite) return Boolean(t.satellite.hidden);
    // Soleil : jamais.
    return false;
  // Fin de isTargetHidden.
  }

  /**
   * Affiche ou masque une famille d'astres : 'solid' (Mercure, Vénus, Terre, Mars), 'gas' (Jupiter à Neptune),
   * 'dwarf' (Pluton) ou 'satellite' (la Lune et tous les satellites naturels). Un satellite suit aussi sa planète.
   * Masqué : ni astre, ni anneaux, ni carte, ni orbite, ni repère, et il n'est plus cliquable. Si l'astre ciblé
   * disparaît, la vue revient sur le Soleil.
   */
  // setBodyKindVisible : affiche ou masque une famille d'astres (début).
  setBodyKindVisible(kind, on) {
    // Retire la famille des masquées, ou l'y ajoute.
    if (on) this.hiddenKinds.delete(kind); else this.hiddenKinds.add(kind);
    // Applique la visibilité.
    this.applyBodyVisibility();
  // Fin de setBodyKindVisible.
  }

  /**
   * Astres masqués un par un (cases de la fenêtre Paramètres) : indices de téléportation (1 = première planète…).
   * Le Soleil (0) ne se masque pas. Masquer une planète masque aussi ses satellites.
   */
  // setHiddenBodies : reçoit les astres masqués un par un (début).
  setHiddenBodies(indices = []) {
    // Garde leurs indices, sans le Soleil.
    this.hiddenTargets = new Set([...indices].filter((i) => i > 0));
    // Applique la visibilité.
    this.applyBodyVisibility();
  // Fin de setHiddenBodies.
  }

  /** Applique les deux réglages : familles masquées et astres masqués un par un. */
  // applyBodyVisibility : applique les familles et les astres masqués (début).
  applyBodyVisibility() {
    // Les deux réglages.
    const h = this.hiddenKinds, own = this.hiddenTargets;
    // Pour chaque planète (début).
    this.planets.forEach((p, j) => {
      // Masquée par sa famille ou une par une.
      p.hidden = isKindHidden(h, p.kind) || own.has(j + 1);
      // Règle son groupe.
      p.group.visible = !p.hidden;
    // Fin de la boucle.
    });
    // Lune masquée : par la famille des satellites ou celle de la Terre, avec la Terre, ou une par une.
    this.moonHidden = isKindHidden(h, this.earth.kind, true) || this.earth.hidden || own.has(this.moonFocus);
    // Règle son groupe.
    this.moonGroup.visible = !this.moonHidden;
    // Pour chaque satellite (début).
    for (const s of this.satellites.list) {
      // Masqué : par la famille des satellites ou celle de sa planète, avec sa planète, ou un par un.
      s.hidden = isKindHidden(h, s.parent.kind, true) || s.parent.hidden || own.has(s.focus);
      // Règle son groupe : ni masqué, ni trop près de sa planète à l'écran (voir updateSatelliteLod).
      s.group.visible = !s.hidden && !s.lodHidden;
    // Fin de la boucle.
    }
    // Cible masquée : retour au Soleil.
    if (this.isTargetHidden(this.focusTarget())) this.setFocus(0);
    // HUD à mettre à jour.
    this.hudAt = 0;
  // Fin de applyBodyVisibility.
  }
  /** Ciel lointain : étoiles, Voie lactée et galaxies proches (décoché : fond noir pur). */
  // setSkyVisible : affiche ou masque le ciel lointain.
  setSkyVisible(on) { this.sky.setVisible(on); }

  /** Vents réels du moment (grille de GET /tiles/earth-wind) : ils entraînent les nuages de la Terre. Voir weatherFlow.jsx. */
  // setEarthWind : transmet les vents aux nuages de la Terre (début).
  setEarthWind(grid) {
    // Vrai si l'atmosphère les a pris.
    return Boolean(this.atmospheres.earth?.userData.setWind?.(grid));
  // Fin de setEarthWind.
  }

  /** Nuages réels calculés : grille de couverture nuageuse du moment (GET /tiles/earth-clouds/cover). */
  // setEarthCloudCover : transmet la couverture nuageuse (début).
  setEarthCloudCover(grid) {
    // Vrai si l'atmosphère l'a prise.
    return Boolean(this.atmospheres.earth?.userData.setCloudCover?.(grid));
  // Fin de setEarthCloudCover.
  }

  /** Nuages réels vus par satellite : mosaïque mondiale (canevas, projection de Mercator). Voir earthCloudMosaic.jsx. */
  // setEarthCloudMosaic : transmet la mosaïque des nuages (début).
  setEarthCloudMosaic(canvas) {
    // Vrai si l'atmosphère l'a prise.
    return Boolean(this.atmospheres.earth?.userData.setCloudMosaic?.(canvas));
  // Fin de setEarthCloudMosaic.
  }

  /** Affiche ou masque l'atmosphère dessinée des planètes solides (Vénus, Terre, Mars) ; masquée, il reste le globe nu. */
  // setAtmospheresVisible : affiche ou masque les atmosphères (début).
  setAtmospheresVisible(on) {
    // Règle chacune.
    for (const atmosphere of Object.values(this.atmospheres || {})) atmosphere.visible = Boolean(on);
  // Fin de setAtmospheresVisible.
  }
  /** Points et noms du Soleil et des planètes. */
  // setBodyMarkersVisible : affiche ou masque les repères du Soleil et des planètes.
  setBodyMarkersVisible(on) { this.bodyMarkersOn = Boolean(on); }
  /** Points et noms des satellites naturels (la Lune). */
  // setSatelliteMarkersVisible : affiche ou masque les repères des satellites.
  setSatelliteMarkersVisible(on) { this.satelliteMarkersOn = Boolean(on); }

  /** Table JPL Horizons de la Lune : [{ t (ms UTC), x, y, z (km, écliptique J2000) }]. */
  // setMoonEphemeris : reçoit la table de positions de la Lune (début).
  setMoonEphemeris(points) {
    // La garde si elle a au moins 4 points, sinon aucune.
    this.moonTable = Array.isArray(points) && points.length >= 4 ? points : null;
    // Le tracé de l'orbite est à recalculer.
    this.moonOrbitTrail.invalidate(); // le tracé reprend les positions exactes
  // Fin de setMoonEphemeris.
  }

  // setCoastsVisible : affiche ou masque les littoraux.
  setCoastsVisible(on) { this.coastsOn = on; this.applyBorders(); }
  // setCoastsFromTiles : les littoraux du globe cèdent la place à ceux des tuiles quand le calque des rues est affiché.
  setCoastsFromTiles(on) { this.coastsFromTiles = Boolean(on); this.applyBorders(); }
  /** Volcans en éruption : pose la liste reçue du serveur ([{ id, name, lon, lat }]). */
  // setVolcanoes : pose les volcans en éruption.
  setVolcanoes(list) { this.volcanoes.set(list); }
  // setVolcanoesVisible : affiche ou masque les volcans en éruption.
  setVolcanoesVisible(on) { this.volcanoes.setVisible(on); }

  /**
   * Régions actives du Soleil : garde la réponse de /api/v1/sun/regions et la pose aussitôt. Les positions sont
   * recalculées ensuite toutes les REGIONS_REPLACE_MS, parce que la longitude d'une région avance avec la rotation
   * du Soleil et que la rotation du maillage (un tour en 25 jours) n'est pas exactement celle du Soleil réel : les
   * reposer régulièrement les remet en place au lieu de laisser l'écart s'accumuler. Une réponse vide ramène les
   * régions simulées.
   */
  // setSolarRegions : garde les régions actives reçues du serveur et les pose.
  setSolarRegions(data) {
    // Garde la réponse, ou null si elle est vide.
    this.solarRegionsData = data?.regions?.length || data?.flares?.length ? data : null;
    // Sans données : revient aux régions simulées et s'arrête là.
    if (!this.solarRegionsData) { this.sunMesh?.userData.setEruptionSites?.(null); return; }
    // Avec des données : les pose tout de suite.
    this.applySolarRegions();
  // Fin de setSolarRegions.
  }

  // applySolarRegions : convertit les régions gardées en régions du moteur et les pose sur le Soleil.
  applySolarRegions() {
    // Sans Soleil, sans Terre ou sans données, rien à faire.
    if (!this.sunMesh || !this.earth?.group || !this.solarRegionsData) return;
    // Note l'instant de la pose, pour ne pas la refaire à chaque image.
    this.solarRegionsAt = performance.now();
    // Direction du Soleil vers la Terre, dans le repère du monde.
    const toEarth = this.sunToEarth.copy(this.earth.group.position).sub(this.sunMesh.position);
    // Tant que la scène n'est pas placée (première image), la direction est nulle : on attend la suivante.
    if (toEarth.lengthSq() === 0) { this.solarRegionsAt = 0; return; }
    // La même direction dans le repère propre du Soleil : on annule la rotation du maillage.
    toEarth.applyQuaternion(this.sunSpin.copy(this.sunMesh.quaternion).invert());
    // Longitude, dans ce repère, du méridien qui fait face à la Terre : c'est l'origine des longitudes publiées.
    const earthLongitude = Math.atan2(toEarth.z, toEarth.x);
    // Les régions du moteur, au plus le budget du maillage, replacées à l'instant présent.
    const sites = sitesFromRegions(this.solarRegionsData, { nowMs: Date.now(), earthLongitude });
    // Les pose : une liste vide ramène les régions simulées.
    this.sunMesh.userData.setEruptionSites?.(sites);
  // Fin de applySolarRegions.
  }
  // applyBorders : applique la visibilité des lignes (début).
  applyBorders() {
    // Frontières.
    if (this.borders) this.borders.visible = this.bordersOn;
    // Littoraux.
    if (this.coasts) this.coasts.visible = this.coastsOn && !this.coastsFromTiles;
    // Lignes voulues : s'il y en a et qu'un des deux jeux est affiché.
    this.bordersWanted = Boolean(this.borders) && (this.bordersOn || this.coastsOn);
    // Règle le repère.
    this.bordersRoot.visible = this.bordersWanted;
  // Fin de applyBorders.
  }

  // resize : au changement de taille de la fenêtre (début).
  resize() {
    // Nouvelle largeur.
    this.W = innerWidth;
    // Nouvelle hauteur.
    this.H = innerHeight;
    // Règle le moteur de rendu.
    this.renderer.setSize(this.W, this.H);
    // Règle le format de la caméra.
    this.cam.aspect = this.W / this.H;
    // Recalcule sa projection.
    this.cam.updateProjectionMatrix();
  // Fin de resize.
  }

  // Sélection d'un astre au clic : d'abord par rayon, puis par proximité de l'écran
  // (à l'échelle réelle, les planètes font souvent moins d'un pixel).
  /** Point de la Terre sous un pixel de l'écran : { lat, lon } ou null. */
  // pickEarth : le point de la Terre sous un pixel.
  pickEarth(x, y) { return pickEarthAt(this, x, y); }

  // selectAt : choisit l'astre sous un clic (début).
  selectAt(x, y) {
    // Placement d'un nuage LiDAR en cours : le clic donne la coordonnée GPS au lieu de choisir un astre.
    if (this.lidar?.handleClick(x, y)) return true;
    // Rectangle du canevas.
    const rect = this.canvas.getBoundingClientRect();
    // Abscisse du pointeur, de −1 à 1.
    this.pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    // Ordonnée du pointeur, de −1 à 1.
    this.pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    // Met à jour la matrice de la caméra.
    this.cam.updateMatrixWorld(true);
    // Met à jour celles de la scène.
    this.scene.updateMatrixWorld(true);
    // Lance le rayon depuis la caméra.
    this.raycaster.setFromCamera(this.pointer, this.cam);

    // Les astres des familles masquées ne se cliquent pas.
    const pickables = [
      // le Soleil,
      this.sunMesh,
      // les planètes non masquées,
      ...this.planets.filter((p) => !p.hidden).map((p) => p.mesh),
      // la Lune si elle ne l'est pas,
      ...(this.moonHidden ? [] : [this.moon]),
      // les satellites dessinés (ni masqués, ni trop près de leur planète à l'écran).
      ...this.satellites.list.filter((sat) => !sat.hidden && !sat.lodHidden).map((sat) => sat.mesh),
    // Fin des astres cliquables.
    ];
    // Objets touchés par le rayon.
    const hits = this.raycaster.intersectObjects(pickables, true);
    // S'il y en a (début).
    if (hits.length) {
      // Le premier touché.
      const hit = hits[0].object;
      // Le Soleil : cible 0.
      if (hit === this.sunMesh) { this.setFocus(0); return true; }
      // La Lune : sa cible.
      if (hit === this.moon) { this.setFocus(this.moonFocus); return true; }
      // Satellite de ce maillage.
      const sat = this.satellites.list.find((sv) => sv.mesh === hit);
      // S'il y en a un : sa cible.
      if (sat) { this.setFocus(sat.focus); return true; }
      // Pour chaque planète (début).
      for (let j = 0; j < this.planets.length; j++) {
        // En partant de l'objet touché.
        let node = hit;
        // Remonte jusqu'au groupe ou au maillage de la planète.
        while (node && node !== this.planets[j].group && node !== this.planets[j].mesh) node = node.parent;
        // Trouvé : sa cible.
        if (node) { this.setFocus(j + 1); return true; }
      // Fin de la boucle.
      }
    // Fin de ce cas.
    }

    // Candidats par proximité à l'écran (début) :
    const candidates = [
      // le Soleil,
      { index: 0, pos: this.sunMesh.position },
      // les planètes,
      ...this.planets.map((p, j) => ({ index: j + 1, pos: p.group.position })),
      // la Lune,
      { index: this.moonFocus, pos: this.moonGroup.position },
      // les satellites,
      ...this.satellites.list.map((sat) => ({ index: sat.focus, pos: sat.group.position })),
    // sans les cibles masquées.
    ].filter((c) => !this.isTargetHidden(this.focusTargets[c.index]));
    // Meilleur candidat, à moins de 34 px.
    let best = null, bestD = 34;
    // Pour chaque candidat (début).
    candidates.forEach((c) => {
      // Sa position à l'écran.
      const v = c.pos.clone().project(this.cam);
      // Hors de la profondeur visible : ignoré.
      if (v.z < -1 || v.z > 1) return;
      // Abscisse en pixels.
      const sx = rect.left + (v.x + 1) * 0.5 * rect.width;
      // Ordonnée en pixels.
      const sy = rect.top + (1 - v.y) * 0.5 * rect.height;
      // Distance au clic.
      const d = Math.hypot(sx - x, sy - y);
      // Plus proche : retenu.
      if (d < bestD) { bestD = d; best = c; }
    // Fin de la boucle.
    });
    // S'il y en a un : sa cible.
    if (best) { this.setFocus(best.index); return true; }
    // Rien sous le clic : faux.
    return false;
  // Fin de selectAt.
  }

  // ----------------------------------------------------------------- boucle

  // frame : une image (début).
  frame(now) {
    // Moteur arrêté : rien.
    if (this.stopped) return;
    // Temps écoulé depuis la dernière image.
    const rawDt = now - this.lastNow;
    // 50 images par seconde au plus (20 au repos sur téléphone) : les rappels en trop sont sautés, rien n'est calculé
    // ni dessiné (voir paceFrame).
    if (!paceFrame(this.pacer || (this.pacer = { due: 0 }), now, this.frameMs)) {
      // Image sautée : demande la suivante.
      this.rafId = requestAnimationFrame(this.frame);
      // Terminé.
      return;
    // Fin de ce cas.
    }
    // Temps écoulé, borné à 100 ms.
    const dt = clamp(rawDt, 0, 100); // retour d'onglet : pas de saut
    // Compte les images par seconde.
    this.countFps(now);
    // Moniteur CPU / GPU (voir perfProbe.jsx) : créé à la première image, quand le moteur de rendu existe.
    const probe = this.perfProbe || (this.perfProbe = new PerfProbe(this.renderer.getContext()));
    // Début de la mesure de l'image.
    probe.frameStart(rawDt);
    // Recalcule la durée visée d'une image.
    this.refreshFrameMs(now);
    // Avance le fondu de l'ombre.
    this.updateShadeFade(dt);
    // Note l'instant.
    this.lastNow = now;
    // Adapte la résolution.
    this.adaptResolution(rawDt, now);
    // Instant simulé : l'heure réelle à vitesse 1, sinon le temps accéléré.
    this.simMs = this.speed === 1 ? Date.now() : this.simMs + dt * this.speed;

    // Jour julien de l'instant simulé (UTC).
    const jd = this.simMs / 864e5 + 2440587.5;
    // Siècles depuis J2000, en Temps terrestre : c'est l'échelle des orbites, et elle avance de 69,184 s sur UTC.
    const T = centuriesTT(this.simMs);
    // Jours depuis J2000 : sert aux rotations propres, calées sur l'heure civile.
    const d = jd - 2451545;

    // Place les astres.
    this.updateBodies(T, d);
    // Place la caméra.
    this.updateCamera(dt);
    // Met à jour les directions du Soleil.
    this.updateSunDirections();
    // Met à jour les frontières.
    this.updateBorders();
    // Les volcans suivent la rotation de la Terre.
    this.volcanoes.sync(this.earth.mesh.rotation.y);
    // Met à jour les nuages LiDAR.
    this.lidar.update(this.cam);
    // Met à jour les points LiDAR.
    this.lidarPoints.update({ cam: this.cam, H: this.H, dpr: this.dpr, sunDir: this.sunDir, shade: this.tiles.uniforms.shade.value, hidden: Boolean(this.earth.hidden), now, flat: !this.tiles.reliefOn });
    // Met à jour les noms des pays.
    this.countryLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh });
    // Moteur de chargement planétaire : pixels par unité de scène à une unité de distance.
    const pxScale = pixelScale(this.H, this.cam.fov * D);
    // Satellites : dessinés seulement quand leur orbite se détache de leur planète à l'écran.
    this.updateSatelliteLod(pxScale);
    // Tuiles : l'astre ciblé, les plus grands à l'écran dans le champ, puis les autres chacun leur tour.
    const tiled = this.planTiles(pxScale);
    // Pour chaque astre tuilé (début).
    for (const tb of this.tiledBodies) {
      // Retenu par le plan de cette image : met ses tuiles à jour.
      if (tiled.has(tb.id)) tb.tiles.update();
      // Choisit entre son modèle et ses tuiles.
      this.updateBodyModel(tb);
    // Fin de la boucle.
    }
    // Met à jour les mosaïques ShadowCam, si elles ont un accès aux images.
    if (this.shadowcam.api) this.shadowcam.update(this.cam);
    // Met à jour les étiquettes.
    this.updateLabels();
    // Met à jour les noms des villes.
    this.worldLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh });
    // Met à jour le point de l'utilisateur.
    this.userMarker.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.earth.mesh, hidden: Boolean(this.earth.hidden) });
    // Met à jour les noms des lieux de la Lune.
    this.moonLabels.update({ cam: this.cam, W: this.W, H: this.H, earthMesh: this.moonTiles.root });
    // Met à jour les sondes.
    this.orbiters.update({ t: this.simMs, moonPos: this.moonGroup.position, moonRadius: this.data.bodies.moon.radius, cam: this.cam, W: this.W, H: this.H });
    // Met à jour le HUD.
    this.updateHud(now);
    // Met à jour le ciel.
    this.updateSky();

    // Début de la mesure du rendu.
    probe.renderStart();
    // Efface l'image.
    this.renderer.clear();
    // Dessine le ciel lointain.
    this.sky.render(this.renderer, this.cam, dt);
    // Dessine la scène par-dessus.
    this.renderer.render(this.scene, this.cam);
    // Fin de la mesure du rendu.
    probe.renderEnd();
    // Fin de la mesure de l'image.
    const perf = probe.frameEnd(this.renderer.info);
    // Transmet les mesures au HUD, s'il y en a.
    if (perf) this.hud.set({ perf });
    // Demande l'image suivante.
    this.rafId = requestAnimationFrame(this.frame);
  // Fin de frame.
  }

  /**
   * Compteur d'images par seconde (composante FpsCounter) : images réellement dessinées par le moteur, comptées sur
   * une demi-seconde. Les rappels sautés (rythme réduit sur téléphone) ne comptent pas. Le HUD n'est prévenu que
   * lorsque la valeur change.
   */
  // countFps : compte les images par seconde (début).
  countFps(now) {
    // Au départ, ou après plus de 2 secondes : le compte repart de zéro.
    if (!(this.fpsSince > 0) || now - this.fpsSince > 2000) { this.fpsSince = now; this.fpsFrames = 0; return; } // départ, retour d'onglet
    // Une image de plus.
    this.fpsFrames++;
    // Durée de la mesure.
    const span = now - this.fpsSince;
    // Moins d'une demi-seconde : rien.
    if (span < 500) return;
    // Images par seconde, arrondies.
    const fps = Math.round((this.fpsFrames * 1000) / span);
    // Nouvelle mesure.
    this.fpsSince = now;
    // Compteur à zéro.
    this.fpsFrames = 0;
    // Valeur changée : la garde et prévient le HUD.
    if (fps !== this.fps) { this.fps = fps; this.hud.set({ fps }); }
  // Fin de countFps.
  }

  /**
   * Résolution adaptative : moyenne glissante de la durée des images. Trop lente → un cran de moins (le GPU traite
   * jusqu'à 2,25× moins de pixels avec le tampon de profondeur logarithmique, et les tuiles demandées suivent la
   * hauteur réelle en pixels) ; rapide pendant 4 s → un cran de plus, sauf si ce cran a déjà fait ralentir.
   */
  // adaptResolution : adapte la densité de pixels à la fluidité (début).
  adaptResolution(rawDt, now) {
    // Durée nulle ou supérieure à 250 ms : mesure ignorée.
    if (!(rawDt > 0) || rawDt > 250) return; // onglet caché, pause : mesure non significative
    // Durée ramenée à l'échelle « 60 images par seconde » : 20 ms entre deux images (50 par seconde) est le rythme visé.
    this.dprFrameMs += (normalizedFrameMs(rawDt, this.frameMs) - this.dprFrameMs) * 0.05;
    // Pas encore l'heure du contrôle : rien.
    if (now < this.dprCheckAt) return;
    // Prochain contrôle dans 1 seconde.
    this.dprCheckAt = now + DPR_CHECK_MS;
    // Durée moyenne d'une image.
    const avg = this.dprFrameMs;
    // Trop lente, au-dessus du plancher (début).
    if (avg > DPR_SLOW_MS && this.dpr > DPR_MIN) {
      // Ce cran est noté trop lourd.
      this.dprBlockedAbove = this.dpr;            // ce cran est trop lourd pour l'instant
      // Pendant 30 secondes.
      this.dprBlockUntil = now + 30000;
      // Descend d'un cran, sans passer sous le plancher.
      this.setResolution(Math.max(DPR_MIN, this.dpr - DPR_STEP));
      // Plus de période rapide.
      this.dprFastSince = 0;
    // Rapide, sous le plafond (début).
    } else if (avg < DPR_FAST_MS && this.dpr < this.dprMax) {
      // Début de la période rapide.
      if (!this.dprFastSince) this.dprFastSince = now;
      // Cran suivant.
      const next = Math.min(this.dprMax, this.dpr + DPR_STEP);
      // Bloqué s'il a déjà fait ralentir récemment.
      const blocked = next >= this.dprBlockedAbove && now < this.dprBlockUntil;
      // Libre, et rapide depuis plus de 4 secondes (début).
      if (!blocked && now - this.dprFastSince > DPR_RAISE_AFTER_MS) {
        // Monte d'un cran.
        this.setResolution(next);
        // Nouvelle période.
        this.dprFastSince = 0;
      // Fin de ce cas.
      }
    // Sinon : plus de période rapide.
    } else this.dprFastSince = 0;
  // Fin de adaptResolution.
  }

  /**
   * Scène recouverte par l'écran de chargement : quelques images par seconde suffisent (compilation des shaders,
   * arrivée des tuiles). Dès qu'elle est visible, le moteur reprend le rythme de l'appareil.
   */
  // setCovered : note si l'écran de chargement recouvre la scène (début).
  setCovered(covered) {
    // Garde l'état.
    this.covered = Boolean(covered);
    // Note l'activité.
    this.markActive();
  // Fin de setCovered.
  }

  /**
   * Met la scène à l'arrêt : la boucle d'affichage du système solaire est arrêtée net (aucun calcul, aucun dessin).
   * Relancée avec setSuspended(false), sans saut de temps.
   */
  // setSuspended : met la scène à l'arrêt, ou la relance (début).
  setSuspended(on) {
    // État demandé.
    const next = Boolean(on);
    // Moteur arrêté, ou même état : rien.
    if (this.stopped || next === this.suspended) return;
    // Le garde.
    this.suspended = next;
    // Annule l'image demandée.
    cancelAnimationFrame(this.rafId);
    // À l'arrêt, ou onglet en pause : rien de plus.
    if (next || this.paused) return;
    // L'horloge repart de maintenant.
    this.lastNow = performance.now();
    // Note l'activité.
    this.markActive();
    // Demande une image.
    this.rafId = requestAnimationFrame(this.frame);
  // Fin de setSuspended.
  }

  /**
   * Mode économie d'énergie (Paramètres) : 20 images par seconde et densité de pixels 1, sur tous les appareils.
   */
  // setPowerSaving : active ou coupe l'économie d'énergie (début).
  setPowerSaving(on) {
    // Garde l'état.
    this.saving = Boolean(on);
    // Plafond de densité : 1 en économie, sinon celui d'origine.
    this.dprMax = this.saving ? Math.min(1, this.dprMaxFull) : this.dprMaxFull;
    // Au-dessus du plafond : la résolution descend.
    if (this.dpr > this.dprMax) this.setResolution(this.dprMax);
    // Note l'activité.
    this.markActive();
  // Fin de setPowerSaving.
  }

  /** Un geste vient d'avoir lieu (toucher, molette, clavier, pilotage) : le moteur reprend son plein rythme. */
  // markActive : note un geste de l'utilisateur (début).
  markActive() {
    // Instant du geste.
    this.activeAt = performance.now();
    // Recalcule la durée visée d'une image.
    this.refreshFrameMs(this.activeAt);
  // Fin de markActive.
  }

  /** Recalcule la durée visée d'une image (voir targetFrameMs). Au repos = aucun geste récent et caméra arrivée. */
  // refreshFrameMs : recalcule la durée visée d'une image (début).
  refreshFrameMs(now) {
    // En mouvement : glissement, transition ou zoom en cours,
    const moving = this.drag || this.focusT < 1 || Math.abs(this.dist - this.distGoal) > this.dist * 1e-3
      // ou flèche enfoncée.
      || Object.values(this.keyRotate).some(Boolean);
    // En mouvement : c'est une activité.
    if (moving) this.activeAt = now;
    // Durée visée : selon l'écran de chargement, l'économie d'énergie et le repos.
    const next = targetFrameMs(this.power, { covered: this.covered, saving: this.saving, idle: now - this.activeAt > IDLE_AFTER_MS });
    // Inchangée : rien.
    if (next === this.frameMs) return;
    // La garde.
    this.frameMs = next;
    // La mesure de fluidité repart.
    this.dprFrameMs = 16.7; // la mesure de fluidité repart du nouveau rythme
    // Plus de période rapide.
    this.dprFastSince = 0;
  // Fin de refreshFrameMs.
  }

  // setResolution : change la densité de pixels (début).
  setResolution(dpr) {
    // Inchangée : rien.
    if (dpr === this.dpr) return;
    // La garde.
    this.dpr = dpr;
    // Règle le moteur de rendu.
    this.renderer.setPixelRatio(dpr); // redimensionne aussi le tampon de rendu
    // La mesure de fluidité repart.
    this.dprFrameMs = 16.7; // nouvelle mesure pour le nouveau cran
  // Fin de setResolution.
  }

  // updateBodies : place les astres à l'instant simulé (début).
  updateBodies(T, d) {
    // Pour chaque planète (début).
    this.planets.forEach((p) => {
      // Sa position héliocentrique. Pour la Terre, la table d'éléments décrit le barycentre Terre–Lune :
      // earthPosition y ajoute le décalage du centre de la Terre, jusqu'à 4 670 km, soit 0,73 rayon terrestre.
      p.ecl = p.def.earth ? earthPosition(p.def.elements, T) : heliocentric(p.def.elements, T);
      // Sa position dans la scène.
      p.w.set(p.ecl[0] * AU_UNITS, p.ecl[1] * AU_UNITS, p.ecl[2] * AU_UNITS);
      // Sa rotation propre.
      p.mesh.rotation.y = (d / p.def.rotation) * TAU;
    // Fin de la boucle.
    });

    // La Terre.
    const E = this.earth;
    // Place la Lune.
    this.updateMoon(T);
    // Satellites : calcul complet à chaque image pour le système de l'astre ciblé, espacé pour les autres.
    const ft = this.focusTarget();
    // Met à jour les satellites, en entier pour le système de la cible.
    this.satellites.update(this.simMs, ft.body || ft.satellite?.parent || null);
    // Rotation propre du Soleil : un tour en 25 jours.
    this.sunMesh.rotation.y = (d / 25) * TAU;
    // Régions actives réelles : reposées de temps en temps pour suivre la rotation du Soleil (voir setSolarRegions).
    if (this.solarRegionsData && performance.now() - this.solarRegionsAt > REGIONS_REPLACE_MS) this.applySolarRegions();

    // Orientation de la Terre : face au Soleil selon l'heure UTC (jour/nuit réels).
    const ew = E.w;
    // Composante de la position de la Terre le long de son équateur.
    const lz = -ew.y * Math.sin(EARTH_TILT) - ew.z * Math.cos(EARTH_TILT);
    // Angle du Soleil vu de la Terre.
    const sunAngle = Math.atan2(-lz, -ew.x);
    // Angle horaire d'après l'heure UTC.
    const hourAngle = -(((this.simMs / 3600000) % 24) - 12) * 15 * D;
    // Rotation de la Terre : la face au Soleil suit l'heure.
    E.mesh.rotation.y = sunAngle - hourAngle;
    // Inclinaison de l'axe terrestre.
    E.group.rotation.x = -EARTH_TILT;

    // Planètes tuilées : obliquité réelle de leur axe (la rotation propre est déjà appliquée au maillage ci-dessus).
    for (const tb of this.tiledBodies) {
      // Si l'astre a un pôle décrit (début).
      if (tb.cfg.pole) {
        // Pôle réel (UAI) : le Nord local (+Y) du groupe pointe vers lui, dans le repère écliptique de la scène.
        tb.poleV ||= new THREE.Vector3(...equatorialDegToScene(tb.cfg.pole[0], tb.cfg.pole[1]));
        // Oriente son groupe vers ce pôle.
        tb.group.quaternion.setFromUnitVectors(UP_Y, tb.poleV);
      // Sinon, s'il a une obliquité : incline son groupe.
      } else if (tb.cfg.obliquity) tb.group.rotation.x = -tb.cfg.obliquity;
    // Fin de la boucle.
    }
  // Fin de updateBodies.
  }

  // Lune en temps réel : position (théorie ELP abrégée) et orientation synchrone. La rotation est uniforme
  // (méridien 0 vers la position moyenne de la Terre) alors que l'orbite ne l'est pas : la face visible oscille
  // donc comme dans le ciel (libration en longitude), et l'équateur incliné de 1,54° donne la libration en latitude.
  /** Vecteur Terre → Lune (scène, rayons terrestres) à l'instant `ms` : JPL Horizons si la table le couvre, sinon ELP. */
  // moonRelAt : le vecteur de la Terre à la Lune à un instant donné (début).
  moonRelAt(ms, out = new THREE.Vector3()) {
    // Position par la théorie, à cet instant.
    const g = moonGeocentric(centuriesTT(ms));
    // Position exacte de la table, si elle couvre l'instant.
    const exact = this.moonTable ? interpolateState(this.moonTable, ms) : null;
    // Si elle existe : elle remplace la position.
    if (exact) Object.assign(g, eclipticOf(exact));
    // La convertit vers la scène.
    return moonToScene(g, out);
  // Fin de moonRelAt.
  }

  // updateMoon : place et oriente la Lune (début).
  updateMoon(T) {
    // Position par la théorie.
    const g = moonGeocentric(T);
    // Position exacte JPL Horizons quand la table couvre l'instant simulé ; l'orientation garde L' et Ω de la théorie.
    const exact = this.moonTable ? interpolateState(this.moonTable, this.simMs) : null;
    // Si elle existe : elle remplace la position.
    if (exact) Object.assign(g, eclipticOf(exact));
    // Note la source de la position.
    this.moonSource = exact ? 'orbite de Kepler' : 'théorie ELP';
    // Garde la position géocentrique.
    this.moonGeo = g;
    // Vecteur de la Terre à la Lune.
    moonToScene(g, this.moonRel);
    // Position de la Lune dans la scène.
    this.moonW.copy(this.earth.w).add(this.moonRel);
    // Met à jour le tracé de l'orbite.
    this.moonOrbitTrail.update(this.simMs);

    // Lois de Cassini : le nœud ascendant de l'équateur lunaire est le nœud descendant de l'orbite (Ω + 180°).
    const nodeEq = (g.node + 180) * D;
    // Axe des nœuds de l'équateur lunaire.
    this.nodeAxis.set(Math.cos(nodeEq), 0, -Math.sin(nodeEq));
    // Inclinaison de l'équateur autour de cet axe.
    this.qTilt.setFromAxisAngle(this.nodeAxis, MOON_EQUATOR_TILT_DEG * D);
    // Rotation synchrone : le méridien 0 vers la Terre moyenne.
    this.qSpin.setFromAxisAngle(Y_AXIS, (g.meanLon + 180) * D);
    // Orientation : l'inclinaison après la rotation.
    this.moonGroup.quaternion.multiplyQuaternions(this.qTilt, this.qSpin);

    // Lumière cendrée : phase de la Terre vue de la Lune ≈ complément de la phase de la Lune vue de la Terre.
    if (this.moonTiles) {
      // Direction du Soleil vue de la Lune.
      const toSun = this.tmpSun.copy(this.moonW).negate().normalize();
      // Direction de la Terre vue de la Lune.
      const toEarth = this.tmpEarth.copy(this.moonRel).negate().normalize();
      // Lumière cendrée : forte quand la Terre est pleine vue de la Lune.
      this.moonTiles.uniforms.earthshine.value = 1 - (1 + toSun.dot(toEarth)) / 2;
    // Fin de ce cas.
    }
  // Fin de updateMoon.
  }

  /**
   * Suit la rotation propre de l'astre ciblé quand la rotation automatique est coupée, ou quand la caméra est à moins
   * de SPIN_LOCK_RADII rayons de son sol :
   * la direction de la caméra tourne autour de l'axe de l'astre du même angle que lui depuis l'image précédente.
   * Renvoie true si la caméra est solidaire de l'astre (la rotation automatique doit alors s'arrêter).
   */
  // followSpin : fait suivre à la caméra la rotation propre de l'astre ciblé (début).
  followSpin() {
    // La cible.
    const f = this.focusTarget();
    // Son maillage, pour une planète.
    const mesh = f.body?.mesh || null;
    // Rotation automatique coupée : la caméra suit la rotation live de l'astre à toute distance (géantes comprises) ;
    // sinon, seulement près du sol d'une planète.
    const ratio = this.surfaceRatio();
    // Près de l'astre : au ras des nuages pour une géante gazeuse, sous 2 rayons sinon.
    const near = f.passable ? this.dist > this.localRadius() && ratio < GAS_SPIN_LOCK_RADII : ratio < SPIN_LOCK_RADII;
    // Solidaire : planète ciblée, transition finie, rotation automatique coupée ou caméra proche.
    const locked = Boolean(mesh) && this.focusT >= 1 && (!this.autoRotate || near);
    // Rotation à l'image précédente.
    const prev = this.spinRef;
    // Garde la rotation de cette image.
    this.spinRef = mesh ? { mesh, y: mesh.rotation.y } : null;
    // Doigt posé ou non, la caméra reste solidaire de l'astre : sans cela, pendant un glisser ou un pincement près
    // du sol, la Terre tournait sous la caméra (≈ 460 m par seconde à l'équateur) et la vue avançait toute seule.
    if (!locked || !prev || prev.mesh !== mesh || this.lockCity || this.focusedTiled()?.lock) return locked;
    // Angle tourné depuis l'image précédente, ramené entre −π et π.
    const d = Math.atan2(Math.sin(mesh.rotation.y - prev.y), Math.cos(mesh.rotation.y - prev.y));
    // Nul : vrai, sans rien changer.
    if (!d) return true;
    // Axe de rotation de l'astre dans la scène.
    const axis = this.spinAxis.set(0, 1, 0).applyQuaternion(mesh.parent.getWorldQuaternion(this.spinQ));
    // Direction de la caméra.
    const v = this.spinDir.set(Math.sin(this.az) * Math.cos(this.el), Math.sin(this.el), Math.cos(this.az) * Math.cos(this.el));
    // La tourne du même angle.
    v.applyAxisAngle(axis, d);
    // Nouvel azimut.
    this.az = Math.atan2(v.x, v.z);
    // Même borne que la vue (au ras du pôle) : avec ±1,5 rad, les flèches restaient bloquées avant le pôle quand la
    // caméra suit la rotation de l'astre.
    this.el = clamp(Math.asin(clamp(v.y, -1, 1)), -POLE_LIMIT, POLE_LIMIT);
    // Vrai.
    return true;
  // Fin de followSpin.
  }

  // updateCamera : place la caméra pour cette image (début).
  updateCamera(dt = 0) {
    // La caméra, les planètes et le Soleil.
    const { cam, planets, sunMesh } = this;
    // La Terre.
    const E = this.earth;

    // Transition douce vers l'astre ciblé, zoom lissé vers la distance visée
    this.focusT = Math.min(1, this.focusT + dt * 0.001 * FOCUS_RATE);
    // Courbe douce de la transition : rapide au départ, lente à l'arrivée.
    const ease = 1 - Math.pow(1 - this.focusT, 3);
    // Point visé : entre le départ et la cible.
    this.target.copy(this.targetStart).lerp(this.focusTarget().get(), ease);
    // Zoom lissé en échelle logarithmique, même vitesse à toute cadence (avant : 16 % par image, donc plus lent à 30 i/s).
    // Relief : la caméra reste au-dessus du sol réel (montagnes soulevées) de l'astre survolé.
    const lifted = this.focusedTiled();
    // Si le relief en volume est actif, avec une carte (début).
    if (lifted?.tiles.reliefOn && lifted.tiles.active) {
      // Hauteur du sol sous la caméra.
      const floor = lifted.tiles.groundFloor(this.cam.position, performance.now());
      // La distance voulue reste au-dessus de ce sol.
      if (floor > 0) this.distGoal = Math.max(this.distGoal, lifted.radius * (1 + floor + minAltitudeRadii(lifted.cfg)));
    // Fin de ce cas.
    }
    // Zoom d'arrivée (goTo avec `fly`) : il mène la distance jusqu'au bout. Le relief peut relever le plancher en
    // route : l'arrivée est relevée d'autant. Toute autre destination (zoom à la main, autre lieu, vue globale) rend
    // la main au zoom lissé habituel.
    const flight = this.zoomFlight;
    // Si la distance voulue ne correspond plus au zoom d'arrivée (début).
    if (flight && this.distGoal !== flight.plan.to) {
      // Relevée en route : l'arrivée du zoom est relevée d'autant.
      if (this.distGoal > flight.plan.to && this.distGoal < flight.plan.from) flight.plan = { ...flight.plan, to: this.distGoal };
      // Sinon : le zoom d'arrivée s'arrête.
      else this.zoomFlight = null;
    // Fin de ce cas.
    }
    // Pendant un zoom d'arrivée (début).
    if (this.zoomFlight) {
      // Avance son temps, de 100 ms au plus.
      flight.t += Math.min(dt, 100);
      // Distance donnée par le plan.
      this.dist = flightDistance(flight.plan, flight.t);
      // Arrivé : terminé.
      if (flight.t >= flight.plan.ms) this.zoomFlight = null;
    // Sinon (début).
    } else {
      // Zoom lissé vers la distance voulue.
      this.dist *= Math.pow(this.distGoal / this.dist, 1 - Math.exp(-dt / ZOOM_TAU_MS));
    // Fin du choix.
    }

    // Le monde est recentré sur la cible : la caméra reste proche de l'origine (précision flottante).
    planets.forEach((p) => {
      // Position de la planète autour du point visé.
      p.group.position.copy(p.w).sub(this.target);
      // Son orbite est recentrée de même.
      p.orbit.position.copy(this.target).negate();
      // Orbite visible : si les orbites sont affichées, la planète non masquée et la caméra assez loin.
      p.orbit.visible = this.orbitsOn && !p.hidden && this.dist > 3000;
    // Fin de la boucle.
    });
    // Position de la Lune.
    this.moonGroup.position.copy(this.moonW).sub(this.target);
    // Son orbite suit la Terre.
    this.moonOrbit.position.copy(this.earth.group.position);
    // Orbite visible : si les orbites sont affichées, la Lune non masquée et la caméra assez près.
    this.moonOrbit.visible = this.orbitsOn && !this.moonHidden && this.dist < MOON_ORBIT_MAX_DIST;
    // Place les satellites.
    this.satellites.place(this.target, cam.position, this.orbitsOn);
    // Position du Soleil.
    sunMesh.position.copy(this.target).negate();
    // Son halo le suit.
    this.glow.position.copy(sunMesh.position);
    // Sa lumière aussi.
    this.sunLight.position.copy(sunMesh.position);

    // Près de la surface d'une planète, la caméra est solidaire de sa rotation propre : le sol reste fixe à l'écran
    // et la rotation automatique est suspendue. Plus loin, retour à la rotation automatique autour de l'astre.
    const spinLocked = this.followSpin();
    // Rotation automatique ralentie près du sol (sinon la caméra défilerait de plusieurs km par image).
    const nearFactor = clamp(this.surfaceRatio(), 0, 1);
    // Petits signes infini (lemniscate de Gerono) ajoutés à la trajectoire pendant la rotation automatique :
    // l'enveloppe monte et descend en douceur quand la rotation démarre ou s'arrête.
    const infinityOn = this.autoRotate && !this.drag && !spinLocked;
    // Enveloppe des signes infini : monte ou descend en douceur.
    this.infinityAmp += ((infinityOn ? 1 : 0) - this.infinityAmp) * (1 - Math.exp(-dt / 900));
    // Avance leur temps.
    this.infinityT += dt * 0.001;
    // Rotation automatique, hors glissement et hors suivi de l'astre (début).
    if (this.autoRotate && !this.drag && !spinLocked) {
      // Tourne l'azimut, moins vite près du sol.
      this.az += AUTO_ROTATE_SPEED * this.rotateSpeed * dt * 0.001 * nearFactor;
    // Fin de ce cas.
    }

    // Ville suivie : la caméra se place à la verticale de la ville
    if (this.lockCity && this.focus === this.earthFocus) {
      // Met à jour la matrice de la Terre.
      E.mesh.updateWorldMatrix(true, false);
      // Verticale de la ville, dans la scène.
      const n = this.lockN.copy(this.lockCity.lv).applyMatrix4(E.mesh.matrixWorld).sub(E.group.position).normalize();
      // Élévation correspondante.
      this.el = Math.asin(clamp(n.y, -1, 1));
      // Azimut correspondant.
      this.az = Math.atan2(n.x, n.z);
    // Fin de ce cas.
    }

    // Lieu survolé d'un astre tuilé : la caméra se place à sa verticale, dans le repère de ses tuiles
    // (orientation du groupe + rotation propre du maillage pour les planètes ; groupe seul pour la Lune).
    const tb = this.focusedTiled();
    // S'il y a un lieu survolé (début).
    if (tb?.lock) {
      // Met à jour la matrice de l'astre.
      tb.mesh.updateWorldMatrix(true, false);
      // Verticale du lieu, dans la scène.
      const n = this.lockN.copy(tb.lock.lv).applyMatrix4(tb.mesh.matrixWorld).sub(tb.group.position).normalize();
      // Élévation correspondante.
      this.el = Math.asin(clamp(n.y, -1, 1));
      // Azimut correspondant.
      this.az = Math.atan2(n.x, n.z);
    // Fin de ce cas.
    }

    // Flèches maintenues : rotation continue, d'autant plus fine qu'on est proche de la surface
    // (même facteur que le glisser), dt borné pour éviter un saut au retour d'onglet.
    const rot = this.keyRotate;
    // Si une flèche est enfoncée (début).
    if (rot.left || rot.right || rot.up || rot.down) {
      // Finesse du pas selon la proximité du sol.
      const kz = Math.max(1e-9, Math.min(1, this.surfaceRatio() * 0.9));
      // Pas de rotation de cette image.
      const step = Math.min(dt, 100) * 0.001 * KEY_ROTATE_SPEED * kz;
      // Pas de butée aux pôles : en maintenant « haut » ou « bas », la vue passe par-dessus le pôle et continue de
      // l'autre côté (crossPole réécrit la même vue, sans saut). Le sens des flèches suit le haut de l'écran.
      const sign = arrowSign(this.heading);
      // Flèche gauche.
      if (rot.left) this.az -= sign * step;
      // Flèche droite.
      if (rot.right) this.az += sign * step;
      // Flèche haut.
      if (rot.up) this.el += sign * step;
      // Flèche bas.
      if (rot.down) this.el -= sign * step;
      // Passage éventuel par-dessus le pôle.
      const view = crossPole({ az: this.az, el: this.el, heading: this.heading });
      // Si le pôle est franchi (début).
      if (view.crossed) {
        // Nouvel azimut.
        this.az = view.az;
        // Nouvelle élévation.
        this.el = view.el;
        // Le cap voulu suit.
        this.headingGoal += view.heading - this.heading; // le cap visé suit, sinon la vue pivoterait pour revenir
        // Nouveau cap.
        this.heading = view.heading;
      // Fin de ce cas.
      }
    // Fin des flèches.
    }

    // Distance de la caméra.
    const { dist } = this;
    // Pulsation des signes infini.
    const wInf = (2 * Math.PI) / INFINITY_PERIOD_S;
    // Leur amplitude, réduite près du sol.
    const aInf = INFINITY_AMPLITUDE * this.infinityAmp * clamp(this.surfaceRatio(), 0.05, 1);
    // Azimut, avec le signe infini.
    const az = this.az + aInf * Math.sin(wInf * this.infinityT);
    // Borné juste avant le pôle (et non plus à ±1,5 rad) : aucune zone morte en approchant du pôle au clavier.
    const el = clamp(this.el + aInf * 0.5 * Math.sin(2 * wInf * this.infinityT), -POLE_LIMIT, POLE_LIMIT);
    // Rayon de la cible.
    const fr = this.focusTarget().r || 1;
    // Vue 3/4 automatique : l'angle suit la distance (rampe continue), puis est lissé dans le temps. Le Soleil,
    // sans sol à survoler, garde un regard centré. La pose conserve exactement la distance de zoom et vise le
    // point de surface survolé : ni l'altitude ni le lieu au centre de l'écran ne bougent.
    const engage = this.focus === 0 || this.focusTarget().passable ? 0 : tiltEngagement(dist / fr);
    // Inclinaison visée : la pilotée, sinon l'automatique.
    const tiltTarget = this.pilotTilt ?? (this.tiltOn ? TILT_MAX_ANGLE * engage : 0);
    // Inclinaison lissée dans le temps.
    this.tiltV = approachTilt(this.tiltV, tiltTarget, dt);
    // Cap de la boussole : rotation douce autour de la verticale locale, sans tour complet au passage de ±π.
    if (this.northLock) {
      // Verrouillé : le nord reste collé en haut, sans lissage.
      const north = this.compassState();
      // Cap voulu : celui du nord.
      if (north) this.headingGoal = north.bearing;
      // Cap : sans lissage.
      this.heading = this.headingGoal;
    // Sinon (début).
    } else {
      // Cap lissé vers le cap voulu.
      this.heading = approachAngle(this.heading, this.headingGoal, dt);
    // Fin du choix.
    }
    // Calcule la pose de la caméra (début) :
    tiltPose({
      // rayon, distance, élévation, azimut, inclinaison et cap ;
      radius: fr, dist, el, az, angle: this.tiltV, heading: this.heading,
      // en sortie : la position, le point visé et le haut de l'image.
      pos: cam.position, aim: this.tiltAim, up: this.tiltUp,
    // Fin du calcul.
    });
    // Haut de l'image.
    cam.up.copy(this.tiltUp);
    // Regarde le point visé.
    cam.lookAt(this.tiltAim);
    // Vue verrouillée : la caméra garde sa place autour de l'astre focus (le zoom avance toujours vers lui) et ne
    // change que de regard, tourné vers l'astre verrouillé.
    const lock = this.viewLock;
    // Si la vue est verrouillée (début).
    if (lock) {
      // L'astre verrouillé.
      const locked = this.focusTargets[lock.index];
      // Cible changée, astre disparu ou masqué : le verrou tombe.
      if (lock.focus !== this.focus || !locked || this.isTargetHidden(locked)) this.viewLock = null;
      // Sinon (début).
      else {
        // Position de l'astre verrouillé.
        const aim = this.lockAim.copy(locked.get()).sub(this.target);
        // Direction du regard.
        const dir = this.lockNdc.copy(aim).sub(cam.position);
        // Si elle n'est pas nulle (début).
        if (dir.lengthSq() > 0) {
          // Regard presque parallèle au « haut » de l'image : on prend l'axe de la scène pour éviter le retournement.
          if (Math.abs(dir.normalize().dot(cam.up)) > 0.999) cam.up.set(0, 1, 0);
          // Regarde l'astre verrouillé.
          cam.lookAt(aim);
        // Fin de ce cas.
        }
      // Fin du « sinon ».
      }
    // Fin du verrou.
    }
    // Met à jour la matrice de la caméra.
    cam.updateMatrixWorld();
    // Intérieur des géantes : dessiné seulement quand la caméra est dans l'astre, solidaire de sa rotation propre.
    for (const g of this.gasInteriors) {
      // Affiche l'intérieur si la caméra est dans l'astre, avec sa rotation propre.
      g.interior.update(cam.position.distanceTo(g.group.position) < g.radius * 1.001, g.mesh.rotation.y);
    // Fin de la boucle.
    }
    // Atmosphères : face dessinée selon que la caméra est dehors ou dedans.
    for (const a of Object.values(this.atmospheres)) a.userData.track(cam.position);

    // Plan proche suivant l'altitude : indispensable pour descendre à quelques mètres du sol (zoom 22).
    const near = clamp((this.focusTarget().passable ? Math.max(dist - fr, dist * 0.1) : dist - fr) * 0.02, 1e-10, 1e-5);
    // S'il a changé de plus de 5 % (début).
    if (Math.abs(near - cam.near) > cam.near * 0.05) {
      // Nouveau plan proche.
      cam.near = near;
      // Recalcule la projection.
      cam.updateProjectionMatrix();
    // Fin de ce cas.
    }

    // Taille du halo du Soleil : selon sa distance, 655 au moins.
    this.glow.scale.setScalar(Math.max(655, cam.position.distanceTo(sunMesh.position) * 0.035));
  // Fin de updateCamera.
  }

  // Ciel lointain atténué quand le Soleil est dans le champ, et masqué par le ciel de jour près du sol terrestre.
  updateSky() {
    // La caméra et le ciel.
    const { cam, sky } = this;
    // Ciel masqué : rien.
    if (!sky.visible) return;
    // Direction de visée.
    const fwd = cam.getWorldDirection(this.skyFwd);
    // Vecteur vers le Soleil.
    const toSun = this.skyToSun.copy(this.sunMesh.position).sub(cam.position);
    // Sa distance.
    const sunDist = toSun.length() || 1;
    // Rendu unitaire.
    toSun.divideScalar(sunDist);
    // Tangente du demi-champ vertical.
    const tanV = Math.tan((cam.fov * D) / 2);
    // Demi-diagonale du champ.
    const halfDiag = Math.atan(Math.hypot(tanV, tanV * cam.aspect));
    // Rayon apparent du Soleil.
    const sunRadius = Math.asin(Math.min(1, this.data.bodies.sun.radius / sunDist));
    // Éblouissement par le Soleil.
    const glare = sunGlare(fwd.dot(toSun), halfDiag, sunRadius);

    // La Terre.
    const E = this.earth;
    // Son rayon.
    const R = E.def.radius || 1;
    // Verticale de la caméra au-dessus de la Terre.
    const up = this.skyUp.copy(cam.position).sub(E.group.position);
    // Altitude en kilomètres.
    const altitudeKm = (up.length() / R - 1) * EARTH_RADIUS_KM;
    // Rendue unitaire.
    up.normalize();
    // Sinus de la hauteur du Soleil au-dessus de l'horizon.
    const sinSunAlt = this.skyToSun.copy(this.sunMesh.position).sub(E.group.position).normalize().dot(up);
    // Intensité visée du ciel, d'après l'éblouissement et le voile du jour.
    sky.setTargetIntensity(skyVisibility({ glare, veil: daySkyVeil(altitudeKm, sinSunAlt) }));
  // Fin de updateSky.
  }

  // Les frontières suivent la rotation de la Terre et flottent juste au-dessus du sol, d'autant plus bas qu'on est près.
  updateBorders() {
    // Lignes non voulues : rien.
    if (!this.bordersWanted) return;
    // Altitude de la caméra au-dessus de la Terre.
    const altitude = Math.max(0, this.cam.position.distanceTo(this.earth.group.position) - 1);
    // Visibles au-dessus de l'altitude minimale.
    this.bordersRoot.visible = altitude > BORDERS_MIN_ALTITUDE;
    // Suivent la rotation de la Terre.
    this.bordersRoot.rotation.y = this.earth.mesh.rotation.y;
    // Flottent juste au-dessus du sol.
    this.bordersRoot.scale.setScalar(1 + borderLift(altitude));
  // Fin de updateBorders.
  }

  // Élévation du Soleil (en degrés) au-dessus de l'horizon d'un point du globe, pour la fiche ville.
  sunAltitudeAt(lon, lat) {
    // Maillage de la Terre.
    const mesh = this.earth?.mesh;
    // Absent : NaN.
    if (!mesh) return NaN;
    // Met à jour sa matrice.
    mesh.updateMatrixWorld(true);
    // Verticale du lieu, dans la scène.
    const normal = lonLatToVec([lon, lat]).transformDirection(mesh.matrixWorld);
    // Direction du Soleil depuis la Terre.
    const toSun = this.tmpSun.copy(this.sunMesh.position).sub(this.earth.group.position).normalize();
    // Hauteur du Soleil, en degrés.
    return Math.asin(clamp(normal.dot(toSun), -1, 1)) / D;
  // Fin de sunAltitudeAt.
  }

  // Direction du Soleil vue de chaque astre tuilé, dans le repère caméra (éclairage des tuiles et de l'atmosphère).
  updateSunDirections(cam = this.cam) {
    // Pour chaque astre tuilé (début).
    for (const tb of this.tiledBodies) {
      // Sa direction du Soleil :
      tb.sunDir
        // la position du Soleil,
        .copy(this.sunMesh.position)
        // moins celle de l'astre,
        .sub(tb.group.position)
        // rendue unitaire,
        .normalize()
        // puis passée dans le repère de la caméra.
        .transformDirection(cam.matrixWorldInverse);
    // Fin de la boucle.
    }
  // Fin de updateSunDirections.
  }

  // updateLabels : met à jour les repères des astres (début).
  updateLabels() {
    // Repère visible seulement si sa case est cochée et si l'astre est trop petit pour être vu (rayon < 4 px).
    const pxScale = this.H / (2 * Math.tan((this.cam.fov * D) / 2));
    // Nom de la cible.
    const focusName = this.focusTarget().name;
    // Pour chaque repère (début).
    for (const b of this.bodyLabels) {
      // Est-ce l'astre ciblé ?
      b.focused = b.name === focusName; // l'astre ciblé garde son repère même s'il chevauche celui de sa planète
      // Repères de sa famille affichés ?
      const on = b.kind === 'satellite' ? this.satelliteMarkersOn : this.bodyMarkersOn;
      // Actif : affiché, non masqué et plus petit que 4 px ;
      b.enabled = on && !b.isHidden?.() && (b.radius * pxScale) / Math.max(1e-9, b.pos.distanceTo(this.cam.position)) < 4
        // Astre caché derrière un autre (planète, satellite, Soleil) : ni point ni nom.
        && !hiddenByAny(this.cam.position, b, this.bodyLabels);
    // Fin de la boucle.
    }
    // Place les étiquettes (début) :
    layoutLabels({
      // la caméra et la taille de l'écran,
      cam: this.cam, W: this.W, H: this.H,
      // les repères des astres,
      bodies: this.bodyLabels,
      // les villes,
      cities: this.cityItems,
      // Aucun nom de ville sur la Terre : ni la courte liste de l'API, ni les libellés Natural Earth.
      citiesEnabled: false,
      // le groupe de la Terre
      earthGroup: this.earth.group,
      // et son maillage.
      earthMesh: this.earth.mesh,
    // Fin du placement.
    });
  // Fin de updateLabels.
  }

  // Textes du HUD, publiés ≈10 fois par seconde.
  updateHud(now) {
    // Moins de 100 ms depuis la dernière publication : rien.
    if (now - this.hudAt < 100) return;
    // Note l'instant.
    this.hudAt = now;

    // La cible.
    const f = this.focusTarget();
    // Date simulée, en français,
    const date = new Date(this.simMs).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' })
      // avec « temps réel » à vitesse 1.
      + (this.speed === 1 ? ' · temps réel' : '');

    // Distance au Soleil en unités astronomiques : celle de la planète, ou de la Terre pour la Lune.
    const au = f.body ? Math.hypot(...f.body.ecl) : f.moon ? Math.hypot(...this.earth.ecl) : 0;
    // Texte de la cible (début) :
    let focusText = (this.focus
      // le nom, la distance au Soleil et le temps de la lumière ;
      ? `${f.name} · ${au.toFixed(3)} UA du Soleil · lumière ${(au * LIGHT_MINUTES_PER_AU).toFixed(1)} min`
      // ou « Vue d'ensemble » ; puis l'échelle.
      : 'Vue d’ensemble') + ' · échelle réelle 1:1';

    // Ville suivie.
    const city = this.lockCity;
    // S'il y en a une, sur la Terre (début).
    if (city && this.focus === this.earthFocus) {
      // Texte : son nom et sa latitude,
      focusText = `${city.name} · ${Math.abs(city.lat).toFixed(2)}°${city.lat >= 0 ? 'N' : 'S'} `
        // sa longitude
        + `${Math.abs(city.lon).toFixed(2)}°${city.lon >= 0 ? 'E' : 'O'}`
        // et l'altitude de la caméra.
        + ` · altitude ${fmtAltitude(this.dist - 1, EARTH_RADIUS_KM)}`;
    // Fin de ce cas.
    }

    // Dans une géante gazeuse modélisée : couche traversée et profondeur réelle sous le sommet des nuages.
    const inside = f.passable && f.body ? interiorReadout(bodyId(f.body.def), this.dist / this.localRadius()) : null;
    // Dans une géante : le nom et la couche traversée.
    if (inside) focusText = `${f.name} · ${inside}`;

    // Lune ciblée : son propre texte.
    if (f.moon && this.moonGeo) focusText = this.moonText(f);
    // Satellite ciblé (début).
    if (f.satellite) {
      // Le satellite.
      const sat = f.satellite;
      // Distance de sa planète au Soleil.
      const sau = Math.hypot(...sat.parent.ecl);
      // Texte : son nom, sa planète et sa distance à elle,
      focusText = `${f.name} · satellite de ${sat.parent.def.name} · ${Math.round(this.satellites.distanceKm(sat)).toLocaleString('fr-FR')} km de son centre`
        // la distance au Soleil, la précision de la position et l'échelle.
        + ` · ${sau.toFixed(3)} UA du Soleil${sat.exact ? '' : ' · position approchée'} · échelle réelle 1:1`;
    // Fin de ce cas.
    }

    // Satellite naturel ciblé : grandeurs en direct pour sa fiche (distance à sa planète, distance au Soleil).
    let satelliteLive = null;
    // Si un satellite est ciblé (début).
    if (f.satellite) {
      // Le satellite.
      const sat = f.satellite;
      // Distance de sa planète au Soleil.
      const sau = Math.hypot(...sat.parent.ecl);
      // Ses grandeurs en direct (début) :
      satelliteLive = {
        // identifiant, nom et planète ;
        id: sat.def.id, name: f.name, satellite: true, parentName: sat.parent.def.name,
        // distance à sa planète et précision ;
        distKm: Math.round(this.satellites.distanceKm(sat)), exact: sat.exact,
        // distance au Soleil et temps de la lumière.
        au: sau, lightMinutes: sau * LIGHT_MINUTES_PER_AU,
      // Fin des grandeurs.
      };
    // Fin de ce cas.
    }

    // À la place du facteur de zoom : distance à la surface de l'astre dont la gravité domine là où est la caméra
    // (« le plus lourd le plus proche », voir gravityMath.jsx). `zoomShort` : la distance seule quand cet astre est
    // celui qui est ciblé (son nom est déjà affiché à côté).
    const dominant = this.dominantBodyNow();
    // Distance à sa surface, mise en forme.
    const distanceText = dominant ? formatDistanceKm((dominant.distance - dominant.r) * EARTH_RADIUS_KM) : '';
    // Texte du zoom : l'astre dominant et la distance.
    const zoomText = dominant ? `${dominant.name} · ${distanceText}` : f.name;
    // Version courte : la distance seule si c'est l'astre ciblé.
    const zoomShort = dominant && dominant.name === f.name ? distanceText : zoomText;
    // Niveau d'échelle (« Rue », « Ville », « Planète »…) : le zoom est continu, ce mot dit où l'on en est.
    const scaleText = dominant
      // d'après la distance à la surface et la nature de l'astre ;
      ? scaleLevel((dominant.distance - dominant.r) * EARTH_RADIUS_KM, { earth: dominant.name === this.earth.def.name, star: dominant.name === this.data.bodies.sun.name })
      // vide sans astre dominant.
      : '';
    // Publie dans le HUD (début) :
    this.hud.set({
      // la date et les textes ;
      date, focusText, zoomText, zoomShort, scaleText,
      // la ville suivie, sur la Terre :
      cityFocus: city && this.focus === this.earthFocus
        // son nom et ses coordonnées,
        ? { name: city.name, lon: city.lon, lat: city.lat }
        // sinon null ;
        : null,
      // l'état des tuiles de chaque astre ;
      ...this.tilesSnapshot(),
      // la Lune en direct, si elle est ciblée ;
      moonLive: f.moon ? this.moonLiveState() : null,
      // les grandeurs de la planète ciblée, sinon celles du satellite ;
      bodyLive: f.body ? { id: bodyId(f.body.def), name: f.name, au, lightMinutes: au * LIGHT_MINUTES_PER_AU } : satelliteLive,
      // la boussole ;
      compass: this.compassState(),
      // les coordonnées des coins.
      gps: this.gpsState(),
      // Nuage de points LiDAR à l'écran : avancement de son chargement (jauge), ou null.
      lidarPoints: this.lidarPoints.progress,
      // Verrouillage de la vue : astre le plus proche de l'astre focus.
      viewLock: this.viewLockState(),
    // Fin de la publication.
    });
  // Fin de updateHud.
  }

  /** État des tuiles de chaque astre, sous sa clé du HUD (tiles, moonTiles, marsTiles…). */
  // tilesSnapshot : l'état des tuiles de chaque astre (début).
  tilesSnapshot() {
    // Résultat.
    const out = {};
    // Pour chaque astre : son état, sous sa clé du HUD.
    for (const tb of this.tiledBodies) out[tb.cfg.hudKey] = tb.tiles.snapshot();
    // Le renvoie.
    return out;
  // Fin de tilesSnapshot.
  }

  /** Lune en direct pour le panneau : phase, distance, libration, Soleil au zénith, sondes. */
  // moonLiveState : la Lune en direct, pour le panneau (début).
  moonLiveState() {
    // Position géocentrique.
    const g = this.moonGeo;
    // Inconnue : null.
    if (!g) return null;
    // Inverse de l'orientation de la Lune.
    this.moonQInv.copy(this.moonGroup.quaternion).invert();
    // toLocal : passe un vecteur dans le repère de la Lune.
    const toLocal = ([x, y, z]) => { const v = this.tmpV.set(x, y, z).applyQuaternion(this.moonQInv); return [v.x, v.y, v.z]; };
    // Position de la Terre.
    const ew = this.earth.w;
    // Longitude du Soleil vue de la Terre.
    const sunLon = Math.atan2(-ew.z, ew.x) / D + 180;
    // Vecteur de la Terre à la Lune et position de la Lune.
    const rel = this.moonRel, w = this.moonW;
    // État de la Lune : phase, distance, libration et point subsolaire.
    const st = moonState({ moonRel: [rel.x, rel.y, rel.z], moonHelio: [w.x, w.y, w.z], elongDeg: g.lon - sunLon, toLocal });
    // Direction de la Terre vue de la Lune.
    const toEarth = [-rel.x, -rel.y, -rel.z];
    // Sa longueur.
    const l = Math.hypot(...toEarth);
    // round : arrondit à une précision donnée.
    const round = (x, k = 1) => Math.round(x * k) / k;
    // Pour chaque sonde (début).
    const orbiters = this.orbiters.items.map((it) => {
      // Ses informations de base.
      const base = { id: it.id, name: it.name, agency: it.agency, description: it.description, error: it.error || null, selected: it.id === this.selectedOrbiter };
      // Sans état : marquée indisponible.
      if (!it.state) return { ...base, ok: false };
      // Ses mesures.
      const m = orbiterMetrics(it.state, toLocal, toEarth.map((c) => c / l));
      // Renvoie (début)
      return {
        // l'altitude et la vitesse,
        ...base, ok: true, altitudeKm: round(m.altitudeKm), speedKmS: round(m.speedKmS, 1000),
        // la période, la position survolée et la visibilité de la Terre.
        periodMin: m.periodMin && round(m.periodMin, 10), lon: round(m.lon, 100), lat: round(m.lat, 100), earthVisible: m.earthVisible,
      // Fin du résultat.
      };
    // Fin de la boucle.
    });
    // Renvoie (début)
    return {
      // la phase, la part éclairée, l'âge et le sens,
      phase: st.phase, lit: round(st.lit * 100), ageDays: round(st.ageDays, 10), waxing: st.waxing,
      // la distance et le temps de la lumière,
      distKm: round(st.distKm), lightSeconds: round(st.lightSeconds, 1000),
      // la libration,
      libration: { lon: round(st.libration.lon, 100), lat: round(st.libration.lat, 100) },
      // le point subsolaire,
      subSolar: { lon: round(st.subSolar.lon, 100), lat: round(st.subSolar.lat, 100) },
      // la source de la position,
      source: this.moonSource,
      // les sondes,
      orbiters,
      // leur source,
      orbitersSource: this.orbiterData?.source || null,
      // l'état de ShadowCam
      shadowcam: this.shadowcam.snapshot(),
      // et la présence du modèle 3D.
      model: Boolean(this.tiledById.moon.model),
    // Fin du résultat.
    };
  // Fin de moonLiveState.
  }

  // Lune ciblée : distance réelle, phase et, de près, point survolé (coordonnées sélénographiques) et altitude.
  moonText(f) {
    // Position géocentrique.
    const g = this.moonGeo;
    // Direction du Soleil vue de la Lune.
    const toSun = this.moonW.clone().negate().normalize();
    // Direction de la Terre vue de la Lune.
    const toEarth = this.moonRel.clone().negate().normalize();
    // Part éclairée.
    const lit = (1 + toSun.dot(toEarth)) / 2;
    // Position de la Terre.
    const ew = this.earth.w;
    // Longitude du Soleil vue de la Terre.
    const sunLon = Math.atan2(-ew.z, ew.x) / D + 180;
    // Élongation, entre 0° et 360°.
    const elong = ((((g.lon - sunLon) % 360) + 360) % 360);
    // Nom de la phase.
    const phase = MOON_PHASES[Math.round(elong / 45) % 8];
    // Texte : distance à la Terre, phase, part éclairée et source.
    let text = `Lune · ${Math.round(g.distKm).toLocaleString('fr-FR')} km de la Terre · ${phase} · ${Math.round(lit * 100)} % éclairée · position ${this.moonSource}`;

    // De près, sous 3 rayons (début).
    if (this.dist < f.r * 3) {
      // Met à jour la matrice de la Lune.
      this.moonGroup.updateMatrixWorld(true);
      // Son inverse.
      this.moonInv.copy(this.moonGroup.matrixWorld).invert();
      // Position de la caméra dans le repère de la Lune.
      const local = this.cam.position.clone().applyMatrix4(this.moonInv);
      // Coordonnées du point au centre de l'écran (en vue 3/4 la caméra est décalée de ce point).
      const aim = this.tiltAim.clone().applyMatrix4(this.moonInv);
      // Sa longitude et sa latitude.
      const [lon, lat] = xyzToLonLat([aim.x, aim.y, aim.z]);
      // Texte : les coordonnées du point visé,
      text = `Lune · ${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'O'}`
        // l'altitude et la phase.
        + ` · altitude ${fmtAltitude(local.length() / f.r - 1, this.tiledById.moon.cfg.radiusKm)} · ${phase}`;
    // Fin de ce cas.
    }
    // Renvoie le texte.
    return text;
  // Fin de moonText.
  }

  // ----------------------------------------------------------------- nettoyage

  // dispose : arrête le moteur et libère tout (début).
  dispose() {
    // Moteur arrêté.
    this.stopped = true;
    // Libère les nuages LiDAR.
    this.lidar?.dispose();
    // Libère les points LiDAR.
    this.lidarPoints?.dispose();
    // Retire les repères créés.
    this.markerEls?.forEach((el) => el.remove());
    // Annule l'image demandée.
    cancelAnimationFrame(this.rafId);
    // Libère la sonde de performance.
    this.perfProbe?.dispose();
    // N'écoute plus la visibilité de l'onglet.
    document.removeEventListener('visibilitychange', this.onVisibility);
    // Débranche les entrées.
    this.removeInput();
    // Libère les tuiles de chaque astre.
    for (const tb of this.tiledBodies) tb.tiles.dispose();
    // Libère les noms des villes.
    this.worldLabels.dispose();
    // Libère le point de l'utilisateur.
    this.userMarker.dispose();
    // Libère les noms des pays.
    this.countryLabels.dispose();
    // Libère les volcans.
    this.volcanoes.dispose();
    // Libère la fiche de ville.
    this.cityCard.dispose();
    // Libère les noms des lieux de la Lune.
    this.moonLabels.dispose();
    // Libère le tracé de l'orbite de la Lune.
    this.moonOrbitTrail.dispose();
    // Libère les sondes.
    this.orbiters.dispose();
    // Libère ShadowCam.
    this.shadowcam.dispose();
    // Libère le ciel.
    this.sky.dispose();
    // Libère les satellites.
    this.satellites.dispose();
    // Pour chaque objet de la scène (début).
    this.scene.traverse((o) => {
      // Libère sa géométrie.
      if (o.geometry) o.geometry.dispose();
      // Ses matériaux, en liste.
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      // Pour chacun (début).
      mats.forEach((m) => {
        // Libère sa texture.
        if (m.map) m.map.dispose();
        // Libère le matériau.
        m.dispose();
      // Fin de la boucle.
      });
    // Fin du parcours.
    });
    // Libère le moteur de rendu.
    this.renderer.dispose();
    // Son canevas.
    const cv = this.renderer.domElement;
    // Le retire de la page.
    if (cv.parentNode) cv.parentNode.removeChild(cv);
  // Fin de dispose.
  }
// Fin de la classe SolarEngine.
}
