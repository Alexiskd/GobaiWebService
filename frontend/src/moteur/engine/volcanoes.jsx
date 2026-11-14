// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la gravité du modèle, le nettoyage de la liste et la construction des tableaux, depuis volcanoesMath.
import { VOLCANO_GRAVITY, buildVolcanoAttributes, normalizeVolcanoes } from './volcanoesMath';

// Volcans en éruption sur la Terre, en direct (liste du serveur : NASA EONET). Chaque volcan est dessiné par un repère
// orange qui bat doucement, visible quand la Terre est vue en entier, puis, en s'approchant, par une fontaine de
// grains incandescents qui montent du cratère et retombent (voir volcanoesMath.jsx). Tout est un seul nuage de
// points, animé par la carte graphique à partir du temps : rien n'est calculé par image côté processeur.
// Les points sont dans le repère de la Terre (sphère de rayon 1, axe y = pôle nord) et tournent avec elle. Un volcan
// passé derrière l'horizon est éteint par le shader, sans test de profondeur : le calque se dessine par-dessus la carte.

// Code GLSL du shader de sommets (début).
const vertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables uniformes : le temps, la gravité, l'échelle en pixels, la densité de l'écran et la caméra dans le repère de la Terre.
  'uniform float time;uniform float gravity;uniform float pixels;uniform float dpr;uniform vec3 camL;',
  // Attributs du point : sa direction de dérive et son lancement.
  'attribute vec3 slide;attribute vec4 launch;',
  // Variables transmises au shader de fragments : la chaleur, l'opacité et la nature du point (1 : repère, 0 : grain).
  'varying float vHeat;varying float vAlpha;varying float vMarker;',
  // Début de la fonction principale.
  'void main(){',
  // Repère (vitesse verticale nulle) ou grain.
  '  float marker=step(launch.x,0.);',
  // Durée du vol du grain : 2·vUp/g (jamais nulle, pour le repère).
  '  float flight=max(2.*launch.x/gravity,.001);',
  // Âge du grain : la fontaine est continue, chaque grain repart dès qu’il est retombé.
  '  float age=mod(time+launch.z,flight);',
  // Hauteur balistique, en rayons terrestres.
  '  float h=max(launch.x*age-.5*gravity*age*age,0.);',
  // Direction du grain : il dérive le long du sol à partir du cratère.
  '  vec3 dir=normalize(position+slide*launch.y*age);',
  // Position dans le repère de la caméra.
  '  vec4 mv=modelViewMatrix*vec4(dir*(1.+h),1.);',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Distance à la caméra.
  '  float dist=max(-mv.z,1e-6);',
  // Cratère du côté visible de la Terre (1) ou derrière l’horizon (0).
  '  float horizon=smoothstep(1.,1.0004,dot(position,camL));',
  // Rayon apparent de la Terre, en pixels.
  '  float earthPx=pixels/max(length(camL),1.);',
  // Hauteur apparente d’un panache de 16 km, en pixels.
  '  float plumePx=.0025*pixels/dist;',
  // Avancement du vol, entre 0 et 1.
  '  float k=age/flight;',
  // Taille d’un grain : 700 m, en pixels.
  '  float gSize=launch.w*1.1e-4*pixels/dist;',
  // Opacité d’un grain : nulle au départ et à la retombée, et quand il fait moins d’un pixel.
  '  float gAlpha=sin(k*PI)*smoothstep(.5,1.5,gSize);',
  // Battement du repère.
  '  float pulse=.78+.22*sin(time*2.2+launch.z);',
  // Opacité du repère : visible quand la Terre fait plus de 40 pixels de rayon, effacé quand la fontaine devient lisible.
  '  float mAlpha=smoothstep(40.,120.,earthPx)*(1.-smoothstep(25.,70.,plumePx));',
  // Nature du point.
  '  vMarker=marker;',
  // Chaleur : le grain refroidit pendant son vol ; le repère reste chaud.
  '  vHeat=mix(1.-k,1.,marker);',
  // Opacité finale, nulle derrière l’horizon.
  '  vAlpha=horizon*mix(gAlpha,mAlpha,marker);',
  // Taille du point : celle du grain (1 à 40 pixels) ou celle du repère (12 pixels d’écran, selon le battement).
  '  gl_PointSize=mix(clamp(gSize,1.,40.),12.*dpr*pulse,marker);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments (début).
const fragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables reçues du shader de sommets.
  'varying float vHeat;varying float vAlpha;varying float vMarker;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Distance au centre du point, de 0 au centre à 1 au bord.
  '  float d=length(gl_PointCoord-.5)*2.;',
  // Disque flou : plein au centre, transparent au bord.
  '  float soft=1.-smoothstep(0.,1.,d);',
  // Repère : cœur plein jusqu’à 35 % du rayon, puis halo.
  '  float mark=max(1.-smoothstep(.28,.4,d),soft*.55);',
  // Opacité du point.
  '  float a=vAlpha*mix(soft,mark,vMarker);',
  // Point invisible : pas dessiné.
  '  if(a<.004)discard;',
  // Couleur d’un grain : gris de cendre quand il est froid, rouge puis orange de lave quand il est chaud.
  '  vec3 col=mix(vec3(.32,.28,.26),vec3(.95,.22,.03),smoothstep(.15,.55,vHeat));',
  // Les plus chauds : jaune orangé.
  '  col=mix(col,vec3(1.,.72,.2),smoothstep(.65,1.,vHeat));',
  // Couleur du repère : orange vif, cœur jaune clair.
  '  col=mix(col,mix(vec3(1.,.3,.05),vec3(1.,.9,.6),1.-smoothstep(0.,.3,d)),vMarker);',
  // Couleur finale, avec son opacité.
  '  gl_FragColor=vec4(col,a);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Calque des volcans en éruption. `root` s'ajoute au groupe de la Terre ; `set(liste)` pose les volcans reçus du
 * serveur, `setVisible` affiche ou masque le calque, `sync` lui fait suivre la rotation de la Terre.
 * `lite` (téléphone) : moins de grains par volcan.
 */
// Déclare et exporte la classe VolcanoLayer.
export class VolcanoLayer {
  // Constructeur : le profil allégé.
  constructor({ lite = false } = {}) {
    // Grains par volcan : 20 sur téléphone, 48 sinon.
    this.grains = lite ? 20 : 48;
    // Repère du calque.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'volcanoes';
    // Les volcans affichés.
    this.list = [];
    // Le nuage de points, créé à la première liste.
    this.points = null;
    // Instant de création, en millisecondes.
    this.start = performance.now();
    // Vecteur de travail : taille du rendu.
    this.bufferSize = new THREE.Vector2();
    // Variables uniformes du shader : le temps, la gravité, l'échelle en pixels, la densité de l'écran et la caméra.
    this.uniforms = { time: { value: 0 }, gravity: { value: VOLCANO_GRAVITY }, pixels: { value: 1000 }, dpr: { value: 1 }, camL: { value: new THREE.Vector3(0, 0, 3) } };
    // Matériau à shader : transparent, sans test ni écriture de la profondeur (l'horizon est géré par le shader).
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false });
  // Fin du constructeur.
  }

  /** Pose les volcans ([{ id, name, lon, lat }]) ; une liste vide ou invalide les enlève tous. */
  // set : la liste reçue du serveur.
  set(list) {
    // Liste nettoyée.
    this.list = normalizeVolcanoes(list);
    // Ancien nuage : retiré du repère et sa géométrie libérée.
    if (this.points) { this.root.remove(this.points); this.points.geometry.dispose(); this.points = null; }
    // Aucun volcan : rien à dessiner.
    if (!this.list.length) return;
    // Tableaux des points.
    const a = buildVolcanoAttributes(this.list, this.grains);
    // Géométrie.
    const geometry = new THREE.BufferGeometry();
    // Cratère de chaque point.
    geometry.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    // Direction de dérive.
    geometry.setAttribute('slide', new THREE.BufferAttribute(a.slide, 3));
    // Paramètres de lancement.
    geometry.setAttribute('launch', new THREE.BufferAttribute(a.launch, 4));
    // Le nuage de points.
    const points = new THREE.Points(geometry, this.material);
    // Toujours dessiné : les grains bougent dans le shader.
    points.frustumCulled = false;
    // Dessiné après la carte et l'atmosphère.
    points.renderOrder = 40;
    // Les points ne se cliquent pas.
    points.raycast = () => {};
    // Avant chaque rendu (début).
    points.onBeforeRender = (renderer, scene, camera) => {
      // Temps écoulé depuis la création, en secondes.
      this.uniforms.time.value = (performance.now() - this.start) / 1000;
      // Échelle : nombre de pixels couverts par une unité de la scène placée à une unité de la caméra.
      this.uniforms.pixels.value = renderer.getDrawingBufferSize(this.bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      // Densité de l'écran.
      this.uniforms.dpr.value = renderer.getPixelRatio();
      // Position de la caméra, ramenée dans le repère de la Terre.
      points.worldToLocal(this.uniforms.camL.value.setFromMatrixPosition(camera.matrixWorld));
    // Fin du traitement avant rendu.
    };
    // L'ajoute au repère.
    this.root.add(points);
    // Le garde.
    this.points = points;
  // Fin de set.
  }

  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }

  // sync : suit la rotation propre de la Terre.
  sync(rotationY) { this.root.rotation.y = rotationY; }

  // dispose : libère la géométrie et le matériau.
  dispose() {
    // La géométrie du nuage, s'il existe.
    this.points?.geometry.dispose();
    // Le matériau.
    this.material.dispose();
  // Fin de dispose.
  }
// Fin de VolcanoLayer.
}
