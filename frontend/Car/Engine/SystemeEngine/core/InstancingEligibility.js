/**
 * Lot 12 — qualification prudente des familles candidates à l'instancing.
 * Cette politique n'altère jamais la scène : elle indique si une famille peut être
 * convertie sans perdre ses différences de matériau, visibilité ou interaction.
 */
const REASONS = Object.freeze({
  NO_SHARED_GEOMETRY: 'NO_SHARED_GEOMETRY',
  NO_SHARED_MATERIAL: 'NO_SHARED_MATERIAL',
  PER_OBJECT_RAYCAST: 'PER_OBJECT_RAYCAST',
  PER_OBJECT_VISIBILITY: 'PER_OBJECT_VISIBILITY',
  CUSTOM_SHADER_STATE: 'CUSTOM_SHADER_STATE',
  DOM_ELEMENT: 'DOM_ELEMENT',
  READY: 'READY',
});

export function assessInstancingFamily(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return { eligible: false, count: 0, reason: REASONS.NO_SHARED_GEOMETRY };
  }
  const first = items[0] || {};
  if (items.some((item) => item?.kind === 'dom' || item?.elementType === 'HTMLElement')) {
    return { eligible: false, count: items.length, reason: REASONS.DOM_ELEMENT };
  }
  if (!first.geometry || items.some((item) => item.geometry !== first.geometry)) {
    return { eligible: false, count: items.length, reason: REASONS.NO_SHARED_GEOMETRY };
  }
  if (!first.material || items.some((item) => item.material !== first.material)) {
    return { eligible: false, count: items.length, reason: REASONS.NO_SHARED_MATERIAL };
  }
  if (items.some((item) => item.perObjectRaycast)) {
    return { eligible: false, count: items.length, reason: REASONS.PER_OBJECT_RAYCAST };
  }
  if (items.some((item) => item.perObjectVisibility)) {
    return { eligible: false, count: items.length, reason: REASONS.PER_OBJECT_VISIBILITY };
  }
  if (items.some((item) => item.customShaderState)) {
    return { eligible: false, count: items.length, reason: REASONS.CUSTOM_SHADER_STATE };
  }
  return { eligible: true, count: items.length, reason: REASONS.READY };
}

/** Regroupe les objets par clé déclarée, puis applique les critères d'éligibilité. */
export function buildInstancingReport(families = []) {
  if (!Array.isArray(families)) throw new TypeError('families doit être un tableau.');
  return families.map((family) => ({
    id: String(family?.id ?? ''),
    ...assessInstancingFamily(family?.items),
  }));
}

export { REASONS as INSTANCING_REASONS };
