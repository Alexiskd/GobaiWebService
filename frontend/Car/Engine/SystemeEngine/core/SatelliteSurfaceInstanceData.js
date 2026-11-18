/**
 * Contrat CPU pour transporter les paramètres de surface d'un satellite par instance.
 * Ce module ne crée pas de ShaderMaterial et ne remplace pas les uniforms actuels :
 * il prépare un format stable, validé et testable pour une future migration GPU.
 *
 * 4 attributs vec4 (16 flottants par instance) :
 *  surface0 = radius, polarScale, shade, airless
 *  surface1 = ovMode, colorOn, panOn, alpha
 *  surface2 = reliefExag, reliefShade, reliefImg, oceanOn
 *  surface3 = lightsOn, detailKind, backdropK, visible
 */
export const SATELLITE_SURFACE_STRIDE = 16;
export const SATELLITE_SURFACE_ATTRIBUTES = Object.freeze({
  surface0: Object.freeze({ offset: 0, size: 4 }),
  surface1: Object.freeze({ offset: 4, size: 4 }),
  surface2: Object.freeze({ offset: 8, size: 4 }),
  surface3: Object.freeze({ offset: 12, size: 4 }),
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const uniform = (uniforms, key, fallback = 0) => finite(uniforms?.[key]?.value, fallback);
const vectorX = (uniforms, key, fallback = 0) => finite(uniforms?.[key]?.value?.x, fallback);

/** Convertit l'état courant d'un satellite en 16 floats, sans modifier ses uniforms. */
export function packSatelliteSurfaceState({
  radius = 1,
  polarScale = 1,
  backdropK = 1,
  visible = true,
  alpha = 1,
  uniforms = {},
} = {}) {
  const values = [
    finite(radius, 1), finite(polarScale, 1), uniform(uniforms, 'shade'), uniform(uniforms, 'airless'),
    uniform(uniforms, 'ovMode'), uniform(uniforms, 'colorOn'), uniform(uniforms, 'panOn'), finite(alpha, 1),
    uniform(uniforms, 'reliefExag'), uniform(uniforms, 'reliefShade'), uniform(uniforms, 'reliefImg'), uniform(uniforms, 'oceanOn'),
    uniform(uniforms, 'lightsOn'), vectorX(uniforms, 'detail'), finite(backdropK, 1), visible ? 1 : 0,
  ];
  if (values.some((value) => !Number.isFinite(value))) throw new TypeError('État de surface satellite non fini.');
  if (values[0] <= 0 || values[1] <= 0 || values[14] <= 0) throw new RangeError('Rayon, aplatissement et facteur de fond doivent être positifs.');
  return new Float32Array(values);
}

/** Alloue quatre buffers contigus prêts à devenir des InstancedBufferAttribute. */
export function createSatelliteSurfaceAttributeBuffers(count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Le nombre d’instances doit être un entier positif ou nul.');
  return Object.fromEntries(Object.keys(SATELLITE_SURFACE_ATTRIBUTES).map((name) => [name, new Float32Array(count * 4)]));
}

/** Écrit un état dans les quatre buffers vec4 ; retourne l'index écrit. */
export function writeSatelliteSurfaceState(target, instanceIndex, state) {
  if (!target || typeof target !== 'object') throw new TypeError('Les buffers d’attributs sont requis.');
  if (!Number.isInteger(instanceIndex) || instanceIndex < 0) throw new RangeError('instanceIndex invalide.');
  const packed = state instanceof Float32Array ? state : packSatelliteSurfaceState(state);
  if (packed.length !== SATELLITE_SURFACE_STRIDE) throw new RangeError(`Un état doit contenir ${SATELLITE_SURFACE_STRIDE} flottants.`);
  for (const [name, descriptor] of Object.entries(SATELLITE_SURFACE_ATTRIBUTES)) {
    const buffer = target[name];
    if (!(buffer instanceof Float32Array) || (instanceIndex + 1) * 4 > buffer.length) {
      throw new RangeError(`Buffer ${name} absent ou trop petit pour cette instance.`);
    }
    buffer.set(packed.subarray(descriptor.offset, descriptor.offset + 4), instanceIndex * 4);
  }
  return instanceIndex;
}

/** Vérifie et retourne les buffers vec4 directement utilisables par Three.js. */
export function createSatelliteSurfaceAttributeViews(buffers, count) {
  if (!buffers || typeof buffers !== 'object' || !Number.isInteger(count) || count < 0) {
    throw new TypeError('Buffers et nombre d’instances valides requis.');
  }
  for (const name of Object.keys(SATELLITE_SURFACE_ATTRIBUTES)) {
    if (!(buffers[name] instanceof Float32Array) || buffers[name].length !== count * 4) {
      throw new RangeError(`Le buffer ${name} ne correspond pas au nombre d’instances.`);
    }
  }
  return buffers;
}
