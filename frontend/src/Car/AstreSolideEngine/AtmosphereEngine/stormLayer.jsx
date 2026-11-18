// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la conversion longitude, latitude → point de la sphère unité.
import { lonLatToUnit } from '../../EruptionEngine/volcanoesMath.jsx';
// Importe la mise en forme des orages et les tracés sur le globe.
import { arrowSegments, normalizeStorms, ringSegments } from './radarMath.jsx';

// Calque des orages sur la Terre (StormEngine, rendu). Deux natures, distinguées à l'œil :
//  - les cellules convectives ESTIMÉES d'après le radar : un anneau à la taille de la zone de forte réflectivité,
//    coloré selon son maximum (orange : modérée, rouge : forte, magenta : très forte), en tirets si la cellule n'a été
//    vue que sur une image ; une flèche fine montre son déplacement estimé sur les 30 prochaines minutes ;
//  - les avertissements OFFICIELS (NWS, États-Unis) : le contour de leur zone (rouge : tornade, jaune : orage violent),
//    doublé si le phénomène est observé, avec le déplacement publié.

// Shader de sommets des cellules, une ligne GLSL par chaîne (début).
const cellVertex = [
  // Inclusions de three.js : fonctions communes et profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Uniformes : échelle, densité, caméra dans le repère de la Terre, opacité, intensité.
  'uniform float pixels;uniform float dpr;uniform vec3 camL;uniform float opacity;uniform float intensity;',
  // Attributs : teinte ; rayon (rayons terrestres), confiance, suivie (1) ou nouvelle (0).
  'attribute vec3 tint;attribute vec3 cell;',
  // Variables transmises : couleur, opacité, nouvelle.
  'varying vec3 vColor;varying float vAlpha;varying float vNew;',
  // Début de la fonction principale.
  'void main(){',
  // Position, au-dessus du radar.
  '  vec4 mv=modelViewMatrix*vec4(position,1.);',
  // À l’écran.
  '  gl_Position=projectionMatrix*mv;',
  // Profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Distance à la caméra.
  '  float dist=max(-mv.z,1e-6);',
  // Côté visible de la Terre (1) ou derrière l’horizon (0).
  '  float horizon=smoothstep(1.,1.0004,dot(normalize(position),camL));',
  // Taille : le diamètre de la zone, au moins 12 points CSS, au plus 180.
  '  gl_PointSize=clamp(2.2*cell.x*pixels/dist,12.*dpr,180.*dpr)*(.9+.1*intensity);',
  // Couleur, opacité (horizon, confiance, opacité choisie) et nouvelle.
  '  vColor=tint;vAlpha=horizon*(.55+.45*cell.y)*opacity;vNew=1.-cell.z;',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// Shader de fragments des cellules, une ligne GLSL par chaîne (début).
const cellFragment = [
  // Inclusion de three.js : profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Uniforme : intensité.
  'uniform float intensity;',
  // Variables reçues.
  'varying vec3 vColor;varying float vAlpha;varying float vNew;',
  // Début de la fonction principale.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Point du disque, de −1 à 1, et distance au centre.
  '  vec2 c=(gl_PointCoord-.5)*2.;float d=length(c);',
  // Anneau au bord du disque.
  '  float ring=smoothstep(.74,.82,d)*(1.-smoothstep(.92,1.,d));',
  // Tirets pour une cellule vue sur une seule image (12 tirets).
  '  ring*=mix(1.,step(.45,fract(atan(c.y,c.x)/6.2831853*12.)),vNew);',
  // Voile intérieur léger et point central.
  '  float fill=(1.-smoothstep(0.,.82,d))*.12*intensity;float core=1.-smoothstep(.08,.16,d);',
  // Opacité totale.
  '  float a=(ring*.95+fill+core*.85)*vAlpha;',
  // Invisible : rien.
  '  if(a<.01)discard;',
  // Couleur finale.
  '  gl_FragColor=vec4(vColor,a);',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// lines : segments colorés (positions à plat, couleur par sommet), dessinés après les cellules.
function lines(positions, colors, material) {
  // Géométrie.
  const g = new THREE.BufferGeometry();
  // Positions.
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // Couleurs.
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // Segments.
  const l = new THREE.LineSegments(g, material);
  // Dessinés après le radar et la foudre.
  l.renderOrder = 45;
  // Ne se cliquent pas.
  l.raycast = () => {};
  // Segments.
  return l;
// Fin de lines.
}

// rgb : couleur CSS → trois composantes de 0 à 1.
const rgb = (css) => { const c = new THREE.Color(css); return [c.r, c.g, c.b]; };
// Couleurs des avertissements : tornade, orage violent.
const TORNADO = rgb('#ff2d55'), SEVERE = rgb('#ffd23f');

/** Calque des orages : `set(data)` pose la réponse /atmosphere/storms ; `setVisible`, `setOpacity`, `setIntensity`. */
// Déclare et exporte la classe StormLayer.
export class StormLayer {
  // Constructeur.
  constructor() {
    // Repère du calque, masqué au départ.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-storms';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Vecteur de travail.
    this.bufferSize = new THREE.Vector2();
    // Uniformes des cellules.
    this.uniforms = { pixels: { value: 1000 }, dpr: { value: 1 }, camL: { value: new THREE.Vector3(0, 0, 3) }, opacity: { value: 0.9 }, intensity: { value: 1 } };
    // Matériau des cellules : sans profondeur (l'horizon est géré par le shader).
    this.cellMaterial = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: cellVertex, fragmentShader: cellFragment, transparent: true, depthTest: false, depthWrite: false });
    // Matériau des flèches des cellules : couleur par sommet, cachées derrière la Terre.
    this.arrowMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false });
    // Matériau des avertissements : couleur par sommet, plus marqué.
    this.warnMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    // Objets posés.
    this.objects = [];
    // Opacité choisie.
    this.opacity = 0.9;
  // Fin du constructeur.
  }

  /** Pose la réponse /atmosphere/storms (null : tout retirer). */
  // set : la réponse.
  set(data) {
    // Anciens objets retirés et libérés.
    this.objects.forEach((o) => { this.root.remove(o); o.geometry.dispose(); }); this.objects = [];
    // Mise en forme.
    const { cells, warnings } = normalizeStorms(data);
    // Cellules (début).
    if (cells.length) {
      // Tableaux : positions, couleurs, données.
      const pos = new Float32Array(cells.length * 3), col = new Float32Array(cells.length * 3), cell = new Float32Array(cells.length * 3);
      // Cellule par cellule : position au-dessus du radar, couleur, rayon en rayons terrestres, confiance, suivie.
      cells.forEach((c, i) => { const p = lonLatToUnit(c.lon, c.lat); pos.set([p[0] * 1.0018, p[1] * 1.0018, p[2] * 1.0018], i * 3); col.set(rgb(c.color), i * 3); cell.set([c.radiusKm / 6371, c.conf, c.frames > 1 ? 1 : 0], i * 3); });
      // Géométrie.
      const g = new THREE.BufferGeometry();
      // Attributs.
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tint', new THREE.BufferAttribute(col, 3)); g.setAttribute('cell', new THREE.BufferAttribute(cell, 3));
      // Nuage de points.
      const points = new THREE.Points(g, this.cellMaterial);
      // Toujours dessiné : visibilité gérée par le shader.
      points.frustumCulled = false;
      // Après le radar et la foudre.
      points.renderOrder = 46;
      // Ne se clique pas.
      points.raycast = () => {};
      // Avant chaque rendu : échelle, densité et caméra.
      points.onBeforeRender = (renderer, scene, camera) => { this.uniforms.pixels.value = renderer.getDrawingBufferSize(this.bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360)); this.uniforms.dpr.value = renderer.getPixelRatio(); points.worldToLocal(this.uniforms.camL.value.setFromMatrixPosition(camera.matrixWorld)); };
      // Gardé.
      this.objects.push(points);
    // Fin des cellules.
    }
    // Flèches des cellules en mouvement : positions et couleurs.
    const ap = [], ac = [];
    // Pour chaque cellule avec un déplacement : sa flèche, à sa couleur.
    cells.filter((c) => c.arrow).forEach((c) => { const seg = arrowSegments(c.arrow[0], c.arrow[1]); ap.push(...seg); const k = rgb(c.color); for (let i = 0; i < seg.length / 3; i++) ac.push(...k); });
    // Flèches posées.
    if (ap.length) this.objects.push(lines(ap, ac, this.arrowMaterial));
    // Avertissements : contours (doublés si observé) et flèches.
    const wp = [], wc = [];
    // Pour chaque avertissement (début).
    warnings.forEach((w) => {
      // Couleur de la nature.
      const k = w.tornado ? TORNADO : SEVERE;
      // Contour, et contour doublé un peu plus haut si observé ; flèche du déplacement publié.
      const segs = [ringSegments(w.ring, 1.0016), ...(w.observed ? [ringSegments(w.ring, 1.002)] : []), ...(w.arrow ? [arrowSegments(w.arrow[0], w.arrow[1], 1.0017)] : [])];
      // Positions et couleurs.
      segs.forEach((seg) => { wp.push(...seg); for (let i = 0; i < seg.length / 3; i++) wc.push(...k); });
    // Fin des avertissements.
    });
    // Avertissements posés.
    if (wp.length) this.objects.push(lines(wp, wc, this.warnMaterial));
    // Tout dans le repère.
    this.objects.forEach((o) => this.root.add(o));
  // Fin de set.
  }

  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }
  // setOpacity : opacité, de 0 à 1, pour les cellules, les flèches et les zones.
  setOpacity(v) { const o = Math.min(1, Math.max(0, Number(v) || 0)); this.uniforms.opacity.value = o; this.arrowMaterial.opacity = 0.8 * o; this.warnMaterial.opacity = o; }
  // setIntensity : intensité visuelle, de 0,5 à 2.
  setIntensity(v) { this.uniforms.intensity.value = Math.min(2, Math.max(0.5, Number(v) || 1)); }

  // dispose : libère tout.
  dispose() {
    // Géométries.
    this.objects.forEach((o) => o.geometry.dispose());
    // Matériaux.
    this.cellMaterial.dispose(); this.arrowMaterial.dispose(); this.warnMaterial.dispose();
  // Fin de dispose.
  }
// Fin de StormLayer.
}
