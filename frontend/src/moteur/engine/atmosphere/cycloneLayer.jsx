// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le tracé en ruban (même style que les orbites : largeur constante à l'écran, sur tous les écrans).
import { OrbitRibbon } from '../orbitRibbon';
// Importe les calculs des cyclones.
import { EARTH_KM, localFrame, normalizeCyclones, styleOf, trackAlphas, trackPositions } from './cycloneMath';

// Calque des cyclones sur la Terre (CycloneEngine, rendu, lot 1). Pour chaque cyclone actif confirmé :
//  - un tourbillon procédural posé à plat sur le globe (plan tangent), avec bouclier nuageux central, bandes
//    spiralées qui tournent dans le sens physique (antihoraire au nord, horaire au sud) et œil dégagé à partir de
//    la catégorie 1 ; c'est un SYMBOLE à l'échelle de sa catégorie, pas l'image satellite du cyclone ;
//  - sa trajectoire OBSERVÉE (positions des agences toutes les 6 h), du plus pâle (ancien) au plus vif (actuel).
// Les trajectoires prévues viendront avec les sources de prévision (lot suivant) ; rien n'est inventé ici.

// Code GLSL du shader de sommets du tourbillon, une ligne par chaîne (début).
const vertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Coordonnées de texture transmises au shader de fragments.
  'varying vec2 vUv;',
  // Début de la fonction principale.
  'void main(){',
  // Coordonnées de texture du coin.
  '  vUv=uv;',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments du tourbillon, une ligne par chaîne (début).
const fragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Uniformes : temps (s), sens de rotation, force de l’œil, couleur de la catégorie, opacité, intensité.
  'uniform float time;uniform float spin;uniform float eye;uniform vec3 color;uniform float opacity;uniform float intensity;',
  // Coordonnées de texture reçues.
  'varying vec2 vUv;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Point du plan, de −1 à 1 (x vers l’est, y vers le nord).
  '  vec2 p=vUv*2.-1.;',
  // Distance au centre.
  '  float r=length(p);',
  // Hors du disque : pas dessiné.
  '  if(r>1.)discard;',
  // Angle autour du centre, dans le sens de rotation du cyclone.
  '  float th=atan(p.y,p.x)*spin;',
  // Logarithme de la distance : les bandes suivent des spirales logarithmiques.
  '  float lr=log(max(r,.02));',
  // Deux grandes bandes spiralées qui tournent.
  '  float arms=.5+.5*cos(2.*(th+2.6*lr)-time*.6);',
  // Bandes fines, décalées.
  '  float fine=.5+.5*cos(5.*(th+3.4*lr)-time*.9+1.7);',
  // Mélange des bandes.
  '  float bands=mix(arms,fine,.35);',
  // Bouclier nuageux central, dense, qui s’éclaircit vers l’extérieur.
  '  float shield=1.-smoothstep(.2,.95,r);',
  // Nuages : bouclier et bandes, effacés au bord.
  '  float cloud=clamp(shield*1.15+bands*(1.-smoothstep(.15,1.,r))*.95-.28,0.,1.);',
  // Œil dégagé au centre (catégorie 1 et plus).
  '  float hole=eye*(1.-smoothstep(.045,.1,r));',
  // Mur de l’œil, plus brillant.
  '  float wall=eye*smoothstep(.05,.1,r)*(1.-smoothstep(.1,.2,r));',
  // Opacité : nuages moins l’œil, bord adouci.
  '  float a=clamp(cloud-hole,0.,1.)*(1.-smoothstep(.86,1.,r));',
  // Couleur : blanc des nuages, cœur teinté par la catégorie.
  '  vec3 col=mix(vec3(.93,.95,.98),color,.4*(1.-smoothstep(0.,.55,r)));',
  // Mur de l’œil éclairci.
  '  col+=wall*.22;',
  // Opacité choisie et intensité.
  '  a*=opacity*min(1.,.55+.45*clamp(intensity,.5,2.));',
  // Invisible : pas dessiné.
  '  if(a<.01)discard;',
  // Couleur finale.
  '  gl_FragColor=vec4(col,a*.92);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Plan unité partagé par tous les tourbillons : 2 × 2, normale +z.
const PLANE = new THREE.PlaneGeometry(2, 2);
// Taille apparente minimale d'un tourbillon : 16 points CSS de rayon, pour rester lisible de loin.
const MIN_RADIUS_CSS = 16;

/**
 * Calque des cyclones. `root` s'ajoute au repère atmosphérique de la Terre ; `set(liste)` pose les cyclones reçus du
 * serveur ; `setVisible`, `setOpacity` et `setIntensity` règlent l'affichage.
 */
// Déclare et exporte la classe CycloneLayer.
export class CycloneLayer {
  // Constructeur.
  constructor() {
    // Repère du calque.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-cyclones';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Objets de chaque cyclone : { group, vortex, material, ribbon }.
    this.items = [];
    // Cyclones affichés (nettoyés).
    this.list = [];
    // Réglages courants : opacité et intensité.
    this.opacity = 0.9; this.intensity = 1;
    // Instant de création.
    this.start = performance.now();
    // Vecteurs de travail.
    this.bufferSize = new THREE.Vector2(); this.tmp = new THREE.Vector3(); this.tmp2 = new THREE.Vector3();
  // Fin du constructeur.
  }

  /** Pose les cyclones reçus du serveur (événements au format commun) ; une liste vide les enlève tous. */
  // set : la liste.
  set(list) {
    // Anciens objets libérés.
    this.clear();
    // Liste nettoyée.
    this.list = normalizeCyclones(list);
    // Pour chaque cyclone : ses objets.
    for (const c of this.list) this.items.push(this.build(c));
  // Fin de set.
  }

  // Méthode privée build : les objets d'un cyclone.
  build(c) {
    // Style de sa catégorie.
    const style = styleOf(c.category);
    // Groupe du cyclone.
    const group = new THREE.Group();
    // Son nom.
    group.name = `cyclone-${c.name}`;
    // Repère local : est, nord, haut.
    const { up, east, north } = localFrame(c.lon, c.lat);
    // Matériau du tourbillon (début).
    const material = new THREE.ShaderMaterial({
      // Uniformes : temps, sens, œil, couleur, opacité, intensité.
      uniforms: { time: { value: 0 }, spin: { value: c.spin }, eye: { value: style.eye }, color: { value: new THREE.Color(style.color) }, opacity: { value: this.opacity }, intensity: { value: this.intensity } },
      // Shaders.
      vertexShader, fragmentShader,
      // Transparent, sans écriture de la profondeur, des deux côtés (le plan peut être vu de biais).
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    // Fin du matériau.
    });
    // Tourbillon : le plan unité.
    const vortex = new THREE.Mesh(PLANE, material);
    // Posé 20 km au-dessus du sol, au centre du cyclone.
    vortex.position.set(up[0], up[1], up[2]).multiplyScalar(1.003);
    // Orienté : x vers l'est, y vers le nord, normale vers le haut.
    vortex.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...east), new THREE.Vector3(...north), new THREE.Vector3(...up)));
    // Rayon du symbole, en rayons terrestres.
    const radius = style.radiusKm / EARTH_KM;
    // Échelle de départ : le rayon du symbole.
    vortex.scale.setScalar(radius);
    // Dessiné après la carte et les nuages de la Terre.
    vortex.renderOrder = 42;
    // Ne se clique pas.
    vortex.raycast = () => {};
    // Avant chaque rendu : temps, et taille minimale à l'écran (appliquée à l'image suivante).
    vortex.onBeforeRender = (renderer, scene, camera) => {
      // Temps écoulé, en secondes.
      material.uniforms.time.value = (performance.now() - this.start) / 1000;
      // Pixels couverts par une unité placée à une unité de la caméra.
      const pixels = renderer.getDrawingBufferSize(this.bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      // Distance de la caméra au centre du tourbillon (repère du monde).
      const dist = this.tmp.setFromMatrixPosition(camera.matrixWorld).distanceTo(this.tmp2.setFromMatrixPosition(vortex.matrixWorld));
      // Échelle du monde du groupe de la Terre (rayon terrestre en unités de la scène).
      const worldScale = vortex.parent ? vortex.parent.getWorldScale(this.tmp2).x : 1;
      // Rayon minimal, en rayons terrestres, pour couvrir MIN_RADIUS_CSS points CSS.
      const minRadius = (MIN_RADIUS_CSS * renderer.getPixelRatio() * dist) / (pixels * Math.max(worldScale, 1e-12));
      // Échelle : le rayon du symbole, agrandi de loin.
      vortex.scale.setScalar(Math.max(radius, minRadius));
    // Fin du traitement avant rendu.
    };
    // Ajoute le tourbillon.
    group.add(vortex);
    // Ruban de la trajectoire observée, s'il y a au moins deux positions.
    let ribbon = null;
    // Deux positions ou plus : ruban.
    if (c.track.length >= 2) {
      // Positions le long du grand cercle, 12 km au-dessus du sol.
      const points = trackPositions(c.track, 1.002);
      // Le ruban, à la couleur de la catégorie.
      ribbon = new OrbitRibbon({ points, color: style.color, name: `trajectoire-${c.name}` });
      // Opacités : de l'ancien au présent.
      ribbon.alphas.set(trackAlphas(ribbon.count));
      // À renvoyer à la carte graphique.
      ribbon.alphasChanged();
      // Trait un peu plus épais que celui des orbites.
      ribbon.material.uniforms.width.value = 1.7;
      // Opacité courante.
      ribbon.material.uniforms.opacity.value = this.opacity;
      // Ajoute le ruban.
      group.add(ribbon.mesh);
    // Fin du cas.
    }
    // Ajoute le groupe au calque.
    this.root.add(group);
    // Renvoie les objets.
    return { group, vortex, material, ribbon };
  // Fin de build.
  }

  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }

  // setOpacity : opacité, de 0 à 1 (début).
  setOpacity(v) {
    // Valeur bornée.
    this.opacity = Math.min(1, Math.max(0, Number(v) || 0));
    // Appliquée au tourbillon et au ruban de chaque cyclone.
    for (const it of this.items) { it.material.uniforms.opacity.value = this.opacity; if (it.ribbon) it.ribbon.material.uniforms.opacity.value = this.opacity; }
  // Fin de setOpacity.
  }

  // setIntensity : intensité visuelle, de 0,5 à 2 (début).
  setIntensity(v) {
    // Valeur bornée.
    this.intensity = Math.min(2, Math.max(0.5, Number(v) || 1));
    // Appliquée au tourbillon de chaque cyclone.
    for (const it of this.items) it.material.uniforms.intensity.value = this.intensity;
  // Fin de setIntensity.
  }

  // Méthode privée clear : retire et libère les objets des cyclones.
  clear() {
    // Pour chaque cyclone : retrait du groupe, matériau et ruban libérés.
    for (const it of this.items) { this.root.remove(it.group); it.material.dispose(); it.ribbon?.dispose(); }
    // Plus aucun objet.
    this.items = [];
  // Fin de clear.
  }

  // dispose : libère tout.
  dispose() { this.clear(); }
// Fin de CycloneLayer.
}
