// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la place dans l'animation (la même boucle que le radar).
import { animationState } from './radarMath.jsx';

// Calque des aérosols sur la Terre (AerosolEngine, rendu). Deux natures, jamais mélangées à l'écran :
//  - OBSERVÉ : l'image servie porte des MESURES (épaisseur optique ou indice absorbant, du jour et de la veille) ; le
//    shader en tire la couleur, rend l'air pur transparent, lisse les bords sans inventer de valeur là où rien n'a été
//    mesuré (nuages, nuit, entre deux orbites), et pâlit ce qui vient de la veille ;
//  - PRÉVU : les images de la prévision CAMS des poussières, posées telles que publiées, animées sur 48 heures avec un
//    fondu (ce sont des sorties de modèle, pas des mesures).

// Shader de sommets, une ligne GLSL par chaîne (début).
const vertex = [
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

// Shader de fragments, une ligne GLSL par chaîne (début).
const fragment = [
  // Inclusion de three.js : profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Image observée, taille d’un texel, produit (0 : épaisseur optique, 1 : indice absorbant), observé affiché.
  'uniform sampler2D obs;uniform vec2 texel;uniform float mode;uniform float showObs;',
  // Images de la prévision A et B, fondu, prévision affichée.
  'uniform sampler2D fcA;uniform sampler2D fcB;uniform float fcMix;uniform float showFc;',
  // Opacité et intensité visuelle.
  'uniform float opacity;uniform float intensity;',
  // Point de la sphère reçu.
  'varying vec3 vP;',
  // sampleObs : lissage bilinéaire fait à la main ; seuls les texels mesurés comptent (début).
  'vec4 sampleObs(vec2 uv){',
  // Position en texels, partie fractionnaire, centre du texel en bas à gauche.
  '  vec2 p=uv/texel-.5;vec2 f=fract(p);vec2 b=(floor(p)+.5)*texel;',
  // Cumuls : valeurs pondérées et poids du jour, puis de la veille.
  '  vec4 acc=vec4(0.);',
  // Quatre texels.
  '  for(int j=0;j<2;j++){for(int i=0;i<2;i++){',
  // Décalage du texel.
  '    vec2 o=vec2(float(i),float(j));',
  // Poids bilinéaire.
  '    float w=mix(1.-f.x,f.x,o.x)*mix(1.-f.y,f.y,o.y);',
  // Codes du texel (rouge : jour, vert : veille).
  '    vec2 c=texture2D(obs,b+o*texel).rg*255.;',
  // Mesure du jour, mesure de la veille.
  '    float ht=step(.5,c.x);float hy=step(.5,c.y);',
  // Valeurs (code − 1) / 50 pondérées.
  '    acc+=vec4(ht*w*(c.x-1.)/50.,ht*w,hy*w*(c.y-1.)/50.,hy*w);',
  // Fin des quatre texels.
  '  }}',
  // Cumuls rendus.
  '  return acc;',
  // Fin de sampleObs.
  '}',
  // aodCol : couleur de l’épaisseur optique (paliers de AOD_SCALE) (début).
  'vec3 aodCol(float v){',
  // 0,1 : jaune très pâle.
  '  vec3 c=vec3(1.,.953,.69);',
  // 0,3 : jaune.
  '  c=mix(c,vec3(1.,.827,.302),smoothstep(.1,.3,v));',
  // 0,6 : orange.
  '  c=mix(c,vec3(1.,.604,.18),smoothstep(.3,.6,v));',
  // 1 : rouge orangé.
  '  c=mix(c,vec3(.91,.329,.118),smoothstep(.6,1.,v));',
  // 2 : rouge sombre.
  '  c=mix(c,vec3(.639,.114,.227),smoothstep(1.,2.,v));',
  // 3 et plus : pourpre.
  '  c=mix(c,vec3(.353,.102,.369),smoothstep(2.,3.,v));',
  // Couleur.
  '  return c;',
  // Fin de aodCol.
  '}',
  // aiCol : couleur de l’indice absorbant (paliers de AI_SCALE) (début).
  'vec3 aiCol(float v){',
  // 0,7 : sable clair.
  '  vec3 c=vec3(.961,.902,.784);',
  // 1,5 : sable.
  '  c=mix(c,vec3(.902,.702,.42),smoothstep(.7,1.5,v));',
  // 2,5 : ocre.
  '  c=mix(c,vec3(.788,.459,.18),smoothstep(1.5,2.5,v));',
  // 3,5 : brun.
  '  c=mix(c,vec3(.557,.231,.11),smoothstep(2.5,3.5,v));',
  // 5 et plus : brun sombre.
  '  c=mix(c,vec3(.29,.086,.031),smoothstep(3.5,5.,v));',
  // Couleur.
  '  return c;',
  // Fin de aiCol.
  '}',
  // shadeObs : couleur prémultipliée d’une valeur avec son poids (début).
  'vec4 shadeObs(float sum,float w){',
  // Valeur moyenne des texels mesurés.
  '  float v=sum/max(w,1e-4);',
  // Opacité : air pur transparent, charge forte presque opaque (seuils propres à chaque produit).
  '  float a=mode<.5?smoothstep(.08,.45,v)*mix(.55,.88,smoothstep(.45,1.5,v)):smoothstep(.6,1.4,v)*mix(.55,.88,smoothstep(1.4,3.,v));',
  // Bords lissés, intensité visuelle.
  '  a=clamp(a*smoothstep(.22,.6,w)*intensity,0.,1.);',
  // Couleur du produit.
  '  vec3 col=mode<.5?aodCol(v):aiCol(v);',
  // Couleur prémultipliée.
  '  return vec4(col*a,a);',
  // Fin de shadeObs.
  '}',
  // Début de la fonction principale.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Direction du point.
  '  vec3 p=normalize(vP);',
  // Latitude et longitude (inverse de lonLatToUnit).
  '  float lat=asin(clamp(p.y,-1.,1.));float lon=atan(-p.z,p.x);',
  // Coordonnées équirectangulaires (image retournée : le nord en v = 1).
  '  vec2 uv=vec2((lon+3.14159265)/6.2831853,(lat+1.5707963)/3.14159265);',
  // Couleur accumulée (prémultipliée).
  '  vec4 c=vec4(0.);',
  // Observé (début).
  '  if(showObs>.5){',
  // Échantillon : jour et veille.
  '    vec4 s=sampleObs(uv);',
  // Jour, et veille pâlie à 55 %.
  '    vec4 t=shadeObs(s.x,s.y);vec4 y=shadeObs(s.z,s.w)*.55;',
  // Le jour par-dessus la veille.
  '    c=t+y*(1.-t.a);',
  // Fin de l’observé.
  '  }',
  // Prévision : images A et B fondues, telles que publiées.
  '  if(showFc>.5){vec4 a=texture2D(fcA,uv);vec4 b=texture2D(fcB,uv);vec4 f=mix(a,b,fcMix);c=vec4(f.rgb*f.a,f.a)*.85*intensity;}',
  // Opacité choisie.
  '  c*=opacity;',
  // Transparent : rien.
  '  if(c.a<.004)discard;',
  // Couleur finale, dé-prémultipliée.
  '  gl_FragColor=vec4(c.rgb/c.a,min(c.a,1.));',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// texture : texture d'un canevas ; `values` : mesures (au plus proche, sans mélange), sinon image lissée.
function texture(canvas, values) {
  // Texture du canevas.
  const tex = new THREE.CanvasTexture(canvas);
  // Sans mipmaps.
  tex.generateMipmaps = false;
  // Filtrage : au plus proche pour les mesures (le shader lisse lui-même), lissé pour une image de prévision.
  tex.minFilter = tex.magFilter = values ? THREE.NearestFilter : THREE.LinearFilter;
  // Répétée en longitude, bornée en latitude.
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  // Texture.
  return tex;
// Fin de texture.
}

/**
 * Calque des aérosols. `setObserved({ product, canvas })` pose l'image observée (ou null), `setForecast(frames)` les
 * images de la prévision ([{ time, canvas }]) ; `setMode('aod' | 'ai' | 'dust')` choisit ce qui est montré.
 */
// Déclare et exporte la classe AerosolLayer.
export class AerosolLayer {
  // Constructeur.
  constructor() {
    // Repère du calque, masqué au départ.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-aerosols';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Image observée ({ product, canvas, tex }) et images de la prévision ([{ time, canvas, tex }]).
    this.observed = null; this.forecast = [];
    // Produit montré et animation de la prévision.
    this.mode = 'aod'; this.animate = true;
    // Instant de départ de l'animation.
    this.start = performance.now();
    // Texture vide.
    this.empty = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
    // Mise à jour de la texture vide.
    this.empty.needsUpdate = true;
    // Uniformes.
    this.uniforms = { obs: { value: this.empty }, texel: { value: new THREE.Vector2(1, 1) }, mode: { value: 0 }, showObs: { value: 0 }, fcA: { value: this.empty }, fcB: { value: this.empty }, fcMix: { value: 0 }, showFc: { value: 0 }, opacity: { value: 0.85 }, intensity: { value: 1 } };
    // Matériau : transparent, sans écriture de la profondeur.
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false });
    // Sphère juste au-dessus de la carte, sous le radar et la foudre.
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1.0009, 128, 64), this.material);
    // Dessinée après la carte et les nuages, avant le radar.
    this.mesh.renderOrder = 37;
    // Ne se clique pas.
    this.mesh.raycast = () => {};
    // Avant chaque rendu : ce qui est montré, image de la prévision et fondu.
    this.mesh.onBeforeRender = () => this.tick();
    // Sphère dans le repère.
    this.root.add(this.mesh);
  // Fin du constructeur.
  }

  // tick : choisit ce qui est montré et l'image de la prévision selon le temps (début).
  tick() {
    // Observé : une image du produit choisi.
    const obsOn = this.mode !== 'dust' && this.observed?.product === this.mode;
    // Image observée.
    this.uniforms.obs.value = obsOn ? this.observed.tex : this.empty; this.uniforms.showObs.value = obsOn ? 1 : 0; this.uniforms.mode.value = this.mode === 'ai' ? 1 : 0;
    // Prévision : au moins une image, produit des poussières.
    const n = this.forecast.length, fcOn = this.mode === 'dust' && n > 0;
    // Place dans l'animation (première image seule si l'animation est éteinte : l'échéance la plus proche).
    const s = fcOn && this.animate ? animationState((performance.now() - this.start) / 1000, n) : { a: 0, b: 0, mix: 0 };
    // Images A et B.
    this.uniforms.fcA.value = fcOn ? this.forecast[s.a].tex : this.empty; this.uniforms.fcB.value = fcOn ? this.forecast[s.b].tex : this.empty;
    // Fondu et prévision montrée.
    this.uniforms.fcMix.value = s.b !== s.a ? s.mix : 0; this.uniforms.showFc.value = fcOn ? 1 : 0;
  // Fin de tick.
  }

  /** Image observée : { product, canvas } (null : retirée). */
  // setObserved : l'image.
  setObserved(data) {
    // Même canevas : rien.
    if (data?.canvas && data.canvas === this.observed?.canvas) { this.observed.product = data.product; return; }
    // Ancienne texture libérée.
    this.observed?.tex.dispose();
    // Nouvelle image, ou aucune.
    this.observed = data?.canvas ? { product: data.product, canvas: data.canvas, tex: texture(data.canvas, true) } : null;
    // Taille d'un texel.
    if (this.observed) this.uniforms.texel.value.set(1 / data.canvas.width, 1 / data.canvas.height);
  // Fin de setObserved.
  }

  /** Images de la prévision : [{ time, canvas }], de la plus proche à la plus lointaine (liste vide : retirées). */
  // setForecast : les images.
  setForecast(frames) {
    // Textures déjà posées, par canevas.
    const old = new Map(this.forecast.map((f) => [f.canvas, f]));
    // Nouvelles images : texture réutilisée ou créée.
    this.forecast = (frames ?? []).filter((f) => f?.canvas).map((f) => { const o = old.get(f.canvas); if (o) { old.delete(f.canvas); return o; } return { time: f.time, canvas: f.canvas, tex: texture(f.canvas, false) }; });
    // Textures abandonnées libérées.
    old.forEach((f) => f.tex.dispose());
  // Fin de setForecast.
  }

  // setMode : produit montré ('aod', 'ai' ou 'dust').
  setMode(mode) { this.mode = mode === 'ai' || mode === 'dust' ? mode : 'aod'; }
  // setAnimate : animation de la prévision, ou échéance la plus proche seule.
  setAnimate(on) { this.animate = on !== false; }
  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }
  // setOpacity : opacité, de 0 à 1.
  setOpacity(v) { this.uniforms.opacity.value = Math.min(1, Math.max(0, Number(v) || 0)); }
  // setIntensity : intensité visuelle, de 0,5 à 2.
  setIntensity(v) { this.uniforms.intensity.value = Math.min(2, Math.max(0.5, Number(v) || 1)); }

  // dispose : libère tout.
  dispose() {
    // Textures.
    this.observed?.tex.dispose(); this.forecast.forEach((f) => f.tex.dispose());
    // Texture vide, géométrie et matériau.
    this.empty.dispose(); this.mesh.geometry.dispose(); this.material.dispose();
  // Fin de dispose.
  }
// Fin de AerosolLayer.
}
