// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la construction des tableaux du shader.
import { buildFireAttributes } from './fireMath.jsx';

// Calque des incendies sur la Terre (WildfireEngine, rendu). Trois nuages de points, un seul matériau :
//  - cellules agrégées (vue du globe) : lueur dont la taille suit le nombre de détections et la puissance totale ;
//  - points chauds un par un (vue rapprochée, tuiles chargées autour du point visé) : un point par pixel satellite ;
//  - incendies confirmés par une agence : un ANNEAU, pour ne jamais les confondre avec une simple détection.
// La couleur suit la puissance radiative moyenne (rouge sombre → orange → jaune pâle) ; les détections anciennes
// pâlissent ; la fenêtre de temps (3 à 24 h) et le passage cellules ↔ points selon l'altitude sont faits par le
// shader : rien n'est recalculé par image côté processeur. Les points sont dans le repère de la Terre (sphère de
// rayon 1) et tournent avec elle ; un point derrière l'horizon est éteint par le shader, sans test de profondeur.

// Code GLSL du shader de sommets, une ligne par chaîne (début).
const vertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Uniformes : temps (s), échelle en pixels, densité de l'écran, caméra dans le repère de la Terre.
  'uniform float time;uniform float pixels;uniform float dpr;uniform vec3 camL;',
  // Uniformes : heure courante (minutes, horloge du calque), fenêtre (minutes), intensité visuelle, opacité.
  'uniform float nowMin;uniform float windowMin;uniform float intensity;uniform float opacity;',
  // Attributs : mesures (puissance, heure de détection, nombre, confiance), nature, graine.
  'attribute vec4 fire;attribute float kind;attribute float seed;',
  // Variables transmises au shader de fragments : couleur, opacité, nature.
  'varying vec3 vColor;varying float vAlpha;varying float vKind;',
  // Début de la fonction principale.
  'void main(){',
  // Position dans le repère de la caméra, à peine au-dessus du sol.
  '  vec4 mv=modelViewMatrix*vec4(position*1.0005,1.);',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Distance à la caméra.
  '  float dist=max(-mv.z,1e-6);',
  // Point du côté visible de la Terre (1) ou derrière l’horizon (0).
  '  float horizon=smoothstep(1.,1.0004,dot(position,camL));',
  // Altitude de la caméra, en rayons terrestres.
  '  float alt=max(length(camL)-1.,0.);',
  // Nature : cellule, point chaud ou incendie confirmé (0 ou 1 pour chacune).
  '  float isCell=1.-step(.5,kind);float isConf=step(1.5,kind);float isHot=1.-isCell-isConf;',
  // Âge de la détection, en minutes.
  '  float age=max(nowMin-fire.y,0.);',
  // Dans la fenêtre de temps choisie (les incendies confirmés n’y sont pas soumis).
  '  float inWindow=mix(1.-smoothstep(windowMin*.92,windowMin,age),1.,isConf);',
  // Éclat : plein pendant la première heure, puis pâlit jusqu’à 12 h.
  '  float recent=mix(1.,.5,smoothstep(60.,720.,age));',
  // Cellules visibles de haut (au-dessus de 2 200 km), effacées en descendant ; points chauds à l’inverse.
  '  float zoom=isCell*smoothstep(.15,.35,alt)+isHot*(1.-smoothstep(.25,.45,alt))+isConf;',
  // Puissance moyenne d’une détection, en mégawatts.
  '  float frp=fire.x/max(fire.z,1.);',
  // Chaleur : de 0 (1 MW) à 1 (300 MW et plus), en échelle logarithmique.
  '  float heat=clamp(log(1.+frp)/log(300.),0.,1.);',
  // Couleur : rouge sombre, rouge orangé, orange, jaune pâle.
  '  vec3 col=mix(vec3(.6,.05,.02),vec3(.97,.27,.04),smoothstep(0.,.35,heat));',
  // Vers l’orange.
  '  col=mix(col,vec3(1.,.62,.13),smoothstep(.35,.7,heat));',
  // Vers le jaune pâle pour les plus puissants.
  '  col=mix(col,vec3(1.,.93,.66),smoothstep(.7,1.,heat));',
  // Incendie confirmé : anneau orange clair.
  '  col=mix(col,vec3(1.,.78,.45),isConf);',
  // Scintillement léger des feux (pas des anneaux).
  '  float flick=mix(.86+.14*sin(time*(4.+seed*5.)+seed*40.),1.,isConf);',
  // Intensité visuelle : de 0,5 (discret) à 2 (appuyé).
  '  float k=clamp(intensity,.5,2.);',
  // Couleur transmise, éclairée par l’intensité.
  '  vColor=col*flick*(.85+.15*k);',
  // Opacité : horizon, fenêtre, âge, altitude, confiance, intensité et opacité choisie.
  '  vAlpha=horizon*inWindow*mix(recent,1.,isConf)*zoom*(.55+.45*fire.w)*min(1.,.6+.4*k)*opacity;',
  // Nature transmise.
  '  vKind=kind;',
  // Taille d’une cellule (points CSS) : selon le nombre de détections et la puissance totale.
  '  float cellPx=(2.2+1.2*log(1.+fire.z)/log(10.)+.8*log(1.+fire.x)/log(10.))*dpr;',
  // Emprise réelle d’une cellule de 0,5° (55 km), en pixels.
  '  float cellReal=.0087*pixels/dist;',
  // Taille d’un point chaud (points CSS) : selon sa puissance.
  '  float hotPx=(2.2+1.2*log(1.+frp)/log(10.))*dpr;',
  // Emprise réelle d’un pixel VIIRS (375 m), en pixels.
  '  float hotReal=5.9e-5*pixels/dist;',
  // Taille de l’anneau d’un incendie confirmé : 15 points CSS, battement lent.
  '  float confPx=15.*dpr*(.92+.08*sin(time*1.6+seed*6.));',
  // Taille finale, selon la nature et l’intensité, bornée.
  '  gl_PointSize=clamp((isCell*max(cellPx,cellReal*.9)+isHot*max(hotPx,hotReal*1.3)+isConf*confPx)*(.8+.2*k),1.,64.*dpr);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments, une ligne par chaîne (début).
const fragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables reçues du shader de sommets.
  'varying vec3 vColor;varying float vAlpha;varying float vKind;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Distance au centre du point, de 0 au centre à 1 au bord.
  '  float d=length(gl_PointCoord-.5)*2.;',
  // Incendie confirmé (1) ou feu (0).
  '  float conf=step(1.5,vKind);',
  // Lueur douce du feu.
  '  float glow=(1.-smoothstep(.1,1.,d))*.62;',
  // Cœur du feu, plein.
  '  float core=1.-smoothstep(0.,.36,d);',
  // Anneau de l’incendie confirmé.
  '  float ring=smoothstep(.56,.68,d)*(1.-smoothstep(.8,.94,d));',
  // Point central de l’anneau.
  '  float pip=1.-smoothstep(.12,.24,d);',
  // Forme selon la nature.
  '  float a=vAlpha*mix(max(glow,core),max(ring,pip),conf);',
  // Invisible : pas dessiné.
  '  if(a<.004)discard;',
  // Cœur des feux éclairci vers le blanc chaud.
  '  vec3 col=mix(vColor,vec3(1.,.97,.86),core*.45*(1.-conf));',
  // Couleur finale, avec son opacité.
  '  gl_FragColor=vec4(col,a);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Calque des incendies. `root` s'ajoute au repère atmosphérique de la Terre ; `setCells`, `setDetail` et
 * `setConfirmed` posent les trois nuages ; `setVisible`, `setOpacity`, `setIntensity` et `setWindowHours` règlent
 * l'affichage par les uniformes.
 */
// Déclare et exporte la classe FireLayer.
export class FireLayer {
  // Constructeur.
  constructor() {
    // Repère du calque.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-fires';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Les trois nuages : cellules, points chauds, incendies confirmés (null tant qu'ils sont vides).
    this.clouds = { cells: null, detail: null, confirmed: null };
    // Origine de l'horloge du calque, en millisecondes.
    this.start = Date.now();
    // Vecteur de travail : taille du rendu.
    this.bufferSize = new THREE.Vector2();
    // Uniformes du shader (début).
    this.uniforms = {
      // Temps (s), échelle, densité, caméra dans le repère de la Terre.
      time: { value: 0 }, pixels: { value: 1000 }, dpr: { value: 1 }, camL: { value: new THREE.Vector3(0, 0, 3) },
      // Heure courante (minutes), fenêtre (24 h par défaut), intensité et opacité.
      nowMin: { value: 0 }, windowMin: { value: 24 * 60 }, intensity: { value: 1 }, opacity: { value: 0.9 },
    // Fin des uniformes.
    };
    // Matériau à shader : transparent, sans test ni écriture de la profondeur (l'horizon est géré par le shader).
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false });
  // Fin du constructeur.
  }

  /** Heure (minutes) sur l'horloge du calque d'un instant en millisecondes. */
  // clockMin : l'instant.
  clockMin(ms) { return (ms - this.start) / 60_000; }

  // Méthode privée place : remplace le nuage `slot` par celui des points donnés (reçus à l'instant `receivedAt`).
  place(slot, points, receivedAt) {
    // Ancien nuage : retiré du repère, géométrie libérée.
    const old = this.clouds[slot];
    // S'il existe : retrait et libération.
    if (old) { this.root.remove(old); old.geometry.dispose(); this.clouds[slot] = null; }
    // Aucun point : rien à dessiner.
    if (!points?.length) return;
    // Tableaux des points, heures de détection sur l'horloge du calque.
    const a = buildFireAttributes(points, this.clockMin(receivedAt ?? Date.now()));
    // Géométrie.
    const geometry = new THREE.BufferGeometry();
    // Positions.
    geometry.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    // Mesures.
    geometry.setAttribute('fire', new THREE.BufferAttribute(a.fire, 4));
    // Natures.
    geometry.setAttribute('kind', new THREE.BufferAttribute(a.kind, 1));
    // Graines.
    geometry.setAttribute('seed', new THREE.BufferAttribute(a.seed, 1));
    // Le nuage de points.
    const cloud = new THREE.Points(geometry, this.material);
    // Toujours dessiné : visibilité gérée par le shader.
    cloud.frustumCulled = false;
    // Dessiné après la carte, l'atmosphère et les volcans ; les anneaux par-dessus les feux.
    cloud.renderOrder = slot === 'confirmed' ? 43 : 41;
    // Les points ne se cliquent pas.
    cloud.raycast = () => {};
    // Avant chaque rendu : uniformes de la caméra et du temps.
    cloud.onBeforeRender = (renderer, scene, camera) => this.beforeRender(renderer, camera, cloud);
    // L'ajoute au repère.
    this.root.add(cloud);
    // Le garde.
    this.clouds[slot] = cloud;
  // Fin de place.
  }

  // Méthode privée beforeRender : met à jour les uniformes (mêmes valeurs pour les trois nuages).
  beforeRender(renderer, camera, cloud) {
    // Instant courant.
    const now = Date.now();
    // Temps, en secondes.
    this.uniforms.time.value = (now - this.start) / 1000;
    // Heure courante, en minutes.
    this.uniforms.nowMin.value = this.clockMin(now);
    // Échelle : pixels couverts par une unité placée à une unité de la caméra.
    this.uniforms.pixels.value = renderer.getDrawingBufferSize(this.bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
    // Densité de l'écran.
    this.uniforms.dpr.value = renderer.getPixelRatio();
    // Caméra ramenée dans le repère de la Terre.
    cloud.worldToLocal(this.uniforms.camL.value.setFromMatrixPosition(camera.matrixWorld));
  // Fin de beforeRender.
  }

  /** Cellules agrégées de la vue du globe. */
  // setCells : les points et l'instant de réception.
  setCells(points, receivedAt) { this.place('cells', points, receivedAt); }
  /** Points chauds un par un (tuiles de détail). */
  // setDetail : les points et l'instant de réception.
  setDetail(points, receivedAt) { this.place('detail', points, receivedAt); }
  /** Incendies confirmés par une agence. */
  // setConfirmed : les points et l'instant de réception.
  setConfirmed(points, receivedAt) { this.place('confirmed', points, receivedAt); }
  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }
  // setOpacity : opacité, de 0 à 1.
  setOpacity(v) { this.uniforms.opacity.value = Math.min(1, Math.max(0, Number(v) || 0)); }
  // setIntensity : intensité visuelle, de 0,5 à 2.
  setIntensity(v) { this.uniforms.intensity.value = Math.min(2, Math.max(0.5, Number(v) || 1)); }
  // setWindowHours : fenêtre de temps des détections, en heures (1 à 24).
  setWindowHours(h) { this.uniforms.windowMin.value = Math.min(24, Math.max(1, Number(h) || 24)) * 60; }

  // dispose : libère les géométries et le matériau.
  dispose() {
    // Chaque nuage existant : géométrie libérée.
    for (const c of Object.values(this.clouds)) c?.geometry.dispose();
    // Le matériau.
    this.material.dispose();
  // Fin de dispose.
  }
// Fin de FireLayer.
}
