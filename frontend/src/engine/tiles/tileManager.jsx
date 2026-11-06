import * as THREE from 'three';
import { TileSource } from './tileSource';
import { TileLayer } from './tileLayer';
import { viewportBounds } from './viewport';

/**
 * Altitude minimale de la caméra au-dessus du sol quand une carte est affichée, en rayons terrestres : ≈ 5 m, pour
 * qu'environ 10 m de terrain tiennent dans la largeur de l'écran (zoom 22, images au-delà de leur niveau natif agrandies).
 */
export const MIN_DISTANCE_WITH_TILES = 1 + 8e-7;

/**
 * Fait le lien entre le moteur 3D et les tuiles d'un astre : choix du fond et du calque, cadrage de la caméra
 * dans le repère de l'astre, état publié pour l'interface (fournisseur, zoom, attribution…).
 * Le moteur l'appelle une fois par image (`update`) après avoir placé la caméra.
 *
 * `body` décrit l'astre :
 *  name          nom du repère (débogage)
 *  parent        THREE.Object3D qui porte le repère des tuiles (positionné, orienté)
 *  mesh          sphère de fond (couleur unie) de l'astre, cachée quand la carte couvre toute la vue
 *  radius        rayon de l'astre en unités de la scène (les tuiles sont calculées sur une sphère de rayon 1)
 *  sunDir        THREE.Vector3 direction du Soleil dans le repère caméra
 *  airless       vrai pour un astre sans atmosphère (Lune)
 *  overlayMode   'blend' (calque transparent : routes, noms) ou 'relief' (ombrage qui module la luminosité du fond)
 *  Mode « composite » (setComposite) : couleurs = texture globale (setColorTexture), fond = détail en gris ou ombrage,
 *  calque = ombrage du relief.
 *  prefetch      préchargement prédictif (trajectoire de la caméra, cône de 120°) vers le cache RAM
 *  ramCapacity   images décodées gardées en RAM pour le préchargement (400 par défaut, 96 au plus sur mobile)
 *  persistentCache nom du cache persistant du navigateur (L3, Cache Storage) pour les fichiers de tuiles
 *  pinnedMaxZoom niveaux 0 à n de tout l'astre préchargés et gardés en mémoire (2 par défaut, plafonné à 2 sur mobile)
 *  syncRotation  (root) => void, optionnel : recopie la rotation propre de l'astre sur le repère des tuiles
 */
const placeholderTexture = () => {
  const t = new THREE.DataTexture(new Uint8Array([140, 138, 133, 255]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
};

export class TileManager {
  /** @param {{ engine: object, api: object, body: object, onChange?: () => void }} o  engine : SolarEngine (cam, renderer, H) */
  constructor({ engine, api, body, onChange = () => {} }) {
    this.engine = engine;
    this.api = api;
    this.body = body;
    this.onChange = onChange;
    this.root = new THREE.Object3D();
    this.root.name = `${body.name}-tiles`;
    this.root.scale.setScalar(body.radius ?? 1);
    body.parent.add(this.root);

    this.uniforms = {
      sunV: { value: body.sunDir }, shade: { value: 1 }, airless: { value: body.airless ? 1 : 0 },
      ovMode: { value: body.overlayMode === 'relief' ? 1 : 0 },
      colorMap: { value: placeholderTexture() }, colorOn: { value: 0 }, panOn: { value: 0 },
      earthshine: { value: 0.5 },
    };
    this.overlayMode = body.overlayMode === 'relief' ? 1 : 0;
    this.base = null;       // { id, source, layer }
    this.overlay = null;    // { id, source }
    this.token = 0;         // invalide les chargements en cours quand on change de fond
    this.lastError = null;
    this.snap = null;
    this.snapSig = '';

    this.frustum = new THREE.Frustum();
    this.proj = new THREE.Matrix4();
    this.inv = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.tmp = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.upv = new THREE.Vector3();
  }

  /** Vrai dès qu'un fond cartographique est choisi (même s'il charge encore). */
  get active() { return Boolean(this.base); }

  // -------------------------------------------------------------- commandes

  /** Choisit le fond (null = aucun : sphère de fond seule). Renvoie les infos de la couche, ou lève une erreur. */
  async setBase(layerId) {
    const token = ++this.token;
    if (!layerId) { this.clearBase(); this.lastError = null; this.onChange(); return null; }
    if (this.base?.id === layerId) return this.base.source.info;

    const source = new TileSource({ api: this.api, layerId, onChange: this.onChange, persistentCache: this.body.persistentCache });
    try {
      await source.start();
    } catch (e) { source.dispose(); throw e; }
    if (source.status === 'error') {
      const message = source.error;
      source.dispose();
      if (token === this.token) { this.lastError = message; this.onChange(); }
      throw new Error(message || 'Couche indisponible');
    }
    if (token !== this.token) { source.dispose(); return null; }

    this.clearBase();
    const { engine } = this;
    const small = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
    const layer = new TileLayer({
      root: this.root,
      source,
      uniforms: this.uniforms,
      maxAnisotropy: Math.min(8, engine.renderer.capabilities.getMaxAnisotropy()),
      capacity: small ? 120 : 260,
      concurrency: small ? 4 : 6,
      pinnedMaxZoom: Math.min(small ? 2 : 4, this.body.pinnedMaxZoom ?? 2),
      prefetch: Boolean(this.body.prefetch),
      ramCapacity: this.body.prefetch ? Math.min(small ? 96 : Infinity, this.body.ramCapacity ?? 400) : 0,
    });
    this.base = { id: layerId, source, layer };
    if (this.overlay) layer.setOverlaySource(this.overlay.source);
    this.lastError = null;
    this.onChange();
    return source.info;
  }

  /** Calque transparent (routes, noms) fondu sur le fond. null = aucun. */
  async setOverlay(layerId) {
    if (!layerId) {
      this.overlay?.source.dispose();
      this.overlay = null;
      this.base?.layer.setOverlaySource(null);
      this.onChange();
      return;
    }
    if (this.overlay?.id === layerId) return;
    const source = new TileSource({ api: this.api, layerId, onChange: this.onChange, persistentCache: this.body.persistentCache });
    await source.start();
    if (source.status === 'error') { const m = source.error; source.dispose(); throw new Error(m || 'Calque indisponible'); }
    this.overlay?.source.dispose();
    this.overlay = { id: layerId, source };
    this.base?.layer.setOverlaySource(source);
    this.onChange();
  }

  /** Texture globale des couleurs (2:1 équirectangulaire), utilisée en mode composite. */
  setColorTexture(texture) {
    this.uniforms.colorMap.value = texture;
    this.uniforms.colorOn.value = texture ? 1 : 0;
  }
  /**
   * Mode composite : couleurs naturelles (texture globale) + fond + calque.
   * pan = vrai : le fond est une image de détail en gris (luminosité fine), le calque un ombrage du relief.
   * pan = faux : le fond est l'ombrage du relief lui-même.
   */
  setComposite(on, { pan = false } = {}) {
    this.uniforms.ovMode.value = on ? 2 : this.overlayMode;
    this.uniforms.panOn.value = on && pan ? 1 : 0;
  }

  /** Éclairage jour/nuit sur la carte. */
  setShade(on) { this.uniforms.shade.value = on ? 1 : 0; }

  clearBase() {
    if (!this.base) return;
    this.base.layer.dispose();
    this.base.source.dispose();
    this.base = null;
    this.body.mesh.visible = true;
  }

  // ------------------------------------------------------------------ image

  update() {
    const b = this.base;
    if (!b) return;
    const { engine, body } = this;
    const { cam } = engine;

    // Ex. Terre : le repère des tuiles suit la rotation propre (le maillage), pas l'inclinaison déjà portée par le groupe.
    body.syncRotation?.(this.root);
    // Seulement la chaîne parent → repère des tuiles (pas les centaines de tuiles : le rendu s'en charge).
    this.root.updateWorldMatrix(true, false);
    // Repère local = sphère de rayon 1 (l'échelle du repère contient le rayon de l'astre).
    this.inv.copy(this.root.matrixWorld).invert();
    const camLocal = this.tmp.copy(cam.position).applyMatrix4(this.inv);

    this.proj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.proj);
    const world = this.root.matrixWorld;
    const scale = body.radius ?? 1;
    const inFrustum = (c, r) => {
      this.sphere.center.set(c[0], c[1], c[2]).applyMatrix4(world);
      this.sphere.radius = r * scale * 1.15;
      return this.frustum.intersectsSphere(this.sphere);
    };

    const cl = [camLocal.x, camLocal.y, camLocal.z];
    const fovY = (cam.fov * Math.PI) / 180;
    // Direction de visée dans le repère de l'astre (priorités et prédiction).
    const f = cam.getWorldDirection(this.fwd).transformDirection(this.inv);
    const fwd = [f.x, f.y, f.z];
    // Haut de l'image dans le repère de l'astre : avec la visée, il fixe l'orientation du champ de vision
    // (la couche réutilise sa sélection tant que la vue ne bouge pas).
    const u = this.upv.copy(cam.up).transformDirection(this.inv);
    const up = [u.x, u.y, u.z];
    b.layer.update({ cam: cl, fwd, up, aspect: cam.aspect, fovY, viewportH: engine.H * engine.renderer.getPixelRatio(), inFrustum });
    this.view = { cam: cl, fovY, aspect: cam.aspect };

    // La sphère de fond n'est cachée que lorsque la carte couvre tout ce qui est visible.
    body.mesh.visible = !b.layer.fullCover;
  }

  /** État résumé pour l'interface, objet stable tant que rien d'affiché n'a changé. */
  snapshot() {
    const b = this.base;
    const info = b?.source.info;
    const bounds = b && this.view ? viewportBounds(this.view.cam, this.view.fovY, this.view.aspect) : null;
    const r = (v) => Math.round(v * 100) / 100;
    const state = {
      layerId: b?.id ?? null,
      overlayId: this.overlay?.id ?? null,
      status: !b ? (this.lastError ? 'error' : 'off') : b.source.status === 'error' ? 'error' : b.layer.loading > 0 ? 'loading' : 'ready',
      error: this.lastError || b?.source.error || null,
      provider: info?.provider ?? null,
      experimental: Boolean(info?.experimental),
      attributionText: info?.attribution?.text ?? '',
      zoom: b?.layer.visibleZoom ?? 0,
      loading: b?.layer.loading ?? 0,
      preload: b ? b.layer.preload : { done: 0, total: 0 },
      // Caches : L1 = textures GPU, L2 = images décodées en RAM, L3 = disque du navigateur (lus / téléchargés).
      caches: b ? {
        gpu: b.layer.cache.size + b.layer.pinned.size, ram: b.layer.ram.size,
        disk: b.source.stats.disk, net: b.source.stats.network,
      } : null,
      bounds: bounds ? { north: r(bounds.north), south: r(bounds.south), east: r(bounds.east), west: r(bounds.west), zoom: Math.max(0, Math.min(22, b.layer.visibleZoom)) } : null,
    };
    const sig = JSON.stringify(state);
    if (sig !== this.snapSig) { this.snapSig = sig; this.snap = state; }
    return this.snap ?? (this.snap = state);
  }

  dispose() {
    this.token++;
    this.clearBase();
    this.overlay?.source.dispose();
    this.overlay = null;
    this.body.parent.remove(this.root);
  }
}
