// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe Line2, la ligne à largeur réglable en pixels, des exemples de three.js.
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
// Importe LineGeometry, la géométrie de ces lignes.
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
// Importe LineMaterial, leur matériau.
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
// Importe la conversion vers le repère de la scène, les rayons de la Terre et de la Lune, la gravité de la Lune et l'état d'une sonde, depuis moonLive.
import { eclToScene, EARTH_RADIUS_KM, MOON_GM, MOON_RADIUS_KM, orbiterStateAt } from './moonLive';
// Importe interpolateState, l'interpolation d'une table de positions, depuis moonEphemeris.
import { interpolateState } from './moonEphemeris';
 
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
 
// Couleur de chaque sonde : LRO, Chandrayaan-2, Danuri et CAPSTONE.
const COLORS = { lro: '#ffb347', 'chandrayaan-2': '#ff7eb6', danuri: '#7ee0ff', capstone: '#b6ff7e' };
// Nombre de segments de l'orbite complète : 256.
const ORBIT_SEGMENTS = 256;
// Apolune maximale pour dessiner une ellipse : 90 000 km.
const MAX_APOLUNE_KM = 90_000; // au-delà, la Terre domine : une ellipse autour de la Lune n'a plus de sens
 
// Réglages d'aspect (début).
const STYLE = {
  // Trajectoire réelle (largeurs en pixels écran, constantes quel que soit le zoom)
  // Largeur de la trajectoire : 1,4 px.
  width: 1.4,
  // Largeur en surbrillance : 2,6 px.
  widthActive: 2.6,
  // Opacité de la trajectoire : 0,8.
  opacity: 0.8,
  // Opacité d'une sonde estompée : 0,25.
  opacityDimmed: 0.25,
  // Halo de la trajectoire en surbrillance
  // Largeur du halo : 11 px.
  glowWidth: 11,
  // Opacité du halo : 0,3.
  glowOpacity: 0.3,
  // Orbite complète (pointillés)
  // Largeur de l'orbite complète : 1,1 px.
  orbitWidth: 1.1,
  // Opacité de l'orbite complète : 0,4.
  orbitOpacity: 0.4,
  // Opacité de l'orbite complète en surbrillance : 0,85.
  orbitOpacityActive: 0.85,
  // Nombre de tirets sur le tour : 110.
  orbitDashes: 110,          // nombre de tirets sur le tour complet, quelle que soit la taille de l'orbite
  // Délai entre deux calculs de l'ellipse : 1 seconde.
  orbitRefreshMs: 1000,      // recalcul de l'ellipse (elle évolue lentement)
  // Traînée de comète
  // Intensité minimale de la traînée, loin dans le passé : 0,16.
  trailFloor: 0.16,
  // Intensité de la partie future : 0,22.
  trailFuture: 0.22,
  // Délai entre deux peintures de la traînée : 120 ms.
  repaintMs: 120,
  // Rééchantillonnage de la table
  // Nombre maximal d'échantillons de la trajectoire : 1 500.
  maxSamples: 1500,
  // Pas minimal entre deux échantillons : 15 secondes.
  minStepMs: 15_000,
  // Points (px)
  // Taille du point de la sonde : 9 px.
  dot: 9,
  // Taille de l'aura : 30 px.
  halo: 30,
  // Taille des points du périlune et de l'apolune : 7 px.
  apsis: 7,
// Fin des réglages.
};
 
// Vecteur de travail.
const v3 = new THREE.Vector3();
// toUnits : convertit des kilomètres en rayons terrestres.
const toUnits = (km) => km / EARTH_RADIUS_KM; // la scène est en rayons terrestres
// kmToScene : convertit un point en kilomètres vers le repère de la scène.
const kmToScene = (x, y, z) => eclToScene([toUnits(x), toUnits(y), toUnits(z)]);
// Format des kilomètres, en français, sans décimale.
const kmFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
// reducedMotion : vrai si le système demande de réduire les animations (hors navigateur : faux),
const reducedMotion = () => typeof window !== 'undefined'
  // d'après la requête média « prefers-reduced-motion ».
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 
// ---------------------------------------------------------------- Calculs des trajectoires (sans three.js)
// Repère : écliptique J2000 centré sur la Lune, distances en km, vitesses en km/s, instants en ms UTC.
 
// vdot : produit scalaire de deux vecteurs.
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// len : longueur d'un vecteur.
const len = (a) => Math.hypot(a[0], a[1], a[2]);
// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// scale : vecteur multiplié par un nombre.
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
 
/**
 * Rééchantillonne la table Horizons d'une sonde avec la spline de Catmull-Rom qui donne aussi sa position :
 * la trajectoire tracée passe exactement par le point de la sonde, sans angles entre deux entrées de la table.
 * Couvre l'intervalle où l'interpolation est définie : de la 2ᵉ à l'avant-dernière entrée.
 * @param {{ t: number, x: number, y: number, z: number }[]} points  table triée par date
 * @returns {{ times: Float64Array, km: Float64Array } | null}  km = [x, y, z] × n
 */
// Déclare et exporte densifyTrack : la trajectoire rééchantillonnée, 1 500 points au plus, un toutes les 15 s au moins (début).
export function densifyTrack(points, { maxSamples = 1500, minStepMs = 15_000 } = {}) {
  // Nombre d'entrées de la table.
  const n = points?.length ?? 0;
  // Moins de 4 : rien.
  if (n < 4) return null;
  // Instant de la 2ᵉ entrée.
  const t0 = points[1].t;
  // Instant de l'avant-dernière.
  const t1 = points[n - 2].t;
  // Durée couverte.
  const span = t1 - t0;
  // Durée nulle ou négative : rien.
  if (!(span > 0)) return null;
  // Nombre d'échantillons : entre 2 et le maximum, d'après le pas minimal.
  const count = Math.max(2, Math.min(maxSamples, Math.ceil(span / minStepMs) + 1));
  // Instants.
  const times = new Float64Array(count);
  // Positions en kilomètres.
  const km = new Float64Array(count * 3);
  // Dernière position connue : celle de la 2ᵉ entrée.
  let last = { x: points[1].x, y: points[1].y, z: points[1].z };
  // Pour chaque échantillon (début).
  for (let i = 0; i < count; i++) {
    // Son instant, réparti sur la durée ; le dernier tombe exactement à la fin.
    const t = i === count - 1 ? t1 : t0 + (span * i) / (count - 1);
    // Position interpolée.
    const p = interpolateState(points, t);
    // Si elle existe : elle devient la dernière connue.
    if (p) last = p;
    // Range l'instant.
    times[i] = t;
    // Range x.
    km[i * 3] = last.x;
    // Range y.
    km[i * 3 + 1] = last.y;
    // Range z.
    km[i * 3 + 2] = last.z;
  // Fin de la boucle.
  }
  // Renvoie les instants et les positions.
  return { times, km };
// Fin de densifyTrack.
}
 
/**
 * Orbite osculatrice : l'ellipse képlérienne que suivrait la sonde à partir de sa position et de sa vitesse
 * actuelles si seule la Lune l'attirait. Sert à dessiner l'orbite complète, au-delà de la fenêtre de la table.
 * @param r   position (km) ; v vitesse (km/s) ; mu paramètre gravitationnel de la Lune (km³/s²)
 * @returns null si l'orbite n'est pas liée (énergie ≥ 0) ; sinon les éléments et `segments + 1` points (boucle fermée)
 */
// Déclare et exporte osculatingOrbit : l'ellipse suivie depuis une position et une vitesse (début).
export function osculatingOrbit(r, v, mu, segments = 256) {
  // Distance au centre.
  const rl = len(r);
  // Distance ou gravité nulle : rien.
  if (!(rl > 0) || !(mu > 0)) return null;
  // Énergie par unité de masse : v²/2 − μ/r.
  const energy = vdot(v, v) / 2 - mu / rl;
  // Énergie positive ou nulle : orbite non liée, rien.
  if (!(energy < 0)) return null;
  // Demi-grand axe.
  const a = -mu / (2 * energy);
  // Moment cinétique.
  const h = cross(r, v);
  // Sa longueur.
  const hl = len(h);
  // Nulle : rien.
  if (!(hl > 0)) return null; // chute radiale : pas de plan d'orbite
  // Vecteur d'excentricité.
  const evec = cross(v, h).map((c, i) => c / mu - r[i] / rl);
  // Excentricité.
  const e = len(evec);
  // 1 ou plus : rien.
  if (!(e < 1)) return null;
 
  // Base du plan orbital : P vers le périlune (ou vers la sonde si l'orbite est circulaire), Q à 90° dans le sens du mouvement.
  // P : direction du périlune, ou de la sonde pour une orbite circulaire.
  const P = e > 1e-9 ? scale(evec, 1 / e) : scale(r, 1 / rl);
  // W : normale au plan de l'orbite.
  const W = scale(h, 1 / hl);
  // Q : à 90° de P dans le plan.
  const Q = cross(W, P);
  // Paramètre de l'ellipse : a × (1 − e²).
  const p = a * (1 - e * e);
 
  // Points de l'ellipse.
  const points = new Float64Array((segments + 1) * 3);
  // Pour chaque point du tour (début).
  for (let i = 0; i <= segments; i++) {
    // Anomalie vraie.
    const nu = (2 * Math.PI * i) / segments;
    // Distance au centre à cet angle.
    const rr = p / (1 + e * Math.cos(nu));
    // Coordonnées dans le plan de l'orbite.
    const c = Math.cos(nu) * rr, s = Math.sin(nu) * rr;
    // x du point.
    points[i * 3] = c * P[0] + s * Q[0];
    // y du point.
    points[i * 3 + 1] = c * P[1] + s * Q[1];
    // z du point.
    points[i * 3 + 2] = c * P[2] + s * Q[2];
  // Fin de la boucle.
  }
  // Distance au périlune.
  const rp = a * (1 - e);
  // Distance à l'apolune.
  const ra = a * (1 + e);
  // Renvoie (début)
  return {
    // le demi-grand axe, l'excentricité et les deux distances,
    a, e, rp, ra,
    // la période en secondes,
    periodS: 2 * Math.PI * Math.sqrt((a * a * a) / mu),
    // l'inclinaison en degrés,
    inclinationDeg: (Math.acos(Math.max(-1, Math.min(1, W[2]))) * 180) / Math.PI, // par rapport à l'écliptique
    // la position du périlune,
    periapsis: scale(P, rp),
    // celle de l'apolune,
    apoapsis: scale(P, -ra),
    // la normale au plan
    normal: W,
    // et les points.
    points,
  // Fin du résultat.
  };
// Fin de osculatingOrbit.
}
 
/**
 * Intensité de la traînée de comète en un point de la trajectoire, `dt` ms après son passage
 * (dt > 0 : passé, dt < 0 : futur). 1 à la position actuelle, `floor` loin dans le passé, futur discret.
 */
// Déclare et exporte trailIntensity : l'intensité de la traînée, dt millisecondes après le passage (début).
export function trailIntensity(dt, tau, { floor = 0.16, future = 0.22 } = {}) {
  // Sans durée de référence : le minimum.
  if (!(tau > 0)) return floor;
  // Renvoie, pour le passé :
  return dt >= 0
    // le minimum, plus une décroissance exponentielle depuis 1 ;
    ? floor + (1 - floor) * Math.exp(-dt / tau)
    // pour le futur : une valeur discrète qui décroît en s'éloignant.
    : future * (0.45 + 0.55 * Math.exp(dt / tau));
// Fin de trailIntensity.
}
 
// Déclare et exporte la classe MoonOrbiters (début).
export class MoonOrbiters {
  // Constructeur : la scène, l'élément des étiquettes et la fonction de choix (début).
  constructor({ scene, parentEl, onPick }) {
    // Groupe des sondes.
    this.group = new THREE.Group();
    // Son nom.
    this.group.name = 'moon-orbiters';
    // L'ajoute à la scène.
    scene.add(this.group);
    // Garde l'élément parent des étiquettes.
    this.parentEl = parentEl;
    // Garde la fonction de choix.
    this.onPick = onPick;
    // Sondes : aucune.
    this.items = [];
    // Visibles.
    this.visible = true;
    // Sonde sélectionnée : aucune.
    this.selected = null;
    // Sonde survolée : aucune.
    this.hovered = null;
    // Orbites complètes : pour la sonde en surbrillance.
    this.fullOrbits = 'active'; // 'active' | 'all' | 'none'
    // Taille de l'écran, partagée par les lignes.
    this.resolution = new THREE.Vector2(1, 1); // partagé par tous les matériaux de ligne
    // Animations réduites ?
    this.calm = reducedMotion();
    // Textures du point net et de l'aura.
    this.textures = { dot: makeDiscTexture(0.78), halo: makeDiscTexture(0) };
  // Fin du constructeur.
  }
 
  // ---------------------------------------------------------------- API publique
 
  // setVisible : affiche ou masque les sondes (début).
  setVisible(on) {
    // Garde l'état.
    this.visible = on;
    // Règle le groupe.
    this.group.visible = on;
    // Masquées : les étiquettes sont cachées.
    if (!on) this.items.forEach(hideLabels);
  // Fin de setVisible.
  }
 
  // select : sélectionne une sonde (début).
  select(id) {
    // Garde son identifiant, ou null.
    this.selected = id ?? null;
    // Applique les styles.
    this.applyStyles();
  // Fin de select.
  }
 
  // hover : survole une sonde (début).
  hover(id) {
    // Identifiant, ou null.
    const next = id ?? null;
    // Inchangé : rien à faire.
    if (this.hovered === next) return;
    // Le garde.
    this.hovered = next;
    // Applique les styles.
    this.applyStyles();
  // Fin de hover.
  }
 
  /** Orbites complètes : seulement pour la sonde en surbrillance (défaut), pour toutes, ou jamais. */
  // setFullOrbits : choisit quelles orbites complètes afficher (début).
  setFullOrbits(mode) {
    // Garde le mode s'il est connu, sinon « active ».
    this.fullOrbits = ['active', 'all', 'none'].includes(mode) ? mode : 'active';
  // Fin de setFullOrbits.
  }
 
  /** @param items réponse de GET /ephemeris/moon/orbiters (items) */
  // setData : reçoit les sondes de l'API (début).
  setData(items) {
    // Retire les anciennes.
    this.clear();
    // Crée chaque sonde.
    for (const o of items || []) this.items.push(this.createItem(o));
    // Applique les styles.
    this.applyStyles();
  // Fin de setData.
  }
 
  /**
   * @param t        instant simulé (ms UTC)
   * @param moonPos  position du centre de la Lune dans la scène ; moonRadius en unités de la scène
   */
  // update : à chaque image, avec l'instant, la Lune, la caméra et la taille de l'écran (début).
  update({ t, moonPos, moonRadius, cam, W, H }) {
    // Le groupe suit le centre de la Lune.
    this.group.position.copy(moonPos);
    // Sondes masquées : rien à calculer (les étiquettes ont déjà été cachées une fois).
    // Si les sondes sont masquées (début).
    if (!this.visible) {
      // Masque le point, l'aura et les étiquettes de chacune.
      for (const it of this.items) { it.dot.visible = false; it.halo.visible = false; hideLabels(it); }
      // Terminé.
      return;
    // Fin de ce cas.
    }
    // Taille de l'écran changée : la transmet aux lignes.
    if (W && H && (this.resolution.x !== W || this.resolution.y !== H)) this.resolution.set(W, H);
 
    // Instant présent.
    const now = performance.now();
    // Pulsation du halo : fixe à 1 si les animations sont réduites.
    const pulse = this.calm ? 1 : 0.78 + 0.22 * Math.sin(now * 0.0042); // le halo « respire »
    // Position de la caméra par rapport à la Lune.
    v3.copy(cam.position).sub(moonPos);
    // Données de la vue, pour placer les étiquettes.
    const view = { camRel: [v3.x, v3.y, v3.z], moonRadius, moonPos, cam, W, H };
 
    // Pour chaque sonde (début).
    for (const it of this.items) {
      // Son état à l'instant simulé, si sa table est utilisable.
      it.state = it.ok ? orbiterStateAt(it.points, t) : null;
 
      // Orbite complète : recalculée de temps en temps, ou tout de suite après un saut dans le temps.
      // Si l'orbite complète n'a jamais été calculée, date de plus d'une seconde, ou si le temps a sauté de plus de 30 minutes (début).
      if (it.state && (it.orbitT === null || now - it.orbitAt > STYLE.orbitRefreshMs || Math.abs(t - it.orbitT) > 30 * 60e3)) {
        // La recalcule.
        this.refreshOrbit(it);
        // Note l'instant réel.
        it.orbitAt = now;
        // Note l'instant simulé.
        it.orbitT = t;
      // Fin de ce cas.
      }
      // Si la traînée date de plus de 120 ms (début).
      if (it.ok && now - it.lastPaint > STYLE.repaintMs) {
        // La repeint.
        paintTrail(it, t);
        // Note l'instant.
        it.lastPaint = now;
      // Fin de ce cas.
      }
 
      // Orbite complète affichée : s'il y a un état et une orbite,
      const showOrbit = Boolean(it.state && it.orbit)
        // en mode « all », ou en mode « active » pour une sonde en surbrillance.
        && (this.fullOrbits === 'all' || (this.fullOrbits === 'active' && it.active));
      // Règle la visibilité de l'orbite.
      it.orbitLine.visible = showOrbit;
      // Le halo est visible pour une sonde en surbrillance.
      it.glowLine.visible = it.ok && it.active;
      // En surbrillance (début).
      if (it.active) {
        // Opacité du halo, pulsée.
        it.glowMat.opacity = STYLE.glowOpacity * pulse;
        // Taille de l'aura, pulsée.
        it.halo.material.size = STYLE.halo * (0.9 + 0.2 * pulse);
      // Fin de ce cas.
      }
 
      // Sans état (début).
      if (!it.state) {
        // Masque le point.
        it.dot.visible = false;
        // Masque l'aura.
        it.halo.visible = false;
        // Masque les apsides.
        it.apsis.visible = false;
        // Cache les étiquettes.
        hideLabels(it);
        // Sonde suivante.
        continue;
      // Fin de ce cas.
      }
 
      // Point de la sonde
      // Position de la sonde dans la scène.
      const s = eclToScene(it.state.r.map(toUnits));
      // L'écrit dans la géométrie du point.
      it.dotGeo.attributes.position.array.set(s);
      // À envoyer à la carte graphique.
      it.dotGeo.attributes.position.needsUpdate = true;
      // Recalcule la sphère englobante.
      it.dotGeo.computeBoundingSphere();
      // Point visible.
      it.dot.visible = true;
      // Aura visible en surbrillance.
      it.halo.visible = it.active;
      // Place l'étiquette de la sonde.
      placeLabel(it.el, s, view, 6, -7);
 
      // Périlune et apolune de la sonde en surbrillance
      // Apsides affichées : orbite affichée et sonde en surbrillance.
      const showApsides = showOrbit && it.active;
      // Règle la visibilité des points.
      it.apsis.visible = showApsides;
      // Si elles sont affichées (début).
      if (showApsides) {
        // Place l'étiquette du périlune.
        placeLabel(it.periEl, it.orbit.periScene, view, 8, -6);
        // Place celle de l'apolune.
        placeLabel(it.apoEl, it.orbit.apoScene, view, 8, -6);
      // Sinon (début).
      } else {
        // Cache l'étiquette du périlune.
        setDisplay(it.periEl, false);
        // Cache celle de l'apolune.
        setDisplay(it.apoEl, false);
      // Fin de ce cas.
      }
    // Fin de la boucle.
    }
  // Fin de update.
  }
 
  // clear : retire toutes les sondes (début).
  clear() {
    // Pour chaque sonde (début).
    for (const it of this.items) {
      // Retire son étiquette.
      it.el.remove();
      // Celle du périlune.
      it.periEl.remove();
      // Celle de l'apolune.
      it.apoEl.remove();
      // Retire ses objets du groupe.
      this.group.remove(it.glowLine, it.trackLine, it.orbitLine, it.halo, it.dot, it.apsis);
      // Libère la géométrie de la trajectoire.
      it.trackGeo.dispose();      // partagée par la trajectoire et son halo
      // Son matériau.
      it.trackMat.dispose();
      // Le matériau du halo.
      it.glowMat.dispose();
      // La géométrie de l'orbite.
      it.orbitGeo.dispose();
      // Son matériau.
      it.orbitMat.dispose();
      // La géométrie du point.
      it.dotGeo.dispose();        // partagée par le point et son aura
      // Le matériau du point.
      it.dot.material.dispose();
      // Celui de l'aura.
      it.halo.material.dispose();
      // La géométrie des apsides.
      it.apsisGeo.dispose();
      // Leur matériau.
      it.apsis.material.dispose();
    // Fin de la boucle.
    }
    // Plus de sondes.
    this.items = [];
    // Plus de survol.
    this.hovered = null;
  // Fin de clear.
  }
 
  // dispose : libère tout (début).
  dispose() {
    // Retire les sondes.
    this.clear();
    // Libère la texture du point.
    this.textures.dot.dispose();
    // Celle de l'aura.
    this.textures.halo.dispose();
    // Retire le groupe de la scène.
    this.group.parent?.remove(this.group);
  // Fin de dispose.
  }
 
  // ---------------------------------------------------------------- Construction
 
  // createItem : crée les objets d'une sonde (début).
  createItem(o) {
    // Sa couleur, blanche par défaut.
    const color = new THREE.Color(COLORS[o.id] || '#ffffff');
    // La même en notation hexadécimale.
    const hex = `#${color.getHexString()}`;
 
    // Étiquettes HTML : la sonde (cliquable, survol = surbrillance) et ses deux apsides (informatives).
    // Étiquette de la sonde.
    const el = makeLabel('l orbiter-label', hex, o.name);
    // Son infobulle : le nom, l'agence et l'invitation à cliquer.
    el.title = `${o.name} (${o.agency}) · cliquer pour le détail`;
    // Rôle de bouton.
    el.setAttribute('role', 'button');
    // Au clic : choisit la sonde, sans propager le clic.
    el.addEventListener('click', (e) => { e.stopPropagation(); this.onPick?.(o.id); });
    // À l'entrée du pointeur : survol.
    el.addEventListener('pointerenter', () => this.hover(o.id));
    // À sa sortie : fin du survol, si c'était cette sonde.
    el.addEventListener('pointerleave', () => { if (this.hovered === o.id) this.hover(null); });
    // Étiquette du périlune.
    const periEl = makeLabel('l orbiter-apsis', hex, '');
    // Étiquette de l'apolune.
    const apoEl = makeLabel('l orbiter-apsis', hex, '');
    // Ajoute les trois à l'élément parent.
    this.parentEl.append(el, periEl, apoEl);
 
    // Trajectoire réelle, lissée.
    // Table utilisable : statut « ok » et au moins 4 points.
    const ok = o.status === 'ok' && Array.isArray(o.points) && o.points.length >= 4;
    // Trajectoire rééchantillonnée, ou aucune.
    const track = ok ? densifyTrack(o.points, { maxSamples: STYLE.maxSamples, minStepMs: STYLE.minStepMs }) : null;
    // Géométrie de la trajectoire.
    const trackGeo = new LineGeometry();
    // Couleurs de ses sommets : aucune pour l'instant.
    let trackColors = null;
    // S'il y a une trajectoire (début).
    if (track) {
      // Nombre de points.
      const n = track.times.length;
      // Positions.
      const positions = new Float32Array(n * 3);
      // Convertit chaque point vers la scène.
      for (let i = 0; i < n; i++) positions.set(kmToScene(track.km[i * 3], track.km[i * 3 + 1], track.km[i * 3 + 2]), i * 3);
      // Les donne à la géométrie.
      trackGeo.setPositions(positions);
      // Couleurs.
      trackColors = new Float32Array(n * 3);
      // Chaque sommet prend la couleur de la sonde à 60 %.
      for (let i = 0; i < trackColors.length; i += 3) { trackColors[i] = color.r * 0.6; trackColors[i + 1] = color.g * 0.6; trackColors[i + 2] = color.b * 0.6; }
      // Les donne à la géométrie.
      trackGeo.setColors(trackColors);
    // Fin de ce cas.
    }
    // Matériau de la trajectoire (début).
    const trackMat = this.lineMaterial({
      // Blanc.
      color: 0xffffff, // la teinte vient des couleurs de sommets (traînée)
      // Couleurs par sommet.
      vertexColors: true,
      // Sa largeur.
      linewidth: STYLE.width,
      // Son opacité.
      opacity: STYLE.opacity,
      // Mélange additif : un sommet sombre devient transparent, la traînée s'efface sans artefact.
      // Mélange additif.
      blending: THREE.AdditiveBlending,
    // Fin du matériau.
    });
    // Ligne de la trajectoire.
    const trackLine = noCull(new Line2(trackGeo, trackMat));
    // Visible s'il y a une trajectoire.
    trackLine.visible = Boolean(track);
    // Rang de dessin 2.
    trackLine.renderOrder = 2;
 
    // Matériau du halo : la couleur de la sonde, large, en mélange additif.
    const glowMat = this.lineMaterial({ color: color.clone(), linewidth: STYLE.glowWidth, opacity: STYLE.glowOpacity, blending: THREE.AdditiveBlending });
    // Ligne du halo, sur la même géométrie.
    const glowLine = noCull(new Line2(trackGeo, glowMat));
    // Masquée au départ.
    glowLine.visible = false;
    // Rang de dessin 1.
    glowLine.renderOrder = 1;
 
    // Orbite complète : tampon de taille fixe, mis à jour sur place (aucune réallocation GPU).
    // Positions de l'orbite complète.
    const orbitPositions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
    // Sa géométrie.
    const orbitGeo = new LineGeometry();
    // Lui donne les positions.
    orbitGeo.setPositions(orbitPositions);
    // Son matériau (début).
    const orbitMat = this.lineMaterial({
      // La couleur de la sonde.
      color: color.clone(),
      // Sa largeur.
      linewidth: STYLE.orbitWidth,
      // Son opacité.
      opacity: STYLE.orbitOpacity,
      // En pointillés.
      dashed: true,
      // Longueur d'un tiret, provisoire.
      dashSize: 0.01,
      // Longueur d'un vide, provisoire.
      gapSize: 0.008,
      // Mélange additif.
      blending: THREE.AdditiveBlending,
    // Fin du matériau.
    });
    // Ligne de l'orbite.
    const orbitLine = noCull(new Line2(orbitGeo, orbitMat));
    // Calcule les distances le long de la ligne.
    orbitLine.computeLineDistances(); // crée les attributs de distance, réécrits ensuite sur place
    // Masquée au départ.
    orbitLine.visible = false;
    // Rang de dessin 0.
    orbitLine.renderOrder = 0;
 
    // Point de la sonde (disque net) + aura en surbrillance, sur la même géométrie.
    // Géométrie du point de la sonde.
    const dotGeo = new THREE.BufferGeometry();
    // Une seule position.
    dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    // Point net (début).
    const dot = noCull(new THREE.Points(dotGeo, new THREE.PointsMaterial({
      // Couleur, taille fixe à l'écran et texture du disque net.
      color, size: STYLE.dot, sizeAttenuation: false, map: this.textures.dot,
      // Transparent, sans écriture de profondeur.
      transparent: true, alphaTest: 0.05, depthWrite: false,
    // Fin du point.
    })));
    // Masqué au départ.
    dot.visible = false;
    // Rang de dessin 5.
    dot.renderOrder = 5;
    // Aura (début).
    const halo = noCull(new THREE.Points(dotGeo, new THREE.PointsMaterial({
      // Couleur, taille fixe à l'écran et texture du dégradé.
      color, size: STYLE.halo, sizeAttenuation: false, map: this.textures.halo,
      // Transparente, opacité 0,85, en mélange additif.
      transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
    // Fin de l'aura.
    })));
    // Masquée au départ.
    halo.visible = false;
    // Rang de dessin 3.
    halo.renderOrder = 3;
 
    // Périlune et apolune.
    // Géométrie des apsides.
    const apsisGeo = new THREE.BufferGeometry();
    // Deux positions.
    apsisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    // Points des apsides (début).
    const apsis = noCull(new THREE.Points(apsisGeo, new THREE.PointsMaterial({
      // Couleur de la sonde éclaircie de 40 %, taille fixe à l'écran.
      color: color.clone().lerp(new THREE.Color('#ffffff'), 0.4), size: STYLE.apsis, sizeAttenuation: false,
      // Texture du disque net, transparent, sans écriture de profondeur.
      map: this.textures.dot, transparent: true, alphaTest: 0.05, depthWrite: false,
    // Fin des points.
    })));
    // Masqués au départ.
    apsis.visible = false;
    // Rang de dessin 4.
    apsis.renderOrder = 4;
 
    // Ajoute les six objets au groupe.
    this.group.add(orbitLine, glowLine, trackLine, halo, apsis, dot);
    // Renvoie la sonde (début) :
    return {
      // les données reçues,
      ...o,
      // si sa trajectoire est utilisable,
      ok: Boolean(track),
      // sa couleur et ses trois étiquettes,
      color, el, periEl, apoEl,
      // les instants, les couleurs, la géométrie, le matériau et la ligne de la trajectoire, le matériau et la ligne du halo,
      times: track?.times ?? null, trackColors, trackGeo, trackMat, trackLine, glowMat, glowLine,
      // la ligne de la trajectoire sous son ancien nom,
      line: trackLine, // compatibilité : l'ancien code du moteur peut lire `item.line`
      // les objets de l'orbite complète et l'état de son calcul,
      orbitPositions, orbitGeo, orbitMat, orbitLine, orbit: null, orbitAt: 0, orbitT: null,
      // les objets du point, de l'aura et des apsides,
      dotGeo, dot, halo, apsisGeo, apsis,
      // sans état, sans surbrillance, traînée jamais peinte.
      state: null, active: false, lastPaint: 0,
    // Fin de la sonde.
    };
  // Fin de createItem.
  }
 
  // lineMaterial : crée un matériau de ligne (début).
  lineMaterial(params) {
    // Transparent, sans écriture de profondeur, avec les réglages reçus.
    const mat = new LineMaterial({ transparent: true, depthWrite: false, ...params });
    // Lui branche la taille de l'écran partagée.
    mat.uniforms.resolution.value = this.resolution; // même vecteur pour toutes les lignes
    // Le renvoie.
    return mat;
  // Fin de lineMaterial.
  }
 
  /** Largeur, opacité et classes des étiquettes selon la sélection et le survol. */
  // applyStyles : règle l'aspect selon la sélection et le survol (début).
  applyStyles() {
    // Sonde mise en avant : la sélectionnée, sinon la survolée.
    const focus = this.selected ?? this.hovered;
    // Pour chaque sonde (début).
    for (const it of this.items) {
      // En surbrillance si elle est sélectionnée ou survolée.
      const active = it.id === this.selected || it.id === this.hovered;
      // Estompée si une autre est mise en avant.
      const dimmed = focus !== null && !active;
      // Garde l'état.
      it.active = active;
      // Largeur de la trajectoire.
      it.trackMat.linewidth = active ? STYLE.widthActive : STYLE.width;
      // Opacité de la trajectoire.
      it.trackMat.opacity = dimmed ? STYLE.opacityDimmed : STYLE.opacity;
      // Opacité de l'orbite : forte en surbrillance, divisée par deux si estompée.
      it.orbitMat.opacity = active ? STYLE.orbitOpacityActive : dimmed ? STYLE.orbitOpacity * 0.5 : STYLE.orbitOpacity;
      // Rang de dessin : 6 en surbrillance, sinon 2.
      it.trackLine.renderOrder = active ? 6 : 2;
      // Classe « selected » sur l'étiquette.
      it.el.classList.toggle('selected', it.id === this.selected);
      // Classe « hovered », si elle est survolée sans être sélectionnée.
      it.el.classList.toggle('hovered', it.id === this.hovered && it.id !== this.selected);
      // Traînée à repeindre.
      it.lastPaint = 0; // repeindre la traînée dès la prochaine image
    // Fin de la boucle.
    }
  // Fin de applyStyles.
  }
 
  /** Recalcule l'orbite complète depuis l'état actuel de la sonde et réécrit les tampons sur place. */
  // refreshOrbit : recalcule l'orbite complète d'une sonde (début).
  refreshOrbit(it) {
    // L'ellipse, depuis la position et la vitesse actuelles.
    const o = osculatingOrbit(it.state.r, it.state.v, MOON_GM, ORBIT_SEGMENTS);
    // Aucune, ou apolune au-delà de 90 000 km : pas d'orbite, terminé.
    if (!o || o.ra > MAX_APOLUNE_KM) { it.orbit = null; return; }
 
    // Tampon des positions.
    const pos = it.orbitPositions;
    // Pour chaque point (début).
    for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
      // Le convertit vers la scène.
      pos.set(kmToScene(o.points[i * 3], o.points[i * 3 + 1], o.points[i * 3 + 2]), i * 3);
    // Fin de la boucle.
    }
    // Écrit les positions dans la géométrie.
    writeLinePositions(it.orbitGeo, pos);
    // Écrit les distances et récupère la longueur du tour.
    const total = writeLineDistances(it.orbitGeo, pos);
    // Tirets proportionnels au périmètre : même aspect pour LRO (≈ 1 800 km) et CAPSTONE (≈ 70 000 km).
    // Longueur d'un tiret et de son vide.
    const dash = total / STYLE.orbitDashes;
    // Tiret : 58 %.
    it.orbitMat.dashSize = dash * 0.58;
    // Vide : 42 %.
    it.orbitMat.gapSize = dash * 0.42;
 
    // Périlune dans la scène.
    const periScene = kmToScene(...o.periapsis);
    // Apolune dans la scène.
    const apoScene = kmToScene(...o.apoapsis);
    // Les écrit dans la géométrie des apsides.
    it.apsisGeo.attributes.position.array.set([...periScene, ...apoScene]);
    // À envoyer à la carte graphique.
    it.apsisGeo.attributes.position.needsUpdate = true;
    // Recalcule la sphère englobante.
    it.apsisGeo.computeBoundingSphere();
 
    // Altitude du périlune, en kilomètres entiers.
    const periAlt = Math.round(o.rp - MOON_RADIUS_KM);
    // Altitude de l'apolune.
    const apoAlt = Math.round(o.ra - MOON_RADIUS_KM);
    // Si elle a changé : met à jour le texte du périlune.
    if (it.orbit?.periAlt !== periAlt) it.periEl.textContent = `Périlune · ${kmFormat.format(periAlt)} km`;
    // De même pour l'apolune.
    if (it.orbit?.apoAlt !== apoAlt) it.apoEl.textContent = `Apolune · ${kmFormat.format(apoAlt)} km`;
    // Garde l'orbite, avec les deux points et les deux altitudes.
    it.orbit = { ...o, periScene, apoScene, periAlt, apoAlt };
  // Fin de refreshOrbit.
  }
// Fin de la classe MoonOrbiters.
}
 
// ---------------------------------------------------------------- Traînée de comète
 
/**
 * Chaque sommet de la trajectoire reçoit la couleur de la sonde multipliée par une intensité qui dépend de son écart
 * à l'instant `t` : récent = brillant, ancien = sombre, futur = discret. La traînée couvre environ une révolution
 * (période de l'orbite complète), plus longue en surbrillance.
 */
// paintTrail : peint la traînée d'une sonde à l'instant t (début).
function paintTrail(it, t) {
  // Les instants et les couleurs des sommets.
  const { times, trackColors: c } = it;
  // S'il en manque : rien.
  if (!times || !c) return;
  // Nombre de sommets.
  const n = times.length;
  // Durée couverte, 1 ms au moins.
  const span = Math.max(times[n - 1] - times[0], 1);
  // Période de l'orbite, en millisecondes, ou 0.
  const periodMs = it.orbit ? it.orbit.periodS * 1000 : 0;
  // Durée de référence : la période si elle est plausible, sinon la durée couverte.
  const base = periodMs > 0 && periodMs < span * 3 ? periodMs : span;
  // Constante de décroissance : plus longue en surbrillance.
  const tau = base / (it.active ? 2.5 : 4);
  // Renfort : 1,3 en surbrillance, sinon 0,85.
  const boost = it.active ? 1.3 : 0.85;
  // Réglages de la traînée.
  const opts = { floor: STYLE.trailFloor, future: STYLE.trailFuture };
  // Couleur de la sonde.
  const { r, g, b } = it.color;
  // Pour chaque sommet (début).
  for (let i = 0; i < n; i++) {
    // Son intensité, 1,6 au plus.
    const k = Math.min(1.6, trailIntensity(t - times[i], tau, opts) * boost);
    // Sa couleur.
    c[i * 3] = r * k; c[i * 3 + 1] = g * k; c[i * 3 + 2] = b * k;
  // Fin de la boucle.
  }
  // Écrit les couleurs dans la géométrie.
  writeLineColors(it.trackGeo, c);
// Fin de paintTrail.
}
 
// ---------------------------------------------------------------- Écriture sur place dans les tampons de Line2
// LineGeometry stocke chaque segment comme une instance [début, fin]. setPositions / setColors / computeLineDistances
// recréent ces tampons à chaque appel (et l'ancien tampon GPU n'est libéré qu'au dispose) : on réécrit donc sur place.
 
// writeSegmentPairs : réécrit sur place les paires début/fin de chaque segment (début).
function writeSegmentPairs(attribute, values, itemSize) {
  // Tableau de destination.
  const out = attribute.data.array;
  // Nombre de segments.
  const segments = values.length / itemSize - 1;
  // Taille différente : faux.
  if (out.length !== segments * itemSize * 2) return false;
  // Pour chaque segment (début).
  for (let s = 0; s < segments; s++) {
    // Positions d'écriture et de lecture.
    const o = s * itemSize * 2, a = s * itemSize;
    // Pour chaque composante (début).
    for (let k = 0; k < itemSize; k++) {
      // Écrit le début du segment.
      out[o + k] = values[a + k];
      // Écrit sa fin.
      out[o + itemSize + k] = values[a + itemSize + k];
    // Fin de la boucle des composantes.
    }
  // Fin de la boucle des segments.
  }
  // À envoyer à la carte graphique.
  attribute.data.needsUpdate = true;
  // Vrai.
  return true;
// Fin de writeSegmentPairs.
}
 
// writeLinePositions : écrit les positions d'une ligne (début).
function writeLinePositions(geometry, positions) {
  // L'attribut des débuts de segments.
  const attr = geometry.attributes.instanceStart;
  // Écriture sur place ; à défaut, la géométrie recrée ses tampons.
  if (!attr || !writeSegmentPairs(attr, positions, 3)) geometry.setPositions(positions);
// Fin de writeLinePositions.
}
 
// writeLineColors : écrit les couleurs d'une ligne (début).
function writeLineColors(geometry, colors) {
  // L'attribut des couleurs.
  const attr = geometry.attributes.instanceColorStart;
  // Écriture sur place ; à défaut, la géométrie recrée ses tampons.
  if (!attr || !writeSegmentPairs(attr, colors, 3)) geometry.setColors(colors);
// Fin de writeLineColors.
}
 
/** Distances cumulées le long de la ligne (pour les pointillés) ; renvoie la longueur totale. */
// writeLineDistances : écrit les distances cumulées le long d'une ligne (début).
function writeLineDistances(geometry, positions) {
  // Nombre de points.
  const n = positions.length / 3;
  // Distances cumulées.
  const cumul = new Float32Array(n);
  // Pour chaque point après le premier (début).
  for (let i = 1; i < n; i++) {
    // Indices du point précédent et du point.
    const a = (i - 1) * 3, b = i * 3;
    // Ajoute la longueur du segment.
    cumul[i] = cumul[i - 1] + Math.hypot(positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]);
  // Fin de la boucle.
  }
  // L'attribut des distances.
  const attr = geometry.attributes.instanceDistanceStart;
  // Écriture sur place, s'il existe.
  if (attr) writeSegmentPairs(attr, cumul, 1);
  // Renvoie la longueur totale.
  return cumul[n - 1];
// Fin de writeLineDistances.
}
 
// ---------------------------------------------------------------- Étiquettes HTML
 
// makeLabel : crée une étiquette HTML (début).
function makeLabel(className, hex, text) {
  // Élément div.
  const el = document.createElement('div');
  // Sa classe.
  el.className = className;
  // Sa couleur, dans la variable CSS --c.
  el.style.setProperty('--c', hex);
  // Cachée au départ.
  el.style.display = 'none';
  // Son texte.
  el.textContent = text;
  // Pour une étiquette d'apside (début).
  if (className.includes('orbiter-apsis')) {
    // Elle ne reçoit pas le pointeur.
    el.style.pointerEvents = 'none';
    // Texte de 10 px.
    el.style.fontSize = '10px';
    // Opacité 0,85.
    el.style.opacity = '0.85';
  // Fin de ce cas.
  }
  // La renvoie.
  return el;
// Fin de makeLabel.
}
 
/** Place une étiquette sur un point du repère de la Lune ; cachée si la Lune le masque ou s'il sort de l'écran. */
// placeLabel : place une étiquette sur un point du repère de la Lune (début).
function placeLabel(el, s, { camRel, moonRadius, moonPos, cam, W, H }, dx, dy) {
  // La Lune masque le point : étiquette cachée, terminé.
  if (segmentHitsSphere(camRel, s, moonRadius)) { setDisplay(el, false); return; }
  // Projette le point à l'écran.
  v3.set(s[0], s[1], s[2]).add(moonPos).project(cam);
  // Derrière la caméra ou hors de l'écran : cachée, terminé.
  if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) { setDisplay(el, false); return; }
  // Étiquette affichée.
  setDisplay(el, true);
  // Abscisse en pixels, avec le décalage.
  const x = ((v3.x + 1) / 2) * W + dx;
  // Ordonnée en pixels, avec le décalage.
  const y = ((1 - v3.y) / 2) * H + dy;
  // Si la position a bougé de plus de 0,05 px (début).
  if (el._x === undefined || Math.abs(el._x - x) > 0.05 || Math.abs(el._y - y) > 0.05) {
    // Garde la position.
    el._x = x; el._y = y;
    // Déplace l'étiquette.
    el.style.transform = `translate(${x}px,${y}px)`;
  // Fin de ce cas.
  }
// Fin de placeLabel.
}
 
// hideLabels : cache les trois étiquettes d'une sonde (début).
function hideLabels(it) {
  // Celle de la sonde.
  setDisplay(it.el, false);
  // Celle du périlune.
  setDisplay(it.periEl, false);
  // Celle de l'apolune.
  setDisplay(it.apoEl, false);
// Fin de hideLabels.
}
 
// ---------------------------------------------------------------- Utilitaires
 
// noCull : empêche le champ de vision d'écarter un objet (début).
function noCull(object) {
  // Coupe le test.
  object.frustumCulled = false; // les boîtes englobantes suivent mal un groupe qui se déplace avec la Lune
  // Renvoie l'objet.
  return object;
// Fin de noCull.
}
 
/**
 * Disque blanc dessiné sur un canvas, teinté ensuite par la couleur du matériau.
 * `hard` = part du rayon à pleine opacité (0 : dégradé doux pour un halo, ≈ 0,8 : point net aux bords lissés).
 */
// makeDiscTexture : dessine un disque blanc (début).
function makeDiscTexture(hard) {
  // Côté de 64 px.
  const size = 64;
  // Canevas.
  const canvas = document.createElement('canvas');
  // Carré.
  canvas.width = canvas.height = size;
  // Contexte de dessin.
  const ctx = canvas.getContext('2d');
  // Dégradé radial, du centre au bord.
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Disque net (début).
  if (hard > 0) {
    // Plein au centre.
    g.addColorStop(0, 'rgba(255,255,255,1)');
    // Plein jusqu'à la part demandée du rayon.
    g.addColorStop(hard, 'rgba(255,255,255,1)');
    // Transparent au bord.
    g.addColorStop(1, 'rgba(255,255,255,0)');
  // Halo (début).
  } else {
    // 0,9 au centre.
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    // 0,45 au quart du rayon.
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    // 0,12 à 60 %.
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    // Transparent au bord.
    g.addColorStop(1, 'rgba(255,255,255,0)');
  // Fin du choix.
  }
  // Remplissage avec le dégradé.
  ctx.fillStyle = g;
  // Remplit le carré.
  ctx.fillRect(0, 0, size, size);
  // Texture à partir du canevas.
  const texture = new THREE.CanvasTexture(canvas);
  // Three.js 0.128 utilise `encoding` ; `colorSpace` / `SRGBColorSpace` sont arrivés plus tard.
  // Encodage sRGB, s'il existe dans cette version de three.js.
  if (THREE.sRGBEncoding !== undefined) texture.encoding = THREE.sRGBEncoding;
  // La renvoie.
  return texture;
// Fin de makeDiscTexture.
}
 
/** Le segment a → b (centre de la sphère à l'origine) traverse-t-il la sphère de rayon r ? */
// Déclare et exporte segmentHitsSphere : le segment de a à b traverse-t-il la sphère de rayon r (début).
export function segmentHitsSphere(a, b, r) {
  // Vecteur de a vers b.
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  // Sa longueur au carré.
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  // Segment nul : faux.
  if (dd === 0) return false;
  // Position, entre 0 et 1, du point du segment le plus proche du centre.
  const t = Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1] + a[2] * d[2]) / dd));
  // Ce point.
  const p = [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t];
  // Vrai s'il est strictement entre les deux bouts et à l'intérieur de la sphère.
  return t > 0 && t < 1 && Math.hypot(p[0], p[1], p[2]) < r * 0.999;
// Fin de segmentHitsSphere.
}
 
/** N'écrit `display` que s'il change (une écriture de style par image et par étiquette coûte un recalcul). */
// setDisplay : affiche ou cache une étiquette (début).
function setDisplay(el, on) {
  // Déjà dans cet état : rien à faire.
  if (el._shown === on) return;
  // Garde l'état.
  el._shown = on;
  // Règle l'affichage.
  el.style.display = on ? 'block' : 'none';
// Fin de setDisplay.
}
 