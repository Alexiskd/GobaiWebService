// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la construction des tableaux du shader et la boucle de relecture.
import { LIGHTNING_LOOP_S, buildStrikeAttributes } from './lightningMath.jsx';

// Calque de la foudre sur la Terre (LightningEngine, rendu). Deux parties :
//  - la couche mondiale des impacts récents (image Xweather Raster Maps, assemblée en mosaïque Mercator), posée sur une
//    sphère juste au-dessus de la carte : les zones orageuses actives du monde entier, vues de loin ;
//  - les impacts un par un autour du point visé (API Xweather Lightning) : un point à la position MESURÉE (jaune pâle
//    pour un impact nuage-sol, anneau violet pour un intra-nuage), et, rejoués dans l'ordre réel à vitesse ×10, une
//    lueur qui éclaire les nuages alentour puis s'éteint, avec un éclair ramifié PROCÉDURAL pour un impact nuage-sol.
// Rien n'est calculé par image côté processeur : la relecture est faite par le shader à partir du temps.

// Shader de sommets de la couche mondiale, une ligne GLSL par chaîne (début).
const mapVertex = [
  // Inclusions de three.js : fonctions communes et profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Point de la sphère transmis au shader de fragments.
  'varying vec3 vP;',
  // Début de la fonction principale.
  'void main(){',
  // Point de la sphère, dans le repère de la Terre.
  '  vP=position;',
  // Position à l’écran.
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
  // Profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// Shader de fragments de la couche mondiale, une ligne GLSL par chaîne (début).
const mapFragment = [
  // Inclusion de three.js : profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Uniformes : la mosaïque Mercator, l'opacité et l'effacement de près.
  'uniform sampler2D map;uniform float opacity;uniform float near;',
  // Point de la sphère reçu.
  'varying vec3 vP;',
  // Début de la fonction principale.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Direction du point.
  '  vec3 p=normalize(vP);',
  // Latitude et longitude (inverse de lonLatToUnit).
  '  float lat=asin(clamp(p.y,-1.,1.));float lon=atan(-p.z,p.x);',
  // Colonne de la mosaïque.
  '  float u=(lon+3.14159265)/6.2831853;',
  // Latitude bornée aux limites de Mercator (85,05°).
  '  float la=clamp(lat,-1.4844,1.4844);',
  // Ligne Mercator depuis le haut de l’image.
  '  float y=.5-log(tan(.78539816+la*.5))/6.2831853;',
  // Couleur de la mosaïque (texture retournée : le haut de l’image en v = 1).
  '  vec4 t=texture2D(map,vec2(u,1.-y));',
  // Opacité : celle de l’image, l’opacité choisie, effacée tout près (les impacts un par un prennent le relais).
  '  float a=t.a*opacity*near;',
  // Transparent : rien.
  '  if(a<.01)discard;',
  // Couleur finale.
  '  gl_FragColor=vec4(t.rgb,a);',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// Shader de sommets des impacts, une ligne GLSL par chaîne (début).
const strikeVertex = [
  // Inclusions de three.js : fonctions communes et profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Uniformes : temps (s), boucle (s), échelle, densité, caméra dans le repère de la Terre, intensité, opacité.
  'uniform float time;uniform float loop;uniform float pixels;uniform float dpr;uniform vec3 camL;uniform float intensity;uniform float opacity;',
  // Attributs : moment de relecture, nature, force, confiance ; graine.
  'attribute vec4 strike;attribute float seed;',
  // Variables transmises : nature, force, lueur, éclair, rayon du point mesuré (fraction du point), opacité, graine.
  'varying float vKind;varying float vAmp;varying float vGlow;varying float vFlash;varying float vMark;varying float vAlpha;varying float vSeed;',
  // Début de la fonction principale.
  'void main(){',
  // Position, un peu au-dessus du sol.
  '  vec4 mv=modelViewMatrix*vec4(position*1.0008,1.);',
  // À l’écran.
  '  gl_Position=projectionMatrix*mv;',
  // Profondeur logarithmique.
  '#include <logdepthbuf_vertex>',
  // Distance à la caméra.
  '  float dist=max(-mv.z,1e-6);',
  // Côté visible de la Terre (1) ou derrière l’horizon (0).
  '  float horizon=smoothstep(1.,1.0004,dot(position,camL));',
  // Temps écoulé depuis la relecture de cet impact dans la boucle.
  '  float fa=mod(mod(time,loop)-strike.x+loop,loop);',
  // Éclair : bref (environ 0,3 s) ; lueur : plus longue (environ 1 s).
  '  vFlash=exp(-fa*9.);vGlow=exp(-fa*3.);',
  // Nature, force et graine.
  '  vKind=strike.y;vAmp=strike.z;vSeed=seed;',
  // Taille du point mesuré : 5 points CSS.
  '  float markPx=5.*dpr;',
  // Taille de la lueur : 30 km (nuage-sol) ou 45 km (intra-nuage), au moins 26 points CSS, selon la force.
  '  float glowPx=max((step(1.5,strike.y)*.0071+(1.-step(1.5,strike.y))*.0047)*pixels/dist,26.*dpr)*(.7+.6*strike.z)*(.8+.2*intensity);',
  // Taille du point : la lueur pendant la relecture, sinon le point mesuré.
  '  gl_PointSize=clamp(max(markPx,glowPx*step(.02,vGlow)),1.,180.*dpr);',
  // Rayon du point mesuré, en fraction du point dessiné.
  '  vMark=markPx/gl_PointSize;',
  // Opacité : horizon, confiance, opacité choisie.
  '  vAlpha=horizon*(.5+.5*strike.w)*opacity;',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// Shader de fragments des impacts, une ligne GLSL par chaîne (début).
const strikeFragment = [
  // Inclusion de three.js : profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables reçues.
  'varying float vKind;varying float vAmp;varying float vGlow;varying float vFlash;varying float vMark;varying float vAlpha;varying float vSeed;',
  // Début de la fonction principale.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Point du disque, de −1 à 1.
  '  vec2 c=(gl_PointCoord-.5)*2.;',
  // Distance au centre.
  '  float d=length(c);',
  // Intra-nuage (1) ou nuage-sol (0).
  '  float ic=step(1.5,vKind);',
  // Point mesuré : disque plein (nuage-sol) ou anneau (intra-nuage), à la taille du point mesuré.
  '  float mk=(1.-smoothstep(vMark*.7,vMark,d))*mix(1.,smoothstep(vMark*.45,vMark*.6,d),ic);',
  // Lueur : éclairage des nuages autour de l’impact, qui s’éteint.
  '  float halo=vGlow*exp(-d*d*mix(5.,3.,ic))*(.45+.55*vAmp);',
  // Éclair ramifié procédural (nuage-sol, pendant l’éclair) : trois branches brisées issues du centre.
  '  float bolt=0.;',
  // Angle et distance du pixel.
  '  float th=atan(c.y,c.x);',
  // Pour chaque branche :
  '  for(int k=0;k<3;k++){float fk=float(k);',
  // son angle, tiré de la graine ;
  '    float a0=6.2831853*fract(vSeed*7.13+fk*.37);',
  // son tracé brisé : l’angle oscille avec la distance ;
  '    float a=a0+.35*sin(d*17.+fk*5.+vSeed*40.)*d;',
  // écart angulaire au tracé, ramené entre −π et π ;
  '    float da=abs(mod(th-a+3.14159265,6.2831853)-3.14159265);',
  // trait fin, plus court pour les branches secondaires.
  '    bolt=max(bolt,(1.-smoothstep(0.,.05,da*d))*step(d,.95-.25*fk));}',
  // Éclair : seulement pour un nuage-sol, pendant l’éclair.
  '  bolt*=vFlash*(1.-ic);',
  // Opacité totale.
  '  float a=(mk*.95+halo+bolt)*vAlpha;',
  // Invisible : rien.
  '  if(a<.004)discard;',
  // Couleur : jaune pâle (nuage-sol) ou violet clair (intra-nuage), cœur blanc pendant l’éclair.
  '  vec3 col=mix(vec3(1.,.93,.62),vec3(.78,.66,1.),ic);',
  // Éclair et cœur de la lueur blanchis.
  '  col=mix(col,vec3(1.),clamp(bolt+vFlash*.6,0.,1.));',
  // Couleur finale.
  '  gl_FragColor=vec4(col,a);',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

/**
 * Calque de la foudre. `root` s'ajoute au repère atmosphérique de la Terre ; `setMap(canvas)` pose la couche mondiale,
 * `setStrikes(points)` les impacts un par un ; `setVisible`, `setOpacity`, `setIntensity` règlent l'affichage.
 */
// Déclare et exporte la classe LightningLayer.
export class LightningLayer {
  // Constructeur.
  constructor() {
    // Repère du calque, masqué au départ.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-lightning';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Instant de création.
    this.start = performance.now();
    // Vecteurs de travail.
    this.bufferSize = new THREE.Vector2(); this.camTmp = new THREE.Vector3();
    // Uniformes des impacts.
    this.uniforms = { time: { value: 0 }, loop: { value: LIGHTNING_LOOP_S }, pixels: { value: 1000 }, dpr: { value: 1 }, camL: { value: new THREE.Vector3(0, 0, 3) }, intensity: { value: 1 }, opacity: { value: 0.9 } };
    // Matériau des impacts : lumière ajoutée, sans profondeur (l'horizon est géré par le shader).
    this.strikeMaterial = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: strikeVertex, fragmentShader: strikeFragment, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    // Nuage des impacts, null tant qu'il est vide.
    this.points = null;
    // Uniformes de la couche mondiale.
    this.mapUniforms = { map: { value: null }, opacity: { value: 0.9 }, near: { value: 1 } };
    // Matériau de la couche mondiale : transparent, sans écriture de la profondeur.
    this.mapMaterial = new THREE.ShaderMaterial({ uniforms: this.mapUniforms, vertexShader: mapVertex, fragmentShader: mapFragment, transparent: true, depthWrite: false });
    // Sphère de la couche mondiale, 7,6 km au-dessus de la carte (au-dessus du creux de ses propres facettes).
    this.mapMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0012, 96, 48), this.mapMaterial);
    // Masquée tant qu'aucune image n'est posée.
    this.mapMesh.visible = false;
    // Dessinée après la carte et les nuages.
    this.mapMesh.renderOrder = 39;
    // Ne se clique pas.
    this.mapMesh.raycast = () => {};
    // Avant chaque rendu : effacement de près (les impacts un par un prennent le relais sous 1 900 km).
    this.mapMesh.onBeforeRender = (renderer, scene, camera) => {
      // Caméra dans le repère de la Terre.
      const cam = this.mapMesh.worldToLocal(this.camTmp.setFromMatrixPosition(camera.matrixWorld));
      // Altitude, en rayons terrestres.
      const alt = Math.max(0, cam.length() - 1);
      // Effacement progressif entre 500 et 1 900 km.
      this.mapUniforms.near.value = Math.min(1, Math.max(0, (alt - 0.08) / 0.22));
    // Fin du traitement avant rendu.
    };
    // Les deux parties dans le repère.
    this.root.add(this.mapMesh);
  // Fin du constructeur.
  }

  /** Couche mondiale : canevas de la mosaïque Mercator (ou null pour la retirer). */
  // setMap : le canevas.
  setMap(canvas) {
    // Ancienne texture libérée.
    this.mapUniforms.map.value?.dispose();
    // Aucun canevas : couche masquée.
    if (!canvas) { this.mapUniforms.map.value = null; this.mapMesh.visible = false; return; }
    // Nouvelle texture, sans mipmaps (pas de couture à l'antiméridien), lissée.
    const tex = new THREE.CanvasTexture(canvas);
    // Sans mipmaps.
    tex.generateMipmaps = false;
    // Filtrage lissé.
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    // Répétée en longitude, bornée en latitude.
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    // Posée.
    this.mapUniforms.map.value = tex;
    // Couche visible.
    this.mapMesh.visible = true;
  // Fin de setMap.
  }

  /** Impacts un par un (voir lightningMath.normalizeStrikes) ; une liste vide les retire. */
  // setStrikes : les impacts.
  setStrikes(strikes) {
    // Ancien nuage retiré et libéré.
    if (this.points) { this.root.remove(this.points); this.points.geometry.dispose(); this.points = null; }
    // Aucun impact : rien.
    if (!strikes?.length) return;
    // Tableaux.
    const a = buildStrikeAttributes(strikes);
    // Géométrie.
    const geometry = new THREE.BufferGeometry();
    // Positions.
    geometry.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    // Données des impacts.
    geometry.setAttribute('strike', new THREE.BufferAttribute(a.strike, 4));
    // Graines.
    geometry.setAttribute('seed', new THREE.BufferAttribute(a.seed, 1));
    // Nuage de points.
    const points = new THREE.Points(geometry, this.strikeMaterial);
    // Toujours dessiné : visibilité gérée par le shader.
    points.frustumCulled = false;
    // Dessiné après la couche mondiale et les feux.
    points.renderOrder = 44;
    // Ne se clique pas.
    points.raycast = () => {};
    // Avant chaque rendu (début).
    points.onBeforeRender = (renderer, scene, camera) => {
      // Temps écoulé, en secondes.
      this.uniforms.time.value = (performance.now() - this.start) / 1000;
      // Échelle : pixels couverts par une unité placée à une unité de la caméra.
      this.uniforms.pixels.value = renderer.getDrawingBufferSize(this.bufferSize).y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      // Densité de l'écran.
      this.uniforms.dpr.value = renderer.getPixelRatio();
      // Caméra dans le repère de la Terre.
      points.worldToLocal(this.uniforms.camL.value.setFromMatrixPosition(camera.matrixWorld));
    // Fin du traitement avant rendu.
    };
    // Ajouté.
    this.root.add(points);
    // Gardé.
    this.points = points;
  // Fin de setStrikes.
  }

  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }
  // setOpacity : opacité, de 0 à 1, pour les deux parties.
  setOpacity(v) { const o = Math.min(1, Math.max(0, Number(v) || 0)); this.uniforms.opacity.value = o; this.mapUniforms.opacity.value = o; }
  // setIntensity : intensité visuelle, de 0,5 à 2.
  setIntensity(v) { this.uniforms.intensity.value = Math.min(2, Math.max(0.5, Number(v) || 1)); }

  // dispose : libère tout.
  dispose() {
    // Nuage des impacts.
    this.points?.geometry.dispose();
    // Matériau des impacts.
    this.strikeMaterial.dispose();
    // Texture, géométrie et matériau de la couche mondiale.
    this.mapUniforms.map.value?.dispose(); this.mapMesh.geometry.dispose(); this.mapMaterial.dispose();
  // Fin de dispose.
  }
// Fin de LightningLayer.
}
