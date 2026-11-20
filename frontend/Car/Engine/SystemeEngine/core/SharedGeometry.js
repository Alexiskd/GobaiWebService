/**
 * Géométries unitaires partageables entre meshes dont seule l'échelle diffère.
 * La clé inclut tous les paramètres qui changent la topologie de la géométrie.
 */
export function unitSphereGeometryKey(widthSegments, heightSegments) {
  const w = Number(widthSegments);
  const h = Number(heightSegments);
  if (!Number.isInteger(w) || w < 3 || !Number.isInteger(h) || h < 2) {
    throw new RangeError('Les segments de sphère doivent être des entiers valides (largeur >= 3, hauteur >= 2).');
  }
  return `unit-sphere:${w}:${h}`;
}

/** Acquiert une sphère de rayon 1 ; le rayon réel est appliqué au Mesh via scale. */
export function acquireUnitSphereGeometry(pool, THREE, widthSegments, heightSegments) {
  if (!pool || typeof pool.acquire !== 'function') throw new TypeError('Un pool compatible acquire() est requis.');
  if (!THREE || typeof THREE.SphereGeometry !== 'function') throw new TypeError('THREE.SphereGeometry est requis.');
  const key = unitSphereGeometryKey(widthSegments, heightSegments);
  const geometry = pool.acquire(key, () => new THREE.SphereGeometry(1, widthSegments, heightSegments));
  return { key, geometry };
}
