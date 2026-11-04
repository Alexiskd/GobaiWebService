import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { eclToScene, EARTH_RADIUS_KM, MOON_GM, MOON_RADIUS_KM, orbiterStateAt } from './moonLive';
import { interpolateState } from './moonEphemeris.js';
 
// Sondes en orbite lunaire (positions réelles JPL Horizons).
//
// Pour chaque sonde :
//  - la trajectoire réelle sur la fenêtre de la table, lissée, en traînée de comète qui suit la sonde ;
//  - l'orbite complète (ellipse osculatrice, en pointillés), calculée depuis sa position et sa vitesse ;
//  - le point de la sonde, son étiquette HTML cliquable et, en surbrillance, le périlune et l'apolune.
// Le repère suit le centre de la Lune sans tourner avec elle (écliptique J2000).
//
// Surbrillance (sonde sélectionnée ou étiquette survolée) : ligne plus épaisse, halo pulsé, aura autour de la sonde,
// orbite complète et apsides affichées ; les autres sondes s'estompent.
 
const COLORS = { lro: '#ffb347', 'chandrayaan-2': '#ff7eb6', danuri: '#7ee0ff', capstone: '#b6ff7e' };
const ORBIT_SEGMENTS = 256;
const MAX_APOLUNE_KM = 90_000; // au-delà, la Terre domine : une ellipse autour de la Lune n'a plus de sens
 
const STYLE = {
  // Trajectoire réelle (largeurs en pixels écran, constantes quel que soit le zoom)
  width: 1.4,
  widthActive: 2.6,
  opacity: 0.8,
  opacityDimmed: 0.25,
  // Halo de la trajectoire en surbrillance
  glowWidth: 11,
  glowOpacity: 0.3,
  // Orbite complète (pointillés)
  orbitWidth: 1.1,
  orbitOpacity: 0.4,
  orbitOpacityActive: 0.85,
  orbitDashes: 110,          // nombre de tirets sur le tour complet, quelle que soit la taille de l'orbite
  orbitRefreshMs: 1000,      // recalcul de l'ellipse (elle évolue lentement)
  // Traînée de comète
  trailFloor: 0.16,
  trailFuture: 0.22,
  repaintMs: 120,
  // Rééchantillonnage de la table
  maxSamples: 1500,
  minStepMs: 15_000,
  // Points (px)
  dot: 9,
  halo: 30,
  apsis: 7,
};
 
const v3 = new THREE.Vector3();
const toUnits = (km) => km / EARTH_RADIUS_KM; // la scène est en rayons terrestres
const kmToScene = (x, y, z) => eclToScene([toUnits(x), toUnits(y), toUnits(z)]);
const kmFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const reducedMotion = () => typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 
// ---------------------------------------------------------------- Calculs des trajectoires (sans three.js)
// Repère : écliptique J2000 centré sur la Lune, distances en km, vitesses en km/s, instants en ms UTC.
 
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
 
/**
 * Rééchantillonne la table Horizons d'une sonde avec la spline de Catmull-Rom qui donne aussi sa position :
 * la trajectoire tracée passe exactement par le point de la sonde, sans angles entre deux entrées de la table.
 * Couvre l'intervalle où l'interpolation est définie : de la 2ᵉ à l'avant-dernière entrée.
 * @param {{ t: number, x: number, y: number, z: number }[]} points  table triée par date
 * @returns {{ times: Float64Array, km: Float64Array } | null}  km = [x, y, z] × n
 */
export function densifyTrack(points, { maxSamples = 1500, minStepMs = 15_000 } = {}) {
  const n = points?.length ?? 0;
  if (n < 4) return null;
  const t0 = points[1].t;
  const t1 = points[n - 2].t;
  const span = t1 - t0;
  if (!(span > 0)) return null;
  const count = Math.max(2, Math.min(maxSamples, Math.ceil(span / minStepMs) + 1));
  const times = new Float64Array(count);
  const km = new Float64Array(count * 3);
  let last = { x: points[1].x, y: points[1].y, z: points[1].z };
  for (let i = 0; i < count; i++) {
    const t = i === count - 1 ? t1 : t0 + (span * i) / (count - 1);
    const p = interpolateState(points, t);
    if (p) last = p;
    times[i] = t;
    km[i * 3] = last.x;
    km[i * 3 + 1] = last.y;
    km[i * 3 + 2] = last.z;
  }
  return { times, km };
}
 
/**
 * Orbite osculatrice : l'ellipse képlérienne que suivrait la sonde à partir de sa position et de sa vitesse
 * actuelles si seule la Lune l'attirait. Sert à dessiner l'orbite complète, au-delà de la fenêtre de la table.
 * @param r   position (km) ; v vitesse (km/s) ; mu paramètre gravitationnel de la Lune (km³/s²)
 * @returns null si l'orbite n'est pas liée (énergie ≥ 0) ; sinon les éléments et `segments + 1` points (boucle fermée)
 */
export function osculatingOrbit(r, v, mu, segments = 256) {
  const rl = len(r);
  if (!(rl > 0) || !(mu > 0)) return null;
  const energy = vdot(v, v) / 2 - mu / rl;
  if (!(energy < 0)) return null;
  const a = -mu / (2 * energy);
  const h = cross(r, v);
  const hl = len(h);
  if (!(hl > 0)) return null; // chute radiale : pas de plan d'orbite
  const evec = cross(v, h).map((c, i) => c / mu - r[i] / rl);
  const e = len(evec);
  if (!(e < 1)) return null;
 
  // Base du plan orbital : P vers le périlune (ou vers la sonde si l'orbite est circulaire), Q à 90° dans le sens du mouvement.
  const P = e > 1e-9 ? scale(evec, 1 / e) : scale(r, 1 / rl);
  const W = scale(h, 1 / hl);
  const Q = cross(W, P);
  const p = a * (1 - e * e);
 
  const points = new Float64Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const nu = (2 * Math.PI * i) / segments;
    const rr = p / (1 + e * Math.cos(nu));
    const c = Math.cos(nu) * rr, s = Math.sin(nu) * rr;
    points[i * 3] = c * P[0] + s * Q[0];
    points[i * 3 + 1] = c * P[1] + s * Q[1];
    points[i * 3 + 2] = c * P[2] + s * Q[2];
  }
  const rp = a * (1 - e);
  const ra = a * (1 + e);
  return {
    a, e, rp, ra,
    periodS: 2 * Math.PI * Math.sqrt((a * a * a) / mu),
    inclinationDeg: (Math.acos(Math.max(-1, Math.min(1, W[2]))) * 180) / Math.PI, // par rapport à l'écliptique
    periapsis: scale(P, rp),
    apoapsis: scale(P, -ra),
    normal: W,
    points,
  };
}
 
/**
 * Intensité de la traînée de comète en un point de la trajectoire, `dt` ms après son passage
 * (dt > 0 : passé, dt < 0 : futur). 1 à la position actuelle, `floor` loin dans le passé, futur discret.
 */
export function trailIntensity(dt, tau, { floor = 0.16, future = 0.22 } = {}) {
  if (!(tau > 0)) return floor;
  return dt >= 0
    ? floor + (1 - floor) * Math.exp(-dt / tau)
    : future * (0.45 + 0.55 * Math.exp(dt / tau));
}
 
export class MoonOrbiters {
  constructor({ scene, parentEl, onPick }) {
    this.group = new THREE.Group();
    this.group.name = 'moon-orbiters';
    scene.add(this.group);
    this.parentEl = parentEl;
    this.onPick = onPick;
    this.items = [];
    this.visible = true;
    this.selected = null;
    this.hovered = null;
    this.fullOrbits = 'active'; // 'active' | 'all' | 'none'
    this.resolution = new THREE.Vector2(1, 1); // partagé par tous les matériaux de ligne
    this.calm = reducedMotion();
    this.textures = { dot: makeDiscTexture(0.78), halo: makeDiscTexture(0) };
  }
 
  // ---------------------------------------------------------------- API publique
 
  setVisible(on) {
    this.visible = on;
    this.group.visible = on;
    if (!on) this.items.forEach(hideLabels);
  }
 
  select(id) {
    this.selected = id ?? null;
    this.applyStyles();
  }
 
  hover(id) {
    const next = id ?? null;
    if (this.hovered === next) return;
    this.hovered = next;
    this.applyStyles();
  }
 
  /** Orbites complètes : seulement pour la sonde en surbrillance (défaut), pour toutes, ou jamais. */
  setFullOrbits(mode) {
    this.fullOrbits = ['active', 'all', 'none'].includes(mode) ? mode : 'active';
  }
 
  /** @param items réponse de GET /ephemeris/moon/orbiters (items) */
  setData(items) {
    this.clear();
    for (const o of items || []) this.items.push(this.createItem(o));
    this.applyStyles();
  }
 
  /**
   * @param t        instant simulé (ms UTC)
   * @param moonPos  position du centre de la Lune dans la scène ; moonRadius en unités de la scène
   */
  update({ t, moonPos, moonRadius, cam, W, H }) {
    this.group.position.copy(moonPos);
    // Sondes masquées : rien à calculer (les étiquettes ont déjà été cachées une fois).
    if (!this.visible) {
      for (const it of this.items) { it.dot.visible = false; it.halo.visible = false; hideLabels(it); }
      return;
    }
    if (W && H && (this.resolution.x !== W || this.resolution.y !== H)) this.resolution.set(W, H);
 
    const now = performance.now();
    const pulse = this.calm ? 1 : 0.78 + 0.22 * Math.sin(now * 0.0042); // le halo « respire »
    v3.copy(cam.position).sub(moonPos);
    const view = { camRel: [v3.x, v3.y, v3.z], moonRadius, moonPos, cam, W, H };
 
    for (const it of this.items) {
      it.state = it.ok ? orbiterStateAt(it.points, t) : null;
 
      // Orbite complète : recalculée de temps en temps, ou tout de suite après un saut dans le temps.
      if (it.state && (it.orbitT === null || now - it.orbitAt > STYLE.orbitRefreshMs || Math.abs(t - it.orbitT) > 30 * 60e3)) {
        this.refreshOrbit(it);
        it.orbitAt = now;
        it.orbitT = t;
      }
      if (it.ok && now - it.lastPaint > STYLE.repaintMs) {
        paintTrail(it, t);
        it.lastPaint = now;
      }
 
      const showOrbit = Boolean(it.state && it.orbit)
        && (this.fullOrbits === 'all' || (this.fullOrbits === 'active' && it.active));
      it.orbitLine.visible = showOrbit;
      it.glowLine.visible = it.ok && it.active;
      if (it.active) {
        it.glowMat.opacity = STYLE.glowOpacity * pulse;
        it.halo.material.size = STYLE.halo * (0.9 + 0.2 * pulse);
      }
 
      if (!it.state) {
        it.dot.visible = false;
        it.halo.visible = false;
        it.apsis.visible = false;
        hideLabels(it);
        continue;
      }
 
      // Point de la sonde
      const s = eclToScene(it.state.r.map(toUnits));
      it.dotGeo.attributes.position.array.set(s);
      it.dotGeo.attributes.position.needsUpdate = true;
      it.dotGeo.computeBoundingSphere();
      it.dot.visible = true;
      it.halo.visible = it.active;
      placeLabel(it.el, s, view, 6, -7);
 
      // Périlune et apolune de la sonde en surbrillance
      const showApsides = showOrbit && it.active;
      it.apsis.visible = showApsides;
      if (showApsides) {
        placeLabel(it.periEl, it.orbit.periScene, view, 8, -6);
        placeLabel(it.apoEl, it.orbit.apoScene, view, 8, -6);
      } else {
        setDisplay(it.periEl, false);
        setDisplay(it.apoEl, false);
      }
    }
  }
 
  clear() {
    for (const it of this.items) {
      it.el.remove();
      it.periEl.remove();
      it.apoEl.remove();
      this.group.remove(it.glowLine, it.trackLine, it.orbitLine, it.halo, it.dot, it.apsis);
      it.trackGeo.dispose();      // partagée par la trajectoire et son halo
      it.trackMat.dispose();
      it.glowMat.dispose();
      it.orbitGeo.dispose();
      it.orbitMat.dispose();
      it.dotGeo.dispose();        // partagée par le point et son aura
      it.dot.material.dispose();
      it.halo.material.dispose();
      it.apsisGeo.dispose();
      it.apsis.material.dispose();
    }
    this.items = [];
    this.hovered = null;
  }
 
  dispose() {
    this.clear();
    this.textures.dot.dispose();
    this.textures.halo.dispose();
    this.group.parent?.remove(this.group);
  }
 
  // ---------------------------------------------------------------- Construction
 
  createItem(o) {
    const color = new THREE.Color(COLORS[o.id] || '#ffffff');
    const hex = `#${color.getHexString()}`;
 
    // Étiquettes HTML : la sonde (cliquable, survol = surbrillance) et ses deux apsides (informatives).
    const el = makeLabel('l orbiter-label', hex, o.name);
    el.title = `${o.name} (${o.agency}) · cliquer pour le détail`;
    el.setAttribute('role', 'button');
    el.addEventListener('click', (e) => { e.stopPropagation(); this.onPick?.(o.id); });
    el.addEventListener('pointerenter', () => this.hover(o.id));
    el.addEventListener('pointerleave', () => { if (this.hovered === o.id) this.hover(null); });
    const periEl = makeLabel('l orbiter-apsis', hex, '');
    const apoEl = makeLabel('l orbiter-apsis', hex, '');
    this.parentEl.append(el, periEl, apoEl);
 
    // Trajectoire réelle, lissée.
    const ok = o.status === 'ok' && Array.isArray(o.points) && o.points.length >= 4;
    const track = ok ? densifyTrack(o.points, { maxSamples: STYLE.maxSamples, minStepMs: STYLE.minStepMs }) : null;
    const trackGeo = new LineGeometry();
    let trackColors = null;
    if (track) {
      const n = track.times.length;
      const positions = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) positions.set(kmToScene(track.km[i * 3], track.km[i * 3 + 1], track.km[i * 3 + 2]), i * 3);
      trackGeo.setPositions(positions);
      trackColors = new Float32Array(n * 3);
      for (let i = 0; i < trackColors.length; i += 3) { trackColors[i] = color.r * 0.6; trackColors[i + 1] = color.g * 0.6; trackColors[i + 2] = color.b * 0.6; }
      trackGeo.setColors(trackColors);
    }
    const trackMat = this.lineMaterial({
      color: 0xffffff, // la teinte vient des couleurs de sommets (traînée)
      vertexColors: true,
      linewidth: STYLE.width,
      opacity: STYLE.opacity,
      // Mélange additif : un sommet sombre devient transparent, la traînée s'efface sans artefact.
      blending: THREE.AdditiveBlending,
    });
    const trackLine = noCull(new Line2(trackGeo, trackMat));
    trackLine.visible = Boolean(track);
    trackLine.renderOrder = 2;
 
    const glowMat = this.lineMaterial({ color: color.clone(), linewidth: STYLE.glowWidth, opacity: STYLE.glowOpacity, blending: THREE.AdditiveBlending });
    const glowLine = noCull(new Line2(trackGeo, glowMat));
    glowLine.visible = false;
    glowLine.renderOrder = 1;
 
    // Orbite complète : tampon de taille fixe, mis à jour sur place (aucune réallocation GPU).
    const orbitPositions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
    const orbitGeo = new LineGeometry();
    orbitGeo.setPositions(orbitPositions);
    const orbitMat = this.lineMaterial({
      color: color.clone(),
      linewidth: STYLE.orbitWidth,
      opacity: STYLE.orbitOpacity,
      dashed: true,
      dashSize: 0.01,
      gapSize: 0.008,
      blending: THREE.AdditiveBlending,
    });
    const orbitLine = noCull(new Line2(orbitGeo, orbitMat));
    orbitLine.computeLineDistances(); // crée les attributs de distance, réécrits ensuite sur place
    orbitLine.visible = false;
    orbitLine.renderOrder = 0;
 
    // Point de la sonde (disque net) + aura en surbrillance, sur la même géométrie.
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const dot = noCull(new THREE.Points(dotGeo, new THREE.PointsMaterial({
      color, size: STYLE.dot, sizeAttenuation: false, map: this.textures.dot,
      transparent: true, alphaTest: 0.05, depthWrite: false,
    })));
    dot.visible = false;
    dot.renderOrder = 5;
    const halo = noCull(new THREE.Points(dotGeo, new THREE.PointsMaterial({
      color, size: STYLE.halo, sizeAttenuation: false, map: this.textures.halo,
      transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    })));
    halo.visible = false;
    halo.renderOrder = 3;
 
    // Périlune et apolune.
    const apsisGeo = new THREE.BufferGeometry();
    apsisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const apsis = noCull(new THREE.Points(apsisGeo, new THREE.PointsMaterial({
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.4), size: STYLE.apsis, sizeAttenuation: false,
      map: this.textures.dot, transparent: true, alphaTest: 0.05, depthWrite: false,
    })));
    apsis.visible = false;
    apsis.renderOrder = 4;
 
    this.group.add(orbitLine, glowLine, trackLine, halo, apsis, dot);
    return {
      ...o,
      ok: Boolean(track),
      color, el, periEl, apoEl,
      times: track?.times ?? null, trackColors, trackGeo, trackMat, trackLine, glowMat, glowLine,
      line: trackLine, // compatibilité : l'ancien code du moteur peut lire `item.line`
      orbitPositions, orbitGeo, orbitMat, orbitLine, orbit: null, orbitAt: 0, orbitT: null,
      dotGeo, dot, halo, apsisGeo, apsis,
      state: null, active: false, lastPaint: 0,
    };
  }
 
  lineMaterial(params) {
    const mat = new LineMaterial({ transparent: true, depthWrite: false, ...params });
    mat.uniforms.resolution.value = this.resolution; // même vecteur pour toutes les lignes
    return mat;
  }
 
  /** Largeur, opacité et classes des étiquettes selon la sélection et le survol. */
  applyStyles() {
    const focus = this.selected ?? this.hovered;
    for (const it of this.items) {
      const active = it.id === this.selected || it.id === this.hovered;
      const dimmed = focus !== null && !active;
      it.active = active;
      it.trackMat.linewidth = active ? STYLE.widthActive : STYLE.width;
      it.trackMat.opacity = dimmed ? STYLE.opacityDimmed : STYLE.opacity;
      it.orbitMat.opacity = active ? STYLE.orbitOpacityActive : dimmed ? STYLE.orbitOpacity * 0.5 : STYLE.orbitOpacity;
      it.trackLine.renderOrder = active ? 6 : 2;
      it.el.classList.toggle('selected', it.id === this.selected);
      it.el.classList.toggle('hovered', it.id === this.hovered && it.id !== this.selected);
      it.lastPaint = 0; // repeindre la traînée dès la prochaine image
    }
  }
 
  /** Recalcule l'orbite complète depuis l'état actuel de la sonde et réécrit les tampons sur place. */
  refreshOrbit(it) {
    const o = osculatingOrbit(it.state.r, it.state.v, MOON_GM, ORBIT_SEGMENTS);
    if (!o || o.ra > MAX_APOLUNE_KM) { it.orbit = null; return; }
 
    const pos = it.orbitPositions;
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      pos.set(kmToScene(o.points[i * 3], o.points[i * 3 + 1], o.points[i * 3 + 2]), i * 3);
    }
    writeLinePositions(it.orbitGeo, pos);
    const total = writeLineDistances(it.orbitGeo, pos);
    // Tirets proportionnels au périmètre : même aspect pour LRO (≈ 1 800 km) et CAPSTONE (≈ 70 000 km).
    const dash = total / STYLE.orbitDashes;
    it.orbitMat.dashSize = dash * 0.58;
    it.orbitMat.gapSize = dash * 0.42;
 
    const periScene = kmToScene(...o.periapsis);
    const apoScene = kmToScene(...o.apoapsis);
    it.apsisGeo.attributes.position.array.set([...periScene, ...apoScene]);
    it.apsisGeo.attributes.position.needsUpdate = true;
    it.apsisGeo.computeBoundingSphere();
 
    const periAlt = Math.round(o.rp - MOON_RADIUS_KM);
    const apoAlt = Math.round(o.ra - MOON_RADIUS_KM);
    if (it.orbit?.periAlt !== periAlt) it.periEl.textContent = `Périlune · ${kmFormat.format(periAlt)} km`;
    if (it.orbit?.apoAlt !== apoAlt) it.apoEl.textContent = `Apolune · ${kmFormat.format(apoAlt)} km`;
    it.orbit = { ...o, periScene, apoScene, periAlt, apoAlt };
  }
}
 
// ---------------------------------------------------------------- Traînée de comète
 
/**
 * Chaque sommet de la trajectoire reçoit la couleur de la sonde multipliée par une intensité qui dépend de son écart
 * à l'instant `t` : récent = brillant, ancien = sombre, futur = discret. La traînée couvre environ une révolution
 * (période de l'orbite complète), plus longue en surbrillance.
 */
function paintTrail(it, t) {
  const { times, trackColors: c } = it;
  if (!times || !c) return;
  const n = times.length;
  const span = Math.max(times[n - 1] - times[0], 1);
  const periodMs = it.orbit ? it.orbit.periodS * 1000 : 0;
  const base = periodMs > 0 && periodMs < span * 3 ? periodMs : span;
  const tau = base / (it.active ? 2.5 : 4);
  const boost = it.active ? 1.3 : 0.85;
  const opts = { floor: STYLE.trailFloor, future: STYLE.trailFuture };
  const { r, g, b } = it.color;
  for (let i = 0; i < n; i++) {
    const k = Math.min(1.6, trailIntensity(t - times[i], tau, opts) * boost);
    c[i * 3] = r * k; c[i * 3 + 1] = g * k; c[i * 3 + 2] = b * k;
  }
  writeLineColors(it.trackGeo, c);
}
 
// ---------------------------------------------------------------- Écriture sur place dans les tampons de Line2
// LineGeometry stocke chaque segment comme une instance [début, fin]. setPositions / setColors / computeLineDistances
// recréent ces tampons à chaque appel (et l'ancien tampon GPU n'est libéré qu'au dispose) : on réécrit donc sur place.
 
function writeSegmentPairs(attribute, values, itemSize) {
  const out = attribute.data.array;
  const segments = values.length / itemSize - 1;
  if (out.length !== segments * itemSize * 2) return false;
  for (let s = 0; s < segments; s++) {
    const o = s * itemSize * 2, a = s * itemSize;
    for (let k = 0; k < itemSize; k++) {
      out[o + k] = values[a + k];
      out[o + itemSize + k] = values[a + itemSize + k];
    }
  }
  attribute.data.needsUpdate = true;
  return true;
}
 
function writeLinePositions(geometry, positions) {
  const attr = geometry.attributes.instanceStart;
  if (!attr || !writeSegmentPairs(attr, positions, 3)) geometry.setPositions(positions);
}
 
function writeLineColors(geometry, colors) {
  const attr = geometry.attributes.instanceColorStart;
  if (!attr || !writeSegmentPairs(attr, colors, 3)) geometry.setColors(colors);
}
 
/** Distances cumulées le long de la ligne (pour les pointillés) ; renvoie la longueur totale. */
function writeLineDistances(geometry, positions) {
  const n = positions.length / 3;
  const cumul = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const a = (i - 1) * 3, b = i * 3;
    cumul[i] = cumul[i - 1] + Math.hypot(positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]);
  }
  const attr = geometry.attributes.instanceDistanceStart;
  if (attr) writeSegmentPairs(attr, cumul, 1);
  return cumul[n - 1];
}
 
// ---------------------------------------------------------------- Étiquettes HTML
 
function makeLabel(className, hex, text) {
  const el = document.createElement('div');
  el.className = className;
  el.style.setProperty('--c', hex);
  el.style.display = 'none';
  el.textContent = text;
  if (className.includes('orbiter-apsis')) {
    el.style.pointerEvents = 'none';
    el.style.fontSize = '10px';
    el.style.opacity = '0.85';
  }
  return el;
}
 
/** Place une étiquette sur un point du repère de la Lune ; cachée si la Lune le masque ou s'il sort de l'écran. */
function placeLabel(el, s, { camRel, moonRadius, moonPos, cam, W, H }, dx, dy) {
  if (segmentHitsSphere(camRel, s, moonRadius)) { setDisplay(el, false); return; }
  v3.set(s[0], s[1], s[2]).add(moonPos).project(cam);
  if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) { setDisplay(el, false); return; }
  setDisplay(el, true);
  const x = ((v3.x + 1) / 2) * W + dx;
  const y = ((1 - v3.y) / 2) * H + dy;
  if (el._x === undefined || Math.abs(el._x - x) > 0.05 || Math.abs(el._y - y) > 0.05) {
    el._x = x; el._y = y;
    el.style.transform = `translate(${x}px,${y}px)`;
  }
}
 
function hideLabels(it) {
  setDisplay(it.el, false);
  setDisplay(it.periEl, false);
  setDisplay(it.apoEl, false);
}
 
// ---------------------------------------------------------------- Utilitaires
 
function noCull(object) {
  object.frustumCulled = false; // les boîtes englobantes suivent mal un groupe qui se déplace avec la Lune
  return object;
}
 
/**
 * Disque blanc dessiné sur un canvas, teinté ensuite par la couleur du matériau.
 * `hard` = part du rayon à pleine opacité (0 : dégradé doux pour un halo, ≈ 0,8 : point net aux bords lissés).
 */
function makeDiscTexture(hard) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  if (hard > 0) {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(hard, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
 
/** Le segment a → b (centre de la sphère à l'origine) traverse-t-il la sphère de rayon r ? */
export function segmentHitsSphere(a, b, r) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  if (dd === 0) return false;
  const t = Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1] + a[2] * d[2]) / dd));
  const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  return t > 0 && t < 1 && Math.hypot(p[0], p[1], p[2]) < r * 0.999;
}
 
/** N'écrit `display` que s'il change (une écriture de style par image et par étiquette coûte un recalcul). */
function setDisplay(el, on) {
  if (el._shown === on) return;
  el._shown = on;
  el.style.display = on ? 'block' : 'none';
}
 