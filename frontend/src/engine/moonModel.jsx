import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { usableUv, uvAlignment } from './moonModelMath';

const MAX_SAMPLES = 4000;

/**
 * Modèle 3D officiel de la Lune (NASA, glTF binaire), posé dans le repère sélénographique du moteur.
 * Le modèle n'indique ni son orientation ni son échelle : on les déduit de sa géométrie (centre, rayon moyen) et de
 * ses coordonnées de texture (longitude/latitude), puis on le met au rayon réel de la Lune.
 * @returns {Promise<{ object: THREE.Object3D, info: { meshes, vertices, rms, mirrored } }>}
 */
// Même éclairage que les tuiles de la Lune (Lommel-Seeliger, terminateur net, lumière cendrée) et mêmes couleurs
// (texture globale des couleurs naturelles) : le passage modèle ↔ tuiles ne change ni la teinte ni la lumière.
const vert = [
  '#include <common>', '#include <logdepthbuf_pars_vertex>',
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  'void main(){vUv=uv;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=-mv.xyz;gl_Position=projectionMatrix*mv;',
  '#include <logdepthbuf_vertex>', '}',
].join('\n');
const frag = [
  '#include <logdepthbuf_pars_fragment>',
  'uniform sampler2D colorMap;uniform float colorOn;uniform sampler2D ownMap;uniform float ownOn;uniform vec3 sunV;uniform float shade;uniform float earthshine;uniform float gltfUv;',
  'varying vec2 vUv;varying vec3 vN;varying vec3 vV;',
  'void main(){', '#include <logdepthbuf_fragment>',
  // uv glTF : v = 0 au Nord ; la texture des couleurs (flipY) a v = 1 au Nord.
  'vec2 cuv=gltfUv>.5?vec2(vUv.x,1.-vUv.y):vUv;',
  'vec3 col=colorOn>.5?texture2D(colorMap,cuv).rgb:(ownOn>.5?texture2D(ownMap,vUv).rgb:vec3(.55,.54,.52));',
  'vec3 N=normalize(vN),V=normalize(vV);if(!gl_FrontFacing)N=-N;float d=dot(N,sunV);float mu=max(dot(N,V),0.),m0=max(d,0.);',
  'float day=smoothstep(-.02,.04,d);vec3 lit=col*min(1.4,.04+2.*m0/(m0+mu+.001));',
  'vec3 night=col*vec3(.05,.056,.068)*(.2+.8*earthshine);',
  'gl_FragColor=vec4(mix(col,mix(night,lit,day),shade),1.);}',
].join('\n');

/**
 * Remplace les matériaux du modèle par l'éclairage de la Lune du moteur. `uniforms` = ceux des tuiles de la Lune
 * (colorMap, colorOn, sunV, shade, earthshine), partagés : tout reste synchronisé sans code de plus.
 */
/**
 * Matériau « surface de la Lune » partagé par la sphère de fond, le modèle 3D et (par leur shader) les tuiles.
 * gltfUv : coordonnées de texture glTF (v = 0 au Nord) ; sinon three.js (v = 1 au Nord).
 */
export function createMoonSurfaceMaterial(uniforms, { gltfUv = false, ownMap = null, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      colorMap: uniforms.colorMap, colorOn: uniforms.colorOn, sunV: uniforms.sunV, shade: uniforms.shade,
      earthshine: uniforms.earthshine, ownMap: { value: ownMap }, ownOn: { value: ownMap ? 1 : 0 }, gltfUv: { value: gltfUv ? 1 : 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side,
  });
}

function applyMoonShading(scene, uniforms, mirrored) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    const old = Array.isArray(o.material) ? o.material[0] : o.material;
    const own = old?.map || null;
    o.material = createMoonSurfaceMaterial(uniforms, { gltfUv: true, ownMap: own, side: mirrored ? THREE.DoubleSide : THREE.FrontSide });
    [].concat(old || []).forEach((m) => { if (m && m.map !== own) m.map?.dispose(); m?.dispose?.(); });
  });
}

export async function loadMoonModel(url, radius, uniforms = null) {
  const loader = new GLTFLoader();
  // Modèles compressés (Draco, meshopt) : décodeurs chargés seulement si le fichier en a besoin.
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url).finally(() => draco.dispose());
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  // Centre et rayon moyen, sur les sommets en coordonnées du modèle.
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const v = new THREE.Vector3();
  const samples = [];
  let meshes = 0, vertices = 0, sumR = 0, nR = 0;
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    meshes++;
    const pos = o.geometry.attributes.position, uv = o.geometry.attributes.uv;
    vertices += pos.count;
    const step = Math.max(1, Math.floor(pos.count / MAX_SAMPLES));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).sub(center);
      sumR += v.length(); nR++;
      if (uv && usableUv(uv.getX(i), uv.getY(i))) samples.push({ p: [v.x, v.y, v.z], u: uv.getX(i), v: uv.getY(i) });
    }
  });
  if (!meshes || nR === 0) throw new Error('Modèle sans maillage');
  const meanR = sumR / nR;

  const { m, det, rms } = samples.length >= 50 ? uvAlignment(samples) : { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], det: 1, rms: NaN };
  const mirrored = det < 0;
  if (uniforms) applyMoonShading(scene, uniforms, mirrored);
  else if (mirrored) scene.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((mat) => { if (mat) mat.side = THREE.DoubleSide; }); });

  // Matrice finale : échelle (rayon réel) · rotation (calage uv) · translation (centre à l'origine).
  const rot = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
  const k = radius / meanR;
  const holder = new THREE.Group();
  holder.name = 'moon-model';
  holder.matrixAutoUpdate = false;
  holder.matrix
    .makeScale(k, k, k)
    .multiply(rot)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  holder.add(scene);
  return { object: holder, info: { meshes, vertices, rms, mirrored } };
}
