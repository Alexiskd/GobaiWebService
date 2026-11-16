// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe le rayon intérieur, le rayon extérieur, l'épaisseur optique maximale et la construction du profil des anneaux, depuis saturnRingsMath.
import { RING_INNER, RING_OUTER, TAU_MAX, buildRingProfile } from './saturnRingsMath';

// Anneaux de Saturne : disque plat dont la couleur et la transparence suivent le profil radial réel
// (anneaux D, C, B, division de Cassini, A avec les lacunes d'Encke et de Keeler, F). Voir saturnRingsMath.jsx.
// Tout est calculé dans le repère du disque (plan xy, pôle = z, Saturne au centre) : pas de perte de précision loin du Soleil.

// Code GLSL du shader de sommets (début).
const vertexShader = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variable transmise au shader de fragments : la position dans le plan du disque.
  'varying vec2 vP;',
  // Fonction principale : garde les coordonnées x et y du sommet et calcule sa position à l'écran.
  'void main(){vP=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Code GLSL du shader de fragments (début).
const fragmentShader = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : le profil, la direction du Soleil, la position de la caméra, le rayon de Saturne, les rayons intérieur et extérieur, l'épaisseur optique maximale, l'aplatissement et le réglage de l'ombre.
  'uniform sampler2D profile;uniform vec3 sunL;uniform vec3 camL;uniform float radius;uniform float inner;uniform float outer;uniform float tauMax;uniform float flatten;uniform float shade;',
  // Position reçue du shader de sommets.
  'varying vec2 vP;',
  // Début de la fonction principale.
  'void main(){',
  // Inclusion de la profondeur logarithmique.
  '#include <logdepthbuf_fragment>',
  // Distance au centre, en rayons de Saturne.
  '  float rho=length(vP)/radius;',
  // Position entre le bord intérieur (0) et le bord extérieur (1).
  '  float u=(rho-inner)/(outer-inner);',
  // En dehors des anneaux : le fragment n'est pas dessiné.
  '  if(u<0.||u>1.)discard;',
  // Lecture du profil à cette position.
  '  vec4 t=texture2D(profile,vec2(u,.5));',
  // Épaisseur optique : le maximum multiplié par le carré de la valeur alpha du profil.
  '  float tau=tauMax*t.a*t.a;',
  // Point du disque, dans le plan z = 0.
  '  vec3 P=vec3(vP,0.);',
  // Direction du point vers la caméra.
  '  vec3 V=normalize(camL-P);',
  // Valeur absolue de la composante z de cette direction, au moins 0,03.
  '  float mv=max(abs(V.z),.03);',      // cosinus de l'angle de vue par rapport au pôle
  // Valeur absolue de la composante z de la direction du Soleil, au moins 0,03.
  '  float ms=max(abs(sunL.z),.03);',   // idem pour le Soleil : faible près de l'équinoxe de Saturne
  // Vus par la tranche, les anneaux ténus s'épaississent : opacité le long de la ligne de visée.
  // Opacité : 1 − e^(−tau/mv).
  '  float alpha=1.-exp(-tau/mv);',
  // Épaisseur traversée par la lumière, à l'aller depuis le Soleil et au retour vers la caméra.
  '  float x=tau*(1./ms+1./mv);',
  // Éclat de la face éclairée.
  '  float lit=(1.-exp(-x))*ms/(ms+mv)*2.4;',   // face éclairée : lumière renvoyée par les particules
  // Éclat de la face sombre.
  '  float through=1.9*(.5*x)*exp(-.5*x);',     // face sombre : lumière qui traverse (C et Cassini ressortent, B s'éteint)
  // Face éclairée si le Soleil et la caméra sont du même côté du disque ; sinon face sombre, à 60 %.
  '  float b=sunL.z*V.z>0.?lit:through*.6;',
  // Éclat ramené entre 0,22 et 1.
  '  b=.22+.78*clamp(b,0.,1.);',
  // Ombre de Saturne (ellipsoïde aplati aux pôles) portée sur les anneaux.
  // Direction du Soleil dans un repère où Saturne aplatie devient une sphère.
  '  vec3 s=normalize(vec3(sunL.xy,sunL.z/flatten));',
  // Distance, le long de cette direction, du point au plus près du centre ; positive quand Saturne est entre le point et le Soleil.
  '  float tca=-dot(P,s);',
  // Ombre : 1, aucune au départ.
  '  float shadow=1.;',
  // Du côté opposé au Soleil : distance du rayon au centre, et ombre progressive entre 0,985 et 1,02 rayon.
  '  if(tca>0.){float d=length(P+tca*s);shadow=smoothstep(radius*.985,radius*1.02,d);}',
  // `shade` = réglage « Ombre » (0 : anneaux entièrement éclairés ; 1 : éclairage réel et ombre de la planète).
  // Couleur finale : le profil, multiplié par l'éclat et l'ombre selon le réglage shade ; opacité alpha.
  '  gl_FragColor=vec4(t.rgb*mix(1.,b*mix(.03,1.,shadow),shade),alpha);',
  // Fin de la fonction principale.
  '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Crée le disque des anneaux pour une Saturne de rayon équatorial `radius` (unités de la scène).
 * `sunPosition()` renvoie la position du Soleil dans la scène ; l'éclairage et l'ombre sont recalés à chaque image.
 */
// Déclare et exporte createSaturnRings : le rayon de Saturne et la fonction qui donne la position du Soleil.
export function createSaturnRings(radius, sunPosition) {
  // Texture du profil radial : 2048 points sur une seule ligne, au format RGBA.
  const profile = new THREE.DataTexture(buildRingProfile(2048), 2048, 1, THREE.RGBAFormat);
  // Filtre d'agrandissement linéaire.
  profile.magFilter = THREE.LinearFilter;
  // Filtre de réduction linéaire avec mipmaps.
  profile.minFilter = THREE.LinearMipmapLinearFilter;
  // Mipmaps générées automatiquement.
  profile.generateMipmaps = true;
  // Signale à three.js que la texture est à envoyer.
  profile.needsUpdate = true;

  // Variables uniformes du shader (début).
  const uniforms = {
    // Le profil.
    profile: { value: profile },
    // Direction du Soleil, provisoire, unitaire.
    sunL: { value: new THREE.Vector3(1, 0, 0.3).normalize() },
    // Position de la caméra, provisoire : à dix rayons au-dessus du disque.
    camL: { value: new THREE.Vector3(0, 0, radius * 10) },
    // Le rayon de Saturne.
    radius: { value: radius },
    // Le rayon intérieur des anneaux.
    inner: { value: RING_INNER },
    // Leur rayon extérieur.
    outer: { value: RING_OUTER },
    // L'épaisseur optique maximale.
    tauMax: { value: TAU_MAX },
    // L'aplatissement : 0,902.
    flatten: { value: 0.902 }, // rayon polaire / rayon équatorial de Saturne
    // Le réglage de l'ombre : 1.
    shade: { value: 1 },       // réglage « Ombre », piloté par le moteur (applyShade)
  // Fin des variables uniformes.
  };
  // Le maillage (début).
  const mesh = new THREE.Mesh(
    // Géométrie : un anneau plat entre les deux rayons, en 256 secteurs.
    new THREE.RingGeometry(radius * RING_INNER, radius * RING_OUTER, 256, 1),
    // Matériau à shader : les deux faces dessinées, transparent, sans écriture de la profondeur.
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide, transparent: true, depthWrite: false })
  // Fin du maillage.
  );
  // Avant chaque rendu du maillage (début).
  mesh.onBeforeRender = (renderer, scene, camera) => {
    // Position de la caméra, ramenée dans le repère du disque.
    mesh.worldToLocal(uniforms.camL.value.setFromMatrixPosition(camera.matrixWorld));
    // Position du Soleil, ramenée dans le repère du disque.
    const sun = mesh.worldToLocal(uniforms.sunL.value.copy(sunPosition()));
    // Rendue unitaire si elle n'est pas nulle.
    if (sun.lengthSq() > 0) sun.normalize();
  // Fin du traitement avant rendu.
  };
  // Fonction de libération rangée dans userData : libère la texture, la géométrie et le matériau.
  mesh.userData.dispose = () => { profile.dispose(); mesh.geometry.dispose(); mesh.material.dispose(); };
  // Renvoie le maillage.
  return mesh;
// Fin de createSaturnRings.
}
