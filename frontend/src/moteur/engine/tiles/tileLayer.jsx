// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe selectTiles, le choix des tuiles à afficher, depuis quadtree.
import { selectTiles } from './quadtree';
// Importe les enfants, le parent et la clé d'une tuile, depuis mercator.
import { childrenOf, parentOf, tileKey } from './mercator';
// Importe LruCache, le cache qui évince le moins récent, depuis lru.
import { LruCache } from './lru';
// Importe TileLoader, la file de chargement, depuis tileLoader.
import { TileLoader } from './tileLoader';
// Importe le maillage d'une tuile, l'écart entre niveaux et le rayon d'un niveau, depuis tileGeometry.
import { buildTileGrid, levelGap, tileRadius } from './tileGeometry';
// Importe les deux shaders des tuiles, depuis tileShaders.
import { tileFragmentShader, tileVertexShader } from './tileShaders';
// Importe la projection Mercator, le choix d'une projection et l'emprise d'une tuile, depuis projection.
import { MERCATOR, projectionOf, tileBoundsIn } from './projection';
// Importe les constantes et les fonctions du relief, depuis relief.
import { MAX_HEIGHT_M, OCEAN_SHADE_BOOST, RELIEF_SKIRT, metersPerTexel, pointInTile, terrariumMeters, texelAt } from './relief';
// Importe nativeTile et OVERZOOM_LEVELS, la tuile native d'une tuile sur-zoomée et le nombre de niveaux, depuis overzoom.
import { nativeTile, OVERZOOM_LEVELS } from './overzoom';
// Importe les outils du préchargement prédictif, depuis prefetch.
import { CameraPredictor, coneTest, PREFETCH_FOV, tilePriority, ZoomWatch } from './prefetch';
// Importe HexDisplay, l'affichage en cellules hexagonales, depuis hexDisplay.
import { HexDisplay } from './hexDisplay';

// Priorité des tuiles d'altitude : 1e9, après toutes les images.
const RELIEF_PRIORITY = 1e9;                           // les tuiles d'altitude passent après toutes les images (plus petite priorité d'abord)
// Accentuation de l'ombrage des fonds marins, partagée.
const OCEAN_BOOST = { value: OCEAN_SHADE_BOOST };       // accentuation de l'ombrage des fonds marins, partagée
// Réglage partagé à zéro, pour un astre sans relief.
const RELIEF_OFF = { value: 0 };                       // astre sans relief : réglages partagés à zéro
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
// Gain de couleur neutre : 1, 1, 1.
const COLOR_GAIN_NONE = new Float32Array([1, 1, 1]);   // image sans correction de couleur
// Décalage de couleur neutre : 0, 0, 0.
const COLOR_OFFSET_NONE = new Float32Array(3);
// Niveau maximal des tuiles jamais évincées, par défaut : 2.
const PINNED_MAX_ZOOM = 2;      // par défaut : tuiles du monde entier jamais évincées (dernier recours) ; réglable par couche
// Priorité du préchargement de l'astre entier : 1e6.
const PRELOAD_PRIORITY = 1e6;   // après toutes les tuiles visibles ; niveaux bas d'abord
// Envois de textures par image, au plus : 8.
const UPLOADS_PER_FRAME = 8;    // envois de textures au GPU par image, au plus (réglable par couche : moins sur téléphone)
// Délai avant un nouvel essai après un échec : 6 secondes.
const RETRY_AFTER_MS = 6000;
// Priorité du préchargement prédictif : 1e3.
const PREFETCH_PRIORITY = 1e3;  // préchargement prédictif : après les tuiles visibles, avant le préchargement global
// Calcul de la vue prédite toutes les 4 images.
const PREFETCH_EVERY = 4;       // calcul de la vue prédite toutes les 4 images
// Demandes prédictives en file, au plus : 48.
const PREFETCH_MAX_QUEUED = 48; // demandes prédictives en file au plus (les plus utiles d'abord)
// Tuiles d'altitude préchargées par passe, au plus : 4.
const PREFETCH_RELIEF = 4;      // tuiles d'altitude préchargées au plus par passe (une tuile d'altitude sert plusieurs images)
// Relance des demandes, vue immobile : toutes les 15 images.
const REQUEST_SWEEP_EVERY = 15; // vue immobile : relance des demandes (échecs expirés, L2) toutes les 15 images
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
   * Caches : L1 = textures sur le GPU (LRU `cache` + `pinned`), L2 = images décodées en RAM
   * (`ram`, LRU), L3 = fichiers bruts sur le disque du navigateur (TileSource `persistentCache`). Le serveur ajoute
   * son propre cache disque (Lune).
   */
  // Constructeur (début des réglages) :
  constructor({
    // le repère, la source, les variables partagées, le filtrage, la capacité, les chargements simultanés, le niveau plafond, les niveaux gardés,
    root, source, uniforms, maxAnisotropy = 4, capacity = 260, concurrency = 6, maxZoomCap = 22, pinnedMaxZoom = PINNED_MAX_ZOOM,
    // le préchargement, la mémoire vive, le sur-zoom, le relief et ses deux sources,
    prefetch = false, ramCapacity = 0, overzoom = OVERZOOM_LEVELS, relief = null, reliefSource = null, oceanSource = null,
    // les envois par image et l'affichage en hexagones.
    uploadsPerFrame = UPLOADS_PER_FRAME, hex = true,
  // Fin des réglages (début du constructeur).
  }) {
    // Garde le nombre d'envois par image.
    this.uploadsPerFrame = uploadsPerFrame;
    // Part des envois autorisée : toute.
    this.uploadShare = 1; // part autorisée cette image (réglée par TileManager quand le rythme d'images fléchit)
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
    // Garde le repère.
    this.root = root;
    // Garde la source.
    this.source = source;
    // Garde les variables partagées.
    this.uniforms = uniforms;
    // Garde le filtrage anisotrope.
    this.maxAnisotropy = maxAnisotropy;
    // Garde le niveau plafond.
    this.maxZoomCap = maxZoomCap;
    // Garde le nombre de niveaux de sur-zoom.
    this.overzoom = overzoom;      // niveaux affichés au-delà du niveau natif (image agrandie, détail simulé éventuel)
    // Textures partagées, par image.
    this.textures = new Map();     // image décodée → { tex, refs } : une seule texture GPU par image (tuiles sur-zoomées)
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
    // Le préchargement vers le disque repart de zéro.
    this.warmList = null; this.warmFinished = false; this.warmGen = (this.warmGen || 0) + 1; // le calque change : on recompte
    // Retire le calque de chaque tuile.
    for (const e of [...this.entries()]) this.dropOverlay(e);
  // Fin de setOverlaySource.
  }

  // ---------------------------------------------------------------- boucle

  /** Un fondu entre deux niveaux est en cours (cellules hexagonales). */
  // fading : vrai tant qu'un fondu des cellules est en cours.
  get fading() { return Boolean(this.hex?.fading); }

  // update : à chaque image, avec la vue (début).
  update(view) {
    // Couche libérée ou source pas prête : rien.
    if (this.disposed || !this.source.ready) return;
    // Les grandes tuiles sont affichées à une échelle adaptée, ce qui limite le nombre de requêtes.
    // Taille des tuiles de la source, 256 px par défaut.
    const tileSize = this.source.info?.tileSize || 256;
    // Seuil SSE : 2 px d'écran par pixel de texture (tuiles de 512 px : 4× moins de requêtes pour la même netteté à l'écran).
    // Options de sélection : niveaux, projection et erreur tolérée à l'écran.
    const opts = { minZoom: this.source.minZoom, maxZoom: this.maxZoom, projection: this.projection, tileSize: 256, maxSSE: (2 * tileSize) / 256 };
    // Instant présent.
    const now = performance.now();

    // Sélection (quadtree) seulement si la vue a réellement changé : caméra immobile → aucun parcours.
    // Nouvelle sélection si la vue a changé.
    const reselect = !sameView(this.lastView, view);
    // Dans ce cas (début).
    if (reselect) {
      // Cellules hexagonales : ce sont elles qui disent quelles images carrées charger.
      // Crée l'affichage en hexagones à la première sélection.
      if (this.hexOn && !this.hex) this.hex = new HexDisplay(this);
      // Tuiles voulues : par les cellules, ou par le quadtree.
      const wanted = this.hexOn ? this.hex.select(view, opts) : selectTiles(view, opts);
      // Priorité = 1 / (distance au centre de l'écran) × importance du niveau (sans visée connue : la distance).
      // Niveau le plus fin voulu.
      let finest = 0;
      // Le cherche.
      for (const t of wanted) if (t.z > finest) finest = t.z;
      // Priorité de chaque tuile : selon le centre de l'écran, ou la distance sans visée.
      for (const t of wanted) t.p = view.fwd ? tilePriority(t, view.cam, view.fwd, finest) : t.d;
      // Garde les tuiles voulues.
      this.wanted = wanted;
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
    this.cache.capacity = Math.max(this.baseCapacity, Math.ceil(wanted.length * 1.3));
    // Zoom en cours : seules les tuiles du champ de la caméra sont demandées, toutes. Le préchargement de fond
    // (monde entier aux niveaux bas, niveau suivant vers le disque) et le préchargement prédictif attendent la fin
    // du zoom, pour laisser tout le réseau aux tuiles regardées.
    // Zoom en cours ?
    this.zooming = this.zoomWatch.update(view.cam, now);
    // Sinon (début).
    if (!this.zooming) {
      // Précharge l'astre entier aux niveaux bas.
      this.preloadWorld();
      // Précharge le niveau suivant vers le disque.
      this.warmNext();
    // Fin de ce cas.
    }

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
        // La demande.
        this.request(key, t);
      // Fin de la boucle.
      }
      // Garde les clés voulues.
      this.wantedKeys = wantedKeys;
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
    // Sinon, si le préchargement est actif et la visée connue : il est calculé.
    } else if (this.prefetchOn && view.fwd) prefetched = this.prefetch(view, opts, now);

    // Annulation dynamique : les demandes en file qui ne servent plus (la vue a tourné) sont abandonnées.
    // Si la sélection ou le préchargement a changé et que la file n'est pas vide (début).
    if ((reselect || prefetched) && this.loader.queued) {
      // Pour chaque clé en file (début).
      for (const key of this.loader.queuedKeys()) {
        // Ni voulue, ni calque, ni altitude, ni gardée, ni prédictive : annulée.
        if (!this.wantedKeys.has(key) && !key.startsWith('ov:') && !key.startsWith('h:') && !this.pinKeys.has(key) && !this.prefetchKeys.has(key)) this.loader.cancel(key);
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
      // Tant qu'il en reste et que le quota n'est pas atteint (début).
      for (let n = 0; n < uploads && this.arrived.length;) {
        // Prend la première.
        const a = this.arrived.shift();
        // Elle n'est plus en attente.
        this.arrivedKeys.delete(a.key);
        // Ni voulue ni gardée : rangée en mémoire vive ; suivante.
        if (!this.wantedKeys.has(a.key) && !this.pinKeys.has(a.key)) { this.toRam(a); continue; }
        // La met en place sur la carte graphique.
        this.install(a);
        // Affichage à recalculer.
        this.showDirty = true;
        // Un envoi de plus.
        n++;
      // Fin de la boucle.
      }
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
    // Pour chaque tuile affichée : demande son calque, son relief et son fond marin, puis la place.
    for (const e of this.visibleEntries) { this.wantOverlay(e); this.wantRelief(e, RELIEF_PRIORITY); this.wantOcean(e, RELIEF_PRIORITY + 1); this.place(e); }
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
    // Tuiles d'altitude préchargées.
    let relief = 0;
    // Pour les 48 premières (début).
    for (const { key, t } of todo.slice(0, PREFETCH_MAX_QUEUED)) {
      // Note la clé.
      keys.add(key);
      // Déjà en file : sa priorité est mise à jour.
      if (this.loader.has(key)) this.loader.load(key, t.p);
      // Sinon : la demande.
      else this.request(key, t);
      // Le relief de la zone vers laquelle la caméra se dirige part aussi : il est là quand l'image s'affiche.
      // Précharge aussi son relief, 4 fois au plus.
      if (relief < PREFETCH_RELIEF && this.prefetchRelief(t)) relief++;
    // Fin de la boucle.
    }
    // Garde les clés prédictives.
    this.prefetchKeys = keys;
    // Vrai.
    return true;
  // Fin de prefetch.
  }

  /**
   * Précharge vers le disque du navigateur la tuile d'altitude d'une tuile pas encore affichée (sans décodage).
   * Renvoie true si une requête est partie. Rien tant que l'adresse de la source n'est pas connue.
   */
  // prefetchRelief : précharge la tuile d'altitude d'une tuile vers le disque (début).
  prefetchRelief(t) {
    // Source des altitudes.
    const src = this.reliefSource;
    // Coordonnées de la tuile.
    const coord = { z: t.z, x: t.x, y: t.y };
    // Sans source, sans adresse ou sans relief pour cette tuile : faux.
    if (!src || !src.template || !this.reliefFor(coord)) return false;
    // Précharge la tuile d'altitude native correspondante.
    return src.warm(nativeTile(coord, src.levelFor(t.z)).coord);
  // Fin de prefetchRelief.
  }

  /** Range une tuile décodée en RAM (L2). */
  // toRam : range une tuile décodée en mémoire vive (début).
  toRam({ key, coord, base, ov, overlay, baseRect, ovRect }) {
    // Si la mémoire vive a de la place et que la couche n'est pas libérée.
    if (this.ram.capacity > 0 && !this.disposed) this.ram.set(key, { coord, base, ov, overlay, baseRect, ovRect });
  // Fin de toRam.
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
   * Précharge l'astre entier aux niveaux 0 à `pinnedMaxZoom` (en plate carrée : 2·(4^(n+1) − 1)/3 tuiles, 170 pour n = 3),
   * avec son calque. Ces tuiles ne sont jamais évincées : où que l'on regarde, une image nette est déjà prête.
   * Appelé à chaque image : relance les tuiles échouées et le calque arrivé après coup. Coût : un parcours de la liste.
   */
  // preloadWorld : précharge l'astre entier aux niveaux bas (début).
  preloadWorld() {
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
          // L'ajoute, niveaux bas d'abord.
          this.pinList.push({ key, z, x, y, d: PRELOAD_PRIORITY + z * 1e3 });
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
    // Garde le nombre de tuiles prêtes.
    this.preloadDone = done;
    // Terminé (le calque peut changer : on revérifie alors, voir setOverlaySource).
    // Terminé si toutes le sont.
    this.preloadComplete = done === this.pinList.length;
  // Fin de preloadWorld.
  }

  /** Avancement du préchargement : { done, total } (+ warm : niveau suivant mis sur le disque du navigateur). */
  // preload : l'avancement du préchargement (début).
  get preload() {
    // Tuiles prêtes et total, en mémoire puis sur le disque.
    return { done: this.preloadDone ?? 0, total: this.pinList?.length ?? 0, warmDone: this.warmDone ?? 0, warmTotal: this.warmList?.length ?? 0 };
  // Fin de preload.
  }

  /**
   * Une fois le préchargement en mémoire terminé et la file réseau vide : le niveau suivant (toute la Lune au niveau
   * pinnedMaxZoom + 1, fond et calque) est téléchargé tranquillement vers le cache disque du navigateur (L3), sans
   * décodage ni GPU. Zoomer n'importe où ensuite ne demande plus rien au réseau.
   */
  // warmNext : précharge le niveau suivant vers le disque (début).
  warmNext() {
    // Préchargement en mémoire pas terminé, pas de cache sur disque, ou déjà fini : rien.
    if (!this.preloadComplete || !this.source.persistentCache || this.warmFinished) return;
    // Si la liste n'existe pas (début).
    if (!this.warmList) {
      // Projection et niveau suivant.
      const proj = this.projection, z = this.pinnedMaxZoom + 1;
      // Liste vide.
      this.warmList = [];
      // Pour la source et le calque (début).
      for (const src of [this.source, this.overlay].filter(Boolean)) {
        // Niveau au-delà de la source, ou sans cache sur disque : suivante.
        if (z > src.maxZoom || !src.persistentCache) continue;
        // Ajoute chaque tuile du niveau.
        for (let y = 0; y < proj.rows(z); y++) for (let x = 0; x < proj.cols(z); x++) this.warmList.push({ src, coord: { z, x, y } });
      // Fin de la boucle.
      }
      // Remet les compteurs à zéro.
      this.warmIndex = 0; this.warmDone = 0; this.warmActive = 0; this.warmGen = this.warmGen || 0;
    // Fin de ce cas.
    }
    // La file n'est pas vide : la vue passe d'abord.
    if (this.loader.active + this.loader.queued > 0) return; // la vue d'abord
    // Deux téléchargements à la fois (début).
    while (this.warmActive < 2 && this.warmIndex < this.warmList.length) {
      // Tuile suivante.
      const { src, coord } = this.warmList[this.warmIndex++];
      // Un téléchargement de plus.
      this.warmActive++;
      // Génération en cours.
      const gen = this.warmGen;
      // La précharge ; à la fin, met à jour les compteurs si le calque n'a pas changé.
      src.warm(coord).catch(() => {}).finally(() => { if (gen === this.warmGen) { this.warmActive--; this.warmDone++; } });
    // Fin de la boucle.
    }
    // Tout est parti et terminé : fini.
    if (this.warmIndex >= this.warmList.length && this.warmActive === 0) this.warmFinished = true;
  // Fin de warmNext.
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
        // urgent : la tuile est-elle voulue à l'écran.
        const urgent = () => this.wantedKeys.has(key);
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
        // Voulue ou gardée : en attente de mise en place.
        if (this.wantedKeys.has(key) || this.pinKeys.has(key)) { this.arrivedKeys.add(key); this.arrived.push(a); }
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
        // Accord des couleurs de la source de l'image sur la mosaïque mondiale (voir TileSource, `__color`) : tableaux
        // partagés par toutes les tuiles de la source, mis à jour sur place quand la mesure s'affine.
        // Gain de couleur de l'image, ou neutre.
        colGain: { value: base.__color?.gain || COLOR_GAIN_NONE },
        // Décalage de couleur, ou neutre.
        colOff: { value: base.__color?.offset || COLOR_OFFSET_NONE },
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
    material.extensions = { fragDepth: true, derivatives: true }; // dérivées : taille du pixel pour le détail simulé (WebGL 1)
    // Deux faces.
    material.side = THREE.DoubleSide; // jupes visibles quel que soit leur sens

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
    // Fin de la fiche.
    };
    // La place.
    this.place(entry);
    // Tuile gardée : dans la table des tuiles gardées.
    if (this.pinKeys.has(key)) this.pinned.set(key, entry);
    // Sinon : dans le cache.
    else this.cache.set(key, entry);
  // Fin de install.
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
    // Nouvelle texture.
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
    // Sans relief, sans source, hors Mercator ou sous le niveau minimal : null.
    if (!r || !this.reliefSource || this.projection !== MERCATOR || coord.z < r.minZoom) return null;
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
        u.hSlope.value = 1 / (2 * metersPerTexel(nh.coord.z, midLat, r.radiusM, size));
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
        u.oSlope.value = 1 / (2 * metersPerTexel(no.coord.z, midLat, r.radiusM, size));
        // Profondeurs disponibles.
        u.oHas.value = 1;
      // Fin de l'arrivée.
      })
      // Échec : noté ; annulation : la demande pourra repartir.
      .catch((err) => { if (err.name !== 'AbortError') e.oFailed = true; else e.oRequested = false; });
  // Fin de wantOcean.
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
    // Hors de l'emprise du calque (ex. LiDAR HD hors de France) : rien à demander pour cette tuile.
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
  // Fin de disposeEntry.
  }

  // dispose : libère la couche (début).
  dispose() {
    // Note la libération.
    this.disposed = true;
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

