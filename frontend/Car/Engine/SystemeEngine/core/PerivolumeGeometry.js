const positive = (value, name) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name} doit être strictement positif.`);
  return number;
};

/** Surfaces des frontières 3D. Ces formules calculent une aire (m²), pas un volume. */
export function perivolumeCube(side) {
  const a = positive(side, 'side');
  return 6 * a ** 2;
}

export function perivolumeBox(length, width, height) {
  const l = positive(length, 'length');
  const w = positive(width, 'width');
  const h = positive(height, 'height');
  return 2 * (l * w + l * h + w * h);
}

export function perivolumeSphere(radius) {
  const r = positive(radius, 'radius');
  return 4 * Math.PI * r ** 2;
}

export function perivolumeCylinder(radius, height) {
  const r = positive(radius, 'radius');
  const h = positive(height, 'height');
  return 2 * Math.PI * r * h + 2 * Math.PI * r ** 2;
}

/** Inégalité isopérimétrique en 3D : A³ >= 36πV². */
export function verifyIsoperimetricInequality(volume, surfaceArea, tolerance = 1e-10) {
  const v = Number(volume);
  const area = Number(surfaceArea);
  if (!Number.isFinite(v) || v < 0 || !Number.isFinite(area) || area < 0) return false;
  return area ** 3 + tolerance >= 36 * Math.PI * v ** 2;
}

/** Test d'appartenance à un périvolume sphérique, cubique, parallélépipédique ou cylindrique.
 * center et point sont exprimés dans le même repère et la même unité.
 */
export function containsPerivolumePoint(point, center, shape) {
  if (![point, center].every((v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite))) {
    throw new TypeError('point et center doivent être des vecteurs 3D finis.');
  }
  if (!shape || typeof shape !== 'object') throw new TypeError('shape est requis.');
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  const dz = point[2] - center[2];
  const type = String(shape.type || 'sphere').toLowerCase();
  if (type === 'sphere') return Math.hypot(dx, dy, dz) <= positive(shape.radius, 'shape.radius');
  if (type === 'cube') {
    const half = positive(shape.side, 'shape.side') / 2;
    return Math.abs(dx) <= half && Math.abs(dy) <= half && Math.abs(dz) <= half;
  }
  if (type === 'box' || type === 'cuboid') {
    return Math.abs(dx) <= positive(shape.length, 'shape.length') / 2
      && Math.abs(dy) <= positive(shape.width, 'shape.width') / 2
      && Math.abs(dz) <= positive(shape.height, 'shape.height') / 2;
  }
  if (type === 'cylinder') {
    const radius = positive(shape.radius, 'shape.radius');
    const height = positive(shape.height, 'shape.height');
    return dx ** 2 + dz ** 2 <= radius ** 2 && Math.abs(dy) <= height / 2;
  }
  throw new TypeError(`Forme de périvolume inconnue : ${type}`);
}

// Alias français conservés pour reprendre exactement l'API fournie.
export const perivolumePave = perivolumeBox;
export const perivolumeCylindre = perivolumeCylinder;
export const verifierIsoperimetrie = verifyIsoperimetricInequality;
