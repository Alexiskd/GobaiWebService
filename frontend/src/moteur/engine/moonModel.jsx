// Importe toute la bibliothèque three.js sous le nom THREE.
import * as THREE from 'three';
// Importe GLTFLoader, le chargeur de modèles glTF de three.js.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Importe DRACOLoader, le décodeur des modèles compressés par Draco.
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
// Importe MeshoptDecoder, le décodeur des modèles compressés par meshopt.
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
// Importe le test d'une coordonnée de texture utilisable et le calcul de l'orientation, depuis moonModelMath.
import { usableUv, uvAlignment } from './moonModelMath';

// Nombre maximal de sommets échantillonnés par maillage : 4000.
const MAX_SAMPLES = 4000;

/**
 * Modèle 3D officiel de la Lune (NASA, glTF binaire), posé dans le repère sélénographique du moteur.
 * Le modèle n'indique ni son orientation ni son échelle : on les déduit de sa géométrie (centre, rayon moyen) et de
 * ses coordonnées de texture (longitude/latitude), puis on le met au rayon réel de la Lune.
 * @returns {Promise<{ object: THREE.Object3D, info: { meshes, vertices, rms, mirrored } }>}
 */
// Même éclairage que les tuiles de la Lune (Lommel-Seeliger, terminateur net, lumière cendrée) et mêmes couleurs
// (texture globale des couleurs naturelles) : le passage modèle ↔ tuiles ne change ni la teinte ni la lumière.
// Code GLSL du shader de sommets (début).
const vert = [
  // Inclusions de three.js : fonctions communes et déclarations de la profondeur logarithmique.
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  // Variables transmises au shader de fragments : coordonnées de texture, normale et direction de la caméra.
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  // Fonction principale : coordonnées de texture, normale dans le repère de la caméra, direction vers la caméra et position à l'écran.
  'void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  // Inclusion de la profondeur logarithmique, puis fin de la fonction principale.
  '#include <logdepthbuf_vertex>', '}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');
// Code GLSL du shader de fragments (début).
const frag = [
  // Inclusion de three.js : déclarations de la profondeur logarithmique.
  '#include <logdepthbuf_pars_fragment>',
  // Variables uniformes : la texture des couleurs et son interrupteur, la texture propre du modèle et son interrupteur, la direction du Soleil, l'ombre, la lumière cendrée et le type de coordonnées de texture.
  'uniform sampler2D colorMap;uniform float colorOn;uniform sampler2D ownMap;uniform float ownOn;uniform vec3 sunV;uniform float shade;uniform float earthshine;uniform float gltfUv;',
  // Variables reçues du shader de sommets.
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  // Début de la fonction principale et inclusion de la profondeur logarithmique.
  'void main(){', '#include <logdepthbuf_fragment>',
  // uv glTF : v = 0 au Nord ; la texture des couleurs (flipY) a v = 1 au Nord.
  // Coordonnées de la texture des couleurs : v inversé pour un modèle glTF.
  'vec2 cuv=gltfUv>.5?vec2(vUv.x,1.-vUv.y):vUv;',
  // Couleur : la texture des couleurs si elle est active, sinon la texture propre du modèle, sinon un gris.
  'vec3 col=colorOn>.5?texture2D(colorMap,cuv).rgb:(ownOn>.5?texture2D(ownMap,vUv).rgb:vec3(.55,.54,.52));',
  // Normale (retournée vue de l'intérieur) et direction de la caméra ; cosinus de l'angle avec le Soleil, de l'angle de vue et de l'éclairement.
  'vec3 N=normalize(vN),V=normalize(vV);if(!gl_FrontFacing)N=-N;float d=dot(N,sunV);float mu=max(dot(N,V),0.),m0=max(d,0.);',
  // Part de jour, progressive autour du terminateur, et couleur éclairée selon la loi de Lommel-Seeliger, plafonnée à 1,4.
  'float day=smoothstep(-.02,.04,d);vec3 lit=col*min(1.4,.04+2.*m0/(m0+mu+.001));',
  // Couleur de nuit : très sombre, modulée par la lumière cendrée.
  'vec3 night=col*vec3(.012,.014,.017)*(.2+.8*earthshine);', // même face nuit que les tuiles (tileShaders.jsx)
  // Couleur finale : sans ombre la couleur brute, avec ombre le mélange nuit/jour ; opaque. Fin de la fonction principale.
  'gl_FragColor=vec4(mix(col,mix(night,lit,day),shade),1.);}',
// Fin : les lignes sont jointes par des retours à la ligne.
].join('\n');

/**
 * Remplace les matériaux du modèle par l'éclairage de la Lune du moteur. `uniforms` = ceux des tuiles de la Lune
 * (colorMap, colorOn, sunV, shade, earthshine), partagés : tout reste synchronisé sans code de plus.
 */
/**
 * Matériau « surface de la Lune » partagé par la sphère de fond, le modèle 3D et (par leur shader) les tuiles.
 * gltfUv : coordonnées de texture glTF (v = 0 au Nord) ; sinon three.js (v = 1 au Nord).
 */
// Déclare et exporte createMoonSurfaceMaterial : les variables uniformes partagées et les options (coordonnées glTF, texture propre, face dessinée).
export function createMoonSurfaceMaterial(uniforms, { gltfUv = false, ownMap = null, side = THREE.FrontSide } = {}) {
  // Renvoie un matériau à shader (début).
  return new THREE.ShaderMaterial({
    // Ses variables uniformes (début).
    uniforms: {
      // Celles partagées avec les tuiles : couleurs, interrupteur, Soleil et ombre.
      colorMap: uniforms.colorMap, colorOn: uniforms.colorOn, sunV: uniforms.sunV, shade: uniforms.shade,
      // La lumière cendrée partagée, puis la texture propre, son interrupteur et le type de coordonnées.
      earthshine: uniforms.earthshine, ownMap: { value: ownMap }, ownOn: { value: ownMap ? 1 : 0 }, gltfUv: { value: gltfUv ? 1 : 0 },
    // Fin des variables uniformes.
    },
    // Le shader de sommets.
    vertexShader: vert,
    // Le shader de fragments.
    fragmentShader: frag,
    // La face dessinée.
    side,
  // Fin du matériau.
  });
// Fin de createMoonSurfaceMaterial.
}

// applyMoonShading : remplace les matériaux d'un modèle par celui de la Lune (début).
function applyMoonShading(scene, uniforms, mirrored) {
  // Pour chaque objet du modèle (début).
  scene.traverse((o) => {
    // Ce n'est pas un maillage : ignoré.
    if (!o.isMesh) return;
    // Sans normales : elles sont calculées.
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    // Ancien matériau : le premier s'il y en a plusieurs.
    const old = Array.isArray(o.material) ? o.material[0] : o.material;
    // Sa texture, ou null.
    const own = old?.map || null;
    // Nouveau matériau : coordonnées glTF, texture propre, et les deux faces pour un modèle en miroir.
    o.material = createMoonSurfaceMaterial(uniforms, { gltfUv: true, ownMap: own, side: mirrored ? THREE.DoubleSide : THREE.FrontSide });
    // Libère les anciens matériaux, et leurs textures sauf celle qui est réutilisée.
    [].concat(old || []).forEach((m) => { if (m && m.map !== own) m.map?.dispose(); m?.dispose?.(); });
  // Fin de la boucle.
  });
// Fin de applyMoonShading.
}

// Déclare et exporte loadMoonModel, asynchrone : l'adresse, le rayon voulu, les variables uniformes et l'écart maximal admis.
export async function loadMoonModel(url, radius, uniforms = null, { maxRms = Infinity } = {}) {
  // Chargeur glTF.
  const loader = new GLTFLoader();
  // Modèles compressés (Draco, meshopt) : décodeurs chargés seulement si le fichier en a besoin.
  // Décodeur Draco, avec l'adresse de ses fichiers.
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
  // Le branche sur le chargeur.
  loader.setDRACOLoader(draco);
  // Branche aussi le décodeur meshopt.
  loader.setMeshoptDecoder(MeshoptDecoder);
  // Attend le modèle, puis libère le décodeur Draco dans tous les cas.
  const gltf = await loader.loadAsync(url).finally(() => draco.dispose());
  // La scène du modèle.
  const scene = gltf.scene;
  // Met à jour ses matrices.
  scene.updateMatrixWorld(true);

  // Centre et rayon moyen, sur les sommets en coordonnées du modèle.
  // Boîte englobante du modèle.
  const box = new THREE.Box3().setFromObject(scene);
  // Son centre.
  const center = box.getCenter(new THREE.Vector3());
  // Vecteur de travail.
  const v = new THREE.Vector3();
  // Échantillons pour le calage : position et coordonnées de texture.
  const samples = [];
  // Compteurs : maillages, sommets, somme des rayons et nombre de rayons.
  let meshes = 0, vertices = 0, sumR = 0, nR = 0;
  // Pour chaque objet du modèle (début).
  scene.traverse((o) => {
    // Ni maillage ni positions : ignoré.
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    // Un maillage de plus.
    meshes++;
    // Ses positions et ses coordonnées de texture.
    const pos = o.geometry.attributes.position, uv = o.geometry.attributes.uv;
    // Ajoute son nombre de sommets.
    vertices += pos.count;
    // Pas d'échantillonnage : au plus 4000 sommets pris par maillage.
    const step = Math.max(1, Math.floor(pos.count / MAX_SAMPLES));
    // Pour chaque sommet échantillonné (début).
    for (let i = 0; i < pos.count; i += step) {
      // Sa position dans le monde, relative au centre.
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(center);
      // Ajoute sa distance au centre.
      sumR += v.length(); nR++;
      // Si sa coordonnée de texture est utilisable : garde l'échantillon.
      if (uv && usableUv(uv.getX(i), uv.getY(i))) samples.push({ p: [v.x, v.y, v.z], u: uv.getX(i), v: uv.getY(i) });
    // Fin de la boucle des sommets.
    }
  // Fin de la boucle des objets.
  });
  // Aucun maillage ou aucun sommet : erreur.
  if (!meshes || nR === 0) throw new Error('Modèle sans maillage');
  // Rayon moyen du modèle.
  const meanR = sumR / nR;

  // Orientation par défaut : la matrice identité.
  const identity = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], det: 1, rms: NaN };
  // Orientation déduite des coordonnées de texture, s'il y a au moins 50 échantillons.
  let { m, det, rms } = samples.length >= 50 ? uvAlignment(samples) : identity;
  // Texture qui n'est pas une carte longitude/latitude (astre irrégulier) : le calage n'a pas de sens, on garde
  // l'orientation du fichier plutôt qu'une rotation fausse.
  // Calage valable : matrice finie, déterminant proche de ±1, et écart sous le maximum admis.
  const aligned = m.every(Number.isFinite) && Math.abs(Math.abs(det) - 1) < 0.05 && (rms <= maxRms || maxRms === Infinity);
  // Sinon : l'orientation du fichier est gardée.
  if (!aligned) ({ m, det } = identity);
  // Modèle en miroir quand le déterminant est négatif.
  const mirrored = det < 0;
  // Avec des variables uniformes : applique l'éclairage de la Lune.
  if (uniforms) applyMoonShading(scene, uniforms, mirrored);
  // Sinon, pour un modèle en miroir : dessine les deux faces de ses matériaux.
  else if (mirrored) scene.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((mat) => { if (mat) mat.side = THREE.DoubleSide; }); });

  // Matrice finale : échelle (rayon réel) · rotation (calage uv) · translation (centre à l'origine).
  // Matrice de rotation 4 × 4 faite à partir de la matrice 3 × 3.
  const rot = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  // Facteur d'échelle : le rayon voulu divisé par le rayon moyen.
  const k = radius / meanR;
  // Groupe qui porte le modèle.
  const holder = new THREE.Group();
  // Son nom : « moon-model ».
  holder.name = 'moon-model';
  // Sa matrice n'est pas recalculée automatiquement.
  holder.matrixAutoUpdate = false;
  // Sa matrice (début) :
  holder.matrix
    // l'échelle,
    .makeScale(k, k, k)
    // multipliée par la rotation,
    .multiply(rot)
    // multipliée par la translation qui amène le centre à l'origine.
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  // Ajoute le modèle au groupe.
  holder.add(scene);
  // Renvoie le groupe et les informations sur le modèle.
  return { object: holder, info: { meshes, vertices, rms, mirrored, aligned } };
// Fin de loadMoonModel.
}
