/**
 * Politique de rendu des satellites : un satellite est visible uniquement lorsque
 * le périvolume de sa planète hôte est le système actif.
 * Aucune dépendance aux couches de surface, nuages ou textures.
 */
export function isSatelliteVisibleInPerivolume(satelliteParent, activeParent, hidden = false) {
  return Boolean(activeParent && satelliteParent && satelliteParent === activeParent && !hidden);
}
