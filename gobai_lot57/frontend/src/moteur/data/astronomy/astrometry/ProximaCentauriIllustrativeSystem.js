import { createProximaCentauriAstrometricRecord } from './ProximaCentauriAstrometry.js';

/**
 * Système de démonstration embarqué pour que Proxima soit visible sans dépendre
 * d'une requête SIMBAD/NASA au démarrage. La position globale vient de
 * l'astrométrie de référence ; le dessin du système planétaire est volontairement
 * schématique et ne prétend pas reconstruire les paramètres orbitaux complets.
 */
export function createProximaCentauriIllustrativeSystem() {
  const star = createProximaCentauriAstrometricRecord();
  return {
    id: 'proxima-centauri-illustrative',
    kind: 'star-system',
    identityStatus: 'catalogued-illustrative-system',
    representation: {
      mode: 'schematic',
      label: 'Reconstitution 3D approximative',
      note: 'Position stellaire calculée depuis les coordonnées et la parallaxe ; échelle interstellaire compressée pour la vue globale ; orbite planétaire schématique.',
    },
    star: {
      ...star,
      radiusSolar: 0.1542,
      spectralType: 'M5.5 Ve',
      visualColor: 0xff765d,
    },
    planets: [{
      id: 'proxima-b',
      name: 'Proxima Centauri b',
      host: { name: 'Proxima Centauri' },
      physical: { radiusEarth: 1.1, massEarthBestEstimate: 1.27 },
      existenceEvidence: {
        status: 'catalogued',
        label: 'Exoplanète cataloguée',
        reason: 'Objet connu ; représentation orbitale 3D schématique.',
      },
      orbit: {
        periodDays: 11.186,
        semiMajorAxisAu: 0.0485,
        eccentricity: 0.04,
        inclinationDeg: 0,
        longitudeAscendingNodeDeg: 0,
        argumentOfPeriastronDeg: 0,
        argumentOfPeriastronConvention: 'planet-orbit',
        meanAnomalyAtEpochDeg: 0,
        epochJulianDate: 2451545.0,
      },
    }],
  };
}
