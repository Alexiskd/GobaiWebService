// Moteur de rendu de nuages de points LiDAR (LAS / LAZ), en WebGL 2 pur.
//
//  - Niveaux de détail : octree parcouru à chaque image par ordre de taille à l'écran, dans la limite d'un budget
//    de points ; seuls les nœuds visibles sont envoyés au GPU (cache LRU).
//  - Colorations : couleurs du fichier, altitude (dégradé), intensité, classes ASPRS / IGN, numéros de retour.
//  - Taille des points adaptative (selon la densité locale) ou fixe, points ronds.
//  - Ombrage EDL (Eye-Dome Lighting) : relief lisible sans normales, comme dans Potree ou CloudCompare.
//  - Caméra orbitale : souris, molette (zoom vers le curseur), tactile (un doigt tourne, deux doigts zooment et
//    déplacent), clavier ; double-clic pour recentrer sur un point.
//  - Sélection d'un point (coordonnées réelles, classe, intensité…) et mesure de distances.
//
// Utilisation :
//   const engine = new LidarEngine(div);
//   engine.on('progress', ({ phase, ratio }) => …);
//   const info = await engine.load(fichierOuUrl);
//   engine.setColorMode('elevation');
//   …
//   engine.dispose();

import { classLut, gradientLut } from './colormaps.js';
import { frustumPlanes, lookAt, mat4, multiply, perspective, project, sphereInFrustum } from './math.js';

const FOV = (55 * Math.PI) / 180;
const MIN_NODE_PX = 60;          // taille minimale (px CSS) d'un nœud pour descendre dans ses enfants
const UPLOADS_PER_FRAME = 12;    // nœuds envoyés au GPU par image (évite les saccades)
const GPU_POINT_FACTOR = 2.5;    // mémoire GPU gardée en cache = budget × facteur
const COLOR_MODES = { rgb: 0, elevation: 1, intensity: 2, classification: 3, returns: 4 };

const POINT_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec3 aPos;
layout(location = 1) in uvec4 aRgbc;
layout(location = 2) in uvec2 aIret;
uniform mat4 uViewProj;
uniform int uColorMode;
uniform int uSizeMode;
uniform float uPointSize;
uniform float uMinSize;
uniform float uMaxSize;
uniform float uProjScale;
uniform float uRootSpacing;
uniform vec3 uNodeMin;
uniform float uNodeSize;
uniform int uVnIndex;
uniform sampler2D uVisibleNodes;
uniform vec2 uZRange;
uniform vec2 uIntensityRange;
uniform float uIntensityGamma;
uniform sampler2D uGradient;
uniform sampler2D uClasses;
out vec3 vColor;

// Espacement local des points : on descend depuis le nœud courant dans les nœuds enfants affichés qui contiennent
// le point (texture : R = masque des enfants affichés, GB = indice du premier enfant, A = niveau d'espacement).
float localSpacing() {
  int idx = uVnIndex;
  vec3 nmin = uNodeMin;
  float nsize = uNodeSize;
  vec4 t = texelFetch(uVisibleNodes, ivec2(idx % 2048, idx / 2048), 0) * 255.0;
  for (int level = 0; level < 20; level++) {
    int mask = int(t.r + 0.5);
    float hs = nsize * 0.5;
    vec3 rel = aPos - nmin;
    int ox = rel.x >= hs ? 1 : 0;
    int oy = rel.y >= hs ? 1 : 0;
    int oz = rel.z >= hs ? 1 : 0;
    int octant = ox | (oy << 1) | (oz << 2);
    if (((mask >> octant) & 1) == 0) break;
    int before = 0;
    for (int b = 0; b < 8; b++) if (b < octant && ((mask >> b) & 1) == 1) before++;
    idx = int(t.g + 0.5) + int(t.b + 0.5) * 256 + before;
    nmin += vec3(float(ox), float(oy), float(oz)) * hs;
    nsize = hs;
    t = texelFetch(uVisibleNodes, ivec2(idx % 2048, idx / 2048), 0) * 255.0;
  }
  return uRootSpacing / exp2(t.a);
}

void main() {
  vec4 cls = texelFetch(uClasses, ivec2(int(aRgbc.w), 0), 0);
  if (cls.a < 0.5 || aPos.z < uZRange.x || aPos.z > uZRange.y) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    return;
  }
  vec4 clip = uViewProj * vec4(aPos, 1.0);
  gl_Position = clip;
  float size = uPointSize;
  if (uSizeMode == 1) size = uPointSize * localSpacing() * uProjScale / max(clip.w, 1e-6);
  gl_PointSize = clamp(size, uMinSize, uMaxSize);
  vec3 c;
  if (uColorMode == 0) {
    c = vec3(aRgbc.xyz) / 255.0;
  } else if (uColorMode == 1) {
    float t = clamp((aPos.z - uZRange.x) / max(uZRange.y - uZRange.x, 1e-6), 0.0, 1.0);
    c = texture(uGradient, vec2(t, 0.5)).rgb;
  } else if (uColorMode == 2) {
    float t = clamp((float(aIret.x) - uIntensityRange.x) / max(uIntensityRange.y - uIntensityRange.x, 1.0), 0.0, 1.0);
    c = vec3(pow(t, uIntensityGamma));
  } else if (uColorMode == 3) {
    c = cls.rgb;
  } else {
    uint rn = aIret.y & 15u;
    uint nr = aIret.y >> 4u;
    if (nr <= 1u) c = vec3(1.0, 0.82, 0.25);        // retour unique
    else if (rn <= 1u) c = vec3(0.3, 0.85, 0.45);   // premier de plusieurs
    else if (rn >= nr) c = vec3(0.95, 0.35, 0.35);  // dernier
    else c = vec3(0.35, 0.6, 1.0);                  // intermédiaire
  }
  vColor = c;
}`;

const POINT_FS = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  if (dot(c, c) > 1.0) discard;
  outColor = vec4(vColor, 1.0);
}`;

const SCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Eye-Dome Lighting : assombrit chaque pixel selon l'écart (en log de profondeur) avec ses voisins.
const EDL_FS = `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uStrength;
uniform float uRadius;
uniform int uEnabled;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
in vec2 vUv;
out vec4 outColor;
float logDepth(float d) {
  float z = d * 2.0 - 1.0;
  float lin = (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  return log2(max(lin, 1e-6));
}
void main() {
  float d = texture(uDepth, vUv).r;
  vec3 bg = mix(uBgBottom, uBgTop, vUv.y);
  if (d >= 1.0) { outColor = vec4(bg, 1.0); return; }
  vec3 col = texture(uColor, vUv).rgb;
  if (uEnabled == 1) {
    float ld = logDepth(d);
    float sum = 0.0;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7853982;
      float dn = texture(uDepth, vUv + vec2(cos(a), sin(a)) * uRadius * uTexel).r;
      if (dn < 1.0) sum += max(0.0, ld - logDepth(dn));
    }
    col *= exp(-sum / 8.0 * 300.0 * uStrength);
  }
  outColor = vec4(col, 1.0);
}`;

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtNum = (v, d = 2) => v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Tas binaire (priorité maximale en tête) pour parcourir l'octree du plus grand nœud à l'écran au plus petit. */
class MaxHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item, priority) {
    const a = this.items;
    a.push({ item, priority });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].priority >= a[i].priority) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].priority > a[m].priority) m = l;
        if (r < a.length && a[r].priority > a[m].priority) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.item;
  }
}

export class LidarEngine {
  /**
   * @param {HTMLElement} container  élément qui reçoit le canvas (il doit avoir une taille)
   * @param {object} options
   *   maxPoints      points chargés au maximum (au-delà, un point sur n) — défaut 25 millions
   *   lazWasmBase    dossier où trouver laz-perf.wasm si le bundler ne le place pas à côté du module
   *   createWorker   fabrique de Worker personnalisée (sinon ./lidar.worker.js)
   *   background     [haut, bas] en hexadécimal
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = { maxPoints: 25_000_000, lazWasmBase: '', background: ['#18213a', '#05070d'], ...options };
    this.listeners = new Map();
    this.settings = {
      colorMode: 'rgb',
      gradient: 'turbo',
      pointSize: 2,
      sizeMode: 'adaptive',
      pointBudget: 3_000_000,
      edl: true,
      edlStrength: 0.8,
      edlRadius: 1.4,
      intensityGamma: 0.75,
      zRange: null,               // [min, max] relatifs : filtre et étendue du dégradé
      classVisible: new Uint8Array(256).fill(1),
      tool: 'info',               // 'info' | 'measure' | 'none'
    };
    this.cloud = null;
    this.nodes = [];
    this.visible = [];
    this.gpuPoints = 0;
    this.measure = [];
    this.marker = null;
    this.dirty = true;
    this.frameIndex = 0;
    this.stats = { fps: 0, points: 0, nodes: 0, gpuPoints: 0 };
    this.requestId = 0;

    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'Nuage de points 3D');
    Object.assign(this.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none', outline: 'none', cursor: 'grab' });
    this.overlay = document.createElement('canvas');
    Object.assign(this.overlay.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    container.append(this.canvas, this.overlay);
    this.ctx = this.overlay.getContext('2d');

    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) {
      this.canvas.remove();
      this.overlay.remove();
      throw new Error('WebGL 2 n’est pas disponible sur ce navigateur ou cet appareil.');
    }
    this.gl = gl;
    this.initGL();

    this.camera = { target: [0, 0, 0], yaw: -Math.PI / 2, pitch: 0.7, distance: 100 };
    this.goal = { ...this.camera, target: [0, 0, 0] };
    this.sceneRadius = 100;
    this.view = mat4();
    this.proj = mat4();
    this.viewProj = mat4();

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.lastTime = performance.now();
    this.fpsWindow = { start: this.lastTime, frames: 0 };
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  // ---------------------------------------------------------------- Événements

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (error) { console.error(error); }
    });
  }

  // ---------------------------------------------------------------- Chargement

  /**
   * Charge un nuage LAS ou LAZ.
   * @param {File|Blob|ArrayBuffer|string} source  fichier, données ou URL
   * @returns {Promise<object>} informations sur le nuage (voir `info`)
   */
  async load(source, { name } = {}) {
    const requestId = ++this.requestId;
    this.emit('progress', { phase: 'Lecture du fichier', ratio: 0 });
    let buffer;
    if (typeof source === 'string') {
      buffer = await this.fetchWithProgress(source, requestId);
      name = name || decodeURIComponent(source.split('/').pop().split('?')[0]) || 'nuage';
    } else if (source instanceof ArrayBuffer) {
      buffer = source;
    } else if (source && typeof source.arrayBuffer === 'function') {
      buffer = await source.arrayBuffer();
      name = name || source.name;
    } else {
      throw new Error('Source non reconnue : attendu un fichier, un ArrayBuffer ou une URL.');
    }
    if (requestId !== this.requestId) throw new Error('Chargement remplacé par un autre.');

    this.worker?.terminate();
    this.worker = this.options.createWorker
      ? this.options.createWorker()
      : new Worker(new URL('./lidar.worker.js', import.meta.url), { type: 'module' });
    const worker = this.worker;

    return new Promise((resolve, reject) => {
      const fail = (message) => {
        const error = new Error(message);
        this.emit('error', error);
        reject(error);
      };
      worker.onerror = (e) => fail(e.message || 'Erreur dans le worker de chargement.');
      worker.onmessage = (event) => {
        const msg = event.data;
        if (msg.id !== requestId) return;
        if (msg.type === 'progress') this.emit('progress', { phase: msg.phase, ratio: msg.ratio });
        else if (msg.type === 'header') this.emit('header', msg.header);
        else if (msg.type === 'error') fail(msg.message);
        else if (msg.type === 'done') {
          this.setCloud(msg.result, name || msg.result.name || 'nuage');
          worker.terminate();
          if (this.worker === worker) this.worker = null;
          resolve(this.info);
        }
      };
      worker.postMessage({
        type: 'load', id: requestId, buffer, name,
        maxPoints: this.options.maxPoints, lazWasmBase: this.options.lazWasmBase,
      }, [buffer]);
    });
  }

  async fetchWithProgress(url, requestId) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Téléchargement impossible (${response.status} ${response.statusText}).`);
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body || !total) return response.arrayBuffer();
    const reader = response.body.getReader();
    const out = new Uint8Array(total);
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (requestId !== this.requestId) { reader.cancel(); throw new Error('Chargement remplacé par un autre.'); }
      if (received + value.length > out.length) return new Blob([out.subarray(0, received), value]).arrayBuffer(); // taille annoncée fausse
      out.set(value, received);
      received += value.length;
      this.emit('progress', { phase: 'Téléchargement', ratio: received / total });
    }
    return out.buffer.slice(0, received);
  }

  setCloud(result, name) {
    this.clearCloud();
    const { nodes, ...rest } = result;
    this.nodes = nodes.map((n) => ({
      ...n,
      center: [n.min[0] + n.size / 2, n.min[1] + n.size / 2, n.min[2] + n.size / 2],
      radius: (n.size * Math.sqrt(3)) / 2,
      gpu: null,
      lastUsed: -1,
    }));
    const { min, max } = rest.bounds;
    this.sceneRadius = Math.max(1e-3, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    this.cloud = { ...rest, name };
    this.settings.zRange = [min[2], max[2]];
    this.settings.classVisible.fill(1);
    if (!rest.hasRgb && this.settings.colorMode === 'rgb') this.settings.colorMode = 'elevation';
    this.updateClassTexture();
    this.fitView(true);
    this.emit('loaded', this.info);
    this.invalidate();
  }

  clearCloud() {
    for (const node of this.nodes) this.freeNode(node);
    this.nodes = [];
    this.visible = [];
    this.cloud = null;
    this.measure = [];
    this.marker = null;
    this.gpuPoints = 0;
    this.invalidate();
  }

  /** Informations sur le nuage chargé, en coordonnées réelles. */
  get info() {
    const c = this.cloud;
    if (!c) return null;
    const abs = (v) => v.map((x, i) => x + c.center[i]);
    return {
      name: c.name,
      pointCount: c.pointCount,
      filePointCount: c.filePointCount,
      stride: c.stride,
      hasRgb: c.hasRgb,
      version: c.header.version,
      pointFormat: c.header.pointFormat,
      compressed: c.header.compressed,
      crs: c.header.crs,
      crsLabel: c.header.crsLabel,
      software: c.header.software,
      center: c.center,
      min: abs(c.bounds.min),
      max: abs(c.bounds.max),
      intensityRange: c.intensityRange,
      classCounts: c.classCounts,
      nodeCount: this.nodes.length,
      maxDepth: c.maxDepth,
      timings: c.timings,
      settings: this.getSettings(),
    };
  }

  getSettings() {
    const s = this.settings;
    const z0 = this.cloud?.center[2] ?? 0;
    return {
      colorMode: s.colorMode, gradient: s.gradient, pointSize: s.pointSize, sizeMode: s.sizeMode,
      pointBudget: s.pointBudget, edl: s.edl, edlStrength: s.edlStrength, tool: s.tool,
      zRange: s.zRange ? [s.zRange[0] + z0, s.zRange[1] + z0] : null,
    };
  }

  // ---------------------------------------------------------------- Réglages

  setColorMode(mode) { if (COLOR_MODES[mode] !== undefined) { this.settings.colorMode = mode; this.invalidate(); } }
  setGradient(name) { this.settings.gradient = name; this.updateGradientTexture(); this.invalidate(); }
  setPointSize(size) { this.settings.pointSize = clamp(Number(size) || 1, 0.5, 20); this.invalidate(); }
  setSizeMode(mode) { this.settings.sizeMode = mode === 'fixed' ? 'fixed' : 'adaptive'; this.invalidate(); }
  setPointBudget(points) { this.settings.pointBudget = clamp(Math.round(points), 100_000, 50_000_000); this.invalidate(); }
  setEDL(on) { this.settings.edl = Boolean(on); this.invalidate(); }
  setEDLStrength(v) { this.settings.edlStrength = clamp(Number(v) || 0, 0, 5); this.invalidate(); }
  setIntensityGamma(v) { this.settings.intensityGamma = clamp(Number(v) || 1, 0.2, 3); this.invalidate(); }

  /** Plage d'altitude affichée (coordonnées réelles) : filtre les points et règle le dégradé. */
  setZRange([zMin, zMax]) {
    if (!this.cloud) return;
    const z0 = this.cloud.center[2];
    this.settings.zRange = [Math.min(zMin, zMax) - z0, Math.max(zMin, zMax) - z0];
    this.invalidate();
  }

  setClassVisible(classification, visible) {
    this.settings.classVisible[classification] = visible ? 1 : 0;
    this.updateClassTexture();
    this.invalidate();
  }

  setAllClassesVisible(visible) {
    this.settings.classVisible.fill(visible ? 1 : 0);
    this.updateClassTexture();
    this.invalidate();
  }

  setTool(tool) {
    this.settings.tool = ['info', 'measure', 'none'].includes(tool) ? tool : 'info';
    this.canvas.style.cursor = this.settings.tool === 'measure' ? 'crosshair' : 'grab';
    this.invalidate();
  }

  clearMeasurements() { this.measure = []; this.emit('measure', this.measureSummary()); this.invalidate(); }
  clearSelection() { this.marker = null; this.emit('pick', null); this.invalidate(); }

  // ---------------------------------------------------------------- Caméra

  /** Distance qui fait tenir l'emprise horizontale du nuage à l'écran, quel que soit le format de la fenêtre. */
  fitDistance(margin = 1) {
    const { min, max } = this.cloud.bounds;
    const half = Math.max(max[0] - min[0], max[1] - min[1], (max[2] - min[2]) * 0.5) / 2;
    const tan = Math.tan(FOV / 2);
    const aspect = this.cssWidth / Math.max(1, this.cssHeight);
    return Math.max(this.sceneRadius * 0.05, (half / Math.min(tan, tan * aspect)) * margin + (max[2] - min[2]) / 2);
  }

  fitView(immediate = false) {
    if (!this.cloud) return;
    const { min, max } = this.cloud.bounds;
    const target = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
    this.setGoal({ target, yaw: -Math.PI / 2 - 0.5, pitch: 0.6, distance: this.fitDistance(0.95) }, immediate);
  }

  topView() {
    if (!this.cloud) return;
    const { min, max } = this.cloud.bounds;
    const target = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
    this.setGoal({ target, yaw: -Math.PI / 2, pitch: Math.PI / 2 - 0.001, distance: this.fitDistance(1.05) });
  }

  resetView() { this.fitView(false); }

  setGoal(goal, immediate = false) {
    this.goal = { ...this.goal, ...goal, target: (goal.target || this.goal.target).slice() };
    this.goal.pitch = clamp(this.goal.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
    this.goal.distance = clamp(this.goal.distance, this.sceneRadius * 1e-4, this.sceneRadius * 40);
    if (immediate) this.camera = { ...this.goal, target: this.goal.target.slice() };
    this.invalidate();
  }

  eyeOf(cam) {
    const cp = Math.cos(cam.pitch);
    return [
      cam.target[0] + cam.distance * cp * Math.cos(cam.yaw),
      cam.target[1] + cam.distance * cp * Math.sin(cam.yaw),
      cam.target[2] + cam.distance * Math.sin(cam.pitch),
    ];
  }

  /** Repère de la caméra (droite, haut, avant) pour un état donné. */
  basisOf(cam) {
    const eye = this.eyeOf(cam);
    const v = lookAt(mat4(), eye, cam.target, [0, 0, 1]);
    return { eye, right: [v[0], v[4], v[8]], up: [v[1], v[5], v[9]], forward: [-v[2], -v[6], -v[10]] };
  }

  updateCamera(dt) {
    const k = 1 - Math.exp(-dt * 16);
    const c = this.camera, g = this.goal;
    let moving = false;
    const step = (a, b, eps) => {
      const d = b - a;
      if (Math.abs(d) > eps) moving = true;
      return Math.abs(d) > eps ? a + d * k : b;
    };
    const eps = this.sceneRadius * 1e-6;
    c.yaw = step(c.yaw, g.yaw, 1e-5);
    c.pitch = step(c.pitch, g.pitch, 1e-5);
    c.distance = step(c.distance, g.distance, eps);
    c.target = c.target.map((v, i) => step(v, g.target[i], eps));
    return moving;
  }

  // ---------------------------------------------------------------- Interactions

  bindEvents() {
    const el = this.canvas;
    const pointers = new Map();
    let gesture = null;
    let lastTap = 0;

    const local = (e) => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    this.handlers = {
      pointerdown: (e) => {
        el.focus({ preventScroll: true });
        el.setPointerCapture(e.pointerId);
        const [x, y] = local(e);
        pointers.set(e.pointerId, { x, y });
        if (pointers.size === 1) {
          const pan = e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
          gesture = { mode: pan ? 'pan' : 'rotate', startX: x, startY: y, t: performance.now(), moved: 0, button: e.button, touch: e.pointerType === 'touch' };
          if (this.settings.tool !== 'measure') el.style.cursor = 'grabbing';
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          gesture = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2], moved: 99 };
        }
      },
      pointermove: (e) => {
        if (!pointers.has(e.pointerId) || !gesture) return;
        const [x, y] = local(e);
        const prev = pointers.get(e.pointerId);
        const dx = x - prev.x, dy = y - prev.y;
        pointers.set(e.pointerId, { x, y });
        if (gesture.mode === 'pinch' && pointers.size >= 2) {
          const [a, b] = [...pointers.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
          if (dist > 0 && gesture.dist > 0) this.zoomAt(mid[0], mid[1], gesture.dist / dist);
          this.pan(mid[0] - gesture.mid[0], mid[1] - gesture.mid[1]);
          gesture.dist = dist;
          gesture.mid = mid;
          return;
        }
        gesture.moved += Math.abs(dx) + Math.abs(dy);
        if (gesture.mode === 'pan') this.pan(dx, dy);
        else this.rotate(dx, dy);
      },
      pointerup: (e) => {
        if (!pointers.has(e.pointerId)) return;
        const [x, y] = local(e);
        pointers.delete(e.pointerId);
        el.releasePointerCapture?.(e.pointerId);
        if (gesture && pointers.size === 0) {
          const isClick = gesture.moved < 6 && performance.now() - gesture.t < 500 && gesture.mode !== 'pinch' && gesture.button === 0;
          if (isClick) {
            const now = performance.now();
            if (gesture.touch && now - lastTap < 320) this.focusAt(x, y); // double tape
            else this.handleClick(x, y);
            lastTap = now;
          }
          gesture = null;
          el.style.cursor = this.settings.tool === 'measure' ? 'crosshair' : 'grab';
        } else if (pointers.size === 1) {
          const [p] = [...pointers.values()];
          gesture = { mode: 'rotate', startX: p.x, startY: p.y, t: 0, moved: 99, button: 0 };
        }
      },
      dblclick: (e) => {
        const [x, y] = local(e);
        this.focusAt(x, y);
      },
      wheel: (e) => {
        e.preventDefault();
        const [x, y] = local(e);
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.cssHeight : 1;
        const delta = clamp(e.deltaY * unit, -400, 400);
        this.zoomAt(x, y, Math.exp(delta * 0.0013));
      },
      contextmenu: (e) => e.preventDefault(),
      keydown: (e) => {
        const step = e.shiftKey ? 0.2 : 0.06;
        const used = {
          ArrowLeft: () => this.rotate(-step * 160, 0),
          ArrowRight: () => this.rotate(step * 160, 0),
          ArrowUp: () => this.rotate(0, -step * 160),
          ArrowDown: () => this.rotate(0, step * 160),
          '+': () => this.zoomAt(this.cssWidth / 2, this.cssHeight / 2, 0.85),
          '=': () => this.zoomAt(this.cssWidth / 2, this.cssHeight / 2, 0.85),
          '-': () => this.zoomAt(this.cssWidth / 2, this.cssHeight / 2, 1.18),
          r: () => this.resetView(),
          t: () => this.topView(),
          m: () => this.setTool(this.settings.tool === 'measure' ? 'info' : 'measure'),
          Escape: () => { this.clearMeasurements(); this.clearSelection(); },
        }[e.key];
        if (used) { e.preventDefault(); used(); }
      },
      contextlost: (e) => { e.preventDefault(); this.contextLost = true; },
      contextrestored: () => {
        this.contextLost = false;
        for (const node of this.nodes) node.gpu = null;
        this.gpuPoints = 0;
        this.initGL();
        this.resize();
      },
    };
    const h = this.handlers;
    el.addEventListener('pointerdown', h.pointerdown);
    el.addEventListener('pointermove', h.pointermove);
    el.addEventListener('pointerup', h.pointerup);
    el.addEventListener('pointercancel', h.pointerup);
    el.addEventListener('dblclick', h.dblclick);
    el.addEventListener('wheel', h.wheel, { passive: false });
    el.addEventListener('contextmenu', h.contextmenu);
    el.addEventListener('keydown', h.keydown);
    el.addEventListener('webglcontextlost', h.contextlost);
    el.addEventListener('webglcontextrestored', h.contextrestored);
  }

  rotate(dx, dy) {
    this.setGoal({ yaw: this.goal.yaw - dx * 0.0065, pitch: this.goal.pitch + dy * 0.0065 });
  }

  pan(dx, dy) {
    const { right, up } = this.basisOf(this.goal);
    const scale = (2 * this.goal.distance * Math.tan(FOV / 2)) / Math.max(1, this.cssHeight);
    const t = this.goal.target.map((v, i) => v - right[i] * dx * scale + up[i] * dy * scale);
    this.setGoal({ target: t });
  }

  /** Zoom vers le point de l'écran (x, y) : le point sous le curseur reste sous le curseur. */
  zoomAt(x, y, factor) {
    const g = this.goal;
    const { eye, right, up, forward } = this.basisOf(g);
    const aspect = this.cssWidth / Math.max(1, this.cssHeight);
    const tan = Math.tan(FOV / 2);
    const nx = (x / Math.max(1, this.cssWidth)) * 2 - 1;
    const ny = 1 - (y / Math.max(1, this.cssHeight)) * 2;
    const dir = forward.map((f, i) => f + right[i] * nx * tan * aspect + up[i] * ny * tan);
    const len = Math.hypot(...dir);
    const d = dir.map((v) => v / len);
    const along = g.distance / Math.max(1e-6, d[0] * forward[0] + d[1] * forward[1] + d[2] * forward[2]);
    const p = eye.map((v, i) => v + d[i] * along);
    const newDistance = clamp(g.distance * factor, this.sceneRadius * 1e-4, this.sceneRadius * 40);
    const f = newDistance / g.distance;
    this.setGoal({ target: g.target.map((v, i) => p[i] + (v - p[i]) * f), distance: newDistance });
  }

  /** Recentre la rotation sur le point sous le curseur. */
  focusAt(x, y) {
    const hit = this.pick(x, y);
    if (!hit) return;
    this.setGoal({ target: hit.local, distance: Math.min(this.goal.distance, Math.max(this.sceneRadius * 0.02, this.goal.distance * 0.6)) });
  }

  handleClick(x, y) {
    if (!this.cloud) return;
    const tool = this.settings.tool;
    if (tool === 'none') return;
    const hit = this.pick(x, y);
    if (tool === 'measure') {
      if (!hit) return;
      this.measure.push(hit.local);
      this.emit('measure', this.measureSummary());
    } else {
      this.marker = hit ? hit.local : null;
      this.emit('pick', hit ? hit.info : null);
    }
    this.invalidate();
  }

  measureSummary() {
    const pts = this.measure;
    const segments = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      segments.push({
        length: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
        horizontal: Math.hypot(b[0] - a[0], b[1] - a[1]),
        dz: b[2] - a[2],
      });
    }
    return {
      points: pts.length,
      segments,
      total: segments.reduce((s, x) => s + x.length, 0),
      totalHorizontal: segments.reduce((s, x) => s + x.horizontal, 0),
    };
  }

  /**
   * Point affiché le plus proche de la caméra sous le curseur (rayon en px CSS).
   * Parcourt seulement les nœuds dessinés à l'image courante, avec les mêmes filtres que le rendu.
   */
  pick(x, y, radius = 9) {
    if (!this.cloud || !this.visible.length) return null;
    const m = this.viewProj;
    const W = this.cssWidth, H = this.cssHeight;
    const r2 = radius * radius;
    const [z0, z1] = this.settings.zRange;
    const visibleClass = this.settings.classVisible;
    let best = null;
    let bestScore = Infinity;
    for (const node of this.visible) {
      const s = project(m, node.center[0], node.center[1], node.center[2], W, H);
      if (s) {
        // Rejet rapide : nœud entier loin du curseur.
        const pr = (node.radius * this.projScaleCss) / s.w;
        if (Math.hypot(s.x - x, s.y - y) > pr + radius) continue;
      }
      const pos = node.pos, rgbc = node.rgbc;
      for (let i = 0; i < node.count; i++) {
        const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
        if (pz < z0 || pz > z1 || !visibleClass[rgbc[i * 4 + 3]]) continue;
        const w = m[3] * px + m[7] * py + m[11] * pz + m[15];
        if (w <= 0) continue;
        const sx = ((m[0] * px + m[4] * py + m[8] * pz + m[12]) / w * 0.5 + 0.5) * W;
        const sy = (1 - ((m[1] * px + m[5] * py + m[9] * pz + m[13]) / w * 0.5 + 0.5)) * H;
        const d2 = (sx - x) * (sx - x) + (sy - y) * (sy - y);
        if (d2 > r2) continue;
        const score = w * (1 + (0.15 * d2) / r2); // le plus proche de la caméra, puis du curseur
        if (score < bestScore) { bestScore = score; best = { node, i }; }
      }
    }
    if (!best) return null;
    const { node, i } = best;
    const local = [node.pos[i * 3], node.pos[i * 3 + 1], node.pos[i * 3 + 2]];
    const c = this.cloud.center;
    const ret = node.iret[i * 2 + 1];
    return {
      local,
      info: {
        x: local[0] + c[0], y: local[1] + c[1], z: local[2] + c[2],
        classification: node.rgbc[i * 4 + 3],
        intensity: node.iret[i * 2],
        returnNumber: ret & 15,
        numberOfReturns: ret >> 4,
        rgb: this.cloud.hasRgb ? [node.rgbc[i * 4], node.rgbc[i * 4 + 1], node.rgbc[i * 4 + 2]] : null,
        level: node.level,
      },
    };
  }

  // ---------------------------------------------------------------- WebGL

  initGL() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader : ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const program = (vs, fs, names) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Programme : ${gl.getProgramInfoLog(p)}`);
      const u = {};
      for (const n of names) u[n] = gl.getUniformLocation(p, n);
      return { program: p, u };
    };
    this.pointProgram = program(POINT_VS, POINT_FS, [
      'uViewProj', 'uColorMode', 'uSizeMode', 'uPointSize', 'uMinSize', 'uMaxSize', 'uProjScale', 'uRootSpacing',
      'uNodeMin', 'uNodeSize', 'uVnIndex', 'uVisibleNodes', 'uZRange', 'uIntensityRange', 'uIntensityGamma', 'uGradient', 'uClasses',
    ]);
    this.edlProgram = program(SCREEN_VS, EDL_FS, [
      'uColor', 'uDepth', 'uTexel', 'uNear', 'uFar', 'uStrength', 'uRadius', 'uEnabled', 'uBgTop', 'uBgBottom',
    ]);
    this.emptyVao = gl.createVertexArray();

    const lutTexture = (filter) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.gradientTexture = lutTexture(gl.LINEAR);
    this.classTexture = lutTexture(gl.NEAREST);
    this.visibleNodesTexture = lutTexture(gl.NEAREST);
    this.updateGradientTexture();
    this.updateClassTexture();
    this.fbo = null;
  }

  updateGradientTexture() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.gradientTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, gradientLut(this.settings.gradient));
  }

  updateClassTexture() {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.classTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, classLut(this.settings.classVisible));
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const coarse = matchMedia?.('(pointer: coarse)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    const w = Math.max(1, Math.round(this.cssWidth * this.dpr));
    const h = Math.max(1, Math.round(this.cssHeight * this.dpr));
    for (const c of [this.canvas, this.overlay]) {
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
    }
    this.width = w;
    this.height = h;
    this.createFramebuffer(w, h);
    this.invalidate();
  }

  createFramebuffer(w, h) {
    const gl = this.gl;
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo.fb);
      gl.deleteTexture(this.fbo.color);
      gl.deleteTexture(this.fbo.depth);
    }
    const tex = (internal, format, type) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
      return t;
    };
    const color = tex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const depth = tex(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`Framebuffer incomplet (${status}).`);
    this.fbo = { fb, color, depth };
  }

  uploadNode(node) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = (data) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    };
    const pos = buffer(node.pos);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const rgbc = buffer(node.rgbc);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 4, gl.UNSIGNED_BYTE, 0, 0);
    const iret = buffer(node.iret);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribIPointer(2, 2, gl.UNSIGNED_SHORT, 0, 0);
    gl.bindVertexArray(null);
    node.gpu = { vao, buffers: [pos, rgbc, iret] };
    this.gpuPoints += node.count;
  }

  freeNode(node) {
    if (!node.gpu) return;
    const gl = this.gl;
    gl.deleteVertexArray(node.gpu.vao);
    node.gpu.buffers.forEach((b) => gl.deleteBuffer(b));
    node.gpu = null;
    this.gpuPoints -= node.count;
  }

  /** Nœuds à afficher : du plus grand à l'écran au plus petit, dans le tronc de vision, jusqu'au budget. */
  selectNodes(eye) {
    if (!this.nodes.length) return [];
    const planes = frustumPlanes(this.viewProj);
    const heap = new MaxHeap();
    heap.push(this.nodes[0], Infinity);
    const selected = [];
    let remaining = this.settings.pointBudget;
    while (heap.size) {
      const node = heap.pop();
      if (!sphereInFrustum(planes, node.center, node.radius)) continue;
      if (node.count > remaining && selected.length) continue;
      selected.push(node);
      remaining -= node.count;
      for (const index of node.children) {
        if (index < 0) continue;
        const child = this.nodes[index];
        const dist = Math.hypot(child.center[0] - eye[0], child.center[1] - eye[1], child.center[2] - eye[2]);
        const screen = dist <= child.radius ? Infinity : (child.radius * this.projScaleCss) / (dist - child.radius);
        if (screen >= MIN_NODE_PX) heap.push(child, screen);
      }
    }
    return selected;
  }

  invalidate() { this.dirty = true; }

  loop(time) {
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    if (this.contextLost) return;
    const moving = this.updateCamera(dt);
    if (moving) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.render();
    this.fpsWindow.frames++;
    if (time - this.fpsWindow.start > 500) {
      this.stats.fps = Math.round((this.fpsWindow.frames * 1000) / (time - this.fpsWindow.start));
      this.fpsWindow = { start: time, frames: 0 };
      this.emit('stats', { ...this.stats });
    }
  }

  render() {
    const gl = this.gl;
    const cam = this.camera;
    const eye = this.eyeOf(cam);
    const aspect = this.width / this.height;
    const near = Math.max(cam.distance * 0.004, this.sceneRadius * 1e-7);
    const far = cam.distance + this.sceneRadius * 4;
    lookAt(this.view, eye, cam.target, [0, 0, 1]);
    perspective(this.proj, FOV, aspect, near, far);
    multiply(this.viewProj, this.proj, this.view);
    this.projScaleCss = this.cssHeight / (2 * Math.tan(FOV / 2));
    const projScalePx = this.height / (2 * Math.tan(FOV / 2));

    // Niveaux de détail et envoi progressif au GPU.
    const selected = this.selectNodes(eye);
    let uploads = 0;
    const drawn = [];
    for (const node of selected) {
      if (!node.gpu) {
        if (uploads >= UPLOADS_PER_FRAME) { this.dirty = true; continue; }
        this.uploadNode(node);
        uploads++;
      }
      node.lastUsed = this.frameIndex;
      drawn.push(node);
    }
    this.visible = drawn;
    this.evict();

    // Passe 1 : points dans le framebuffer (couleur + profondeur).
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo.fb);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let points = 0;
    if (drawn.length) {
      const { program, u } = this.pointProgram;
      const s = this.settings;
      gl.useProgram(program);
      gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj);
      gl.uniform1i(u.uColorMode, COLOR_MODES[s.colorMode]);
      gl.uniform1i(u.uSizeMode, s.sizeMode === 'adaptive' ? 1 : 0);
      gl.uniform1f(u.uPointSize, s.sizeMode === 'adaptive' ? s.pointSize * 0.7 : s.pointSize * this.dpr);
      gl.uniform1f(u.uMinSize, Math.max(1, (s.sizeMode === 'adaptive' ? 1.5 : 1) * this.dpr));
      gl.uniform1f(u.uMaxSize, 32 * this.dpr);
      gl.uniform1f(u.uProjScale, projScalePx);
      gl.uniform1f(u.uRootSpacing, this.nodes[0].spacing);
      gl.uniform2f(u.uZRange, s.zRange[0], s.zRange[1]);
      gl.uniform2f(u.uIntensityRange, this.cloud.intensityRange[0], this.cloud.intensityRange[1]);
      gl.uniform1f(u.uIntensityGamma, s.intensityGamma);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.gradientTexture);
      gl.uniform1i(u.uGradient, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.classTexture);
      gl.uniform1i(u.uClasses, 1);
      const vnIndex = this.updateVisibleNodesTexture(drawn);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.visibleNodesTexture);
      gl.uniform1i(u.uVisibleNodes, 2);

      // De l'avant vers l'arrière : le test de profondeur élimine plus tôt les points cachés.
      const order = drawn.slice().sort((a, b) => (
        Math.hypot(a.center[0] - eye[0], a.center[1] - eye[1], a.center[2] - eye[2])
        - Math.hypot(b.center[0] - eye[0], b.center[1] - eye[1], b.center[2] - eye[2])
      ));
      for (const node of order) {
        gl.uniform3f(u.uNodeMin, node.min[0], node.min[1], node.min[2]);
        gl.uniform1f(u.uNodeSize, node.size);
        gl.uniform1i(u.uVnIndex, vnIndex.get(node));
        gl.bindVertexArray(node.gpu.vao);
        gl.drawArrays(gl.POINTS, 0, node.count);
        points += node.count;
      }
      gl.bindVertexArray(null);
    }

    // Passe 2 : ombrage EDL et fond, vers l'écran.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.disable(gl.DEPTH_TEST);
    const { program, u } = this.edlProgram;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fbo.color);
    gl.uniform1i(u.uColor, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.fbo.depth);
    gl.uniform1i(u.uDepth, 1);
    gl.uniform2f(u.uTexel, 1 / this.width, 1 / this.height);
    gl.uniform1f(u.uNear, near);
    gl.uniform1f(u.uFar, far);
    gl.uniform1f(u.uStrength, this.settings.edlStrength);
    gl.uniform1f(u.uRadius, this.settings.edlRadius * this.dpr);
    gl.uniform1i(u.uEnabled, this.settings.edl ? 1 : 0);
    const [top, bottom] = this.options.background.map(hexToRgb);
    gl.uniform3f(u.uBgTop, ...top);
    gl.uniform3f(u.uBgBottom, ...bottom);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    this.drawOverlay();
    this.frameIndex++;
    this.stats = { ...this.stats, points, nodes: drawn.length, gpuPoints: this.gpuPoints, budget: this.settings.pointBudget };
  }

  /**
   * Hiérarchie des nœuds dessinés, pour la taille adaptative : ordre par niveau puis par clé (les enfants d'un même
   * parent sont contigus et rangés par octant), un texel par nœud.
   */
  updateVisibleNodesTexture(drawn) {
    const gl = this.gl;
    const order = drawn.slice().sort((a, b) => a.level - b.level || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const index = new Map(order.map((node, i) => [node, i]));
    const rootSpacing = this.nodes[0].spacing;
    const width = 2048;
    const height = Math.max(1, Math.ceil(order.length / width));
    const data = new Uint8Array(width * height * 4);
    order.forEach((node, i) => {
      let mask = 0;
      let first = -1;
      node.children.forEach((c, octant) => {
        if (c < 0) return;
        const j = index.get(this.nodes[c]);
        if (j === undefined) return;
        mask |= 1 << octant;
        if (first < 0 || j < first) first = j;
      });
      data[i * 4] = mask;
      data[i * 4 + 1] = first < 0 ? 0 : first & 255;
      data[i * 4 + 2] = first < 0 ? 0 : (first >> 8) & 255;
      data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(Math.log2(rootSpacing / node.spacing))));
    });
    gl.activeTexture(gl.TEXTURE2); // unité dédiée : ne pas écraser les palettes liées aux unités 0 et 1
    gl.bindTexture(gl.TEXTURE_2D, this.visibleNodesTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return index;
  }

  /** Libère la mémoire GPU des nœuds non affichés depuis le plus longtemps au-delà du cache autorisé. */
  evict() {
    const limit = this.settings.pointBudget * GPU_POINT_FACTOR;
    if (this.gpuPoints <= limit) return;
    const candidates = this.nodes.filter((n) => n.gpu && n.lastUsed < this.frameIndex).sort((a, b) => a.lastUsed - b.lastUsed);
    for (const node of candidates) {
      if (this.gpuPoints <= limit) break;
      this.freeNode(node);
    }
  }

  drawOverlay() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    if (!this.cloud) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const W = this.cssWidth, H = this.cssHeight;
    const proj = (p) => project(this.viewProj, p[0], p[1], p[2], W, H);

    const label = (text, x, y) => {
      ctx.font = '600 12px system-ui, -apple-system, Segoe UI, sans-serif';
      const w = ctx.measureText(text).width + 12;
      ctx.fillStyle = 'rgba(8, 12, 22, 0.82)';
      ctx.strokeStyle = 'rgba(79, 195, 247, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - w / 2, y - 11, w, 22, 6) : ctx.rect(x - w / 2, y - 11, w, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e8f6ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + 0.5);
    };

    // Mesure : polyligne, longueur de chaque segment au milieu, total au dernier point.
    if (this.measure.length) {
      const pts = this.measure.map(proj);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#4fc3f7';
      ctx.shadowColor = 'rgba(79, 195, 247, 0.8)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      let started = false;
      pts.forEach((p) => {
        if (!p) { started = false; return; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      pts.forEach((p) => {
        if (!p) return;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4fc3f7';
        ctx.stroke();
      });
      const summary = this.measureSummary();
      summary.segments.forEach((s, i) => {
        const a = pts[i], b = pts[i + 1];
        if (a && b) label(`${fmtNum(s.length)} m`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 14);
      });
      const last = pts[pts.length - 1];
      if (last && summary.segments.length > 1) label(`Total ${fmtNum(summary.total)} m`, last.x, last.y + 22);
    }

    // Point sélectionné : réticule.
    if (this.marker) {
      const p = proj(this.marker);
      if (p) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.moveTo(p.x - 13, p.y); ctx.lineTo(p.x - 4, p.y);
        ctx.moveTo(p.x + 4, p.y); ctx.lineTo(p.x + 13, p.y);
        ctx.moveTo(p.x, p.y - 13); ctx.lineTo(p.x, p.y - 4);
        ctx.moveTo(p.x, p.y + 4); ctx.lineTo(p.x, p.y + 13);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  /** Capture PNG de la vue (nuage + mesures), en data URL. */
  screenshot() {
    this.render();
    const out = document.createElement('canvas');
    out.width = this.width;
    out.height = this.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(this.canvas, 0, 0);
    ctx.drawImage(this.overlay, 0, 0);
    return out.toDataURL('image/png');
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.requestId++;
    this.worker?.terminate();
    this.resizeObserver.disconnect();
    const el = this.canvas, h = this.handlers;
    el.removeEventListener('pointerdown', h.pointerdown);
    el.removeEventListener('pointermove', h.pointermove);
    el.removeEventListener('pointerup', h.pointerup);
    el.removeEventListener('pointercancel', h.pointerup);
    el.removeEventListener('dblclick', h.dblclick);
    el.removeEventListener('wheel', h.wheel);
    el.removeEventListener('contextmenu', h.contextmenu);
    el.removeEventListener('keydown', h.keydown);
    el.removeEventListener('webglcontextlost', h.contextlost);
    el.removeEventListener('webglcontextrestored', h.contextrestored);
    const gl = this.gl;
    for (const node of this.nodes) this.freeNode(node);
    if (this.fbo) {
      gl.deleteFramebuffer(this.fbo.fb);
      gl.deleteTexture(this.fbo.color);
      gl.deleteTexture(this.fbo.depth);
    }
    gl.deleteTexture(this.gradientTexture);
    gl.deleteTexture(this.classTexture);
    gl.deleteTexture(this.visibleNodesTexture);
    gl.deleteProgram(this.pointProgram.program);
    gl.deleteProgram(this.edlProgram.program);
    gl.deleteVertexArray(this.emptyVao);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();
    this.overlay.remove();
    this.listeners.clear();
  }
}
