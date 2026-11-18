// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le calcul des vents.
import { FLOW_MAX_LAT, advect, flowRadius, normalizeWinds, randomPoint, sampleWind, speedColor, timeScale } from './flowMath.jsx';
// Importe les flèches tracées sur le globe.
import { arrowSegments } from './radarMath.jsx';

// Calque des vents sur la Terre (AtmosphericFlowEngine, rendu). Des particules suivent le vent du modèle au niveau
// choisi, à une altitude exagérée (les niveaux se séparent en 3D), avec une traîne qui s'efface ; leur couleur dit la
// vitesse. Les axes des courants-jets (repérés à 250 hPa) sont tracés en flèches à leur altitude. Le vent vient d'un
// modèle sur une grille de 12° × 10° : les particules en montrent la circulation, pas des trajectoires mesurées.

/** Nombre de particules. */
// Déclare et exporte le nombre de particules.
export const FLOW_PARTICLES = 4000;
/** Points gardés par traîne. */
// Déclare et exporte la longueur de la traîne.
export const FLOW_TRAIL = 8;
/** Pas de temps entre deux points de traîne (s) : une traîne d'environ 0,85 s de mouvement. */
// Déclare et exporte le pas de la traîne.
export const FLOW_TRAIL_STEP_S = 0.12;

// Shader de sommets des traînes, une ligne GLSL par chaîne (début).
const vertex = [
  // Inclusions de three.js : fonctions communes et profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Attribut : couleur et opacité du sommet.
  'attribute vec4 rgba;',
  // Variable transmise : couleur et opacité.
  'varying vec4 vC;',
  // Début de la fonction principale.
  'void main(){',
  // Couleur transmise.
  '  vC=rgba;',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
  // Profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// Shader de fragments des traînes, une ligne GLSL par chaîne (début).
const fragment = [
  // Inclusion de three.js : profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Uniformes : opacité et intensité.
  'uniform float opacity;uniform float intensity;',
  // Variable reçue.
  'varying vec4 vC;',
  // Début de la fonction principale.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Opacité totale.
  '  float a=vC.a*opacity*clamp(intensity,.5,2.);',
  // Invisible : rien.
  '  if(a<.01)discard;',
  // Couleur finale, éclaircie avec l’intensité.
  '  gl_FragColor=vec4(vC.rgb*(.85+.15*intensity),min(a,1.));',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

/** Calque des vents : `set(data)` pose la réponse /atmosphere/winds ; `setLevel`, `setJets`, `setVisible`, `setOpacity`… */
// Déclare et exporte la classe FlowLayer.
export class FlowLayer {
  // Constructeur.
  constructor() {
    // Repère du calque, masqué au départ.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-winds';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Vents mis en forme, niveau choisi, axes affichés, rayon du niveau.
    this.data = null; this.level = '250hPa'; this.showJets = true; this.radius = flowRadius(10.4);
    // Particules : position, âge, durée de vie, vitesse ; traînes (positions 3D, anneau commun).
    const n = FLOW_PARTICLES, k = FLOW_TRAIL;
    // Tableaux des particules.
    this.lon = new Float32Array(n); this.lat = new Float32Array(n); this.age = new Float32Array(n); this.life = new Float32Array(n); this.speed = new Float32Array(n);
    // Traînes : k points de 3 coordonnées par particule ; index du point le plus récent ; temps accumulé.
    this.hist = new Float32Array(n * k * 3); this.head = 0; this.acc = 0; this.last = performance.now();
    // Géométrie des segments : (k − 1) segments de 2 sommets par particule.
    const verts = n * (k - 1) * 2;
    // Positions et couleurs des sommets.
    this.pos = new Float32Array(verts * 3); this.rgba = new Float32Array(verts * 4);
    // Géométrie.
    const g = new THREE.BufferGeometry();
    // Positions, mises à jour à chaque image.
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    // Couleurs et opacités, mises à jour à chaque image.
    g.setAttribute('rgba', new THREE.BufferAttribute(this.rgba, 4).setUsage(THREE.DynamicDrawUsage));
    // Uniformes.
    this.uniforms = { opacity: { value: 0.85 }, intensity: { value: 1 } };
    // Matériau : transparent, caché derrière la Terre, sans écriture de la profondeur.
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false });
    // Segments des traînes.
    this.trails = new THREE.LineSegments(g, this.material);
    // Toujours calculés : la Terre les cache.
    this.trails.frustumCulled = false;
    // Après les autres calques.
    this.trails.renderOrder = 47;
    // Ne se cliquent pas.
    this.trails.raycast = () => {};
    // Masqués tant qu'aucun vent n'est posé.
    this.trails.visible = false;
    // Altitude de la vue (rayons terrestres) et vecteur de travail.
    this.alt = 1.5; this.camTmp = new THREE.Vector3();
    // Avant chaque rendu : altitude de la vue, puis les particules avancent.
    this.trails.onBeforeRender = (renderer, scene, camera) => { this.alt = Math.max(0, this.trails.worldToLocal(this.camTmp.setFromMatrixPosition(camera.matrixWorld)).length() - 1); this.step(); };
    // Matériau des axes des courants-jets.
    this.jetMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    // Axes, null tant qu'il n'y en a pas.
    this.jets = null;
    // Traînes dans le repère.
    this.root.add(this.trails);
  // Fin du constructeur.
  }

  // spawn : (re)place la particule i au hasard, traîne repliée sur elle.
  spawn(i) {
    // Point au hasard.
    const [lo, la] = randomPoint();
    // Position, âge et durée de vie (3 à 7 s, l'âge de départ dispersé).
    this.lon[i] = lo; this.lat[i] = la; this.age[i] = 0; this.life[i] = 3 + Math.random() * 4;
    // Toute la traîne sur ce point.
    for (let j = 0; j < FLOW_TRAIL; j++) this.write((i * FLOW_TRAIL + j) * 3, lo, la);
  // Fin de spawn.
  }

  // write : écrit dans la traîne, à l'indice `o`, le point 3D d'une position au rayon du niveau (sans allocation ;
  // même convention que lonLatToUnit).
  write(o, lon, lat) {
    // Rayon du niveau, longitude et latitude en radians.
    const r = this.radius, lo = (lon * Math.PI) / 180, la = (lat * Math.PI) / 180;
    // Cosinus de la latitude, mis à l'échelle.
    const cl = Math.cos(la) * r;
    // Coordonnées : x, y (pôle nord), z.
    this.hist[o] = cl * Math.cos(lo); this.hist[o + 1] = Math.sin(la) * r; this.hist[o + 2] = -cl * Math.sin(lo);
  // Fin de write.
  }

  // reset : toutes les particules replacées (nouveau niveau, nouveaux vents).
  reset() {
    // Rayon du niveau choisi.
    this.radius = flowRadius(this.data?.levels[this.level]?.altKm ?? 0);
    // Chaque particule, avec un âge dispersé (pas d'apparition d'ensemble).
    for (let i = 0; i < FLOW_PARTICLES; i++) { this.spawn(i); this.age[i] = Math.random() * this.life[i]; }
  // Fin de reset.
  }

  // step : avance les particules et réécrit les traînes (début).
  step() {
    // Instant courant et durée écoulée (bornée : un onglet repris ne fait pas sauter les particules).
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000);
    // Noté.
    this.last = now;
    // Vents du niveau.
    const level = this.data?.levels[this.level], grid = this.data?.grid;
    // Aucun : rien.
    if (!level || !grid) return;
    // Temps accumulé : un point de traîne tous les 0,12 s.
    this.acc += dt;
    // Durée de vent parcourue pendant cette image (accélération selon l'altitude de la vue).
    const sim = dt * timeScale(this.alt);
    // Nouveau point de traîne ?
    const record = this.acc >= FLOW_TRAIL_STEP_S;
    // Point le plus récent : suivant dans l'anneau.
    if (record) { this.acc %= FLOW_TRAIL_STEP_S; this.head = (this.head + 1) % FLOW_TRAIL; }
    // Particule par particule (début).
    for (let i = 0; i < FLOW_PARTICLES; i++) {
      // Vieillie.
      this.age[i] += dt;
      // Fin de vie ou sortie de la grille : replacée.
      if (this.age[i] > this.life[i] || Math.abs(this.lat[i]) > FLOW_MAX_LAT) { this.spawn(i); continue; }
      // Vent au point.
      const [u, v] = sampleWind(grid, level, this.lon[i], this.lat[i]);
      // Vitesse gardée pour la couleur.
      this.speed[i] = Math.hypot(u, v);
      // Déplacement (temps accéléré).
      const [lo, la] = advect(this.lon[i], this.lat[i], u, v, sim);
      // Nouvelle position.
      this.lon[i] = lo; this.lat[i] = la;
      // Point de traîne enregistré, ou point le plus récent déplacé.
      this.write((i * FLOW_TRAIL + this.head) * 3, lo, la);
    // Fin des particules.
    }
    // Segments réécrits (début).
    for (let i = 0; i < FLOW_PARTICLES; i++) {
      // Couleur de la vitesse.
      const c = speedColor(this.speed[i]);
      // Apparition et disparition en douceur selon l'âge.
      const t = this.age[i] / this.life[i], fade = Math.min(1, t * 4) * Math.min(1, (1 - t) * 4);
      // Segment par segment, du plus récent au plus ancien.
      for (let j = 0; j < FLOW_TRAIL - 1; j++) {
        // Points du segment dans l'anneau.
        const a = (i * FLOW_TRAIL + ((this.head - j + FLOW_TRAIL) % FLOW_TRAIL)) * 3, b = (i * FLOW_TRAIL + ((this.head - j - 1 + FLOW_TRAIL) % FLOW_TRAIL)) * 3;
        // Indice du premier sommet.
        const o = (i * (FLOW_TRAIL - 1) + j) * 2;
        // Positions des deux sommets.
        this.pos[o * 3] = this.hist[a]; this.pos[o * 3 + 1] = this.hist[a + 1]; this.pos[o * 3 + 2] = this.hist[a + 2]; this.pos[o * 3 + 3] = this.hist[b]; this.pos[o * 3 + 4] = this.hist[b + 1]; this.pos[o * 3 + 5] = this.hist[b + 2];
        // Opacités : la tête vive, la queue effacée.
        const al = fade * (1 - j / (FLOW_TRAIL - 1)), bl = fade * (1 - (j + 1) / (FLOW_TRAIL - 1));
        // Couleurs et opacités des deux sommets.
        const q = o * 4; this.rgba[q] = this.rgba[q + 4] = c[0]; this.rgba[q + 1] = this.rgba[q + 5] = c[1]; this.rgba[q + 2] = this.rgba[q + 6] = c[2]; this.rgba[q + 3] = al; this.rgba[q + 7] = bl;
      // Fin des segments.
      }
    // Fin des particules.
    }
    // Tableaux à renvoyer à la carte graphique.
    this.trails.geometry.attributes.position.needsUpdate = true; this.trails.geometry.attributes.rgba.needsUpdate = true;
  // Fin de step.
  }

  // buildJets : axes des courants-jets en flèches, à l'altitude de 250 hPa (début).
  buildJets() {
    // Anciens axes retirés et libérés.
    if (this.jets) { this.root.remove(this.jets); this.jets.geometry.dispose(); this.jets = null; }
    // Axes reçus.
    const jets = this.data?.jets ?? [];
    // Aucun : rien.
    if (!jets.length) return;
    // Rayon : 250 hPa, un peu au-dessus des particules.
    const r = flowRadius(10.4) + 0.0006;
    // Positions et couleurs.
    const pos = [], col = [];
    // Pour chaque axe : une flèche par tronçon, à la couleur de sa vitesse maximale.
    for (const j of jets) { const c = speedColor(j.maxKmh / 3.6); for (let i = 1; i < j.points.length; i++) { const seg = arrowSegments(j.points[i - 1], j.points[i], r, 6); pos.push(...seg); for (let v = 0; v < seg.length / 3; v++) col.push(...c); } }
    // Géométrie.
    const g = new THREE.BufferGeometry();
    // Positions et couleurs.
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // Segments.
    this.jets = new THREE.LineSegments(g, this.jetMaterial);
    // Après les traînes.
    this.jets.renderOrder = 48;
    // Ne se cliquent pas.
    this.jets.raycast = () => {};
    // Affichés selon le réglage.
    this.jets.visible = this.showJets;
    // Ajoutés.
    this.root.add(this.jets);
  // Fin de buildJets.
  }

  /** Pose la réponse /atmosphere/winds (null : tout retirer). */
  // set : la réponse.
  set(raw) {
    // Mise en forme.
    this.data = raw ? normalizeWinds(raw) : null;
    // Traînes visibles si le niveau choisi est disponible.
    this.trails.visible = Boolean(this.data?.levels[this.level]);
    // Particules replacées.
    this.reset();
    // Axes reconstruits.
    this.buildJets();
  // Fin de set.
  }

  // setLevel : niveau montré ('10m', '850hPa', '500hPa' ou '250hPa').
  setLevel(level) { if (level === this.level) return; this.level = level; this.trails.visible = Boolean(this.data?.levels[level]); this.reset(); }
  // setJets : affiche ou masque les axes des courants-jets.
  setJets(on) { this.showJets = on !== false; if (this.jets) this.jets.visible = this.showJets; }
  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); this.last = performance.now(); }
  // setOpacity : opacité, de 0 à 1.
  setOpacity(v) { const o = Math.min(1, Math.max(0, Number(v) || 0)); this.uniforms.opacity.value = o; this.jetMaterial.opacity = 0.9 * o; }
  // setIntensity : intensité visuelle, de 0,5 à 2.
  setIntensity(v) { this.uniforms.intensity.value = Math.min(2, Math.max(0.5, Number(v) || 1)); }

  // dispose : libère tout.
  dispose() {
    // Traînes et axes.
    this.trails.geometry.dispose(); this.jets?.geometry.dispose();
    // Matériaux.
    this.material.dispose(); this.jetMaterial.dispose();
  // Fin de dispose.
  }
// Fin de FlowLayer.
}
