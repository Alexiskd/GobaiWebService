// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe selectTiles, le choix des tuiles à afficher, depuis quadtree.
import { selectTiles } from '../loading/quadtree.jsx';
// Importe les enfants, le parent et la clé d'une tuile, depuis mercator.
import { childrenOf, parentOf, tileKey } from '../mercator.jsx';
// Importe LruCache, le cache qui évince le moins récent, depuis lru.
import { LruCache } from '../loading/lru.jsx';
// Importe TileLoader, la file de chargement, depuis tileLoader.
import { TileLoader } from './tileLoader.jsx';
// Importe le maillage d'une tuile, l'écart entre niveaux et le rayon d'un niveau, depuis tileGeometry.
import { buildTileGrid, levelGap, tileRadius } from './tileGeometry.jsx';
// Importe les deux shaders des tuiles, depuis tileShaders.
import { tileFragmentShader, tileVertexShader } from './tileShaders.jsx';
// Importe la projection Mercator, le choix d'une projection et l'emprise d'une tuile, depuis projection.
import { EQUIRECTANGULAR, MERCATOR, projectionOf, tileBoundsIn } from '../projection.jsx';
// Importe les constantes et les fonctions du relief, depuis relief.
import { MAX_HEIGHT_M, OCEAN_SHADE_BOOST, RELIEF_SKIRT, metersPerTexel, pointInTile, terrariumMeters, texelAt } from '../../ReliefEngine/relief.jsx';
// Importe nativeTile et OVERZOOM_LEVELS, la tuile native d'une tuile sur-zoomée et le nombre de niveaux, depuis overzoom.
import { nativeTile, OVERZOOM_LEVELS } from '../loading/overzoom.jsx';
// Importe la basse résolution d'abord : premiers niveaux de l'astre entier et ancêtres des tuiles voulues.
import { coarsePriority, isCoarseLevel, lowResTiles } from '../loading/lowRes.jsx';
// Importe l'accord des couleurs entre les niveaux de zoom.
import { LEVEL_PX, LevelColors, corrected } from './levelColors.jsx';
// Importe le repli des lumières de la nuit (ancêtre déjà chargé), depuis nightLights.
import { LIGHTS_PAD, NEIGHBOUR_DIRS, fillPad, lightsFallback, lightsPrefetchList, neighbourTile, padLightsImage, paddedRect } from '../earth/nightLights.jsx';
// Importe les outils du préchargement prédictif, depuis prefetch.
import { CameraPredictor, coneTest, PREFETCH_FOV, tilePriority, ZoomWatch } from '../loading/prefetch.jsx';
// Importe les paliers de zoom : palier d'une distance, budget, tuiles gardées et tuiles à décharger.
import { keptKeys, offFieldKeys, tierFor, tileBudget, withinBudget } from '../loading/zoomTiers.jsx';
// Importe l'identifiant du calque des rues, demandé seulement aux paliers qui l'affichent.
import { ROADS_LAYER_ID } from '../earth/roadSource.jsx';
// Importe HexDisplay, l'affichage en cellules hexagonales, depuis hexDisplay.
import { HexDisplay } from '../hex/hexDisplay.jsx';

// Priorité des tuiles d'altitude : 1e9, après toutes les images.
const RELIEF_PRIORITY = 1e9;                           // les tuiles d'altitude passent après toutes les images (plus petite priorité d'abord)
// Accentuation de l'ombrage des fonds marins, partagée.
const OCEAN_BOOST = { value: OCEAN_SHADE_BOOST };       // accentuation de l'ombrage des fonds marins, partagée
// Réglage partagé à zéro, pour un astre sans relief.
/** Altitude de la caméra (km) au-delà de laquelle la Terre n'affiche plus de relief : le relief ne se voit qu'à partir de 1 km. */
// Déclare et exporte l'altitude limite du relief de la Terre : 1 km.
export const RELIEF_MAX_KM = 1;
const RELIEF_OFF = { value: 0 };                       // astre sans relief : réglages partagés à zéro
// Côté des images de lumières par défaut (en pixels), si l'astre n'en fournit pas.
const LIGHTS_SIZE_DEFAULT = { value: new THREE.Vector2(256, 256) };
/** Durée du fondu d'une tuile de lumières fine par-dessus son repli (ancêtre ou mosaïque mondiale), en millisecondes. */
// Déclare et exporte la durée du fondu des lumières : 400 ms.
export const LIGHTS_FADE_MS = 400;
// lightsFadeMs : 0 si le système demande de réduire les animations (changement immédiat), sinon la durée du fondu.
const lightsFadeMs = () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : LIGHTS_FADE_MS);
// Clé d'une tuile de lumières native (z/x/y).
const lightsKey = (c) => `${c.z}/${c.x}/${c.y}`;
// Contexte de lecture d'une altitude : pas encore créé.
let probe = null;
/** Canevas d'un pixel pour lire une altitude (créé au premier besoin). */
// heightProbe : le canevas d'un pixel qui sert à lire une altitude (début).
function heightProbe() {
  // S'il n'a pas encore été demandé (début).
  if (probe === null) {
    // Crée un canevas, si la page existe.
    const canvas = globalThis.document?.createElement('canvas');
    // D'un seul pixel.
    if (canvas) canvas.width = canvas.height = 1;
    // Son contexte, prévu pour des lectures fréquentes ; faux s'il est indisponible.
    probe = canvas?.getContext('2d', { willReadFrequently: true }) || false;
  // Fin de ce cas.
  }
  // Le renvoie, ou null.
  return probe || null;
// Fin de heightProbe.
}
/** Côté d'une image de tuile en pixels : largeur naturelle (image), largeur (canevas, ImageBitmap), sinon 256. */
// Déclare et exporte imageSide : le côté d'une image, 256 par défaut.
export const imageSide = (img) => img?.naturalWidth || img?.width || 256;
// Gain de couleur neutre : 1, 1, 1.
const COLOR_GAIN_NONE = new Float32Array([1, 1, 1]);   // image sans correction de couleur
// Décalage de couleur neutre : 0, 0, 0.
const COLOR_OFFSET_NONE = new Float32Array(3);
// Niveau maximal des tuiles jamais évincées, par défaut : 2.
const PINNED_MAX_ZOOM = 2;      // par défaut : tuiles du monde entier jamais évincées (dernier recours) ; réglable par couche
// Priorité du préchargement de l'astre entier : 1e6.
const PRELOAD_PRIORITY = 1e6;   // après toutes les tuiles visibles ; niveaux bas d'abord
// Envois de textures par image, au plus : 8.
const UPLOADS_PER_FRAME = 8;    // envois de textures au GPU par image, au plus (réglable par couche)
// Déclare et exporte le temps de mise en place permis par image (envoi à la carte graphique compris, voir initTexture) : 4 ms sur
// ordinateur, 2 ms sur téléphone. La première tuile passe toujours, même si elle dépasse.
export const UPLOAD_BUDGET_MS = { desktop: 4, handheld: 2 };

/**
 * Encore une mise en place cette image ? Oui pour la première ; ensuite tant que le nombre permis n'est pas atteint
 * et que le temps déjà passé reste sous le budget (une grosse image de 512 px ne fait plus sauter d'image).
 */
// Déclare et exporte uploadAllowed : mises en place faites, temps passé (ms), nombre permis et budget (ms) (début).
export function uploadAllowed(done, elapsedMs, maxCount, budgetMs) {
  // La première passe toujours (la carte avance même sur un appareil lent).
  if (done === 0) return maxCount > 0;
  // Ensuite : sous le nombre permis et sous le budget de temps.
  return done < maxCount && elapsedMs < budgetMs;
// Fin de uploadAllowed.
}

// Délai avant un nouvel essai après un échec : 6 secondes.
const RETRY_AFTER_MS = 6000;
// Priorité du préchargement prédictif : 1e3.
const PREFETCH_PRIORITY = 1e3;  // préchargement prédictif : après les tuiles visibles, avant le préchargement global
// Calcul de la vue prédite toutes les 4 images.
const PREFETCH_EVERY = 4;       // calcul de la vue prédite toutes les 4 images
// Demandes prédictives en file, au plus : 48.
const PREFETCH_MAX_QUEUED = 120; // demandes prédictives en file au plus (les plus utiles d'abord ; 48 avant)
// Relance des demandes, vue immobile : toutes les 15 images.
const REQUEST_SWEEP_EVERY = 15; // vue immobile : relance des demandes (échecs expirés, L2) toutes les 15 images
// Netteté qui suit le mouvement : pendant un déplacement, une rotation ou un zoom, l'erreur tolérée à l'écran est
// doublée (images un niveau plus grossières, quatre fois moins de requêtes) ; 250 ms après l'arrêt, la vue est
// resélectionnée à la netteté normale.
const MOTION_SSE = 2, MOTION_HOLD_MS = 250;
// Zoom rapide : un niveau d'images n'est demandé qu'après 180 ms de présence dans la vue ; les niveaux traversés
// plus vite sont sautés (l'ancêtre déjà affiché reste en attendant le niveau d'arrivée).
const LEVEL_SETTLE_MS = 180;
// Vue inchangée à ces tolérances près : la sélection précédente est réutilisée (pas de nouveau parcours du quadtree).
// Tolérance de position : un millième de l'altitude.
const VIEW_POS_TOL = 1e-3;      // × altitude de la caméra
// Tolérance de direction : 5e-4 radian.
const VIEW_DIR_TOL = 5e-4;      // rad (≈ 1 px d'écran)


/** Vue « presque identique » : position relative à l'altitude, visée et haut de l'image, champ et taille d'écran. */
// sameView : deux vues sont-elles presque identiques (début).
function sameView(a, b) {
  // Vue absente, ou champ, hauteur d'écran ou format différents : faux.
  if (!a || !b || a.fovY !== b.fovY || a.viewportH !== b.viewportH || a.aspect !== b.aspect) return false;
  // Altitude de la caméra, jamais nulle.
  const alt = Math.max(Math.hypot(b.cam[0], b.cam[1], b.cam[2]) - 1, 1e-12);
  // Écart entre les deux positions.
  const dp = Math.hypot(a.cam[0] - b.cam[0], a.cam[1] - b.cam[1], a.cam[2] - b.cam[2]);
  // Au-delà de la tolérance : faux.
  if (dp > alt * VIEW_POS_TOL) return false;
  // d3 : écart entre deux vecteurs ; 0 si les deux manquent, infini si un seul manque.
  const d3 = (u, v) => (u && v ? Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) : u === v ? 0 : Infinity);
  // Vrai si la visée et le haut de l'image sont dans la tolérance.
  return d3(a.fwd, b.fwd) <= VIEW_DIR_TOL && d3(a.up, b.up) <= VIEW_DIR_TOL;
// Fin de sameView.
}
// copyView : copie une vue (début) :
const copyView = (v) => ({
  // la caméra, la visée, le haut de l'image, le champ, la hauteur d'écran et le format.
  cam: [...v.cam], fwd: v.fwd && [...v.fwd], up: v.up && [...v.up], fovY: v.fovY, viewportH: v.viewportH, aspect: v.aspect,
// Fin de copyView.
});

// Détail simulé coupé, partagé.
const NO_DETAIL = { value: new THREE.Vector2(0, 0) };

// emptyTexture : une texture transparente d'un pixel (début).
const emptyTexture = () => {
  // La texture de données.
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  // À envoyer à la carte graphique.
  t.needsUpdate = true;
  // La renvoie.
  return t;
// Fin de emptyTexture.
};

/**
 * Une couche de tuiles posée sur un astre (Terre ou Lune) : sélection (quadtree), chargement, cache borné, affichage.
 * Une tuile jamais prête est remplacée par son ancêtre déjà chargé, donc la carte n'a pas de trou.
 * Un `overlaySource` optionnel (ex. routes et noms) est fondu dans le même maillage que la source principale.
 */
// Déclare et exporte la classe TileLayer (début).
export class TileLayer {
  /**
   * @param {object} o
   *  root        THREE.Object3D parent (repère de l'astre, sphère de rayon 1)
   *  source      TileSource principale (son `info.projection` fixe le découpage)
   *  uniforms    { sunV, shade, airless, ovMode, colorMap, colorOn, panOn } partagés par toutes les tuiles de l'astre
   *  maxAnisotropy, capacity, concurrency, maxZoomCap (22 = limite des fournisseurs ; la géométrie est relative au centre de tuile)
   *  pinnedMaxZoom  niveaux 0 à n de l'astre entier préchargés au démarrage et jamais évincés (Lune : 3 → 170 tuiles)
   *  prefetch       préchargement prédictif (vitesse de la caméra, cône élargi à 120°) vers le cache RAM
   *  ramCapacity    cache L2 : images décodées hors GPU (tuiles évincées du GPU ou préchargées)
   *  overzoom       niveaux affichés au-delà du niveau natif de la source (3 par défaut ; davantage avec le détail simulé)
   *
   * Caches : L1 = textures sur le GPU (LRU `cache` + `pinned`), L2 = images décodées en RAM (`ram`, LRU). Rien
   * n'est gardé sur le disque du navigateur : les fichiers sont téléchargés sans cache (voir loadImage).
   */
  // Constructeur (début des réglages) :
  constructor({
    // le repère, la source, les variables partagées, le filtrage, la capacité, les chargements simultanés, le niveau plafond, les niveaux gardés,
    root, source, uniforms, maxAnisotropy = 4, capacity = 260, concurrency = 6, maxZoomCap = 22, pinnedMaxZoom = PINNED_MAX_ZOOM,
    // le préchargement, la mémoire vive, le sur-zoom, le relief et ses deux sources, et la source des lumières de nuit,
    prefetch = false, ramCapacity = 0, overzoom = OVERZOOM_LEVELS, relief = null, reliefSource = null, oceanSource = null, nightLights = null,
    // les envois par image, l'affichage en hexagones et la taille maximale d'une texture (0 : pas de limite),
    uploadsPerFrame = UPLOADS_PER_FRAME, hex = true,
    // le rayon de l'astre en km (distance affichée des paliers) et l'appareil (tenu en main, économie d'énergie).
    radiusKm = 0, device = () => ({ handheld: false, saving: false }),
    // Atlas multi-couches expérimental, désactivé par défaut ; instance de SatelliteTileAtlasPipeline.
    surfaceAtlasPipeline = null, bodyId = null,
    // Envoi immédiat d'une texture à la carte graphique (renderer.initTexture), ou null : envoi au premier dessin.
    initTexture = null,
  // Fin des réglages (début du constructeur).
  }) {
    // Paliers de zoom (table du serveur) : rayon de l'astre, appareil, palier en cours et budget de tuiles.
    this.radiusKm = radiusKm; this.device = device; this.tier = null; this.budget = Infinity;
    // Altitude de la caméra (km) et altitude au-delà de laquelle les altitudes du relief ne sont plus chargées (posée par le gestionnaire).
    this.altKm = 0; this.reliefCapKm = Infinity;
    // Garde le nombre d'envois par image.
    this.uploadsPerFrame = uploadsPerFrame;
    // Garde l'envoi immédiat des textures : la texture part à la carte graphique pendant la mise en place (comptée dans
    // son budget), et non au premier dessin de la cellule, où elle faisait sauter une image.
    this.initTexture = typeof initTexture === 'function' ? initTexture : null;
    // Mouvement : vue de l'image précédente, fin du mouvement en cours, état à la dernière sélection.
    this.prevFrameView = null; this.movingUntil = -Infinity; this.lastMoving = false;
    // Zoom rapide : instant où chaque niveau d'images est entré dans la vue.
    this.levelSeen = new Map();
    // Part des envois autorisée : toute.
    this.uploadShare = 1; // part autorisée cette image (réglée par TileManager quand le rythme d'images fléchit)
    // Compteurs de performance : naissance de la couche, première tuile (ms), tuiles mises en place, temps d'envoi
    // à la carte graphique par image (ms, lissé) et débit de mise en place (tuiles/s, sur 5 s glissantes).
    // firstTileAtMs et worldReadyMs se comptent depuis l'ouverture de la page (performance.now()) : première image posée,
    // puis fond instantané complet (toutes les tuiles gardées en mémoire, le globe entier affiché).
    this.perf = { bornAt: performance.now(), firstTileMs: null, firstTileAtMs: null, worldReadyMs: null, installs: 0, uploadMs: 0, rate: 0, windowAt: performance.now(), windowCount: 0 };
    // Affichage en cellules hexagonales (voir hexDisplay.jsx) : le modèle par défaut. `hex: false` garde l'ancien
    // affichage en tuiles carrées (tests, dépannage).
    // Affichage en hexagones demandé ?
    this.hexOn = Boolean(hex);
    // Son gestionnaire : pas encore créé.
    this.hex = null;
    // Relief à vraies altitudes ({ radiusM, minZoom, maxZoom }, voir relief.jsx) et sa source de tuiles d'altitude :
    // seulement pour un découpage Mercator, celui des tuiles d'altitude. Posé plus bas, une fois le découpage connu.
    // Garde le relief demandé.
    this.reliefWanted = relief;
    // Garde la source des tuiles d'altitude.
    this.reliefSource = reliefSource;
    // Fond des océans : source des tuiles de profondeur (ReliefSource, voir relief.jsx), ou null.
    // Source des fonds marins, si le relief en a ; sinon aucune.
    this.oceanSource = relief?.ocean ? oceanSource : null;
    // Textures d'altitude partagées, par image.
    this.heightTextures = new Map(); // image d'altitude → { tex, refs }
    // Lumières humaines de la nuit (NightLightsSource, voir nightLights.jsx), ou null.
    this.lightsSource = nightLights;
    // Garde le repère.
    this.root = root;
    // Garde la source.
    this.source = source;
    // Garde les variables partagées.
    this.uniforms = uniforms;
    // Opt-in : le rendu historique reste le repli si l'atlas est absent ou échoue.
    this.surfaceAtlasPipeline = surfaceAtlasPipeline;
    this.bodyId = bodyId;
    // Garde le filtrage anisotrope.
    this.maxAnisotropy = maxAnisotropy;
    // Garde le niveau plafond.
    this.maxZoomCap = maxZoomCap;
    // Garde le nombre de niveaux de sur-zoom.
    this.overzoom = overzoom;      // niveaux affichés au-delà du niveau natif (image agrandie, détail simulé éventuel)
    // Textures partagées, par image.
    this.textures = new Map();     // image décodée → { tex, refs } : une seule texture GPU par image (tuiles sur-zoomées)
    // Lumières de la nuit déjà sur la carte graphique, par tuile native (z/x/y → image) : repli immédiat d'une tuile
    // fille en attendant la sienne. Une entrée vit tant que sa texture est utilisée.
    this.lightsByCoord = new Map();
    // Textures de lumières dont la bordure vient de recevoir une voisine : renvoyées à la carte graphique, une par image.
    this.lightsDirty = new Set();
    // Garde le niveau maximal des tuiles gardées.
    this.pinnedMaxZoom = pinnedMaxZoom;
    // Liste des tuiles à précharger : pas encore calculée.
    this.pinList = null;           // tuiles à précharger (calculées au premier passage)
    // Leurs clés.
    this.pinKeys = new Set();
    // Groupe des tuiles.
    this.group = new THREE.Group();
    // Son nom.
    this.group.name = 'tiles';
    // L'ajoute au repère.
    root.add(this.group);

    // Calque : aucun.
    this.overlay = null;
    // Texture transparente d'attente.
    this.placeholder = emptyTexture();
    // File de chargement.
    this.loader = new TileLoader(concurrency);
    // Garde la capacité de base.
    this.baseCapacity = capacity;
    this.baseRamCapacity = ramCapacity;
    this.coreGpuCapacity = null;
    // Cache des tuiles sur la carte graphique ; une tuile évincée passe par evict.
    this.cache = new LruCache(capacity, (_k, entry) => this.evict(entry));
    // Cache des images décodées en mémoire vive.
    this.ram = new LruCache(ramCapacity);  // L2 : clé → { coord, base, ov, overlay, baseRect, ovRect }
    // Préchargement prédictif : si demandé et s'il y a de la mémoire vive.
    this.prefetchOn = prefetch && ramCapacity > 0;
    // Prédicteur de la caméra.
    this.predictor = new CameraPredictor();
    // Détecteur de zoom.
    this.zoomWatch = new ZoomWatch();
    // Pas de zoom en cours.
    this.zooming = false;
    // Clés des demandes prédictives.
    this.prefetchKeys = new Set();
    // Compteur d'images.
    this.frame = 0;
    // Tuiles gardées, par clé.
    this.pinned = new Map();
    // Tuiles arrivées, à mettre en place.
    this.arrived = [];
    // Leurs clés.
    this.arrivedKeys = new Set(); // arrivées en attente de mise en place : on ne les redemande pas
    // Clés des tuiles voulues.
    this.wantedKeys = new Set();
    // Clés des tuiles basse résolution demandées pour la vue en cours (affichées en attendant les tuiles fines).
    this.lowKeys = new Set();
    // Clés des premiers niveaux de l'astre entier, chargés avant tout le reste.
    this.coarseKeys = new Set();
    // Accord des couleurs entre les niveaux de zoom : chaque niveau prend les teintes du plus grossier de la couche.
    this.levelColors = new LevelColors({ baseZoom: Math.max(0, source.minZoom ?? 0) });
    // Tuiles en échec : instant du prochain essai.
    this.failed = new Map();       // clé → date de nouvel essai
    // Niveau le plus fin affiché.
    this.visibleZoom = 0;
    // La vue n'est pas entièrement couverte.
    this.fullCover = false;
    // Nombre de tuiles voulues.
    this.wantedCount = 0;
    // Pas encore libérée.
    this.disposed = false;
    // Écart entre niveaux, pour une altitude de 1.
    this.gap = levelGap(1);
    // Réutilisation entre images : sélection, liste affichée, préchargement.
    // Tuiles voulues.
    this.wanted = [];
    // Vue de la dernière sélection.
    this.lastView = null;      // vue de la dernière sélection
    // Vue prédite du dernier préchargement.
    this.lastPredView = null;  // vue prédite du dernier préchargement
    // Affichage à recalculer.
    this.showDirty = true;     // l'ensemble affiché doit être recalculé (sélection, arrivée, éviction)
    // Tuiles affichées.
    this.visibleEntries = [];
    // Compteur du balayage périodique.
    this.sweep = 0;
  // Fin du constructeur.
  }

  /** Niveau affiché maximal : niveau natif de la couche avec sur-zoom modéré, borné à 22. */
  // maxZoom : le niveau natif plus le sur-zoom, sans dépasser le plafond.
  get maxZoom() { return Math.min(this.maxZoomCap, this.source.maxZoom + this.overzoom); }
  // loading : les chargements en cours et en file.
  get loading() { return this.loader.active + this.loader.queued; }
  // projection : celle que donne la description de la source.
  get projection() { return projectionOf(this.source.info?.projection); }

  // setOverlaySource : change la source du calque (début).
  setOverlaySource(source) {
    // Même source : rien à faire.
    if (this.overlay === source) return;
    // La garde.
    this.overlay = source;
    // Le préchargement est à revérifier.
    this.preloadComplete = false;
    // Retire le calque de chaque tuile.
    for (const e of [...this.entries()]) this.dropOverlay(e);
  // Fin de setOverlaySource.
  }

  // ---------------------------------------------------------------- boucle

  /** Un fondu entre deux niveaux est en cours (cellules hexagonales). */
  // fading : vrai tant qu'un fondu des cellules est en cours.
  get fading() { return Boolean(this.hex?.fading); }

  /** Applique un budget mémoire du Core sans toucher aux tuiles épinglées ni à la vue courante. */
  setCoreMemoryProfile({ gpuCapacity, ramCapacity, preserveWanted = true } = {}) {
    if (this.disposed) return false;
    this.coreGpuCapacity = Math.max(1, Math.floor(Number(gpuCapacity) || 1));
    this.cache.capacity = this.coreGpuCapacity;
    this.ram.capacity = Math.max(0, Math.floor(Number(ramCapacity) || 0));
    // L'éviction GPU suit le callback historique : textures libérées et transfert RAM si possible.
    while (this.cache.size > this.cache.capacity) {
      const candidate = this.cache.keys().find((key) => !preserveWanted || !this.wantedKeys.has(key));
      if (candidate === undefined) break;
      this.cache.delete(candidate);
    }
    // Réduit immédiatement le cache RAM dans son ordre LRU.
    while (this.ram.size > this.ram.capacity) {
      const oldest = this.ram.keys()[0];
      if (oldest === undefined) break;
      this.ram.delete(oldest);
    }
    return true;
  }

  // update : à chaque image, avec la vue (début).
  update(view) {
    // Couche libérée ou source pas prête : rien.
    if (this.disposed || !this.source.ready) return;
    // Les grandes tuiles sont affichées à une échelle adaptée, ce qui limite le nombre de requêtes.
    // Taille des tuiles de la source, 256 px par défaut.
    const tileSize = this.source.info?.tileSize || 256;
    // Seuil SSE : 2 px d'écran par pixel de texture (tuiles de 512 px : 4× moins de requêtes pour la même netteté à l'écran).
    // Options de sélection : niveaux, projection et erreur tolérée à l'écran.
    // Instant présent.
    const now = performance.now();
    // Mouvement : la vue a changé depuis l'image précédente → en mouvement pendant encore 250 ms.
    if (!sameView(this.prevFrameView, view)) this.movingUntil = now + MOTION_HOLD_MS;
    // Garde la vue de cette image.
    this.prevFrameView = copyView(view);
    // En mouvement ?
    const moving = now < this.movingUntil;
    // Palier de zoom d'après la distance affichée (altitude de la caméra en km), si la source donne des paliers.
    // Altitude de la caméra au-dessus du sol, en km.
    this.altKm = this.radiusKm > 0 ? (Math.hypot(view.cam[0], view.cam[1], view.cam[2]) - 1) * this.radiusKm : 0;
    this.tier = this.radiusKm > 0 ? tierFor(this.source.info?.tiers, (Math.hypot(view.cam[0], view.cam[1], view.cam[2]) - 1) * this.radiusKm) : null;
    // Budget de tuiles du palier, pour cet appareil et le mode économie d'énergie (sans palier : aucune limite).
    this.budget = tileBudget(this.tier, this.device());
    // Options de sélection : niveaux (plafonnés par le palier), projection, erreur tolérée à l'écran (doublée en mouvement), vue de biais allégée.
    const opts = { minZoom: this.source.minZoom, maxZoom: this.tier ? Math.min(this.maxZoom, this.tier.maxZoom) : this.maxZoom, projection: this.projection, tileSize: 256, maxSSE: ((2 * tileSize) / 256) * (moving ? MOTION_SSE : 1), foreshorten: true };

    // Sélection (quadtree) seulement si la vue a réellement changé : caméra immobile → aucun parcours.
    // Nouvelle sélection si la vue a changé, ou si le mouvement commence ou s'arrête (netteté à refaire).
    const reselect = !sameView(this.lastView, view) || moving !== this.lastMoving;
    // Garde l'état du mouvement.
    this.lastMoving = moving;
    // Dans ce cas (début).
    if (reselect) {
      // Cellules hexagonales : ce sont elles qui disent quelles images carrées charger.
      // Crée l'affichage en hexagones à la première sélection.
      if (this.hexOn && !this.hex) this.hex = new HexDisplay(this);
      // Durée des fondus entre niveaux : celle de la carte marine de la table, s'il y en a une.
      this.hex?.setFadeMs(this.source.info?.marine?.fadeMs);
      // Tuiles voulues : par les cellules, ou par le quadtree.
      const wanted = this.hexOn ? this.hex.select(view, opts) : selectTiles(view, opts);
      // Priorité = 1 / (distance au centre de l'écran) × importance du niveau (sans visée connue : la distance).
      // Niveau le plus fin voulu.
      let finest = 0;
      // Le cherche.
      for (const t of wanted) if (t.z > finest) finest = t.z;
      // Priorité de chaque tuile : selon le centre de l'écran, ou la distance sans visée.
      for (const t of wanted) t.p = view.fwd ? tilePriority(t, view.cam, view.fwd, finest) : t.d;
      // Garde les tuiles voulues, dans le budget du palier (les plus prioritaires) ; les autres cellules affichent un
      // niveau moins fin.
      this.wanted = withinBudget(wanted, this.budget);
      // Chargement limité au champ de la caméra (table du serveur) : les tuiles hors champ quittent la carte graphique.
      if (this.source.info?.fieldOnly) this.unloadOffField();
      // Zoom rapide : note l'instant d'entrée de chaque niveau d'images, oublie ceux qui ne sont plus voulus.
      const levels = new Set(wanted.map((t) => t.z));
      // Niveaux nouveaux : notés maintenant.
      for (const z of levels) if (!this.levelSeen.has(z)) this.levelSeen.set(z, now);
      // Niveaux partis : oubliés.
      for (const z of [...this.levelSeen.keys()]) if (!levels.has(z)) this.levelSeen.delete(z);
      // Garde une copie de la vue.
      this.lastView = copyView(view);
      // Cellules hexagonales : rien à refaire à l'écran tant que la vue garde les mêmes cellules au même niveau
      // (une image qui arrive ou qui part redemande l'affichage de son côté).
      // Affichage à recalculer, sauf si les cellules n'ont pas changé.
      if (!this.hexOn || this.hex.changed) this.showDirty = true;
    // Fin de la nouvelle sélection.
    }
    // Tuiles voulues.
    const wanted = this.wanted;
    // Écart entre niveaux, d'après l'altitude de la caméra.
    this.gap = levelGap(Math.max(0, Math.hypot(view.cam[0], view.cam[1], view.cam[2]) - 1));
    // Leur nombre.
    this.wantedCount = wanted.length;

    // Le cache doit pouvoir contenir au moins tout ce qui est voulu, sinon les tuiles s'évincent en boucle.
    // Capacité du cache : au moins 1,3 fois le nombre de tuiles voulues.
    this.cache.capacity = Math.max(this.coreGpuCapacity ?? this.baseCapacity, Math.ceil(wanted.length * 1.3));
    // Zoom en cours : seules les tuiles du champ de la caméra sont demandées, toutes. Le préchargement de fond
    // (monde entier aux niveaux bas, niveau suivant vers le disque) et le préchargement prédictif attendent la fin
    // du zoom, pour laisser tout le réseau aux tuiles regardées.
    // Zoom en cours ?
    this.zooming = this.zoomWatch.update(view.cam, now);
    // Les premiers niveaux de l'astre entier sont demandés même pendant un zoom : ce sont eux qui remplacent le fond
    // sombre tant que rien de plus fin n'est arrivé. Le reste du préchargement attend la fin du zoom.
    // Précharge l'astre entier aux niveaux bas ; pendant un zoom, seulement les premiers niveaux.
    this.preloadWorld(this.zooming);

    // 1. Demandes de chargement pour les tuiles voulues (à chaque nouvelle sélection, sinon balayage périodique).
    // À chaque nouvelle sélection, ou toutes les 15 images (début).
    if (reselect || ++this.sweep >= REQUEST_SWEEP_EVERY) {
      // Remet le compteur à zéro.
      this.sweep = 0;
      // Clés voulues : un nouvel ensemble après une sélection, sinon le même.
      const wantedKeys = reselect ? new Set() : this.wantedKeys;
      // Pour chaque tuile voulue (début).
      for (const t of wanted) {
        // Sa clé, calculée une fois.
        const key = t.key ?? (t.key = tileKey(t.z, t.x, t.y));
        // La note.
        if (reselect) wantedKeys.add(key);
        // Tuile déjà sur la carte graphique.
        const entry = this.ready(key);
        // Dans ce cas : suivante.
        if (entry) continue;
        // Déjà arrivée, en attente de mise en place : suivante.
        if (this.arrivedKeys.has(key)) continue;
        // Déjà décodée en RAM (L2) : envoi au GPU dès cette image, sans réseau.
        // Image déjà décodée en mémoire vive.
        const inRam = this.ram.peek(key);
        // Dans ce cas : elle passe dans les arrivées ; suivante.
        if (inRam) { this.ram.map.delete(key); this.arrivedKeys.add(key); this.arrived.push({ ...inRam, key, d: t.p }); continue; }
        // Déjà en file : sa priorité est mise à jour ; suivante.
        if (this.loader.has(key)) { this.loader.load(key, t.p); continue; } // remonte la priorité (ex. tuile préchargée)
        // En échec récent : suivante.
        if ((this.failed.get(key) ?? 0) > now) continue;
        // Zoom rapide : un niveau au-delà des niveaux gardés, présent depuis moins de 180 ms, est sauté pour l'instant.
        if (this.zooming && t.z > this.pinnedMaxZoom && now - (this.levelSeen.get(t.z) ?? now) < LEVEL_SETTLE_MS) continue;
        // La demande.
        this.request(key, t);
      // Fin de la boucle.
      }
      // Garde les clés voulues.
      this.wantedKeys = wantedKeys;
      // Basse résolution d'abord : l'ancêtre de chaque tuile voulue pas encore affichable passe avant elle.
      this.requestLowRes(wanted, reselect, now);
      // Accord des couleurs : les tuiles affichées pas encore mesurées le sont dès que leur référence est là.
      for (const e of this.visibleEntries) this.sampleLevelColor(e);
    // Fin des demandes.
    }

    // Préchargement prédictif : où sera la caméra dans 1,5 s, avec un champ de vision de 120°.
    // Le préchargement a-t-il changé ? Non pour l'instant.
    let prefetched = false;
    // Pendant un zoom (début).
    if (this.zooming) {
      // Les demandes prédictives déjà en file (hors champ) sont abandonnées par l'annulation ci-dessous.
      // Les demandes prédictives sont oubliées.
      if (this.prefetchKeys.size) { this.prefetchKeys = new Set(); this.lastPredView = null; prefetched = true; }
    // Sinon, si le préchargement est actif, permis hors champ par la table, et la visée connue : il est calculé.
    } else if (this.prefetchOn && !this.source.info?.fieldOnly && view.fwd) prefetched = this.prefetch(view, opts, now);

    // Annulation dynamique : les demandes en file qui ne servent plus (la vue a tourné) sont abandonnées.
    // Si la sélection ou le préchargement a changé et que la file n'est pas vide (début).
    if ((reselect || prefetched) && this.loader.queued) {
      // Pour chaque clé en file (début).
      for (const key of this.loader.queuedKeys()) {
        // Ni voulue, ni basse résolution, ni calque, ni altitude, ni gardée, ni prédictive : annulée.
        if (!this.wantedKeys.has(key) && !this.lowKeys.has(key) && !key.startsWith('ov:') && !key.startsWith('h:') && !this.pinKeys.has(key) && !this.prefetchKeys.has(key)) this.loader.cancel(key);
      // Fin de la boucle.
      }
    // Fin de ce cas.
    }

    // 2. Mise en place de quelques tuiles arrivées
    // Les plus prioritaires d'abord ; une tuile arrivée mais plus voulue (la vue a bougé) reste en RAM (L2).
    // S'il y a des tuiles arrivées (début).
    if (this.arrived.length) {
      // Les plus prioritaires d'abord.
      this.arrived.sort((p, q) => p.d - q.d);
      // Nombre d'envois permis à cette image, 1 au moins.
      const uploads = Math.max(1, Math.ceil(this.uploadsPerFrame * this.uploadShare));
      // Début de la mesure du temps d'envoi.
      const t0 = performance.now(), before = this.perf.installs;
      // Budget de temps de cette image : téléphone ou ordinateur.
      const budgetMs = this.device().handheld ? UPLOAD_BUDGET_MS.handheld : UPLOAD_BUDGET_MS.desktop;
      // Tant qu'il en reste, sous le quota et sous le budget de temps (début).
      for (let n = 0; this.arrived.length && uploadAllowed(n, performance.now() - t0, uploads, budgetMs);) {
        // Prend la première.
        const a = this.arrived.shift();
        // Elle n'est plus en attente.
        this.arrivedKeys.delete(a.key);
        // Ni voulue, ni basse résolution, ni gardée : rangée en mémoire vive ; suivante.
        if (!this.wantedKeys.has(a.key) && !this.lowKeys.has(a.key) && !this.pinKeys.has(a.key)) { this.toRam(a); continue; }
        // La met en place sur la carte graphique.
        this.install(a);
        // Une mise en place de plus ; la première date le temps avant la première tuile.
        if (this.perf.firstTileMs === null) { this.perf.firstTileMs = Math.round(performance.now() - this.perf.bornAt); this.perf.firstTileAtMs = Math.round(performance.now()); }
        // Comptée.
        this.perf.installs++; this.perf.windowCount++;
        // Affichage à recalculer.
        this.showDirty = true;
        // Un envoi de plus.
        n++;
      // Fin de la boucle.
      }
      // Temps d'envoi de cette image (lissé), seulement si une tuile est partie.
      if (this.perf.installs > before) this.perf.uploadMs = 0.9 * this.perf.uploadMs + 0.1 * (performance.now() - t0);
    // Fin de ce cas.
    }

    // 3. Quoi afficher : la tuile, sinon son ancêtre prêt, sinon ses descendants prêts.
    // Recalculé seulement quand la sélection ou le contenu des caches change ; sinon on garde la liste affichée.
    // Si l'affichage est à recalculer, en hexagones (début).
    if (this.showDirty && this.hexOn && this.hex) {
      // Cellules hexagonales : chaque cellule affiche ses images d'un bloc ; les maillages carrés restent cachés.
      // C'est fait.
      this.showDirty = false;
      // Les cellules décident de ce qui s'affiche.
      const shown = this.hex.show(now);
      // Les maillages carrés restent cachés.
      for (const e of this.visibleEntries) e.mesh.visible = false;
      // Les images utilisées sont marquées récentes.
      for (const e of shown.entries) this.touch(e.key);
      // Garde les tuiles utilisées.
      this.visibleEntries = shown.entries;
      // Garde le niveau affiché.
      this.visibleZoom = shown.zoom;
      // Garde la couverture.
      this.fullCover = shown.full;
    // Sinon, si l'affichage est à recalculer, en tuiles carrées (début).
    } else if (this.showDirty) {
      // C'est fait.
      this.showDirty = false;
      // Tuiles à afficher.
      const show = new Set();
      // Vue couverte, a priori, s'il y a des tuiles voulues.
      let full = wanted.length > 0;
      // Pour chaque tuile voulue (début).
      for (const t of wanted) {
        // Ce qui peut s'afficher à sa place.
        const cover = this.cover(t);
        // Rien : la vue n'est pas couverte.
        if (!cover.length) full = false;
        // Ajoute ces tuiles.
        for (const e of cover) show.add(e);
      // Fin de la boucle.
      }
      // Garde la couverture.
      this.fullCover = full;
      // Masque les tuiles qui ne sont plus à afficher.
      for (const e of this.visibleEntries) if (!show.has(e)) e.mesh.visible = false;
      // Niveau le plus fin.
      let zoom = 0;
      // Tuiles visibles.
      const visible = [];
      // Pour chaque tuile à afficher (début).
      for (const e of show) {
        // Elle est visible.
        e.mesh.visible = true;
        // Marquée récente.
        this.touch(e.key);
        // Retient le niveau le plus fin.
        if (e.z > zoom) zoom = e.z;
        // L'ajoute.
        visible.push(e);
      // Fin de la boucle.
      }
      // Garde les tuiles visibles.
      this.visibleEntries = visible;
      // Garde le niveau affiché.
      this.visibleZoom = zoom;
    // Fin du recalcul.
    }
    // Pour chaque tuile affichée : demande son calque, son relief, son fond marin et ses lumières (dont elle avance le
    // fondu), puis la place.
    for (const e of this.visibleEntries) { this.wantOverlay(e); this.wantRelief(e, RELIEF_PRIORITY); this.wantOcean(e, RELIEF_PRIORITY + 1); this.wantLights(e, RELIEF_PRIORITY + 2); this.fadeLights(e, now); this.place(e); }
    // Une texture de lumières recousue avec une voisine arrivée : renvoyée à la carte graphique (une par image).
    this.flushLightsDirty();
    // En hexagones : avance les fondus et place les cellules.
    if (this.hexOn && this.hex) { this.hex.animate(now); this.hex.place(); }
  // Fin de update.
  }

  /**
   * Préchargement prédictif. Vue estimée à T + Δt (vitesses de translation, de zoom et de rotation de la caméra),
   * second passage de sélection avec un cône de 120°, priorité selon l'écart au centre de la vue estimée.
   * Les images arrivent dans le cache RAM (L2) : elles ne prennent de place sur le GPU que si on les regarde.
   */
  // prefetch : le préchargement prédictif (début).
  prefetch(view, opts, now) {
    // Met à jour le prédicteur.
    this.predictor.update(view.cam, view.fwd, now);
    // Trois images sur quatre : rien.
    if (this.frame++ % PREFETCH_EVERY) return false;
    // Vue estimée, ou la vue actuelle.
    const pred = this.predictor.predict() || { cam: view.cam, fwd: view.fwd };
    // Caméra immobile : la vue prédite n'a pas bougé, le préchargement calculé reste valable.
    // Vue prédite, avec un champ élargi.
    const predView = { cam: pred.cam, fwd: pred.fwd, up: null, fovY: PREFETCH_FOV, viewportH: view.viewportH, aspect: 1 };
    // Identique à la précédente : rien.
    if (sameView(this.lastPredView, predView)) return false;
    // La garde.
    this.lastPredView = copyView(predView);
    // Tuiles de la vue prédite (début) :
    const wide = selectTiles(
      // depuis la caméra estimée, dans un cône élargi ;
      { cam: pred.cam, fovY: PREFETCH_FOV, viewportH: view.viewportH, inFrustum: coneTest(pred.cam, pred.fwd, PREFETCH_FOV / 2) },
      // 160 tuiles au plus.
      { ...opts, maxTiles: 160 },
    // Fin de la sélection.
    );
    // Niveau le plus fin.
    const finest = wide.reduce((m, t) => Math.max(m, t.z), 0);
    // Tuiles à demander.
    const todo = [];
    // Leurs clés.
    const keys = new Set();
    // Pour chaque tuile (début).
    for (const t of wide) {
      // Sa clé.
      const key = tileKey(t.z, t.x, t.y);
      // Déjà voulue, prête, en mémoire vive ou arrivée : suivante.
      if (this.wantedKeys.has(key) || this.ready(key) || this.ram.has(key) || this.arrivedKeys.has(key)) continue;
      // En échec récent : suivante.
      if ((this.failed.get(key) ?? 0) > now) continue;
      // Sa priorité, après les tuiles visibles.
      t.p = PREFETCH_PRIORITY + tilePriority(t, pred.cam, pred.fwd, finest);
      // L'ajoute.
      todo.push({ key, t });
    // Fin de la boucle.
    }
    // Les plus utiles d'abord.
    todo.sort((a, b) => a.t.p - b.t.p);
    // Pour les 48 premières (début).
    for (const { key, t } of todo.slice(0, PREFETCH_MAX_QUEUED)) {
      // Note la clé.
      keys.add(key);
      // Déjà en file : sa priorité est mise à jour.
      if (this.loader.has(key)) this.loader.load(key, t.p);
      // Sinon : la demande.
      else this.request(key, t);
    // Fin de la boucle.
    }
    // Lumières de la nuit des zones voisines (hors tuiles déjà voulues), en dernier : prêtes quand la vue s'y déplace.
    this.prefetchLights(wide.filter((t) => !this.wantedKeys.has(tileKey(t.z, t.x, t.y))), keys);
    // Garde les clés prédictives.
    this.prefetchKeys = keys;
    // Vrai.
    return true;
  // Fin de prefetch.
  }

  /**
   * Précharge les lumières de la nuit de la vue prédite (cône élargi) : quelques tuiles natives voisines, au plus bas
   * de la file, annulées comme les autres demandes prédictives quand la vue change ou qu'un zoom commence. L'image
   * reçue reste partagée par la source (30 s, puis le cache du navigateur) : une tuile qui entre dans le champ la
   * reçoit aussitôt.
   */
  // prefetchLights : précharge les lumières des zones voisines (début).
  prefetchLights(wide, keys) {
    // Source des lumières.
    const src = this.lightsSource;
    // Sans source, ou lumières éteintes : rien.
    if (!src || !this.lightsActive()) return;
    // Tuiles natives à précharger (pas encore sur la carte graphique).
    for (const { coord, key, p } of lightsPrefetchList(wide, src.maxZoom, this.lightsByCoord)) {
      // Clé de la demande.
      const k = `lp:${key}`;
      // Gardée parmi les demandes prédictives.
      keys.add(k);
      // Demande (ou priorité mise à jour) : après les lumières des tuiles affichées ; échec ou annulation sans suite.
      this.loader.load(k, RELIEF_PRIORITY + 3 + p, (signal) => src.loadImage(coord, signal)).catch(() => {});
    // Fin de la boucle.
    }
  // Fin de prefetchLights.
  }

  /** Lumières de la nuit actives : interrupteur allumé ou vue de nuit, et carte ombrée (ou vue de nuit). */
  // lightsActive : vrai si les lumières de la nuit sont à charger (début).
  lightsActive() {
    // Vue de la pollution lumineuse (toute la Terre de nuit) ?
    const view = this.uniforms.lightView?.value > 0;
    // Interrupteur ou vue de nuit, et ombre ou vue de nuit.
    return (this.uniforms.lightsOn?.value > 0 || view) && (this.uniforms.shade?.value > 0 || view);
  // Fin de lightsActive.
  }

  /** Range une tuile décodée en RAM (L2). */
  // toRam : range une tuile décodée en mémoire vive (début).
  toRam({ key, coord, base, ov, overlay, baseRect, ovRect }) {
    // Si la mémoire vive a de la place et que la couche n'est pas libérée.
    if (this.ram.capacity > 0 && !this.disposed) this.ram.set(key, { coord, base, ov, overlay, baseRect, ovRect });
  // Fin de toRam.
  }

  /**
   * Décharge de la carte graphique les tuiles hors du champ de la caméra : ni voulues, ni ancêtres d'une tuile voulue
   * (repli affiché pendant le chargement), ni épinglées (mosaïque instantanée). Leurs images passent en mémoire vive.
   */
  // unloadOffField : décharge les tuiles hors champ (début).
  unloadOffField() {
    // Clés à garder : les tuiles voulues et leurs ancêtres.
    const keep = keptKeys(this.wanted);
    // Pour chaque tuile à décharger : retirée du cache (son éviction la passe en mémoire vive et libère ses textures).
    for (const key of offFieldKeys(this.cache.keys(), keep, this.pinKeys)) this.cache.delete(key);
  // Fin de unloadOffField.
  }

  /** Éviction du GPU (L1) : textures détruites, image décodée gardée en RAM (L2) pour un retour instantané. */
  // evict : une tuile quitte la carte graphique (début).
  evict(e) {
    // Affichage à recalculer.
    this.showDirty = true;
    // Ses images passent en mémoire vive.
    this.toRam({ key: e.key, coord: { z: e.z, x: e.x, y: e.y }, base: e.baseImg, ov: e.ovImg, overlay: e.ovSource, baseRect: e.baseRect, ovRect: e.ovRect });
    // Ses objets sont libérés.
    this.disposeEntry(e);
  // Fin de evict.
  }

  /**
   * Basse résolution d'abord. Pour chaque tuile voulue qui n'est pas encore affichable, demande son ancêtre trois
   * niveaux plus haut (64 fois moins de données pour la même zone), avec une priorité qui le fait passer avant les
   * tuiles fines : la zone s'affiche d'abord floue, puis nette, au lieu de montrer le fond sombre de l'astre.
   * Les niveaux gardés pour l'astre entier ne sont pas redemandés ici.
   */
  // requestLowRes : les tuiles voulues, vrai après une nouvelle sélection, l'instant présent (début).
  requestLowRes(wanted, reselect, now) {
    // Tuiles basse résolution utiles à la vue.
    const low = lowResTiles(wanted, {
      // Niveau le plus grossier : juste au-dessus des niveaux gardés, et pas sous le niveau minimal de la carte.
      floor: Math.max(this.source.minZoom, this.pinnedMaxZoom + 1),
      // Déjà affichable : sur la carte graphique.
      covered: (key) => Boolean(this.ready(key)),
    });
    // Clés : un nouvel ensemble après une sélection, sinon le même, complété.
    const keys = reselect ? new Set() : this.lowKeys;
    // Pour chaque tuile basse résolution (début).
    for (const t of low) {
      // Note sa clé.
      keys.add(t.key);
      // Déjà arrivée, en attente de mise en place : suivante.
      if (this.arrivedKeys.has(t.key)) continue;
      // Image déjà décodée en mémoire vive.
      const inRam = this.ram.peek(t.key);
      // Dans ce cas : elle passe dans les arrivées ; suivante.
      if (inRam) { this.ram.map.delete(t.key); this.arrivedKeys.add(t.key); this.arrived.push({ ...inRam, key: t.key, d: t.p }); continue; }
      // Déjà en file : sa priorité est remontée ; suivante.
      if (this.loader.has(t.key)) { this.loader.load(t.key, t.p); continue; }
      // En échec récent : suivante.
      if ((this.failed.get(t.key) ?? 0) > now) continue;
      // La demande.
      this.request(t.key, t);
    // Fin de la boucle.
    }
    // Garde les clés.
    this.lowKeys = keys;
  // Fin de requestLowRes.
  }

  /**
   * Précharge l'astre entier aux niveaux 0 à `pinnedMaxZoom` (en plate carrée : 2·(4^(n+1) − 1)/3 tuiles, 170 pour n = 3),
   * avec son calque. Ces tuiles ne sont jamais évincées : où que l'on regarde, une image nette est déjà prête.
   * Appelé à chaque image : relance les tuiles échouées et le calque arrivé après coup. Coût : un parcours de la liste.
   */
  // preloadWorld : précharge l'astre entier aux niveaux bas ; `coarseOnly` limite aux premiers niveaux (début).
  preloadWorld(coarseOnly = false) {
    // Projection.
    const proj = this.projection;
    // Si la liste n'existe pas (début).
    if (!this.pinList) {
      // Liste vide.
      this.pinList = [];
      // Pour chaque niveau, du minimal au niveau gardé (début).
      for (let z = Math.max(0, this.source.minZoom); z <= Math.min(this.pinnedMaxZoom, this.source.maxZoom); z++) {
        // Pour chaque ligne et chaque colonne (début).
        for (let y = 0; y < proj.rows(z); y++) for (let x = 0; x < proj.cols(z); x++) {
          // Clé de la tuile.
          const key = tileKey(z, x, y);
          // Premiers niveaux : chargés avant tout le reste, ils remplacent le fond sombre pendant le chargement.
          const coarse = isCoarseLevel(z, this.source.minZoom);
          // L'ajoute, niveaux bas d'abord ; les premiers niveaux avec leur priorité propre.
          this.pinList.push({ key, z, x, y, coarse, d: coarse ? coarsePriority(z) : PRELOAD_PRIORITY + z * 1e3 });
          // Note la clé d'un premier niveau.
          if (coarse) this.coarseKeys.add(key);
          // Note sa clé.
          this.pinKeys.add(key);
        // Fin des lignes et colonnes.
        }
      // Fin des niveaux.
      }
    // Fin de ce cas.
    }
    // Préchargement terminé : rien.
    if (this.preloadComplete) return;
    // Instant présent.
    const now = performance.now();
    // Tuiles prêtes.
    let done = 0;
    // Pour chaque tuile de la liste (début).
    for (const t of this.pinList) {
      // Pendant un zoom, seuls les premiers niveaux sont traités : la liste est triée, on s'arrête au premier autre.
      if (coarseOnly && !t.coarse) break;
      // Tuile déjà gardée.
      const e = this.pinned.get(t.key);
      // Si elle l'est (début).
      if (e) {
        // Sans calque, calque en erreur, calque posé ou en échec : prête.
        if (!this.overlay || this.overlay.status === 'error' || e.ovMap || e.ovFailed) done++;
        // Sinon : demande son calque.
        else this.wantOverlay(e, t.d);
        // Suivante.
        continue;
      // Fin de ce cas.
      }
      // Déjà en file, arrivée, ou en échec récent : suivante.
      if (this.loader.has(t.key) || this.arrivedKeys.has(t.key) || (this.failed.get(t.key) ?? 0) > now) continue;
      // La demande.
      this.request(t.key, t);
    // Fin de la boucle.
    }
    // Passage limité aux premiers niveaux : le bilan du préchargement n'est pas recalculé.
    if (coarseOnly) return;
    // Garde le nombre de tuiles prêtes.
    this.preloadDone = done;
    // Terminé (le calque peut changer : on revérifie alors, voir setOverlaySource).
    // Terminé si toutes le sont.
    this.preloadComplete = done === this.pinList.length;
    // La première fois : note l'instant où le globe entier est affiché, depuis l'ouverture de la page.
    if (this.preloadComplete && this.pinList.length && this.perf.worldReadyMs === null) this.perf.worldReadyMs = Math.round(performance.now());
  // Fin de preloadWorld.
  }

  /**
   * Compteurs de performance : première tuile (ms depuis la création de la couche, et depuis l'ouverture de la page),
   * globe entier affiché (ms depuis l'ouverture), tuiles mises en place, tuiles/s, envoi au GPU par image (ms).
   */
  // perfSnapshot : les compteurs (début).
  perfSnapshot(now = performance.now()) {
    // Compteurs.
    const p = this.perf;
    // Fenêtre de 5 s écoulée : débit recalculé, fenêtre repartie.
    if (now - p.windowAt >= 5000) { p.rate = Math.round((p.windowCount * 10000) / (now - p.windowAt)) / 10; p.windowAt = now; p.windowCount = 0; }
    // Renvoie les valeurs lisibles.
    return { firstTileMs: p.firstTileMs, firstTileAtMs: p.firstTileAtMs, worldReadyMs: p.worldReadyMs, installs: p.installs, tilesPerSec: p.rate, uploadMs: Math.round(p.uploadMs * 100) / 100 };
  // Fin de perfSnapshot.
  }

  /** Avancement du préchargement en mémoire : { done, total }. */
  // preload : l'avancement du préchargement (début).
  get preload() {
    // Tuiles prêtes et total.
    return { done: this.preloadDone ?? 0, total: this.pinList?.length ?? 0 };
  // Fin de preload.
  }

  // ------------------------------------------------------------- chargement

  // request : demande une tuile (début).
  request(key, t) {
    // Ses coordonnées.
    const coord = { z: t.z, x: t.x, y: t.y };
    // Le calque du moment.
    const overlay = this.overlay;
    // Par la file de chargement,
    this.loader
      // avec sa priorité (début de la tâche).
      .load(key, t.p ?? t.d, async (signal) => {
        // Au-delà du niveau natif, on charge l'ancêtre et on n'en affiche qu'une partie (rect).
        // Tuile native du fond, et portion à afficher.
        const nb = nativeTile(coord, this.source.maxZoom);
        // Tuile native du calque, s'il est prêt et couvre la tuile.
        const no = overlay?.ready && overlay.covers(coord) ? nativeTile(coord, overlay.maxZoom) : null;
        // Tuile à l'écran : demandée au réseau avant le reste (préchargements, relief).
        // urgent : la tuile est-elle voulue à l'écran, ou affichée en basse résolution en attendant.
        const urgent = () => this.wantedKeys.has(key) || this.lowKeys.has(key) || this.coarseKeys.has(key);
        // Fond et calque en même temps. Le calque est facultatif : s'il échoue, on affiche la tuile sans lui.
        // Charge le fond et le calque en même temps (début).
        const [base, ov] = await Promise.all([
          // Le fond.
          this.source.loadImage(nb.coord, signal, urgent()),
          // Le calque : un échec autre qu'une annulation donne null.
          no ? overlay.loadImage(no.coord, signal, urgent()).catch((e) => { if (e.name === 'AbortError') throw e; return null; }) : null,
        // Fin du chargement.
        ]);
        // Renvoie les deux images et leurs portions.
        return { base, ov, baseRect: nb.rect, ovRect: no?.rect };
      // Fin de la tâche.
      })
      // À l'arrivée (début).
      .then(({ base, ov, baseRect, ovRect }) => {
        // Couche libérée : rien.
        if (this.disposed) return;
        // La tuile arrivée.
        const a = { key, coord, d: t.p ?? t.d, base, ov, overlay, baseRect, ovRect };
        // Voulue maintenant (ou préchargement global) → GPU ; préchargement prédictif → RAM, prête pour plus tard.
        // Voulue, basse résolution ou gardée : en attente de mise en place.
        if (this.wantedKeys.has(key) || this.lowKeys.has(key) || this.pinKeys.has(key)) { this.arrivedKeys.add(key); this.arrived.push(a); }
        // Sinon : en mémoire vive.
        else this.toRam(a);
      // Fin de l'arrivée.
      })
      // En cas d'échec, hors annulation : nouvel essai dans 6 secondes.
      .catch((e) => { if (e.name !== 'AbortError') this.failed.set(key, performance.now() + RETRY_AFTER_MS); });
  // Fin de request.
  }

  // install : met une tuile en place sur la carte graphique (début).
  install({ key, coord, base, ov, overlay, baseRect = [0, 0, 1, 1], ovRect = [0, 0, 1, 1] }) {
    // Déjà prête : rien.
    if (this.ready(key)) return;
    // Projection.
    const proj = this.projection;
    // Jupes : 1,5 % de la taille de la tuile, assez pour boucher les fissures entre niveaux voisins.
    // Tuile soulevée par le relief : maillage plus fin et jupe plus profonde (les bords voisins diffèrent en hauteur).
    // Réglage du relief pour cette tuile.
    const lifted = this.reliefFor(coord);
    // Maillage de la tuile :
    const grid = buildTileGrid(coord.z, coord.x, coord.y, proj, lifted
      // avec le relief, une jupe plus profonde et un maillage plus fin ;
      ? { skirt: RELIEF_SKIRT * proj.groundSize(coord.z, 0), minSegments: lifted.segments }
      // sinon, une jupe de 1,5 % de la taille de la tuile.
      : { skirt: 0.015 * proj.groundSize(coord.z, 0) });
    // Sommets relatifs au centre de la tuile : la position réelle est portée par la matrice (voir `place`).
    // Géométrie.
    const geometry = new THREE.BufferGeometry();
    // Positions.
    geometry.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3));
    // Normales.
    geometry.setAttribute('normal', new THREE.BufferAttribute(grid.normals, 3));
    // Coordonnées de texture.
    geometry.setAttribute('uv', new THREE.BufferAttribute(grid.uvs, 2));
    // Indices des triangles.
    geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
    // Avec le relief (début).
    if (lifted) {
      // Les sommets montent dans le shader : le volume englobant est élargi d'autant, pour ne pas masquer un sommet visible.
      // Calcule la sphère englobante.
      geometry.computeBoundingSphere();
      // L'élargit de dix fois la hauteur maximale du relief.
      geometry.boundingSphere.radius += (MAX_HEIGHT_M * 10) / lifted.radiusM;
    // Fin de ce cas.
    }

    // Texture du fond.
    const map = this.texture(base);
    // Texture du calque, si c'est toujours le même calque.
    const ovMap = ov && overlay === this.overlay ? this.texture(ov) : null;
    // Matériau (début).
    const material = new THREE.ShaderMaterial({
      // Variables uniformes (début).
      uniforms: {
        // Image du fond.
        map: { value: map },
        // Côté de l'image du fond en pixels (256 ou 512 selon le fournisseur ; 256 si inconnu) : grille de l'agrandissement lissé.
        mapSize: { value: imageSide(base) },
        // Accord des couleurs de la source de l'image sur la mosaïque mondiale (voir TileSource, `__color`) : tableaux
        // partagés par toutes les tuiles de la source, mis à jour sur place quand la mesure s'affine.
        // Gain de couleur de l'image, ou neutre.
        colGain: { value: base.__color?.gain || COLOR_GAIN_NONE },
        // Décalage de couleur, ou neutre.
        colOff: { value: base.__color?.offset || COLOR_OFFSET_NONE },
        // Accord des couleurs entre les niveaux de zoom : tableaux partagés par toutes les tuiles du niveau, mis à jour
        // sur place quand la mesure s'affine. Une tuile au-delà du niveau natif prend la correction de son image.
        // Gain de couleur du niveau.
        lvGain: { value: this.levelColors.of(Math.min(coord.z, this.source.maxZoom)).gain },
        // Décalage de couleur du niveau.
        lvOff: { value: this.levelColors.of(Math.min(coord.z, this.source.maxZoom)).offset },
        // Image du calque, ou la texture d'attente.
        ovMap: { value: ovMap || this.placeholder },
        // Interrupteur du calque.
        ovOn: { value: ovMap ? 1 : 0 },
        // Relief : tuile d'altitude posée plus tard (wantRelief), réglages partagés par toutes les tuiles de l'astre.
        // Image d'altitude : en attente.
        hMap: { value: this.placeholder },
        // Sa portion.
        hRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        // Pas d'altitude pour l'instant.
        hHas: { value: 0 },
        // Facteur de pente.
        hSlope: { value: 0 },
        // Taille de l'image d'altitude.
        hSize: { value: 256 },
        // Conversion des mètres en rayons, ou 0 sans relief.
        hUnit: { value: lifted ? 1 / lifted.radiusM : 0 },
        // Fond des océans : tuile de profondeurs posée plus tard (wantOcean), interrupteur partagé par l'astre.
        // Image des profondeurs : en attente.
        oMap: { value: this.placeholder },
        // Sa portion.
        oRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        // Pas de profondeurs pour l'instant.
        oHas: { value: 0 },
        // Facteur de pente.
        oSlope: { value: 0 },
        // Taille de l'image des profondeurs.
        oSize: { value: 256 },
        // Accentuation de l'ombrage des fonds.
        oBoost: OCEAN_BOOST,
        // Interrupteur du fond des océans.
        oceanOn: this.uniforms.oceanOn || RELIEF_OFF,
        // Lumières de la nuit : tuile posée plus tard (wantLights), interrupteur partagé par l'astre.
        // Image des lumières : en attente.
        ltMap: { value: this.placeholder },
        // Sa portion.
        ltRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        // Pas de lumières pour l'instant.
        ltHas: { value: 0 },
        // Repli : image ancêtre déjà chargée, sa portion et sa présence ; fondu de la tuile fine par-dessus (0 à 1).
        lpMap: { value: this.placeholder }, lpRect: { value: new THREE.Vector4(0, 0, 1, 1) }, lpHas: { value: 0 }, ltFade: { value: 0 },
        // Côtés des images de lumières et de la mosaïque, lecture en lumière linéaire : partagés par l'astre.
        ltSize: this.uniforms.ltSize || LIGHTS_SIZE_DEFAULT, lgSize: this.uniforms.lgSize || LIGHTS_SIZE_DEFAULT, ltLinear: this.uniforms.ltLinear || RELIEF_OFF,
        // Interrupteur des lumières.
        lightsOn: this.uniforms.lightsOn || RELIEF_OFF,
        // Mosaïque mondiale des lumières, partagée par l'astre (vue de la pollution lumineuse), et sa présence.
        lgMap: this.uniforms.lgMap || { value: this.placeholder }, lgOn: this.uniforms.lgOn || RELIEF_OFF,
        // Vue de la pollution lumineuse : toute la Terre de nuit.
        lightView: this.uniforms.lightView || RELIEF_OFF,
        // Modèle d'éclairage de l'astre (1 : la Terre), masque de l'eau et sa présence.
        surfModel: this.uniforms.surfModel || RELIEF_OFF, gasModel: this.uniforms.gasModel || RELIEF_OFF, wMap: this.uniforms.wMap || { value: this.placeholder }, wOn: this.uniforms.wOn || RELIEF_OFF,
        // Exagération du relief.
        reliefExag: this.uniforms.reliefExag || RELIEF_OFF,
        // Force de l'ombrage du relief.
        reliefShade: this.uniforms.reliefShade || RELIEF_OFF,
        // Force du relief estimé.
        reliefImg: this.uniforms.reliefImg || RELIEF_OFF,
        // Portion de l'image du fond.
        baseRect: { value: new THREE.Vector4(...baseRect) },
        // Portion de l'image du calque.
        ovRect: { value: new THREE.Vector4(...ovRect) },
        // Tuiles carrées : pas de fondu avec l'ancêtre (fade = 1, le shader ne lit pas son image). Les transitions
        // entre niveaux sont fondues par les cellules hexagonales, avec `alpha` plus bas.
        // Image de l'ancêtre : inutilisée.
        parentMap: { value: this.placeholder },
        // Son gain.
        parGain: { value: COLOR_GAIN_NONE },
        // Son décalage.
        parOff: { value: COLOR_OFFSET_NONE },
        // Sa portion.
        parentRect: { value: new THREE.Vector4(0, 0, 1, 1) },
        // Fondu avec l'ancêtre : terminé.
        fade: { value: 1 },
        // Opacité : 1 sur ce matériau (opaque). Les fondus entre niveaux des cellules hexagonales passent par une copie
        // transparente du matériau, qui partage tous les autres réglages (voir hexDisplay.jsx).
        // Opacité : 1.
        alpha: { value: 1 },
        // Direction du Soleil.
        sunV: this.uniforms.sunV,
        // Éclairage jour/nuit.
        shade: this.uniforms.shade,
        // Astre sans air.
        airless: this.uniforms.airless,
        // Mode du calque.
        ovMode: this.uniforms.ovMode,
        // Texture globale des couleurs.
        colorMap: this.uniforms.colorMap,
        // Son interrupteur.
        colorOn: this.uniforms.colorOn,
        // Affinage par le détail.
        panOn: this.uniforms.panOn,
        // Lumière cendrée, 0,5 par défaut.
        earthshine: this.uniforms.earthshine || { value: 0.5 },
        // Détail simulé, ou coupé.
        detail: this.uniforms.detail || NO_DETAIL,
        // Coordonnées de la tuile.
        tileCoord: { value: new THREE.Vector3(coord.x, coord.y, coord.z) },
        // Portion de la texture globale (couleurs de la Lune) couverte par cette tuile : [u0, v0, largeur, hauteur].
        // Portion de la texture globale (début) :
        globalRect: { value: new THREE.Vector4(
          // son coin,
          coord.x / this.projection.cols(coord.z), 1 - (coord.y + 1) / this.projection.rows(coord.z),
          // sa largeur et sa hauteur.
          1 / this.projection.cols(coord.z), 1 / this.projection.rows(coord.z),
        // Fin de la portion.
        ) },
      // Fin des variables uniformes.
      },
      // Shader de sommet.
      vertexShader: tileVertexShader,
      // Shader de fragment.
      fragmentShader: tileFragmentShader,
    // Fin du matériau.
    });
    // Extensions : profondeur par fragment et dérivées.
    material.extensions = { fragDepth: true, derivatives: true, shaderTextureLOD: true }; // dérivées : taille du pixel (détail simulé, niveau des lumières) ; lecture à niveau imposé des lumières (WebGL 1)
    // Deux faces.
    material.side = THREE.DoubleSide; // jupes visibles quel que soit leur sens

    // Atlas expérimental : ne remplace le fond classique que si l'entrée atlas est immédiatement prête.
    // Les images d'altitude et de nuit conservent leur pipeline spécialisé existant.
    if (this.surfaceAtlasPipeline) {
      this.surfaceAtlasPipeline.attach({ id: `tile:${key}`, image: base, uniforms: material.uniforms, bodyId: this.bodyId });
    }

    // Maillage.
    const mesh = new THREE.Mesh(geometry, material);
    // Matrice fixée à la main.
    mesh.matrixAutoUpdate = false;
    // Masqué au départ.
    mesh.visible = false;
    // L'ajoute au groupe.
    this.group.add(mesh);

    // Fiche de la tuile (début).
    const entry = {
      // Sa clé, ses coordonnées, son maillage, ses textures, l'état du calque, son centre.
      key, z: coord.z, x: coord.x, y: coord.y, mesh, map, ovMap, ovRequested: Boolean(ovMap), ovFailed: false, center: grid.center, gap: 0,
      // Pour l'éviction vers la RAM (L2) et le fondu des enfants.
      // Ses images et leurs portions.
      baseImg: base, ovImg: ovMap ? ov : null, ovSource: ovMap ? overlay : null, baseRect, ovRect,
      // Relief : texture et image d'altitude, portion affichée, état de la demande.
      // L'état de son relief.
      lifted: Boolean(lifted), hMap: null, hImg: null, hRect: null, hRequested: false, hFailed: false,
      // Fond des océans : texture de profondeurs et état de la demande.
      // L'état de son fond marin.
      oMap: null, oRequested: false, oFailed: false,
      // Lumières de la nuit : texture fine, texture de repli, début du fondu et état de la demande.
      // L'état de ses lumières.
      ltMap: null, lpMap: null, ltFadeAt: 0, ltRequested: false, ltFailed: false,
    // Fin de la fiche.
    };
    // La place.
    this.place(entry);
    // Tuile gardée : dans la table des tuiles gardées.
    if (this.pinKeys.has(key)) this.pinned.set(key, entry);
    // Sinon : dans le cache.
    else this.cache.set(key, entry);
    // Accord des couleurs : cette tuile sert de mesure à son niveau si sa référence est déjà là.
    this.sampleLevelColor(entry);
  // Fin de install.
  }

  /**
   * Accord des couleurs entre les niveaux : compare une tuile au même endroit vu par son ancêtre de référence (niveau
   * le plus grossier dont les couleurs sont connues) et ajoute la mesure à son niveau. Les deux images sont réduites à
   * 4 px de côté (tons d'ensemble) et corrigées de ce que le shader leur applique déjà. Chaque tuile ne compte qu'une
   * fois ; une tuile au-delà du niveau natif (portion agrandie d'un ancêtre) ne compte pas. Mesure facultative.
   */
  // sampleLevelColor, asynchrone : la fiche de la tuile (début).
  async sampleLevelColor(e) {
    // Les corrections des niveaux, et la source.
    const lc = this.levelColors, src = this.source;
    // Déjà mesurée, au-delà du niveau natif, niveau qui n'attend rien, ou source sans lecture de pixels : rien.
    if (e.lvSampled || e.z > src.maxZoom || !lc.wants(e.z) || typeof src.pixelsAsync !== 'function') return;
    // Tuile de référence dont l'image est sur la carte graphique.
    const ref = lc.reference(e, (key) => Boolean(this.ready(key)));
    // Aucune pour l'instant : nouvel essai plus tard.
    if (!ref) return;
    // Fiche de la référence, et état du niveau.
    const r = this.ready(ref.key), st = lc.of(e.z);
    // La tuile ne sera pas mesurée deux fois ; une mesure est en cours pour ce niveau.
    e.lvSampled = true; st.busy = true;
    // Essai (début).
    try {
      // Image de la référence, et sa taille.
      const img = r.baseImg, size = img.naturalWidth || img.width || 256;
      // Pixels de la tuile, et du même endroit dans la référence.
      const [a, b] = await Promise.all([src.pixelsAsync(e.baseImg, LEVEL_PX), src.pixelsAsync(img, LEVEL_PX, lc.crop(size, ref.depth, e))]);
      // Couche libérée ou lecture refusée : rien.
      if (this.disposed || !a || !b) return;
      // Correction du niveau de la référence.
      const rl = lc.of(ref.z);
      // Pixels de la tuile, avec la correction de sa source.
      const mine = corrected(a, e.baseImg.__color?.gain, e.baseImg.__color?.offset);
      // Pixels de la référence, avec la correction de sa source puis celle de son niveau.
      const theirs = corrected(corrected(b, img.__color?.gain, img.__color?.offset), rl.gain, rl.offset);
      // Ajoute la mesure au niveau.
      lc.add(e.z, mine, theirs);
    // Mesure facultative : la tuile est déjà affichée.
    } catch { /* lecture impossible : la tuile garde la correction en cours */ } finally {
      // La mesure est finie.
      st.busy = false;
    // Fin de l'essai.
    }
  // Fin de sampleLevelColor.
  }

  /** Matrice de la tuile : échelle = rayon de son niveau, translation = centre · rayon (double précision côté JS). */
  // place : règle la matrice d'une tuile (début).
  place(e) {
    // Écart inchangé : rien à faire.
    if (e.gap === this.gap) return;
    // Le garde.
    e.gap = this.gap;
    // Rayon de son niveau.
    const r = tileRadius(e.z, this.gap);
    // Matrice : échelle au rayon et centre porté au même rayon.
    e.mesh.matrix.makeScale(r, r, r).setPosition(e.center[0] * r, e.center[1] * r, e.center[2] * r);
    // Matrice dans la scène à recalculer.
    e.mesh.matrixWorldNeedsUpdate = true;
  // Fin de place.
  }

  /**
   * Texture GPU d'une image, partagée : les tuiles sur-zoomées d'une même zone affichent toutes des portions de la
   * même image ancêtre, qui n'est envoyée au GPU (avec ses mipmaps) qu'une fois au lieu d'une fois par tuile.
   * Chaque appel doit être suivi, à la fin, d'un `releaseTexture`.
   */
  // texture : la texture partagée d'une image (début).
  texture(img) {
    // Texture déjà créée pour cette image.
    const shared = this.textures.get(img);
    // Dans ce cas : un utilisateur de plus, et elle est renvoyée.
    if (shared) { shared.refs++; return shared.tex; }
    // Nouvelle texture : l'image à sa pleine taille, sur tous les appareils.
    const t = new THREE.Texture(img);
    // La partage.
    this.textures.set(img, { tex: t, refs: 1 });
    // Avec mipmaps.
    t.generateMipmaps = true;
    // Réduction lissée entre mipmaps.
    t.minFilter = THREE.LinearMipmapLinearFilter;
    // Agrandissement lissé.
    t.magFilter = THREE.LinearFilter;
    // Filtrage anisotrope.
    t.anisotropy = this.maxAnisotropy;
    // Sans répétition aux bords.
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    // À envoyer à la carte graphique.
    t.needsUpdate = true;
    // Envoi immédiat, si le moteur le permet (début de l'essai).
    try {
      // La texture et ses mipmaps partent maintenant, pendant la mise en place.
      this.initTexture?.(t);
    // Échec (contexte perdu) : l'envoi se fera au premier dessin, comme avant.
    } catch { /* envoi différé au premier dessin */ }
    // La renvoie.
    return t;
  // Fin de texture.
  }

  /** Rend une texture obtenue par `texture` : détruite quand plus aucune tuile ne l'utilise. */
  // releaseTexture : rend une texture (début).
  releaseTexture(t) {
    // Son partage.
    const shared = this.textures.get(t.image);
    // Encore utilisée ailleurs : rien de plus.
    if (shared && shared.tex === t && --shared.refs > 0) return;
    // Image de lumières : plus disponible comme repli.
    if (t.lightsKey && this.lightsByCoord.get(t.lightsKey) === t.image) this.lightsByCoord.delete(t.lightsKey);
    // Sinon : retirée du partage.
    if (shared && shared.tex === t) this.textures.delete(t.image);
    // Et détruite.
    t.dispose();
  // Fin de releaseTexture.
  }

  // ---------------------------------------------------------------- relief

  /** Réglage du relief à vraies altitudes pour cette tuile, ou null (pas de relief, autre découpage, niveau trop haut). */
  // reliefFor : le réglage du relief d'une tuile, ou null (début).
  reliefFor(coord) {
    // Relief demandé.
    const r = this.reliefWanted;
    // Sans relief, sans source, découpage inconnu (ni Mercator ni géographique) ou sous le niveau minimal : null.
    if (!r || !this.reliefSource || (this.projection !== MERCATOR && this.projection !== EQUIRECTANGULAR) || coord.z < r.minZoom) return null;
    // Le renvoie.
    return r;
  // Fin de reliefFor.
  }

  /** Charge la tuile d'altitude d'une tuile affichée. L'image est déjà à l'écran : le relief s'y ajoute à l'arrivée. */
  // wantRelief : charge la tuile d'altitude d'une tuile affichée (début).
  wantRelief(e, priority = 0) {
    // Source des altitudes.
    const src = this.reliefSource;
    // Tuile sans relief, déjà servie, demandée ou en échec, ou source absente ou en panne : rien.
    if (!e.lifted || e.hMap || e.hRequested || e.hFailed || !src || src.broken) return;
    // Caméra trop haute (la Terre n'affiche son relief qu'à 1 km ou moins, avec une marge de 10 %) : pas de tuile d'altitude.
    if (this.altKm > this.reliefCapKm * 1.1) return;
    // Demande notée.
    e.hRequested = true;
    // Réglage du relief.
    const r = this.reliefWanted;
    // Tuile d'altitude native : pas encore connue.
    let nh = null;
    // Par la file de chargement,
    this.loader
      // sous la clé « h: » (début de la tâche).
      .load(`h:${e.key}`, priority, async (signal) => {
        // Niveau le plus fin de la source en cours : connu une fois sa fiche lue (il peut changer avec la source).
        // Attend que la source soit prête.
        await src.ready();
        // Tuile d'altitude native et portion.
        nh = nativeTile({ z: e.z, x: e.x, y: e.y }, src.levelFor(e.z));
        // Charge l'image.
        return src.loadImage(nh.coord, signal);
      // Fin de la tâche.
      })
      // À l'arrivée (début).
      .then((img) => {
        // Couche libérée, source changée ou tuile partie : rien.
        if (this.disposed || src !== this.reliefSource || !this.ready(e.key)) return;
        // Texture d'altitude.
        e.hMap = this.heightTexture(img);
        // Garde l'image.
        e.hImg = img;
        // Garde la portion.
        e.hRect = nh.rect;
        // Variables uniformes de la tuile.
        const u = e.mesh.material.uniforms;
        // Pose la texture.
        u.hMap.value = e.hMap;
        // Pose la portion.
        u.hRect.value.set(...nh.rect);
        // Pente : différence d'altitude entre deux pixels voisins, divisée par deux fois leur écart au sol.
        // Latitude du milieu de la tuile d'altitude.
        const midLat = this.projection.lat(nh.coord.y + 0.5, nh.coord.z);
        // Taille de l'image.
        const size = img.naturalWidth || img.width || 256;
        // La transmet.
        u.hSize.value = size;
        // Facteur de pente : l'inverse de deux fois la taille d'un pixel au sol.
        u.hSlope.value = 1 / (2 * metersPerTexel(nh.coord.z, midLat, r.radiusM, size, this.projection.id));
        // Altitude disponible.
        u.hHas.value = 1;
      // Fin de l'arrivée.
      })
      // Échec : noté ; annulation : la demande pourra repartir.
      .catch((err) => { if (err.name !== 'AbortError') e.hFailed = true; else e.hRequested = false; });
  // Fin de wantRelief.
  }

  /**
   * Charge la tuile de profondeurs (fond des océans) d'une tuile affichée et soulevée. Une tuile grossière sert toutes
   * les tuiles affichées qu'elle couvre : un seul téléchargement, partagé par la source.
   */
  // wantOcean : charge la tuile de profondeurs d'une tuile affichée (début).
  wantOcean(e, priority = 0) {
    // Source des fonds marins.
    const src = this.oceanSource;
    // Source absente ou en panne, tuile sans relief, déjà servie, demandée ou en échec, ou fond coupé : rien.
    if (!src || src.broken || !e.lifted || e.oMap || e.oRequested || e.oFailed || !(this.uniforms.oceanOn?.value > 0)) return;
    // Demande notée.
    e.oRequested = true;
    // Réglage du relief.
    const r = this.reliefWanted;
    // Tuile de profondeurs native : pas encore connue.
    let no = null;
    // Par la file de chargement,
    this.loader
      // sous la clé « o: » (début de la tâche).
      .load(`o:${e.key}`, priority, async (signal) => {
        // Attend que la source soit prête.
        await src.ready();
        // Tuile native et portion.
        no = nativeTile({ z: e.z, x: e.x, y: e.y }, src.levelFor(e.z));
        // Charge l'image.
        return src.loadImage(no.coord, signal);
      // Fin de la tâche.
      })
      // À l'arrivée (début).
      .then((img) => {
        // Couche libérée, source changée ou tuile partie : rien.
        if (this.disposed || src !== this.oceanSource || !this.ready(e.key)) return;
        // Texture des profondeurs.
        e.oMap = this.heightTexture(img);
        // Variables uniformes de la tuile.
        const u = e.mesh.material.uniforms;
        // Pose la texture.
        u.oMap.value = e.oMap;
        // Pose la portion.
        u.oRect.value.set(...no.rect);
        // Latitude du milieu de la tuile.
        const midLat = this.projection.lat(no.coord.y + 0.5, no.coord.z);
        // Taille de l'image.
        const size = img.naturalWidth || img.width || 256;
        // La transmet.
        u.oSize.value = size;
        // Facteur de pente.
        u.oSlope.value = 1 / (2 * metersPerTexel(no.coord.z, midLat, r.radiusM, size, this.projection.id));
        // Profondeurs disponibles.
        u.oHas.value = 1;
      // Fin de l'arrivée.
      })
      // Échec : noté ; annulation : la demande pourra repartir.
      .catch((err) => { if (err.name !== 'AbortError') e.oFailed = true; else e.oRequested = false; });
  // Fin de wantOcean.
  }

  /**
   * Charge les lumières de la nuit d'une tuile affichée (atlas de la pollution lumineuse, niveau 6 au plus) : une tuile grossière sert
   * toutes les tuiles affichées qu'elle couvre (un seul téléchargement, partagé par la source). Le shader les allume
   * côté nuit, selon le Soleil.
   */
  // wantLights : charge les lumières d'une tuile affichée (début).
  wantLights(e, priority = 0) {
    // Source des lumières.
    const src = this.lightsSource;
    // Sans source, déjà servie, demandée ou en échec, lumières coupées hors vue de nuit, ou carte sans ombre hors vue de nuit : rien.
    if (!src || e.ltMap || e.ltRequested || e.ltFailed || !this.lightsActive()) return;
    // Demande notée.
    e.ltRequested = true;
    // Tuile native des lumières et portion affichée.
    const no = nativeTile({ z: e.z, x: e.x, y: e.y }, src.maxZoom);
    // Variables uniformes de la tuile.
    const u = e.mesh.material.uniforms;
    // Repli immédiat : l'ancêtre le plus proche déjà sur la carte graphique (aucun trou, aucun saut, pendant le chargement) ;
    // une demande annulée puis relancée garde le repli déjà posé.
    const fb = e.lpMap ? null : lightsFallback(this.lightsByCoord, no.coord, { z: e.z, x: e.x, y: e.y });
    // Trouvé : posé en repli, avec la portion de la tuile affichée dans cet ancêtre.
    if (fb) { e.lpMap = this.lightsTexture(fb.img); u.lpMap.value = e.lpMap; u.lpRect.value.set(...this.lightsRect(fb.rect, e.lpMap)); u.lpHas.value = 1; }
    // Par la file de chargement,
    this.loader
      // sous la clé « lt: », charge l'image.
      .load(`lt:${e.key}`, priority, (signal) => src.loadImage(no.coord, signal))
      // À l'arrivée (début).
      .then((img) => {
        // Couche libérée, source changée ou tuile partie : rien.
        if (this.disposed || src !== this.lightsSource || !this.ready(e.key)) return;
        // Texture des lumières, connue par sa tuile native.
        e.ltMap = this.lightsTexture(img, no.coord);
        // Pose la texture et sa portion (dans la texture bordée).
        u.ltMap.value = e.ltMap; u.ltRect.value.set(...this.lightsRect(no.rect, e.ltMap));
        // Lumières disponibles.
        u.ltHas.value = 1;
        // Fondu par-dessus le repli (ancêtre ou mosaïque), ou d'un coup si les animations sont réduites.
        const ms = lightsFadeMs();
        // Début du fondu, ou fondu terminé.
        if (ms > 0) { e.ltFadeAt = performance.now(); u.ltFade.value = 0; } else this.endLightsFade(e);
      // Fin de l'arrivée.
      })
      // Échec : noté ; annulation : la demande pourra repartir.
      .catch((err) => { if (err.name !== 'AbortError') e.ltFailed = true; else e.ltRequested = false; });
  // Fin de wantLights.
  }

  /** Avance le fondu des lumières d'une tuile ; à la fin, la tuile fine reste seule et le repli est rendu. */
  // fadeLights : avance le fondu des lumières (début).
  fadeLights(e, now) {
    // Pas de fondu en cours : rien.
    if (!e.ltFadeAt) return;
    // Avancement, de 0 à 1.
    const t = Math.min(1, (now - e.ltFadeAt) / LIGHTS_FADE_MS);
    // Courbe douce t² × (3 − 2t).
    e.mesh.material.uniforms.ltFade.value = t * t * (3 - 2 * t);
    // Terminé : fin du fondu.
    if (t >= 1) this.endLightsFade(e);
  // Fin de fadeLights.
  }

  // endLightsFade : la tuile fine seule, repli rendu (début).
  endLightsFade(e) {
    // Variables uniformes de la tuile.
    const u = e.mesh.material.uniforms;
    // Fondu terminé.
    e.ltFadeAt = 0; u.ltFade.value = 1;
    // Repli rendu et retiré.
    if (e.lpMap) { this.releaseTexture(e.lpMap); e.lpMap = null; u.lpMap.value = this.placeholder; u.lpHas.value = 0; }
  // Fin de endLightsFade.
  }

  /**
   * Texture d'une image de lumières, partagée comme `texture`. Stockée en sRGB sur la carte graphique quand elle le
   * permet (WebGL 2, `ltLinear`) : lue en lumière linéaire, ses mipmaps moyennent la lumière elle-même — agrégation
   * cohérente de loin, sans éteindre les petites villes ni créer de foyers. `coord` : sa tuile native, pour le repli.
   */
  // lightsTexture : la texture partagée d'une image de lumières (début).
  lightsTexture(img, coord = null) {
    // Bordure prise dans les voisines (WebGL 2 seulement : en WebGL 1 une taille hors puissance de 2 serait rééchantillonnée).
    const p = this.lightsPad();
    // Tuile native connue, avec bordure : son canevas bordé, déjà fait ou fait maintenant avec ses voisines déjà là.
    if (coord && p > 0) img = this.lightsByCoord.get(lightsKey(coord)) ?? this.padLights(img, coord, p);
    // Nouvelle texture pour cette image ?
    const fresh = !this.textures.has(img);
    // Texture partagée (mipmaps, lissage, filtrage anisotrope, bords).
    const t = this.texture(img);
    // Première création : stockage sRGB si demandé.
    if (fresh && this.uniforms.ltLinear?.value > 0) t.internalFormat = 'SRGB8_ALPHA8';
    // Tuile native connue : notée pour les replis et les bordures.
    if (coord) { t.lightsKey = lightsKey(coord); this.lightsByCoord.set(t.lightsKey, img); }
    // La renvoie.
    return t;
  // Fin de lightsTexture.
  }

  /** Bordure des textures de lumières, en pixels : LIGHTS_PAD en WebGL 2, 0 sinon. */
  // lightsPad : la bordure (début).
  lightsPad() {
    // Lecture en lumière linéaire (WebGL 2) : bordure ; sinon aucune.
    return this.uniforms.ltLinear?.value > 0 ? LIGHTS_PAD : 0;
  // Fin de lightsPad.
  }

  /** Portion d'une tuile native ramenée dans sa texture (bordée ou non). */
  // lightsRect : la portion et la texture (début).
  lightsRect(rect, tex) {
    // Bordure.
    const p = this.lightsPad();
    // Sans bordure : la portion telle quelle ; sinon décalée et mise à l'échelle.
    return p > 0 ? paddedRect(rect, tex.image.width - 2 * p, p) : rect;
  // Fin de lightsRect.
  }

  /**
   * Canevas bordé d'une tuile native arrivée : entouré des bords de ses voisines déjà sur la carte graphique (même
   * niveau, antiméridien compris), et ces voisines reçoivent en retour le bord de celle-ci, renvoyées ensuite à la
   * carte graphique. Les tuiles se raccordent sans couture quel que soit l'ordre d'arrivée.
   */
  // padLights : l'image, sa tuile native et la bordure (début).
  padLights(img, coord, p) {
    // Canevas d'une voisine déjà là, ou null.
    const near = (dir) => { const nb = neighbourTile(coord, dir); return nb ? this.lightsByCoord.get(lightsKey(nb)) ?? null : null; };
    // Canevas bordé de la tuile.
    const c = padLightsImage(img, p, near);
    // Côté de la tuile.
    const N = c.width - 2 * p;
    // Pour chaque direction (début).
    for (const dir of NEIGHBOUR_DIRS) {
      // La voisine.
      const nb = neighbourTile(coord, dir);
      // Au-delà d'un pôle : suivante.
      if (!nb) continue;
      // Voisine qui est la tuile elle-même (niveau 0 : elle se touche à l'antiméridien) : bande prise en elle-même.
      if (lightsKey(nb) === lightsKey(coord)) { fillPad(c.getContext('2d'), null, c, dir, N, p); continue; }
      // Son canevas bordé, s'il est là.
      const nc = this.lightsByCoord.get(lightsKey(nb));
      // Absente (ou sans bordure) : suivante.
      if (!nc?.getContext) continue;
      // Elle reçoit le bord de la nouvelle tuile, dans la direction opposée.
      fillPad(nc.getContext('2d'), null, c, [-dir[0], -dir[1]], nc.width - 2 * p, p);
      // Sa texture sera renvoyée à la carte graphique.
      const shared = this.textures.get(nc);
      // Notée.
      if (shared) this.lightsDirty.add(shared.tex);
    // Fin de la boucle.
    }
    // Renvoie le canevas.
    return c;
  // Fin de padLights.
  }

  /** Renvoie à la carte graphique une texture de lumières recousue (une par image, pour étaler le travail). */
  // flushLightsDirty : une texture recousue renvoyée (début).
  flushLightsDirty() {
    // La première en attente.
    const t = this.lightsDirty.values().next().value;
    // Aucune : rien.
    if (!t) return;
    // Retirée de l'attente.
    this.lightsDirty.delete(t);
    // Toujours utilisée : à renvoyer.
    if (this.textures.get(t.image)?.tex === t) t.needsUpdate = true;
  // Fin de flushLightsDirty.
  }

  /** Texture d'une image d'altitude, partagée comme `texture` : sans lissage ni mipmaps (les couleurs codent un nombre). */
  // heightTexture : la texture partagée d'une image d'altitude (début).
  heightTexture(img) {
    // Texture déjà créée pour cette image.
    const shared = this.heightTextures.get(img);
    // Dans ce cas : un utilisateur de plus, et elle est renvoyée.
    if (shared) { shared.refs++; return shared.tex; }
    // Nouvelle texture.
    const t = new THREE.Texture(img);
    // La partage.
    this.heightTextures.set(img, { tex: t, refs: 1 });
    // Sans mipmaps.
    t.generateMipmaps = false;
    // Réduction sans lissage.
    t.minFilter = THREE.NearestFilter;
    // Agrandissement sans lissage.
    t.magFilter = THREE.NearestFilter;
    // Sans répétition aux bords.
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    // À envoyer à la carte graphique.
    t.needsUpdate = true;
    // La renvoie.
    return t;
  // Fin de heightTexture.
  }

  // releaseHeightTexture : rend une texture d'altitude (début).
  releaseHeightTexture(t) {
    // Son partage.
    const shared = this.heightTextures.get(t.image);
    // Encore utilisée ailleurs : rien de plus.
    if (shared && shared.tex === t && --shared.refs > 0) return;
    // Sinon : retirée du partage.
    if (shared && shared.tex === t) this.heightTextures.delete(t.image);
    // Et détruite.
    t.dispose();
  // Fin de releaseHeightTexture.
  }

  /**
   * Altitude du sol (m) en un point, lue dans la tuile d'altitude la plus fine déjà chargée qui le contient, ou null.
   * Un seul pixel lu : sert au plancher de la caméra, pas à l'affichage.
   */
  // heightAt : l'altitude du sol en un point, ou null (début).
  heightAt(lon, lat) {
    // Meilleure tuile et position du point dans cette tuile.
    let best = null, hit = null;
    // Pour chaque tuile (début).
    for (const e of this.entries()) {
      // Sans image d'altitude, ou pas plus fine que la meilleure : suivante.
      if (!e.hImg || (best && e.z <= best.z)) continue;
      // Position du point dans la tuile, s'il y est.
      const at = pointInTile(tileBoundsIn(this.projection, e.z, e.x, e.y), lon, lat);
      // Dans ce cas : c'est la meilleure.
      if (at) { best = e; hit = at; }
    // Fin de la boucle.
    }
    // Aucune : null.
    if (!best) return null;
    // Essai (début).
    try {
      // Image d'altitude.
      const img = best.hImg;
      // Pixel correspondant au point.
      const { px, py } = texelAt(best.hRect, hit.u, hit.v, img.naturalWidth || img.width || 256, img.naturalHeight || img.height || 256);
      // Canevas d'un pixel.
      const ctx = heightProbe();
      // Indisponible : null.
      if (!ctx) return null;
      // Y dessine le pixel.
      ctx.drawImage(img, px, py, 1, 1, 0, 0, 1, 1);
      // Lit ses couleurs.
      const d = ctx.getImageData(0, 0, 1, 1).data;
      // Les convertit en mètres.
      return terrariumMeters(d[0], d[1], d[2]);
    // Lecture refusée (début).
    } catch {
      // null.
      return null;
    // Fin de l'essai.
    }
  // Fin de heightAt.
  }

  // ---------------------------------------------------------------- calque

  /** Charge le calque d'une tuile affichée qui n'en a pas encore (ex. calque activé après coup). */
  // wantOverlay : charge le calque d'une tuile affichée (début).
  wantOverlay(e, priority = 0) {
    // Le calque.
    const ov = this.overlay;
    // Calque pas prêt, ou déjà posé, demandé ou en échec : rien.
    if (!ov?.ready || e.ovMap || e.ovRequested || e.ovFailed) return;
    // Rues et routes : demandées seulement aux paliers qui les affichent (table du serveur).
    if (ov.layerId === ROADS_LAYER_ID && this.tier?.details?.roads === false) return;
    // Hors de l'emprise du calque (ex. un calque limité à la France) : rien à demander pour cette tuile.
    // Hors de l'emprise du calque : noté en échec, terminé.
    if (!ov.covers(e)) { e.ovFailed = true; return; }
    // Demande notée.
    e.ovRequested = true;
    // Clé de la demande, sous « ov: ».
    const key = `ov:${e.key}`;
    // Tuile native du calque et portion.
    const no = nativeTile({ z: e.z, x: e.x, y: e.y }, ov.maxZoom);
    // Par la file de chargement,
    this.loader
      // charge l'image du calque.
      .load(key, priority, (signal) => ov.loadImage(no.coord, signal))
      // À l'arrivée (début).
      .then((img) => {
        // Couche libérée, calque changé ou tuile partie : rien.
        if (this.disposed || ov !== this.overlay || !this.ready(e.key)) return;
        // Texture du calque.
        e.ovMap = this.texture(img);
        // Garde l'image et sa source.
        e.ovImg = img; e.ovSource = ov;
        // Pose la texture.
        e.mesh.material.uniforms.ovMap.value = e.ovMap;
        // Garde la portion.
        e.ovRect = no.rect;
        // Pose la portion.
        e.mesh.material.uniforms.ovRect.value.set(...no.rect);
        // Allume le calque.
        e.mesh.material.uniforms.ovOn.value = 1;
      // Fin de l'arrivée.
      })
      // Échec : noté ; annulation : la demande pourra repartir.
      .catch((err) => { if (err.name !== 'AbortError') e.ovFailed = true; else e.ovRequested = false; });
  // Fin de wantOverlay.
  }

  // dropOverlay : retire le calque d'une tuile (début).
  dropOverlay(e) {
    // Rend sa texture.
    if (e.ovMap) this.releaseTexture(e.ovMap);
    // Plus de texture.
    e.ovMap = null;
    // Plus d'image ni de source.
    e.ovImg = null; e.ovSource = null;
    // Plus de demande.
    e.ovRequested = false;
    // Plus d'échec.
    e.ovFailed = false;
    // Remet la texture d'attente.
    e.mesh.material.uniforms.ovMap.value = this.placeholder;
    // Éteint le calque.
    e.mesh.material.uniforms.ovOn.value = 0;
  // Fin de dropOverlay.
  }

  // -------------------------------------------------------------- utilitaires

  // ready : la tuile prête de cette clé, gardée ou en cache.
  ready(key) { return this.pinned.get(key) || this.cache.peek(key); }
  // touch : marque une tuile du cache comme récente.
  touch(key) { if (!this.pinned.has(key)) this.cache.touch(key); }
  // entries : parcourt les tuiles gardées, puis celles du cache.
  *entries() { yield* this.pinned.values(); yield* this.cache.map.values(); }

  /** Entrées prêtes à afficher à la place de la tuile `t`. */
  // cover : ce qui peut s'afficher à la place d'une tuile (début).
  cover(t) {
    // La tuile elle-même.
    const self = this.ready(tileKey(t.z, t.x, t.y));
    // Prête : elle seule.
    if (self) return [self];
    // Pour chaque ancêtre, du plus proche à la racine (début).
    for (let p = parentOf(t); p; p = parentOf(p)) {
      // L'ancêtre, s'il est prêt.
      const e = this.ready(tileKey(p.z, p.x, p.y));
      // Dans ce cas : lui seul.
      if (e) return [e];
    // Fin de la boucle.
    }
    // Descendants prêts.
    const out = [];
    // Pour chaque enfant (début).
    for (const c of childrenOf(t)) {
      // L'enfant, s'il est prêt.
      const e = this.ready(tileKey(c.z, c.x, c.y));
      // Dans ce cas : ajouté.
      if (e) out.push(e);
      // Sinon : ses propres enfants prêts sont ajoutés.
      else for (const g of childrenOf(c)) { const eg = this.ready(tileKey(g.z, g.x, g.y)); if (eg) out.push(eg); }
    // Fin de la boucle.
    }
    // Les renvoie.
    return out;
  // Fin de cover.
  }

  // disposeEntry : libère les objets d'une tuile (début).
  disposeEntry(e) {
    // Retire ses paires de l'affichage en hexagones.
    this.hex?.dropEntry(e);
    // Libère la référence logique atlas ; le pipeline n'est pas propriétaire des textures GPU.
    this.surfaceAtlasPipeline?.release(`tile:${e.key}`);
    // Retire son maillage du groupe.
    this.group.remove(e.mesh);
    // Libère sa géométrie.
    e.mesh.geometry.dispose();
    // Libère son matériau.
    e.mesh.material.dispose();
    // Rend la texture du fond.
    this.releaseTexture(e.map);
    // Rend celle du calque.
    if (e.ovMap) this.releaseTexture(e.ovMap);
    // Rend celle des altitudes.
    if (e.hMap) this.releaseHeightTexture(e.hMap);
    // Rend celle des profondeurs.
    if (e.oMap) this.releaseHeightTexture(e.oMap);
    // Rend celle des lumières de la nuit, et celle de leur repli.
    if (e.ltMap) this.releaseTexture(e.ltMap);
    // Repli encore posé (fondu en cours) : rendu.
    if (e.lpMap) this.releaseTexture(e.lpMap);
  // Fin de disposeEntry.
  }

  // dispose : libère la couche (début).
  dispose() {
    // Note la libération.
    this.disposed = true;
    // Plus aucune texture de lumières à renvoyer.
    this.lightsDirty.clear();
    // Libère l'affichage en hexagones.
    this.hex?.dispose();
    // Annule tous les chargements.
    this.loader.cancelAll();
    // Vide la mémoire vive.
    this.ram.map.clear();
    // Vide le cache.
    this.cache.clear();
    // Libère chaque tuile gardée.
    this.pinned.forEach((e) => this.disposeEntry(e));
    // Vide leur table.
    this.pinned.clear();
    // Libère la texture d'attente.
    this.placeholder.dispose();
    // Retire le groupe du repère.
    this.root.remove(this.group);
  // Fin de dispose.
  }
// Fin de la classe TileLayer.
}

