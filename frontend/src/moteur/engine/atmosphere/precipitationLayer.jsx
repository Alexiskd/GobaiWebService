// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe la place dans l'animation.
import { animationState } from './radarMath';

// Calque des précipitations sur la Terre (PrecipitationEngine, rendu). Le serveur envoie des tuiles où chaque pixel
// porte une MESURE (réflectivité de la pluie, de la neige, couverture radar) et non une couleur : le shader en tire
// lui-même la couleur (échelle de radarMath), lisse les bords sans inventer de pluie faible autour des averses (seuls
// les pixels avec écho sont moyennés), trace la limite de portée des radars et assombrit légèrement les zones sans
// radar (aucune mesure n'y existe). Deux niveaux : la vue mondiale (1 024 px) et un bloc de détail (2,4 km par pixel) autour
// du point visé, chacun animé sur les dernières images, avec un fondu d'une image à la suivante.

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
  // Images mondiales A et B, images de détail A et B.
  'uniform sampler2D gA;uniform sampler2D gB;uniform sampler2D dA;uniform sampler2D dB;',
  // Fondu de A vers B, détail présent, bloc du détail (u0, v0 depuis le nord, côté), tailles d’un texel.
  'uniform float mixAB;uniform float dOn;uniform vec3 dBox;uniform vec2 gTexel;uniform vec2 dTexel;',
  // Opacité, intensité visuelle, affichage de la couverture.
  'uniform float opacity;uniform float intensity;uniform float coverage;',
  // Point de la sphère reçu.
  'varying vec3 vP;',
  // sampleR : lissage bilinéaire fait à la main sur quatre texels voisins (début de la fonction).
  'vec4 sampleR(sampler2D t,vec2 uv,vec2 texel,out float cov){',
  // Position en texels, partie fractionnaire et centre du texel en bas à gauche.
  '  vec2 p=uv/texel-.5;vec2 f=fract(p);vec2 b=(floor(p)+.5)*texel;',
  // Cumuls : dBZ pondérés et poids de la pluie, puis de la neige ; couverture.
  '  vec4 acc=vec4(0.);cov=0.;',
  // Quatre texels.
  '  for(int j=0;j<2;j++){for(int i=0;i<2;i++){',
  // Décalage du texel.
  '    vec2 o=vec2(float(i),float(j));',
  // Poids bilinéaire.
  '    float w=mix(1.-f.x,f.x,o.x)*mix(1.-f.y,f.y,o.y);',
  // Valeurs du texel, en octets.
  '    vec3 c=texture2D(t,b+o*texel).rgb*255.;',
  // Écho de pluie, écho de neige.
  '    float hr=step(.5,c.r);float hs=step(.5,c.g);',
  // Seuls les texels avec écho entrent dans la moyenne de chaque nature.
  '    acc+=vec4(hr*w*(c.r-11.),hr*w,hs*w*(c.g-11.),hs*w);',
  // Couverture : 0 seulement là où aucun radar ne porte (inconnue : comptée couverte).
  '    cov+=w*step(64.,c.b);',
  // Fin des quatre texels.
  '  }}',
  // Cumuls rendus.
  '  return acc;',
  // Fin de sampleR.
  '}',
  // rainCol : couleur de la pluie selon la réflectivité (paliers de RAIN_SCALE) (début).
  'vec3 rainCol(float d){',
  // 5 dBZ : bleu très pâle.
  '  vec3 c=vec3(.604,.843,1.);',
  // 15 dBZ : bleu.
  '  c=mix(c,vec3(.239,.545,1.),smoothstep(5.,15.,d));',
  // 25 dBZ : vert.
  '  c=mix(c,vec3(.184,.749,.31),smoothstep(15.,25.,d));',
  // 35 dBZ : jaune.
  '  c=mix(c,vec3(1.,.882,.29),smoothstep(25.,35.,d));',
  // 40 dBZ : orange.
  '  c=mix(c,vec3(1.,.608,.184),smoothstep(35.,40.,d));',
  // 45 dBZ : rouge.
  '  c=mix(c,vec3(1.,.231,.184),smoothstep(40.,45.,d));',
  // 50 dBZ : rouge sombre.
  '  c=mix(c,vec3(.769,.086,.165),smoothstep(45.,50.,d));',
  // 55 dBZ et plus : magenta.
  '  c=mix(c,vec3(.878,.251,.984),smoothstep(50.,55.,d));',
  // Couleur.
  '  return c;',
  // Fin de rainCol.
  '}',
  // snowCol : couleur de la neige selon la réflectivité (paliers de SNOW_SCALE) (début).
  'vec3 snowCol(float d){',
  // 5 dBZ : blanc bleuté.
  '  vec3 c=vec3(.933,.965,1.);',
  // 20 dBZ : bleu lavande clair.
  '  c=mix(c,vec3(.78,.847,1.),smoothstep(5.,20.,d));',
  // 30 dBZ : lavande.
  '  c=mix(c,vec3(.663,.643,1.),smoothstep(20.,30.,d));',
  // 40 dBZ et plus : violet.
  '  c=mix(c,vec3(.541,.42,1.),smoothstep(30.,40.,d));',
  // Couleur.
  '  return c;',
  // Fin de snowCol.
  '}',
  // shade : couleur prémultipliée d’un échantillon (début).
  'vec4 shade(vec4 s){',
  // Nature dominante : neige si son poids l’emporte.
  '  float sn=step(s.y+1e-4,s.w);',
  // Poids et réflectivité moyenne de la nature dominante.
  '  float w=mix(s.y,s.w,sn);float d=mix(s.x,s.z,sn)/max(w,1e-4);',
  // Opacité : bords lissés, échos faibles discrets, forts presque opaques.
  '  float a=smoothstep(.22,.6,w)*smoothstep(-6.,5.,d)*clamp(.28+.03*(d-5.),.22,.92);',
  // Intensité visuelle et opacité choisies.
  '  a=clamp(a*intensity,0.,1.)*opacity;',
  // Couleur de la nature, éclaircie avec l’intensité.
  '  vec3 col=mix(rainCol(d),snowCol(d),sn)*(.85+.15*intensity);',
  // Couleur prémultipliée.
  '  return vec4(col*a,a);',
  // Fin de shade.
  '}',
  // frameAt : échantillon d’une image (mondiale, ou détail dans son bloc avec un bord fondu) (début).
  'vec4 frameAt(sampler2D g,sampler2D dt,vec2 uv,vec2 m,out float cov){',
  // Échantillon mondial.
  '  vec4 s=sampleR(g,uv,gTexel,cov);',
  // Détail présent : position dans le bloc (passage de l’antiméridien compris).
  '  if(dOn>.5){vec2 q=vec2(fract(m.x-dBox.x)/dBox.z,(m.y-dBox.y)/dBox.z);',
  // Distance au bord du bloc.
  '    float e=min(min(q.x,1.-q.x),min(q.y,1.-q.y));',
  // Dans le bloc : échantillon du détail, fondu vers le mondial sur le bord.
  '    if(e>0.){float cd;vec4 sd=sampleR(dt,vec2(q.x,1.-q.y),dTexel,cd);float k=smoothstep(0.,.04,e);s=mix(s,sd,k);cov=mix(cov,cd,k);}}',
  // Échantillon.
  '  return s;',
  // Fin de frameAt.
  '}',
  // Début de la fonction principale.
  'void main(){',
  // Profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Direction du point.
  '  vec3 p=normalize(vP);',
  // Latitude et longitude (inverse de lonLatToUnit).
  '  float lat=asin(clamp(p.y,-1.,1.));float lon=atan(-p.z,p.x);',
  // Colonne Mercator.
  '  float u=(lon+3.14159265)/6.2831853;',
  // Ligne Mercator depuis le nord (latitude bornée à 85,05°).
  '  float y=.5-log(tan(.78539816+clamp(lat,-1.4844,1.4844)*.5))/6.2831853;',
  // Au-delà de Mercator (pôles) : aucune donnée.
  '  if(abs(lat)>1.4844)discard;',
  // Coordonnées de texture (image retournée : le nord en v = 1) et position Mercator.
  '  vec2 uv=vec2(u,1.-y);vec2 m=vec2(u,y);',
  // Image A, sa couverture et sa couleur.
  '  float covA;vec4 cA=shade(frameAt(gA,dA,uv,m,covA));',
  // Image B pendant un fondu, sinon A.
  '  vec4 c=cA;float cov=covA;',
  // Fondu vers B.
  '  if(mixAB>.001){float covB;vec4 cB=shade(frameAt(gB,dB,uv,m,covB));c=mix(cA,cB,mixAB);cov=mix(covA,covB,mixAB);}',
  // Limite de portée des radars : ligne fine à mi-hauteur de la couverture.
  '  float fw=max(fwidth(cov),1e-4);float line=1.-smoothstep(.6,1.8,abs(cov-.5)/fw);',
  // Ligne de la limite (gris clair) et léger assombrissement hors de portée, si la couverture est affichée.
  '  float la=coverage*opacity*line*.38;float dim=coverage*opacity*(1.-cov)*.12*(1.-la);',
  // Ajoutés sous les précipitations : la ligne, puis l’assombrissement (aucune mesure n’y existe).
  '  c+=(vec4(vec3(.8,.85,.9)*la,la)+vec4(0.,0.,0.,dim))*(1.-c.a);',
  // Transparent : rien.
  '  if(c.a<.004)discard;',
  // Couleur finale, dé-prémultipliée.
  '  gl_FragColor=vec4(c.rgb/c.a,c.a);',
  // Fin de la fonction principale.
  '}',
// Fin : lignes jointes.
].join('\n');

// texture : texture d'une image de mesures (canevas), sans lissage ni mipmaps (le shader lisse lui-même).
function texture(canvas, repeat) {
  // Texture du canevas.
  const tex = new THREE.CanvasTexture(canvas);
  // Sans mipmaps.
  tex.generateMipmaps = false;
  // Au plus proche : les valeurs ne sont jamais mélangées par la carte graphique.
  tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
  // Répétée en longitude (vue mondiale) ou bornée (détail) ; bornée en latitude.
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  // Texture.
  return tex;
// Fin de texture.
}

/**
 * Calque des précipitations. `setGlobal(frames)` pose les images mondiales ([{ time, canvas }], de la plus ancienne à
 * la plus récente), `setDetail(block)` le bloc de détail ({ box, frames } ou null) ; `setAnimate`, `setCoverage`,
 * `setVisible`, `setOpacity`, `setIntensity` règlent l'affichage.
 */
// Déclare et exporte la classe PrecipitationLayer.
export class PrecipitationLayer {
  // Constructeur.
  constructor() {
    // Repère du calque, masqué au départ.
    this.root = new THREE.Object3D();
    // Son nom.
    this.root.name = 'atmosphere-precipitation';
    // Masqué tant qu'il n'est pas allumé.
    this.root.visible = false;
    // Images mondiales et de détail : [{ time, tex }] ; détail par heure ; détail complet.
    this.global = []; this.detail = []; this.detailByTime = new Map(); this.detailFull = false;
    // Animation allumée.
    this.animate = true;
    // Instant de départ de l'animation.
    this.start = performance.now();
    // Texture vide (aucune donnée) pour les échantillonneurs inutilisés.
    this.empty = new THREE.DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1, THREE.RGBAFormat);
    // Mise à jour de la texture vide.
    this.empty.needsUpdate = true;
    // Uniformes.
    this.uniforms = { gA: { value: this.empty }, gB: { value: this.empty }, dA: { value: this.empty }, dB: { value: this.empty }, mixAB: { value: 0 }, dOn: { value: 0 }, dBox: { value: new THREE.Vector3(0, 0, 1) }, gTexel: { value: new THREE.Vector2(1, 1) }, dTexel: { value: new THREE.Vector2(1, 1) }, opacity: { value: 0.85 }, intensity: { value: 1 }, coverage: { value: 1 } };
    // Matériau : transparent, sans écriture de la profondeur, dérivées permises (ligne de couverture).
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, extensions: { derivatives: true } });
    // Sphère juste au-dessus de la carte, sous la couche mondiale de la foudre.
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1.0011, 128, 64), this.material);
    // Masquée tant qu'aucune image n'est posée.
    this.mesh.visible = false;
    // Dessinée après la carte et les nuages, avant la foudre.
    this.mesh.renderOrder = 38;
    // Ne se clique pas.
    this.mesh.raycast = () => {};
    // Avant chaque rendu : image affichée et fondu.
    this.mesh.onBeforeRender = () => this.tick();
    // Sphère dans le repère.
    this.root.add(this.mesh);
  // Fin du constructeur.
  }

  // tick : choisit les images A et B et le fondu selon le temps (début).
  tick() {
    // Nombre d'images mondiales.
    const n = this.global.length;
    // Place dans l'animation (dernière image seule si l'animation est éteinte).
    const s = this.animate ? animationState((performance.now() - this.start) / 1000, n) : { a: n - 1, b: n - 1, mix: 0 };
    // Images mondiales A et B.
    this.uniforms.gA.value = this.global[s.a]?.tex ?? this.empty; this.uniforms.gB.value = this.global[s.b]?.tex ?? this.empty;
    // Fondu.
    this.uniforms.mixAB.value = s.b !== s.a ? s.mix : 0;
    // Détail aux mêmes heures, seulement quand toutes les images affichées l'ont (sinon le mondial seul : la netteté ne
    // change pas d'une image à l'autre pendant le chargement).
    const da = this.detailFull ? this.detailByTime.get(this.global[s.a]?.time) : null, db = this.detailFull ? this.detailByTime.get(this.global[s.b]?.time) : null;
    // Détail utilisable si les deux images existent.
    const on = Boolean(da && db);
    // Images de détail.
    this.uniforms.dA.value = on ? da.tex : this.empty; this.uniforms.dB.value = on ? db.tex : this.empty;
    // Détail présent.
    this.uniforms.dOn.value = on ? 1 : 0;
  // Fin de tick.
  }

  /** Images mondiales : [{ time, canvas }] (une liste vide les retire). */
  // setGlobal : les images.
  setGlobal(frames) {
    // Textures déjà posées, par heure (réutilisées si le canevas est le même).
    const old = new Map(this.global.map((f) => [f.time, f]));
    // Nouvelles images : texture réutilisée ou créée.
    this.global = (frames ?? []).filter((f) => f?.canvas).map((f) => { const o = old.get(f.time); if (o && o.canvas === f.canvas) { old.delete(f.time); return o; } return { time: f.time, canvas: f.canvas, tex: texture(f.canvas, true) }; });
    // Textures abandonnées libérées.
    old.forEach((f) => f.tex.dispose());
    // Taille d'un texel.
    if (this.global[0]) this.uniforms.gTexel.value.set(1 / this.global[0].canvas.width, 1 / this.global[0].canvas.height);
    // Sphère visible s'il y a au moins une image.
    this.mesh.visible = this.global.length > 0;
    // Correspondance avec le détail.
    this.sync();
  // Fin de setGlobal.
  }

  /** Bloc de détail : { box: [u0, v0, côté], frames: [{ time, canvas }] }, ou null pour le retirer. */
  // setDetail : le bloc.
  setDetail(block) {
    // Textures déjà posées, par canevas.
    const old = new Map(this.detail.map((f) => [f.canvas, f]));
    // Nouvelles images : texture réutilisée ou créée.
    this.detail = (block?.frames ?? []).filter((f) => f?.canvas).map((f) => { const o = old.get(f.canvas); if (o) { old.delete(f.canvas); return o; } return { time: f.time, canvas: f.canvas, tex: texture(f.canvas, false) }; });
    // Textures abandonnées libérées.
    old.forEach((f) => f.tex.dispose());
    // Bloc et taille d'un texel.
    if (block?.box && this.detail[0]) { this.uniforms.dBox.value.set(block.box[0], block.box[1], block.box[2]); this.uniforms.dTexel.value.set(1 / this.detail[0].canvas.width, 1 / this.detail[0].canvas.height); }
    // Correspondance avec les images mondiales.
    this.sync();
  // Fin de setDetail.
  }

  // sync : détail rangé par heure, et vrai si chaque image mondiale a son détail.
  sync() {
    // Détail par heure.
    this.detailByTime = new Map(this.detail.map((d) => [d.time, d]));
    // Complet : chaque image mondiale a son détail.
    this.detailFull = this.global.length > 0 && this.global.every((g) => this.detailByTime.has(g.time));
  // Fin de sync.
  }

  // setAnimate : animation des dernières images, ou dernière image seule.
  setAnimate(on) { this.animate = on !== false; }
  // setCoverage : affiche ou masque la limite de portée des radars.
  setCoverage(on) { this.uniforms.coverage.value = on === false ? 0 : 1; }
  // setVisible : affiche ou masque le calque.
  setVisible(on) { this.root.visible = Boolean(on); }
  // setOpacity : opacité, de 0 à 1.
  setOpacity(v) { this.uniforms.opacity.value = Math.min(1, Math.max(0, Number(v) || 0)); }
  // setIntensity : intensité visuelle, de 0,5 à 2.
  setIntensity(v) { this.uniforms.intensity.value = Math.min(2, Math.max(0.5, Number(v) || 1)); }

  // dispose : libère tout.
  dispose() {
    // Textures des images.
    [...this.global, ...this.detail].forEach((f) => f.tex.dispose());
    // Texture vide, géométrie et matériau.
    this.empty.dispose(); this.mesh.geometry.dispose(); this.material.dispose();
  // Fin de dispose.
  }
// Fin de PrecipitationLayer.
}
