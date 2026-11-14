// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';

// Sphère de couleur unie avec le même éclairage jour/nuit que les cartes (tiles/tileShaders.jsx) : face tournée vers
// le Soleil éclairée, face opposée dans l'ombre, et le même réglage « Ombre » (uniform `shade`, 0 = astre entièrement
// éclairé, 1 = ombre). Sert aux astres sans carte : géantes gazeuses, satellites en sphère unie, fond des planètes.
// Avant, ces sphères étaient éclairées par les lumières de la scène : elles ne suivaient ni le bouton « Ombre » ni
// l'intensité de l'ombre des cartes.

// Programme de sommets, en GLSL (début).
const vertexShader = [
  // Inclut les définitions communes et celles du tampon de profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Valeurs transmises au programme de fragments : la normale et la direction de vue.
  'varying vec3 vN;varying vec3 vV;',
  // Calcule la normale, la direction de vue et la position à l'écran.
  'void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  // Écrit la profondeur logarithmique ; fin du programme.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

// Programme de fragments, en GLSL (début).
const fragmentShader = [
  // Inclut les définitions du tampon de profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : la couleur, la direction du Soleil, le réglage d'ombre et l'indicateur « sans atmosphère ».
  'uniform vec3 color;uniform vec3 sunV;uniform float shade;uniform float airless;',
  // Valeurs reçues du programme de sommets.
  'varying vec3 vN;varying vec3 vV;',
  // Début du programme ; écrit la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // Vue de l'intérieur (géante gazeuse traversée) : la normale est retournée.
  // Normale et direction de vue normalisées ; la normale est retournée sur la face arrière.
  'vec3 N=normalize(vN),V=normalize(vV);if(!gl_FrontFacing)N=-N;',
  // Orientation par rapport au Soleil, et cosinus des angles de vue et d'éclairement.
  'float d=dot(N,sunV);float mu=max(dot(N,V),0.),m0=max(d,0.);',
  // Mêmes courbes que les cartes : terminateur doux avec atmosphère, net sans atmosphère.
  // Part de jour : transition douce avec atmosphère, nette sans atmosphère.
  'float day=mix(smoothstep(-.12,.22,d),smoothstep(-.02,.04,d),airless);',
  // Couleur éclairée : une formule avec atmosphère, une autre sans.
  'vec3 lit=mix(color*(.38+.72*m0),color*min(1.4,.04+2.*m0/(m0+mu+.001)),airless);',
  // Couleur de nuit : bleutée avec atmosphère, grise sans.
  'vec3 night=color*mix(vec3(.024,.034,.06),vec3(.012,.014,.017),airless);',
  // Couleur finale : la couleur unie si l'ombre est coupée, le mélange jour/nuit sinon.
  'gl_FragColor=vec4(mix(color,mix(night,lit,day),shade),1.);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * @param color     couleur de l'astre (THREE.Color ou valeur acceptée par THREE.Color)
 * @param uniforms  uniforms partagés de ses cartes (TileManager.uniforms) : `sunV` (direction du Soleil dans le repère
 *                  caméra), `shade` (réglage « Ombre ») et `airless` — partagés, donc toujours synchronisés
 * @param side      THREE.DoubleSide pour une géante gazeuse (visible aussi de l'intérieur)
 */
// Déclare et exporte createShadedSphereMaterial : la couleur, les uniformes partagés et la face dessinée (avant par défaut).
export function createShadedSphereMaterial(color, uniforms, side = THREE.FrontSide) {
  // Crée le matériau (début).
  const material = new THREE.ShaderMaterial({
    // Ses variables uniformes (début).
    uniforms: {
      // La couleur, propre à ce matériau.
      color: { value: new THREE.Color(color) },
      // La direction du Soleil, partagée.
      sunV: uniforms.sunV,
      // Le réglage d'ombre, partagé.
      shade: uniforms.shade,
      // L'indicateur « sans atmosphère », partagé.
      airless: uniforms.airless,
    // Fin des uniformes.
    },
    // Le programme de sommets.
    vertexShader,
    // Le programme de fragments.
    fragmentShader,
    // La face dessinée.
    side,
  // Fin du matériau.
  });
  // Tampon de profondeur logarithmique : extension nécessaire en WebGL 1 (comme le halo de l'atmosphère).
  // Active l'extension d'écriture de la profondeur.
  material.extensions = { fragDepth: true };
  // Renvoie le matériau.
  return material;
// Fin de createShadedSphereMaterial.
}
