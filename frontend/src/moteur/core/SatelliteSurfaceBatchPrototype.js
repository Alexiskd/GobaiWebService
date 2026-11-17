/**
 * Prototype WebGL1/GLSL1 isolé pour une surface sphérique instanciée.
 * Ce shader est volontairement un sous-ensemble : atlas couleur + éclairage diffus.
 * Il ne remplace pas tileShaders.jsx / TileLayer et ne gère pas les tuiles, relief,
 * couches, lumières nocturnes, atmosphère ou transitions multi-LOD.
 */

export const SATELLITE_BATCH_VERTEX_SHADER = `
#include <common>
attribute vec4 surface0;
attribute vec4 surface1;
attribute vec4 surface2;
attribute vec4 surface3;
attribute vec4 atlasRect;
varying vec2 vAtlasUv;
varying vec3 vNormal;
varying float vVisible;
varying float vShade;
varying float vAirless;
void main() {
  float radius = max(surface0.x, 0.000001);
  float polarScale = max(surface0.y, 0.000001);
  vec3 localPosition = position * vec3(radius, radius * polarScale, radius);
  vec3 localNormal = normalize(vec3(normal.x, normal.y / polarScale, normal.z));
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(localPosition, 1.0);
  vNormal = normalize(normalMatrix * mat3(instanceMatrix) * localNormal);
  vAtlasUv = atlasRect.xy + uv * atlasRect.zw;
  vVisible = surface3.w;
  vShade = surface0.z;
  vAirless = surface0.w;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const SATELLITE_BATCH_FRAGMENT_SHADER = `
uniform sampler2D uSurfaceAtlas;
uniform vec3 uSunDirection;
varying vec2 vAtlasUv;
varying vec3 vNormal;
varying float vVisible;
varying float vShade;
varying float vAirless;
void main() {
  if (vVisible < 0.5) discard;
  vec3 albedo = texture2D(uSurfaceAtlas, vAtlasUv).rgb;
  float diffuse = max(dot(normalize(vNormal), normalize(uSunDirection)), 0.0);
  float ambient = mix(0.20, 0.12, step(0.5, vAirless));
  float illumination = mix(1.0, ambient + diffuse * (1.0 - ambient), step(0.5, vShade));
  gl_FragColor = vec4(albedo * illumination, 1.0);
}
`;

/** Valide un rectangle UV d'atlas [u, v, largeur, hauteur]. */
export function normalizeSatelliteAtlasRect(rect) {
  if (!Array.isArray(rect) && !ArrayBuffer.isView(rect)) {
    throw new TypeError('Le rectangle atlas doit être un tableau [u, v, largeur, hauteur].');
  }
  if (rect.length !== 4) throw new RangeError('Le rectangle atlas doit contenir quatre valeurs.');
  const values = Array.from(rect, Number);
  if (values.some((value) => !Number.isFinite(value))) throw new TypeError('Le rectangle atlas contient une valeur non finie.');
  const [u, v, width, height] = values;
  if (u < 0 || v < 0 || width <= 0 || height <= 0 || u + width > 1 + 1e-7 || v + height > 1 + 1e-7) {
    throw new RangeError('Le rectangle atlas doit être positif et rester dans [0, 1].');
  }
  return new Float32Array(values);
}

/** Écrit un rectangle UV dans un buffer vec4 contigu. */
export function writeSatelliteAtlasRect(buffer, instanceIndex, rect) {
  if (!(buffer instanceof Float32Array)) throw new TypeError('Le buffer atlas doit être un Float32Array.');
  if (!Number.isInteger(instanceIndex) || instanceIndex < 0 || (instanceIndex + 1) * 4 > buffer.length) {
    throw new RangeError('Index d’instance hors limites pour le buffer atlas.');
  }
  buffer.set(normalizeSatelliteAtlasRect(rect), instanceIndex * 4);
  return instanceIndex;
}

/**
 * Construit un prototype instancié. THREE est injecté pour garder les tests du
 * contrat indépendants de WebGL et permettre un test sans contexte graphique.
 * Les matrices sont des Matrix4 locales au groupe du batch ; le rayon est porté
 * par surface0.x et l'aplatissement par surface0.y.
 */
export function createSatelliteSurfaceBatchPrototype({
  THREE,
  capacity = 2,
  atlasTexture,
  sunDirection = [1, 0, 0],
  sphereWidthSegments = 64,
  sphereHeightSegments = 48,
} = {}) {
  if (!THREE?.InstancedMesh || !THREE?.InstancedBufferAttribute || !THREE?.ShaderMaterial) {
    throw new TypeError('Une version de Three.js avec InstancedMesh est requise.');
  }
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity doit être un entier positif.');
  if (!atlasTexture) throw new TypeError('Une texture atlas couleur est requise.');
  if (!Array.isArray(sunDirection) || sunDirection.length !== 3 || sunDirection.some((v) => !Number.isFinite(Number(v)))) {
    throw new TypeError('sunDirection doit contenir trois nombres finis.');
  }

  const geometry = new THREE.SphereGeometry(1, sphereWidthSegments, sphereHeightSegments);
  const attributeBuffers = Object.fromEntries(['surface0', 'surface1', 'surface2', 'surface3', 'atlasRect']
    .map((name) => [name, new Float32Array(capacity * 4)]));
  for (const [name, array] of Object.entries(attributeBuffers)) {
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, 4));
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSurfaceAtlas: { value: atlasTexture },
      uSunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
    },
    vertexShader: SATELLITE_BATCH_VERTEX_SHADER,
    fragmentShader: SATELLITE_BATCH_FRAGMENT_SHADER,
    depthTest: true,
    depthWrite: true,
    transparent: false,
    side: THREE.FrontSide,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.count = 0;
  mesh.frustumCulled = false;

  return {
    mesh,
    geometry,
    material,
    capacity,
    attributeBuffers,
    setInstance(index, { matrix, surfaceState, atlasRect }) {
      if (!Number.isInteger(index) || index < 0 || index >= capacity) throw new RangeError('Index d’instance hors capacité.');
      if (!matrix?.isMatrix4) throw new TypeError('matrix doit être une THREE.Matrix4.');
      if (!(surfaceState instanceof Float32Array) || surfaceState.length !== 16) {
        throw new TypeError('surfaceState doit être un Float32Array de 16 valeurs.');
      }
      const rect = normalizeSatelliteAtlasRect(atlasRect);
      for (let group = 0; group < 4; group += 1) {
        attributeBuffers[`surface${group}`].set(surfaceState.subarray(group * 4, group * 4 + 4), index * 4);
        geometry.getAttribute(`surface${group}`).needsUpdate = true;
      }
      attributeBuffers.atlasRect.set(rect, index * 4);
      geometry.getAttribute('atlasRect').needsUpdate = true;
      mesh.setMatrixAt(index, matrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.count = Math.max(mesh.count, index + 1);
      return index;
    },
    setCount(count) {
      if (!Number.isInteger(count) || count < 0 || count > capacity) throw new RangeError('Nombre d’instances hors capacité.');
      mesh.count = count;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
