// Les fonctions testées.
import { anchorPoint, enuToGeodetic, ecefToGeodetic, geodeticToEcef, nativeToEnu, normalizeAnchor, placeLidarPoint } from './lidar-anchor';

// Emprise d'exemple : 200 m sur 100 m, de 15 à 60 m de haut.
const bounds = { minX: 1000, minY: 2000, minZ: 15, maxX: 1200, maxY: 2100, maxZ: 60 };
// Calage d'exemple, à Conflans.
const anchor = { lat: 48.9937, lon: 2.0939, alt: 32, heading: 0 };
// Mètres par degré de latitude, approximatif.
const M_PER_DEG_LAT = 111_200; // ordre de grandeur à 49° N

// Groupe de tests du calage GPS.
describe('calage GPS LiDAR', () => {
  // Premier test : le point d'ancrage.
  it('pose la coordonnée GPS au centre de l’emprise, au bas du nuage', () => {
    // C'est le centre de l'emprise, tout en bas.
    expect(anchorPoint(bounds)).toEqual({ x: 1100, y: 2050, z: 15 });
    // Place ce point.
    const g = placeLidarPoint({ x: 1100, y: 2050, z: 15 }, bounds, anchor);
    // Sa latitude est celle du calage.
    expect(g.lat).toBeCloseTo(anchor.lat, 9);
    // Sa longitude aussi.
    expect(g.lon).toBeCloseTo(anchor.lon, 9);
    // Son altitude aussi.
    expect(g.alt).toBeCloseTo(anchor.alt, 4);
  // Fin du test.
  });

  // Deuxième test : les autres points.
  it('déplace les autres points en Est-Nord-Haut', () => {
    // Un point 50 m plus loin sur l'axe Y.
    const north = placeLidarPoint({ x: 1100, y: 2100, z: 15 }, bounds, anchor); // +50 m au nord
    // Il est environ 50 m plus au nord.
    expect((north.lat - anchor.lat) * M_PER_DEG_LAT).toBeCloseTo(50, -0.5);
    // Sa longitude n'a pas changé.
    expect(north.lon).toBeCloseTo(anchor.lon, 7);
    // Un point 45 m plus haut.
    const top = placeLidarPoint({ x: 1100, y: 2050, z: 60 }, bounds, anchor); // 45 m plus haut
    // Son altitude a augmenté de 45 m.
    expect(top.alt).toBeCloseTo(anchor.alt + 45, 3);
    // Un point plus loin sur l'axe X.
    const east = placeLidarPoint({ x: 1200, y: 2050, z: 15 }, bounds, anchor);
    // Il est plus à l'est.
    expect(east.lon).toBeGreaterThan(anchor.lon);
  // Fin du test.
  });

  // Troisième test : le cap.
  it('applique le cap (axe +Y du nuage vers l’est à 90°)', () => {
    // Un point 10 m plus loin sur l'axe Y, avec un cap de 90°.
    const enu = nativeToEnu({ x: 1100, y: 2060, z: 15 }, bounds, 90);
    // Il se retrouve 10 m à l'est.
    expect(enu.x).toBeCloseTo(10, 9);
    // Et à 0 m au nord.
    expect(enu.y).toBeCloseTo(0, 9);
  // Fin du test.
  });

  // Quatrième test : aller-retour entre les deux systèmes.
  it('ECEF ⟷ WGS84 aller-retour', () => {
    // Convertit le calage en cartésien, puis de nouveau en GPS.
    const g = ecefToGeodetic(geodeticToEcef(anchor));
    // Même latitude.
    expect(g.lat).toBeCloseTo(anchor.lat, 9);
    // Même longitude.
    expect(g.lon).toBeCloseTo(anchor.lon, 9);
    // Même altitude.
    expect(g.alt).toBeCloseTo(anchor.alt, 4);
    // Un décalage nul redonne l'altitude du calage.
    expect(enuToGeodetic({ x: 0, y: 0, z: 0 }, anchor).alt).toBeCloseTo(anchor.alt, 4);
  // Fin du test.
  });

  // Cinquième test : vérification du calage.
  it('valide et normalise le calage', () => {
    // Une longitude de 190° devient −170° ; altitude et cap valent 0 par défaut.
    expect(normalizeAnchor({ lat: 10, lon: 190 })).toEqual({ lat: 10, lon: -170, alt: 0, heading: 0 });
    // Un cap de −90° devient 270°.
    expect(normalizeAnchor({ lat: 0, lon: 0, heading: -90 }).heading).toBe(270);
    // Une latitude de 91° est refusée.
    expect(() => normalizeAnchor({ lat: 91, lon: 0 })).toThrow();
  // Fin du test.
  });
// Fin du groupe.
});
