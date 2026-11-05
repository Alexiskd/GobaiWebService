// Couche three.js : nuages LAS / LAZ posés sur le globe terrestre du moteur principal (SolarEngine).
// Chaque nuage arrive du worker en mètres Est-Nord-Haut autour de son centre (option `georeference`) ; un groupe
// « ancre » le place à sa latitude, sa longitude et son altitude dans le repère du maillage de la Terre, qui suit la
// rotation propre. Les points restent en float32 relatifs au centre : la précision est millimétrique malgré
// l'échelle astronomique de la scène (les matrices modèle-vue sont calculées en double précision par three.js).
// Niveaux de détail : octree du worker (échantillonnage de grille, comme Potree), parcouru par taille à l'écran sous
// un budget de points. Géométries créées à la demande, quelques nœuds par image.
import * as THREE from 'three';
import { classLut, gradientLut } from './colormaps.js';

const D = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;
const MIN_NODE_PX = 90;          // taille minimale (px) d'un nœud pour descendre dans ses enfants
const MARKER_BELOW_PX = 14;      // en dessous de cette taille à l'écran, le nuage est remplacé par un repère
const UPLOADS_PER_FRAME = 24;    // nouvelles géométries par image : pas d'à-coup au premier survol
const NOISE_CLASSES = [7, 18];   // bruit bas et haut (ASPRS) : masqués par défaut sur le globe
let sequence = 0;
export const GLOBE_COLOR_MODES = ['rgb', 'elevation', 'intensity', 'classification', 'returns'];

const vertexShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec4 rgbc;   // rouge, vert, bleu, classe (octets normalisés)
attribute vec2 iret;   // intensité, retours (numéro | nombre << 4)
uniform int mode;
uniform vec2 zRange;
uniform vec2 intensityRange;
uniform sampler2D gradient;
uniform sampler2D classes;
uniform float pointSize;
uniform float curvature; // 1 / (2 R) : le plan local épouse la courbure de la Terre
varying vec3 vColor;

void main() {
  float cls = floor(rgbc.a * 255.0 + 0.5);
  vec4 classColor = texture2D(classes, vec2((cls + 0.5) / 256.0, 0.5));
  vec3 p = position;
  p.z -= (p.x * p.x + p.y * p.y) * curvature;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = pointSize;
  if (classColor.a < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; }

  if (mode == 0) {
    vColor = rgbc.rgb;
  } else if (mode == 1) {
    float t = clamp((position.z - zRange.x) / max(zRange.y - zRange.x, 1e-3), 0.0, 1.0);
    vColor = texture2D(gradient, vec2(t, 0.5)).rgb;
  } else if (mode == 2) {
    float t = clamp((iret.x - intensityRange.x) / max(intensityRange.y - intensityRange.x, 1.0), 0.0, 1.0);
    vColor = vec3(pow(t, 0.8));
  } else if (mode == 3) {
    vColor = classColor.rgb;
  } else {
    float rn = mod(iret.y, 16.0);
    float nr = floor(iret.y / 16.0);
    vColor = nr <= 1.0 ? vec3(0.95, 0.82, 0.3)
      : rn <= 1.0 ? vec3(0.3, 0.75, 1.0)
      : rn >= nr ? vec3(1.0, 0.36, 0.3) : vec3(0.42, 0.95, 0.52);
  }
  #include <logdepthbuf_vertex>
}`;

const fragmentShader = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  if (dot(c, c) > 1.0) discard; // points ronds
  gl_FragColor = vec4(vColor, 1.0);
  #include <logdepthbuf_fragment>
}`;

const lutTexture = (data, filter) => {
  const texture = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
  texture.magFilter = filter;
  texture.minFilter = filter;
  texture.needsUpdate = true;
  return texture;
};

/** Direction locale (repère du maillage de la Terre) : même convention que lonLatToVec du moteur. */
function localBasis(lat, lon) {
  const la = lat * D, lo = lon * D;
  const up = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
  const east = new THREE.Vector3(-Math.sin(lo), 0, -Math.cos(lo));
  const north = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo));
  return { up, east, north };
}

/** Altitude locale du sol : classe 2 si présente, sinon 1er centile, sur l'aperçu régulier de la racine. */
function groundLevel(root, fallback) {
  if (!root?.count) return fallback;
  const ground = [];
  const other = [];
  for (let i = 0; i < root.count; i++) {
    const cls = root.rgbc[i * 4 + 3];
    if (NOISE_CLASSES.includes(cls)) continue;
    (cls === 2 ? ground : other).push(root.pos[i * 3 + 2]);
  }
  const list = ground.length > 50 ? ground : other;
  if (!list.length) return fallback;
  list.sort((a, b) => a - b);
  return list[Math.floor(list.length * (ground.length > 50 ? 0.05 : 0.01))];
}

class MaxHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value, priority) {
    const a = this.items;
    a.push({ value, priority });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].priority >= a[i].priority) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
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
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].priority > a[m].priority) m = l;
        if (r < a.length && a[r].priority > a[m].priority) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top.value;
  }
}

export class GlobeLidarLayer {
  /**
   * @param {object} engine  SolarEngine (doit exposer `earth.mesh`, `earth.def.radius`, `cam`, `renderer`)
   * @param {object} [options]  pointBudget (3 M par défaut), pointSize (px CSS)
   */
  constructor(engine, { pointBudget = 3_000_000, pointSize = 2 } = {}) {
    this.engine = engine;
    this.radius = engine.earth.def?.radius || 1;
    this.pointBudget = pointBudget;
    this.pixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.pointSize = pointSize;
    this.clouds = new Map();
    this.root = new THREE.Group();
    this.root.name = 'lidar-globe';
    engine.earth.mesh.add(this.root);
    this.gradient = lutTexture(gradientLut('turbo'), THREE.LinearFilter);
    this.stats = { points: 0, nodes: 0 };
    this.tmp = {
      viewProj: new THREE.Matrix4(), inverse: new THREE.Matrix4(), frustum: new THREE.Frustum(),
      camWorld: new THREE.Vector3(), camLocal: new THREE.Vector3(), sphere: new THREE.Sphere(),
    };
    this.raf = requestAnimationFrame(() => this.loop());
  }

  /**
   * Ajoute un nuage chargé par loadLidarCloud (option georeference).
   * @param {object} result  résultat du worker
   * @param {object} [options]  id, placement { lat, lon, height } si le fichier n'est pas géoréférencé,
   *   colorMode, groundClamp (pose le sol du nuage sur la sphère, défaut true)
   */
  add(result, { id = `lidar-${++sequence}`, placement = null, colorMode, groundClamp = true } = {}) {
    const frame = placement ? { ...result.geo, ...placement } : result.geo;
    if (!frame || !Number.isFinite(frame.lat) || !Number.isFinite(frame.lon)) {
      throw new Error('Nuage sans position géographique : indiquez une latitude et une longitude.');
    }
    const nodes = result.nodes.map((n) => ({
      ...n,
      center: [n.min[0] + n.size / 2, n.min[1] + n.size / 2, n.min[2] + n.size / 2],
      radius: (n.size * Math.sqrt(3)) / 2,
      points: null,
    }));
    const { min, max } = result.bounds;
    const visibleClasses = new Array(256).fill(true);
    NOISE_CLASSES.forEach((c) => { visibleClasses[c] = false; });
    const classes = lutTexture(classLut(visibleClasses), THREE.NearestFilter);
    const mode = colorMode || (result.hasRgb ? 'rgb' : 'elevation');
    const material = new THREE.ShaderMaterial({
      uniforms: {
        mode: { value: Math.max(0, GLOBE_COLOR_MODES.indexOf(mode)) },
        zRange: { value: new THREE.Vector2(min[2], max[2]) },
        intensityRange: { value: new THREE.Vector2(...(result.intensityRange || [0, 65535])) },
        gradient: { value: this.gradient },
        classes: { value: classes },
        pointSize: { value: this.pointSize * this.pixelRatio },
        curvature: { value: 1 / (2 * EARTH_RADIUS_M) },
      },
      vertexShader,
      fragmentShader,
    });
    material.extensions = { fragDepth: true };

    const anchor = new THREE.Group();
    anchor.name = `lidar:${result.name}`;
    this.root.add(anchor);

    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, Math.max(30, max[2] + 20)], 3));
    const marker = new THREE.Points(markerGeometry, new THREE.PointsMaterial({
      color: 0x4fc3f7, size: 9 * this.pixelRatio, sizeAttenuation: false, depthWrite: false, transparent: true,
    }));
    marker.raycast = () => {};
    marker.renderOrder = 2;
    anchor.add(marker);

    const cloud = {
      id, name: result.name, nodes, bounds: result.bounds, frame, groundClamp, visible: true,
      groundZ: groundLevel(result.nodes[0], min[2]), anchor, marker, material, classes, visibleClasses,
      colorMode: mode, hasRgb: result.hasRgb, pointCount: result.pointCount,
    };
    this.clouds.set(id, cloud);
    this.place(cloud);
    return id;
  }

  /** Ancre le nuage : latitude, longitude, altitude (ou sol posé sur la sphère), axes est / nord / haut. */
  place(cloud) {
    const { lat, lon, height = 0 } = cloud.frame;
    const altitude = cloud.groundClamp ? -cloud.groundZ : height;
    const { up, east, north } = localBasis(lat, lon);
    cloud.anchor.position.copy(up).multiplyScalar(this.radius * (1 + altitude / EARTH_RADIUS_M));
    cloud.anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up));
    cloud.anchor.scale.setScalar(this.radius / EARTH_RADIUS_M);
  }

  get(id) { return this.clouds.get(id) || null; }

  setPlacement(id, { lat, lon, height }) {
    const cloud = this.clouds.get(id);
    if (!cloud) return;
    cloud.frame = { ...cloud.frame, lat, lon, ...(Number.isFinite(height) ? { height } : {}) };
    this.place(cloud);
  }

  setGroundClamp(id, on) {
    const cloud = this.clouds.get(id);
    if (!cloud) return;
    cloud.groundClamp = Boolean(on);
    this.place(cloud);
  }

  setColorMode(id, mode) {
    const cloud = this.clouds.get(id);
    const index = GLOBE_COLOR_MODES.indexOf(mode);
    if (!cloud || index < 0) return;
    cloud.colorMode = mode;
    cloud.material.uniforms.mode.value = index;
  }

  setClassVisible(id, classification, visible) {
    const cloud = this.clouds.get(id);
    if (!cloud) return;
    cloud.visibleClasses[classification] = Boolean(visible);
    cloud.classes.image.data.set(classLut(cloud.visibleClasses));
    cloud.classes.needsUpdate = true;
  }

  setVisible(id, visible) {
    const cloud = this.clouds.get(id);
    if (!cloud) return;
    cloud.visible = Boolean(visible);
    cloud.anchor.visible = cloud.visible;
  }

  setPointSize(px) {
    this.pointSize = px;
    for (const cloud of this.clouds.values()) cloud.material.uniforms.pointSize.value = px * this.pixelRatio;
  }

  /** Position géographique et rayon (m) du nuage, pour y amener la caméra. */
  locate(id) {
    const cloud = this.clouds.get(id);
    if (!cloud) return null;
    const { min, max } = cloud.bounds;
    return { lat: cloud.frame.lat, lon: cloud.frame.lon, radiusMeters: Math.hypot(max[0] - min[0], max[1] - min[1]) / 2 };
  }

  remove(id) {
    const cloud = this.clouds.get(id);
    if (!cloud) return;
    this.clouds.delete(id);
    this.root.remove(cloud.anchor);
    cloud.anchor.traverse((o) => {
      o.geometry?.dispose();
      if (o.material && o.material !== cloud.material) o.material.dispose();
    });
    cloud.material.dispose();
    cloud.classes.dispose();
  }

  createPoints(cloud, node) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(node.pos, 3));
    geometry.setAttribute('rgbc', new THREE.BufferAttribute(node.rgbc, 4, true));
    geometry.setAttribute('iret', new THREE.BufferAttribute(node.iret, 2));
    // Sphère englobante connue : pas de parcours des points, et marge pour l'abaissement dû à la courbure.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...node.center), node.radius * 1.05 + 1);
    const points = new THREE.Points(geometry, cloud.material);
    points.raycast = () => {}; // le moteur lance des rayons sur la Terre et ses enfants : pas sur des millions de points
    points.matrixAutoUpdate = false;
    points.visible = false;
    cloud.anchor.add(points);
    node.points = points;
  }

  loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(() => this.loop());
    if (this.engine.stopped || !this.clouds.size) return;
    this.update();
  }

  /** Choix des nœuds affichés : taille à l'écran, tronc de vision, budget de points partagé entre les nuages. */
  update() {
    const { cam, renderer } = this.engine;
    if (!cam) return;
    const t = this.tmp;
    const height = renderer?.domElement?.clientHeight || (typeof window === 'undefined' ? 800 : window.innerHeight);
    const projScale = height / (2 * Math.tan((cam.fov * D) / 2));
    t.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    t.frustum.setFromProjectionMatrix(t.viewProj);
    t.camWorld.setFromMatrixPosition(cam.matrixWorld);
    this.root.updateWorldMatrix(true, true);

    const shown = [...this.clouds.values()].filter((c) => c.visible);
    const budgetPerCloud = this.pointBudget / Math.max(1, shown.length);
    let uploads = 0;
    let points = 0;
    let nodes = 0;
    for (const cloud of shown) {
      const world = cloud.anchor.matrixWorld;
      const scale = world.getMaxScaleOnAxis();
      t.inverse.copy(world).invert();
      t.camLocal.copy(t.camWorld).applyMatrix4(t.inverse);
      const screenOf = (node) => {
        const dist = Math.hypot(node.center[0] - t.camLocal.x, node.center[1] - t.camLocal.y, node.center[2] - t.camLocal.z);
        return dist <= node.radius ? Infinity : (node.radius * projScale) / (dist - node.radius);
      };
      const inView = (node) => {
        t.sphere.center.set(...node.center).applyMatrix4(world);
        t.sphere.radius = node.radius * scale * 1.05;
        return t.frustum.intersectsSphere(t.sphere);
      };

      for (const node of cloud.nodes) node.wanted = false;
      const rootScreen = screenOf(cloud.nodes[0]);
      cloud.marker.visible = rootScreen < MARKER_BELOW_PX;
      if (rootScreen >= 0.5) {
        const heap = new MaxHeap();
        heap.push(cloud.nodes[0], Infinity);
        let remaining = budgetPerCloud;
        let first = true;
        while (heap.size) {
          const node = heap.pop();
          if (!inView(node)) continue;
          if (node.count > remaining && !first) continue;
          first = false;
          if (!node.points) {
            if (uploads >= UPLOADS_PER_FRAME) continue; // la suite viendra aux images suivantes
            this.createPoints(cloud, node);
            uploads++;
          }
          node.wanted = true;
          remaining -= node.count;
          points += node.count;
          nodes++;
          for (const index of node.children) {
            if (index < 0) continue;
            const child = cloud.nodes[index];
            const screen = screenOf(child);
            if (screen >= MIN_NODE_PX) heap.push(child, screen);
          }
        }
      }
      for (const node of cloud.nodes) if (node.points) node.points.visible = node.wanted;
    }
    this.stats = { points, nodes };
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const id of [...this.clouds.keys()]) this.remove(id);
    this.engine.earth?.mesh?.remove(this.root);
    this.gradient.dispose();
  }
}
