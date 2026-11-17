/** Applique le facteur de fond à l'échelle du mesh, sans modifier une géométrie potentiellement partagée. */
export function applyBackdropMeshScale(mesh, nextFactor, previousFactor) {
  if (!mesh?.scale || typeof mesh.scale.multiplyScalar !== 'function') {
    throw new TypeError('Un mesh avec scale.multiplyScalar() est requis.');
  }
  if (!Number.isFinite(nextFactor) || nextFactor <= 0 || !Number.isFinite(previousFactor) || previousFactor <= 0) {
    throw new RangeError('Les facteurs de fond doivent être finis et strictement positifs.');
  }
  if (nextFactor === previousFactor) return false;
  mesh.scale.multiplyScalar(nextFactor / previousFactor);
  return true;
}
