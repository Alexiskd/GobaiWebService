/**
 * Constantes et petites fonctions communes au moteur SolarEngine (engine.jsx) et à ses méthodes (dossier engine/).
 */
import * as THREE from 'three';
import { D } from '../OrbitEngine/ephemeris.jsx';
import { TILED_BODY_BY_ID } from '../BodyEngine/tiledBodies.jsx';

// TAU : un tour complet, 2π arrondi.
export const TAU = 6.2832;
/** Délai entre deux replacements des régions actives réelles du Soleil, en millisecondes : une minute. */
// Déclare REGIONS_REPLACE_MS : la rotation du Soleil déplace les régions, on les remet en place à ce rythme.
export const REGIONS_REPLACE_MS = 60_000;
// UP_Y : l'axe vertical de la scène.
export const UP_Y = new THREE.Vector3(0, 1, 0);
// Rayon de la Terre en kilomètres.
export const EARTH_RADIUS_KM = TILED_BODY_BY_ID.earth.radiusKm;
// Demi-grand axe de l'orbite de la Lune, en kilomètres : sa distance moyenne à la Terre.
export const MOON_DISTANCE_KM = 384_400;
// Rayon du Soleil en unités astronomiques : le fond de sa toupie, où il descend dans l'affichage Schwarzschild.
export const SUN_RADIUS_AU = 0.00465;
// Une toupie n'est dessinée que si son rayon vaut au moins 1/400 de sa distance à la caméra (quelques pixels).
export const WELL_MIN_APPARENT = 400;
// Les décisions de chargement des périvolumes (actif, arrière-plan, déchargé) sont réévaluées une image sur trois :
// elles changent à l'échelle de la seconde, pas de l'image.
export const CORE_DECISION_EVERY = 3;
// Formats du HUD, créés une fois : un toLocaleString avec options recrée un formateur à chaque appel (10 fois par seconde).
export const HUD_DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' });
export const HUD_INT_FORMAT = new Intl.NumberFormat('fr-FR');
// Creux minimal de la toupie d'un astre, en part de son rayon : 100 %, la toupie est aussi profonde que large d'un
// côté (35 % avant l'amplification de la représentation).
export const WELL_MIN_DEPTH_SHARE = 1;
// Opacité du trait de la grille du Soleil et des toupies, mode pleinement affiché (0,5 avant l'amplification).
export const WELL_LINE_OPACITY = 0.8;
// Distance de la vue globale : 1,3 million de rayons terrestres.
export const VIEW_DISTANCE = 1.3e6;     // distance de la vue globale
// Distance maximale de la caméra.
export const MAX_DISTANCE = 6e7;
// Distance de départ : 9 rayons terrestres.
export const START_DISTANCE = 9;        // vue de départ à l'ouverture de l'app : Terre à 9× (neuf rayons terrestres)
// Vitesse de rotation au clavier : 1,1 rad/s.
export const KEY_ROTATE_SPEED = 1.1;    // rad/s : rotation caméra avec les flèches maintenues
// Obliquité de l'axe terrestre : 0,409 rad.
export const EARTH_TILT = 0.409;        // obliquité de l'axe terrestre (rad)
// Minutes-lumière par unité astronomique.
export const LIGHT_MINUTES_PER_AU = 8.317;
// Couleur unie de la Lune.
export const MOON_COLOR = 0x8f8d88;
// Couleur de l'orbite de la Lune.
export const MOON_ORBIT_COLOR = 0x8fa3d0;
// Distance au-delà de laquelle l'orbite de la Lune est masquée.
export const MOON_ORBIT_MAX_DIST = 3e3;  // seuil inverse des orbites héliocentriques : au-delà, l'anneau n'est que quelques pixels
// Limite de la vue polaire pour le modèle 3D : sinus de 55°.
export const MODEL_POLAR_LIMIT = Math.sin(55 * D); // vue polaire : tuiles plutôt que modèle 3D (pôles des modèles NASA pincés)
// Altitude minimale d'affichage des frontières.
export const BORDERS_MIN_ALTITUDE = 2.5e-4; // ≈ 1,6 km : plus bas, les frontières 1:50m s'écartent trop de l'imagerie
// Mouvements lissés indépendants de la cadence (mêmes réglages qu'avant à 60 images/s, mais identiques à 30 ou 144).
export const ZOOM_TAU_MS = 96;
// Calque three.js des objets de l'atmosphère redessinés au-dessus du globe CesiumJS (renderAtmosphereOverlay).
export const ATMO_LAYER = 5;          // lissage du zoom : ≈ 16 % du chemin restant par image à 60 i/s
// Vitesse de la transition vers un astre.
export const FOCUS_RATE = 1.2;          // transition vers un astre : 0 → 1 en ≈ 0,83 s
// Vitesse de la rotation automatique : 0,072 rad/s.
export const AUTO_ROTATE_SPEED = 0.072; // rad/s
// Latitude maximale de la vue.
export const POLE_LIMIT = Math.PI / 2 - 1e-4; // latitude maximale de la vue : au ras du pôle
// Lumière d'ambiance quand l'ombre est active.
export const AMBIENT_SHADED = 0.045;     // lumière d'ambiance quand l'ombre est activée (face nuit presque noire)
// Intensité de la lumière du Soleil.
export const SUN_LIGHT = 1.7;            // intensité du Soleil sur les objets éclairés par la scène
// Durée du fondu de l'ombre : 600 ms.
export const SHADE_FADE_MS = 600;       // fondu de l'ombre jour/nuit (bouton Jour / Nuit), comme le thème de l'interface (App.jsx)
// Signes infini sur la trajectoire de la caméra en rotation automatique : petite amplitude (rad), un ∞ toutes les 9 s.
export const INFINITY_AMPLITUDE = 0.035;
// Période d'un signe infini : 9 secondes.
export const INFINITY_PERIOD_S = 9;
// Caméra solidaire de la rotation de la planète en dessous de cette altitude (en rayons au-dessus du sol).
export const SPIN_LOCK_RADII = 2;
// Géante gazeuse : même chose, mais seulement tout près des nuages (à 12 km/s, ils défileraient sous la caméra).
export const GAS_SPIN_LOCK_RADII = 0.25;
// Géante gazeuse : distance au centre (en rayons locaux) où l'on arrive en traversant la couche de nuages.
export const GAS_ENTRY_RADII = 0.97;
// Points du tracé de chaque orbite de planète (voir ephemeris.orbitPositions).
export const ORBIT_POINTS = 2048;
// Seuil de taille des astres tuilés, budget d'astres mis à jour à la fois et apparition des satellites : voir
// bodyLoading.jsx (moteur de chargement planétaire).
// Résolution adaptative : si les images ralentissent, on rend moins de pixels (le détail des tuiles, lui, suit la
// densité plafond de l'appareil : voir tileManager.jsx).
export const DPR_STEP = 0.25;
// Densité de pixels minimale par défaut : 0,75 (le profil de l'appareil donne la sienne : 1,25 sur téléphone).
export const DPR_MIN = 0.75;            // plancher : en dessous l'image devient trop floue
// Durée d'image au-dessus de laquelle la résolution baisse : 18,6 ms.
export const DPR_SLOW_MS = 18.6;        // moyenne au-dessus (≈ 45 images par seconde pour 50 visées) : on baisse la résolution
// Durée d'image en dessous de laquelle elle remonte : 17,2 ms.
export const DPR_FAST_MS = 17.2;        // moyenne en dessous (rythme visé tenu) pendant DPR_RAISE_AFTER_MS : on la remonte d'un cran
// Délai avant de remonter : 4 secondes.
export const DPR_RAISE_AFTER_MS = 4000;
// Délai entre deux contrôles : 1 seconde.
export const DPR_CHECK_MS = 1000;
// fmtAltitude : met une altitude en forme (début).
export const fmtAltitude = (radii, radiusKm) => {
  // Altitude en mètres, jamais négative.
  const m = Math.max(0, radii * radiusKm * 1000);
  // En mètres sous 1 km, sinon en kilomètres, avec une décimale sous 10 km.
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
// Fin de fmtAltitude.
};     // teinte unie de la Lune tant que ses tuiles ne couvrent pas la vue

// clamp : borne une valeur entre a et b.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Y_AXIS : l'axe vertical.
export const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Noms des huit phases de la Lune (début).
export const MOON_PHASES = [
  // De la nouvelle lune à la gibbeuse croissante.
  'Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Gibbeuse croissante',
  // De la pleine lune au dernier croissant.
  'Pleine lune', 'Gibbeuse décroissante', 'Dernier quartier', 'Dernier croissant',
// Fin des phases.
];
