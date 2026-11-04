import * as THREE from 'three';
import { selectTiles } from './quadtree.js';
import { childrenOf, parentOf, tileKey } from './mercator.js';
import { LruCache } from './lru.js';
import { TileLoader } from './tileLoader.js';
import { buildTileGrid, levelGap, tileRadius } from './tileGeometry.js';
import { tileFragmentShader, tileVertexShader } from './tileShaders.js';
import { projectionOf } from './projection.js';
import { nativeTile, OVERZOOM_LEVELS } from './overzoom.js';
import { ancestorRect, CameraPredictor, coneTest, PREFETCH_FOV, tilePriority } from './prefetch.js';

const PINNED_MAX_ZOOM = 2;      // par défaut : tuiles du monde entier jamais évincées (dernier recours) ; réglable par couche
const PRELOAD_PRIORITY = 1e6;   // après toutes les tuiles visibles ; niveaux bas d'abord
const UPLOADS_PER_FRAME = 3;    // limite les envois de textures au GPU par image (évite les saccades)
const RETRY_AFTER_MS = 6000;
const PREFETCH_PRIORITY = 1e3;  // préchargement prédictif : après les tuiles visibles, avant le préchargement global
const PREFETCH_EVERY = 4;       // calcul de la vue prédite toutes les 4 images
const PREFETCH_MAX_QUEUED = 48; // demandes prédictives en file au plus (les plus utiles d'abord)
const FADE_MS = 180;            // fondu enchaîné parent → enfant
const REQUEST_SWEEP_EVERY = 15; // vue immobile : relance des demandes (échecs expirés, L2) toutes les 15 images
// Vue inchangée à ces tolérances près : la sélection précédente est réutilisée (pas de nouveau parcours du quadtree).
const VIEW_POS_TOL = 1e-3;      // × altitude de la caméra
const VIEW_DIR_TOL = 5e-4;      // rad (≈ 1 px d'écran)

/** Vue « presque identique » : position relative à l'altitude, visée et haut de l'image, champ et taille d'écran. */
function sameView(a, b) {
  if (!a || !b || a.fovY !== b.fovY || a.viewportH !== b.viewportH || a.aspect !== b.aspect) return false;
  const alt = Math.max(Math.hypot(b.cam[0], b.cam[1], b.cam[2]) - 1, 1e-12);
  const dp = Math.hypot(a.cam[0] - b.cam[0], a.cam[1] - b.cam[1], a.cam[2] - b.cam[2]);
  if (dp > alt * VIEW_POS_TOL) return false;
  const d3 = (u, v) => (u && v ? Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]) : u === v ? 0 : Infinity);
  return d3(a.fwd, b.fwd) <= VIEW_DIR_TOL && d3(a.up, b.up) <= VIEW_DIR_TOL;
}
const copyView = (v) => ({
  cam: [...v.cam], fwd: v.fwd && [...v.fwd], up: v.up && [...v.up], fovY: v.fovY, viewportH: v.viewportH, aspect: v.aspect,
});

const emptyTexture = () => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
};

/**
 * Une couche de tuiles posée sur un astre (Terre ou Lune) : sélection (quadtree), chargement, cache borné, affichage.
 * Une tuile jamais prête est remplacée par son ancêtre déjà chargé, donc la carte n'a pas de trou.
 * Un `overlaySource` optionnel (ex. routes et noms) est fondu dans le même maillage que la source principale.
 */
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
   *
   * Caches : L1 = textures sur le GPU (LRU `cache` + `pinned`), L2 = images décodées en RAM
   * (`ram`, LRU), L3 = fichiers bruts sur le disque du navigateur (TileSource `persistentCache`). Le serveur ajoute
   * son propre cache disque (Lune).
   */
  constructor({
    root, source, uniforms, maxAnisotropy = 4, capacity = 260, concurrency = 6, maxZoomCap = 22, pinnedMaxZoom = PINNED_MAX_ZOOM,
    prefetch = false, ramCapacity = 0,
  }) {
    this.root = root;
    this.source = source;
    this.uniforms = uniforms;
    this.maxAnisotropy = maxAnisotropy;
    this.maxZoomCap = maxZoomCap;
    this.pinnedMaxZoom = pinnedMaxZoom;
    this.pinList = null;           // tuiles à précharger (calculées au premier passage)
    this.pinKeys = new Set();
    this.group = new THREE.Group();
    this.group.name = 'tiles';
    root.add(this.group);

    this.overlay = null;
    this.placeholder = emptyTexture();
    this.loader = new TileLoader(concurrency);
    this.baseCapacity = capacity;
    this.cache = new LruCache(capacity, (_k, entry) => this.evict(entry));
    this.ram = new LruCache(ramCapacity);  // L2 : clé → { coord, base, ov, overlay, baseRect, ovRect }
    this.prefetchOn = prefetch && ramCapacity > 0;
    this.predictor = new CameraPredictor();
    this.prefetchKeys = new Set();
    this.frame = 0;
    this.pinned = new Map();
    this.arrived = [];
    this.arrivedKeys = new Set(); // arrivées en attente de mise en place : on ne les redemande pas
    this.wantedKeys = new Set();
    this.failed = new Map();       // clé → date de nouvel essai
    this.visibleZoom = 0;
    this.fullCover = false;
    this.wantedCount = 0;
    this.disposed = false;
    this.gap = levelGap(1);
    // Réutilisation entre images : sélection, liste affichée, préchargement.
    this.wanted = [];
    this.lastView = null;      // vue de la dernière sélection
    this.lastPredView = null;  // vue prédite du dernier préchargement
    this.showDirty = true;     // l'ensemble affiché doit être recalculé (sélection, arrivée, éviction)
    this.visibleEntries = [];
    this.sweep = 0;
  }

  /** Niveau affiché maximal : niveau natif de la couche avec sur-zoom modéré, borné à 22. */
  get maxZoom() { return Math.min(this.maxZoomCap, this.source.maxZoom + OVERZOOM_LEVELS); }
  get loading() { return this.loader.active + this.loader.queued; }
  get projection() { return projectionOf(this.source.info?.projection); }

  setOverlaySource(source) {
    if (this.overlay === source) return;
    this.overlay = source;
    this.preloadComplete = false;
    this.warmList = null; this.warmFinished = false; this.warmGen = (this.warmGen || 0) + 1; // le calque change : on recompte
    for (const e of [...this.entries()]) this.dropOverlay(e);
  }

  // ---------------------------------------------------------------- boucle

  update(view) {
    if (this.disposed || !this.source.ready) return;
    // Les grandes tuiles sont affichées à une échelle adaptée, ce qui limite le nombre de requêtes.
    const tileSize = this.source.info?.tileSize || 256;
    // Seuil SSE : 2 px d'écran par pixel de texture (tuiles de 512 px : 4× moins de requêtes pour la même netteté à l'écran).
    const opts = { minZoom: this.source.minZoom, maxZoom: this.maxZoom, projection: this.projection, tileSize: 256, maxSSE: (2 * tileSize) / 256 };
    const now = performance.now();

    // Sélection (quadtree) seulement si la vue a réellement changé : caméra immobile → aucun parcours.
    const reselect = !sameView(this.lastView, view);
    if (reselect) {
      const wanted = selectTiles(view, opts);
      // Priorité = 1 / (distance au centre de l'écran) × importance du niveau (sans visée connue : la distance).
      let finest = 0;
      for (const t of wanted) if (t.z > finest) finest = t.z;
      for (const t of wanted) t.p = view.fwd ? tilePriority(t, view.cam, view.fwd, finest) : t.d;
      this.wanted = wanted;
      this.lastView = copyView(view);
      this.showDirty = true;
    }
    const wanted = this.wanted;
    this.gap = levelGap(Math.max(0, Math.hypot(view.cam[0], view.cam[1], view.cam[2]) - 1));
    this.wantedCount = wanted.length;

    // Le cache doit pouvoir contenir au moins tout ce qui est voulu, sinon les tuiles s'évincent en boucle.
    this.cache.capacity = Math.max(this.baseCapacity, Math.ceil(wanted.length * 1.3));
    this.preloadWorld();
    this.warmNext();

    // 1. Demandes de chargement pour les tuiles voulues (à chaque nouvelle sélection, sinon balayage périodique).
    if (reselect || ++this.sweep >= REQUEST_SWEEP_EVERY) {
      this.sweep = 0;
      const wantedKeys = reselect ? new Set() : this.wantedKeys;
      for (const t of wanted) {
        const key = t.key ?? (t.key = tileKey(t.z, t.x, t.y));
        if (reselect) wantedKeys.add(key);
        const entry = this.ready(key);
        if (entry) continue;
        if (this.arrivedKeys.has(key)) continue;
        // Déjà décodée en RAM (L2) : envoi au GPU dès cette image, sans réseau.
        const inRam = this.ram.peek(key);
        if (inRam) { this.ram.map.delete(key); this.arrivedKeys.add(key); this.arrived.push({ ...inRam, key, d: t.p }); continue; }
        if (this.loader.has(key)) { this.loader.load(key, t.p); continue; } // remonte la priorité (ex. tuile préchargée)
        if ((this.failed.get(key) ?? 0) > now) continue;
        this.request(key, t);
      }
      this.wantedKeys = wantedKeys;
    }

    // Préchargement prédictif : où sera la caméra dans 1,5 s, avec un champ de vision de 120°.
    const prefetched = this.prefetchOn && view.fwd ? this.prefetch(view, opts, now) : false;

    // Annulation dynamique : les demandes en file qui ne servent plus (la vue a tourné) sont abandonnées.
    if ((reselect || prefetched) && this.loader.queued) {
      for (const key of this.loader.queuedKeys()) {
        if (!this.wantedKeys.has(key) && !key.startsWith('ov:') && !this.pinKeys.has(key) && !this.prefetchKeys.has(key)) this.loader.cancel(key);
      }
    }

    // 2. Mise en place de quelques tuiles arrivées
    // Les plus prioritaires d'abord ; une tuile arrivée mais plus voulue (la vue a bougé) reste en RAM (L2).
    if (this.arrived.length) {
      this.arrived.sort((p, q) => p.d - q.d);
      for (let n = 0; n < UPLOADS_PER_FRAME && this.arrived.length;) {
        const a = this.arrived.shift();
        this.arrivedKeys.delete(a.key);
        if (!this.wantedKeys.has(a.key) && !this.pinKeys.has(a.key)) { this.toRam(a); continue; }
        this.install(a);
        this.showDirty = true;
        n++;
      }
    }

    // 3. Quoi afficher : la tuile, sinon son ancêtre prêt, sinon ses descendants prêts.
    // Recalculé seulement quand la sélection ou le contenu des caches change ; sinon on garde la liste affichée.
    if (this.showDirty) {
      this.showDirty = false;
      const show = new Set();
      let full = wanted.length > 0;
      for (const t of wanted) {
        const cover = this.cover(t);
        if (!cover.length) full = false;
        for (const e of cover) show.add(e);
      }
      this.fullCover = full;
      for (const e of this.visibleEntries) if (!show.has(e)) e.mesh.visible = false;
      let zoom = 0;
      const visible = [];
      for (const e of show) {
        e.mesh.visible = true;
        this.touch(e.key);
        if (e.z > zoom) zoom = e.z;
        visible.push(e);
      }
      this.visibleEntries = visible;
      this.visibleZoom = zoom;
    }
    for (const e of this.visibleEntries) { this.wantOverlay(e); this.place(e); this.fade(e, now); }
  }

  /**
   * Préchargement prédictif. Vue estimée à T + Δt (vitesses de translation, de zoom et de rotation de la caméra),
   * second passage de sélection avec un cône de 120°, priorité selon l'écart au centre de la vue estimée.
   * Les images arrivent dans le cache RAM (L2) : elles ne prennent de place sur le GPU que si on les regarde.
   */
  prefetch(view, opts, now) {
    this.predictor.update(view.cam, view.fwd, now);
    if (this.frame++ % PREFETCH_EVERY) return false;
    const pred = this.predictor.predict() || { cam: view.cam, fwd: view.fwd };
    // Caméra immobile : la vue prédite n'a pas bougé, le préchargement calculé reste valable.
    const predView = { cam: pred.cam, fwd: pred.fwd, up: null, fovY: PREFETCH_FOV, viewportH: view.viewportH, aspect: 1 };
    if (sameView(this.lastPredView, predView)) return false;
    this.lastPredView = copyView(predView);
    const wide = selectTiles(
      { cam: pred.cam, fovY: PREFETCH_FOV, viewportH: view.viewportH, inFrustum: coneTest(pred.cam, pred.fwd, PREFETCH_FOV / 2) },
      { ...opts, maxTiles: 160 },
    );
    const finest = wide.reduce((m, t) => Math.max(m, t.z), 0);
    const todo = [];
    const keys = new Set();
    for (const t of wide) {
      const key = tileKey(t.z, t.x, t.y);
      if (this.wantedKeys.has(key) || this.ready(key) || this.ram.has(key) || this.arrivedKeys.has(key)) continue;
      if ((this.failed.get(key) ?? 0) > now) continue;
      t.p = PREFETCH_PRIORITY + tilePriority(t, pred.cam, pred.fwd, finest);
      todo.push({ key, t });
    }
    todo.sort((a, b) => a.t.p - b.t.p);
    for (const { key, t } of todo.slice(0, PREFETCH_MAX_QUEUED)) {
      keys.add(key);
      if (this.loader.has(key)) this.loader.load(key, t.p);
      else this.request(key, t);
    }
    this.prefetchKeys = keys;
    return true;
  }

  /** Range une tuile décodée en RAM (L2). */
  toRam({ key, coord, base, ov, overlay, baseRect, ovRect }) {
    if (this.ram.capacity > 0 && !this.disposed) this.ram.set(key, { coord, base, ov, overlay, baseRect, ovRect });
  }

  /** Éviction du GPU (L1) : textures détruites, image décodée gardée en RAM (L2) pour un retour instantané. */
  evict(e) {
    this.showDirty = true;
    this.toRam({ key: e.key, coord: { z: e.z, x: e.x, y: e.y }, base: e.baseImg, ov: e.ovImg, overlay: e.ovSource, baseRect: e.baseRect, ovRect: e.ovRect });
    this.disposeEntry(e);
  }

  /** Fondu enchaîné : la tuile apparaît en 180 ms par-dessus l'image de son ancêtre (même maillage, aucun clignotement). */
  fade(e, now) {
    if (e.faded) return;
    e.fadeStart ??= now;
    const f = Math.min(1, (now - e.fadeStart) / FADE_MS);
    const u = e.mesh.material.uniforms;
    u.fade.value = f;
    if (f >= 1) { e.faded = true; u.parentMap.value = this.placeholder; }
  }

  /**
   * Précharge l'astre entier aux niveaux 0 à `pinnedMaxZoom` (en plate carrée : 2·(4^(n+1) − 1)/3 tuiles, 170 pour n = 3),
   * avec son calque. Ces tuiles ne sont jamais évincées : où que l'on regarde, une image nette est déjà prête.
   * Appelé à chaque image : relance les tuiles échouées et le calque arrivé après coup. Coût : un parcours de la liste.
   */
  preloadWorld() {
    const proj = this.projection;
    if (!this.pinList) {
      this.pinList = [];
      for (let z = Math.max(0, this.source.minZoom); z <= Math.min(this.pinnedMaxZoom, this.source.maxZoom); z++) {
        for (let y = 0; y < proj.rows(z); y++) for (let x = 0; x < proj.cols(z); x++) {
          const key = tileKey(z, x, y);
          this.pinList.push({ key, z, x, y, d: PRELOAD_PRIORITY + z * 1e3 });
          this.pinKeys.add(key);
        }
      }
    }
    if (this.preloadComplete) return;
    const now = performance.now();
    let done = 0;
    for (const t of this.pinList) {
      const e = this.pinned.get(t.key);
      if (e) {
        if (!this.overlay || this.overlay.status === 'error' || e.ovMap || e.ovFailed) done++;
        else this.wantOverlay(e, t.d);
        continue;
      }
      if (this.loader.has(t.key) || this.arrivedKeys.has(t.key) || (this.failed.get(t.key) ?? 0) > now) continue;
      this.request(t.key, t);
    }
    this.preloadDone = done;
    // Terminé (le calque peut changer : on revérifie alors, voir setOverlaySource).
    this.preloadComplete = done === this.pinList.length;
  }

  /** Avancement du préchargement : { done, total } (+ warm : niveau suivant mis sur le disque du navigateur). */
  get preload() {
    return { done: this.preloadDone ?? 0, total: this.pinList?.length ?? 0, warmDone: this.warmDone ?? 0, warmTotal: this.warmList?.length ?? 0 };
  }

  /**
   * Une fois le préchargement en mémoire terminé et la file réseau vide : le niveau suivant (toute la Lune au niveau
   * pinnedMaxZoom + 1, fond et calque) est téléchargé tranquillement vers le cache disque du navigateur (L3), sans
   * décodage ni GPU. Zoomer n'importe où ensuite ne demande plus rien au réseau.
   */
  warmNext() {
    if (!this.preloadComplete || !this.source.persistentCache || this.warmFinished) return;
    if (!this.warmList) {
      const proj = this.projection, z = this.pinnedMaxZoom + 1;
      this.warmList = [];
      for (const src of [this.source, this.overlay].filter(Boolean)) {
        if (z > src.maxZoom || !src.persistentCache) continue;
        for (let y = 0; y < proj.rows(z); y++) for (let x = 0; x < proj.cols(z); x++) this.warmList.push({ src, coord: { z, x, y } });
      }
      this.warmIndex = 0; this.warmDone = 0; this.warmActive = 0; this.warmGen = this.warmGen || 0;
    }
    if (this.loader.active + this.loader.queued > 0) return; // la vue d'abord
    while (this.warmActive < 2 && this.warmIndex < this.warmList.length) {
      const { src, coord } = this.warmList[this.warmIndex++];
      this.warmActive++;
      const gen = this.warmGen;
      src.warm(coord).catch(() => {}).finally(() => { if (gen === this.warmGen) { this.warmActive--; this.warmDone++; } });
    }
    if (this.warmIndex >= this.warmList.length && this.warmActive === 0) this.warmFinished = true;
  }

  // ------------------------------------------------------------- chargement

  request(key, t) {
    const coord = { z: t.z, x: t.x, y: t.y };
    const overlay = this.overlay;
    this.loader
      .load(key, t.d, async (signal) => {
        // Au-delà du niveau natif, on charge l'ancêtre et on n'en affiche qu'une partie (rect).
        const nb = nativeTile(coord, this.source.maxZoom);
        const base = await this.source.loadImage(nb.coord, signal);
        // Le calque est facultatif : s'il échoue, on affiche la tuile sans lui.
        const no = overlay?.ready ? nativeTile(coord, overlay.maxZoom) : null;
        const ov = no ? await overlay.loadImage(no.coord, signal).catch((e) => { if (e.name === 'AbortError') throw e; return null; }) : null;
        return { base, ov, baseRect: nb.rect, ovRect: no?.rect };
      })
      .then(({ base, ov, baseRect, ovRect }) => {
        if (this.disposed) return;
        const a = { key, coord, d: t.p ?? t.d, base, ov, overlay, baseRect, ovRect };
        // Voulue maintenant (ou préchargement global) → GPU ; préchargement prédictif → RAM, prête pour plus tard.
        if (this.wantedKeys.has(key) || this.pinKeys.has(key)) { this.arrivedKeys.add(key); this.arrived.push(a); }
        else this.toRam(a);
      })
      .catch((e) => { if (e.name !== 'AbortError') this.failed.set(key, performance.now() + RETRY_AFTER_MS); });
  }

  install({ key, coord, base, ov, overlay, baseRect = [0, 0, 1, 1], ovRect = [0, 0, 1, 1] }) {
    if (this.ready(key)) return;
    const proj = this.projection;
    // Jupes : 1,5 % de la taille de la tuile, assez pour boucher les fissures entre niveaux voisins.
    const grid = buildTileGrid(coord.z, coord.x, coord.y, proj, { skirt: 0.015 * proj.groundSize(coord.z, 0) });
    // Fondu : image de départ = portion de l'ancêtre prêt le plus proche (celui qu'on affichait jusqu'ici).
    let parent = null;
    for (let q = parentOf(coord); q && !parent; q = parentOf(q)) parent = this.ready(tileKey(q.z, q.x, q.y)) || null;
    // Sommets relatifs au centre de la tuile : la position réelle est portée par la matrice (voir `place`).
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(grid.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(grid.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));

    const map = this.texture(base);
    const ovMap = ov && overlay === this.overlay ? this.texture(ov) : null;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: map },
        ovMap: { value: ovMap || this.placeholder },
        ovOn: { value: ovMap ? 1 : 0 },
        baseRect: { value: new THREE.Vector4(...baseRect) },
        ovRect: { value: new THREE.Vector4(...ovRect) },
        parentMap: { value: parent ? parent.map : this.placeholder },
        parentRect: { value: new THREE.Vector4(...(parent ? ancestorRect(parent, coord, parent.baseRect) : [0, 0, 1, 1])) },
        fade: { value: parent ? 0 : 1 },
        sunV: this.uniforms.sunV,
        shade: this.uniforms.shade,
        airless: this.uniforms.airless,
        ovMode: this.uniforms.ovMode,
        colorMap: this.uniforms.colorMap,
        colorOn: this.uniforms.colorOn,
        panOn: this.uniforms.panOn,
        earthshine: this.uniforms.earthshine || { value: 0.5 },
        // Portion de la texture globale (couleurs de la Lune) couverte par cette tuile : [u0, v0, largeur, hauteur].
        globalRect: { value: new THREE.Vector4(
          coord.x / this.projection.cols(coord.z), 1 - (coord.y + 1) / this.projection.rows(coord.z),
          1 / this.projection.cols(coord.z), 1 / this.projection.rows(coord.z),
        ) },
      },
      vertexShader: tileVertexShader,
      fragmentShader: tileFragmentShader,
    });
    material.extensions = { fragDepth: true };
    material.side = THREE.DoubleSide; // jupes visibles quel que soit leur sens

    const mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    this.group.add(mesh);

    const entry = {
      key, z: coord.z, x: coord.x, y: coord.y, mesh, map, ovMap, ovRequested: Boolean(ovMap), ovFailed: false, center: grid.center, gap: 0,
      // Pour l'éviction vers la RAM (L2) et le fondu des enfants.
      baseImg: base, ovImg: ovMap ? ov : null, ovSource: ovMap ? overlay : null, baseRect, ovRect, faded: !parent,
    };
    this.place(entry);
    if (this.pinKeys.has(key)) this.pinned.set(key, entry);
    else this.cache.set(key, entry);
  }

  /** Matrice de la tuile : échelle = rayon de son niveau, translation = centre · rayon (double précision côté JS). */
  place(e) {
    if (e.gap === this.gap) return;
    e.gap = this.gap;
    const r = tileRadius(e.z, this.gap);
    e.mesh.matrix.makeScale(r, r, r).setPosition(e.center[0] * r, e.center[1] * r, e.center[2] * r);
    e.mesh.matrixWorldNeedsUpdate = true;
  }

  texture(img) {
    const t = new THREE.Texture(img);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = this.maxAnisotropy;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  // ---------------------------------------------------------------- calque

  /** Charge le calque d'une tuile affichée qui n'en a pas encore (ex. calque activé après coup). */
  wantOverlay(e, priority = 0) {
    const ov = this.overlay;
    if (!ov?.ready || e.ovMap || e.ovRequested || e.ovFailed) return;
    e.ovRequested = true;
    const key = `ov:${e.key}`;
    const no = nativeTile({ z: e.z, x: e.x, y: e.y }, ov.maxZoom);
    this.loader
      .load(key, priority, (signal) => ov.loadImage(no.coord, signal))
      .then((img) => {
        if (this.disposed || ov !== this.overlay || !this.ready(e.key)) return;
        e.ovMap = this.texture(img);
        e.ovImg = img; e.ovSource = ov;
        e.mesh.material.uniforms.ovMap.value = e.ovMap;
        e.ovRect = no.rect;
        e.mesh.material.uniforms.ovRect.value.set(...no.rect);
        e.mesh.material.uniforms.ovOn.value = 1;
      })
      .catch((err) => { if (err.name !== 'AbortError') e.ovFailed = true; else e.ovRequested = false; });
  }

  dropOverlay(e) {
    if (e.ovMap) e.ovMap.dispose();
    e.ovMap = null;
    e.ovImg = null; e.ovSource = null;
    e.ovRequested = false;
    e.ovFailed = false;
    e.mesh.material.uniforms.ovMap.value = this.placeholder;
    e.mesh.material.uniforms.ovOn.value = 0;
  }

  // -------------------------------------------------------------- utilitaires

  ready(key) { return this.pinned.get(key) || this.cache.peek(key); }
  touch(key) { if (!this.pinned.has(key)) this.cache.touch(key); }
  *entries() { yield* this.pinned.values(); yield* this.cache.map.values(); }

  /** Entrées prêtes à afficher à la place de la tuile `t`. */
  cover(t) {
    const self = this.ready(tileKey(t.z, t.x, t.y));
    if (self) return [self];
    for (let p = parentOf(t); p; p = parentOf(p)) {
      const e = this.ready(tileKey(p.z, p.x, p.y));
      if (e) return [e];
    }
    const out = [];
    for (const c of childrenOf(t)) {
      const e = this.ready(tileKey(c.z, c.x, c.y));
      if (e) out.push(e);
      else for (const g of childrenOf(c)) { const eg = this.ready(tileKey(g.z, g.x, g.y)); if (eg) out.push(eg); }
    }
    return out;
  }

  disposeEntry(e) {
    this.group.remove(e.mesh);
    e.mesh.geometry.dispose();
    e.mesh.material.dispose();
    e.map.dispose();
    if (e.ovMap) e.ovMap.dispose();
  }

  dispose() {
    this.disposed = true;
    this.loader.cancelAll();
    this.ram.map.clear();
    this.cache.clear();
    this.pinned.forEach((e) => this.disposeEntry(e));
    this.pinned.clear();
    this.placeholder.dispose();
    this.root.remove(this.group);
  }
}
