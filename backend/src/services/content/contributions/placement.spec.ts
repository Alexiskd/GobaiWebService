// Fonctions testées : le placement automatique d'un relevé d'après l'en-tête de son fichier.
import { MAX_SPAN_METERS, PlacementError, detectCrs, placeFromHeader, storedBounds } from './placement';

// Groupe de tests.
describe('placement', () => {
  // Emprise de la dalle LiDAR HD de Beaubourg, versionnée dans le dépôt.
  const PARIS = { minX: 652_000, minY: 6_862_000, minZ: 25.52, maxX: 653_000, maxY: 6_863_000, maxZ: 98.05 };

  // Test : une dalle IGN déclarée est placée exactement.
  it('place une dalle LiDAR HD déclarée en EPSG:2154', () => {
    // Placement calculé.
    const p = placeFromHeader({ bounds: PARIS, pointCount: 16_618_577, epsg: 2154 });
    // Système retenu et dalle reconnue.
    expect(p.crs).toBe('EPSG:2154');
    expect(p.crsSource).toBe('declare');
    expect(p.tile?.id).toBe('LHD_FXX_0652_6863');
    // Calage conforme au manifeste de la dalle.
    expect(p.anchor.lat).toBeCloseTo(48.8607816, 6);
    expect(p.anchor.lon).toBeCloseTo(2.3525702, 6);
    expect(p.anchor.heading).toBeCloseTo(-0.4684, 4);
    expect(p.anchor.alt).toBe(25.52);
    // Côtés de l'emprise, en mètres.
    expect(p.sizeMeters.map((v) => Math.round(v * 100) / 100)).toEqual([1000, 1000, 72.53]);
    // Les quatre coins, du sud-ouest au nord-ouest.
    expect(p.footprint).toHaveLength(4);
    expect(p.footprint[0].lat).toBeLessThan(p.footprint[3].lat);
    expect(p.footprint[0].lon).toBeLessThan(p.footprint[1].lon);
  // Fin du test.
  });

  // Test : un fichier muet est reconnu à son emprise.
  it('reconnaît le Lambert-93 d’un fichier qui ne déclare rien', () => {
    // Aucun code EPSG, aucun WKT.
    expect(detectCrs({ bounds: PARIS, pointCount: 10 })).toEqual({ crs: 'EPSG:2154', crsSource: 'deduit' });
    // Un WKT suffit à le déclarer.
    expect(detectCrs({ bounds: PARIS, pointCount: 10, crsWkt: 'PROJCS["RGF93 / Lambert-93"]' }).crsSource).toBe('declare');
  // Fin du test.
  });

  // Test : un relevé en degrés.
  it('place un relevé en degrés WGS84 et retrouve sa dalle IGN', () => {
    // Emprise en degrés autour de l'Hôtel de Ville.
    const p = placeFromHeader({ bounds: { minX: 2.34, minY: 48.85, minZ: 30, maxX: 2.36, maxY: 48.87, maxZ: 90 }, pointCount: 5, epsg: 4326 });
    // Système, calage et cap.
    expect(p.crs).toBe('EPSG:4326');
    expect(p.anchor.lat).toBeCloseTo(48.86, 9);
    expect(p.anchor.lon).toBeCloseTo(2.35, 9);
    expect(p.anchor.heading).toBe(0);
    // La dalle IGN est retrouvée par conversion inverse.
    expect(p.tile?.id).toBe('LHD_FXX_0652_6863');
    // L'emprise enregistrée est recentrée en mètres, pour le moteur d'affichage.
    const b = storedBounds({ bounds: { minX: 2.34, minY: 48.85, minZ: 30, maxX: 2.36, maxY: 48.87, maxZ: 90 }, pointCount: 5 }, p);
    expect(b.minX).toBeCloseTo(-b.maxX, 6);
    expect(b.maxY).toBeCloseTo(1113.2, 1);
  // Fin du test.
  });

  // Test : l'emprise Lambert-93 est enregistrée telle quelle.
  it('garde l’emprise native d’un fichier Lambert-93', () => {
    // Placement puis emprise enregistrée.
    const p = placeFromHeader({ bounds: PARIS, pointCount: 10, epsg: 2154 });
    // Identique à l'originale.
    expect(storedBounds({ bounds: PARIS, pointCount: 10 }, p)).toEqual(PARIS);
  // Fin du test.
  });

  // Test : les refus.
  it('refuse un fichier qu’il ne sait pas placer', () => {
    // Un système projeté inconnu (coordonnées UTM).
    expect(() => placeFromHeader({ bounds: { minX: 500_000, minY: 4_600_000, minZ: 0, maxX: 500_100, maxY: 4_600_100, maxZ: 10 }, pointCount: 10 }))
      .toThrow(/non reconnu/);
    // Un nombre de points absurde.
    expect(() => placeFromHeader({ bounds: PARIS, pointCount: 0 })).toThrow(/nombre de points/i);
    // Une emprise plate.
    expect(() => placeFromHeader({ bounds: { ...PARIS, maxX: PARIS.minX }, pointCount: 10 })).toThrow(/plate/);
    // Une emprise trop grande pour un relevé local.
    expect(() => placeFromHeader({ bounds: { ...PARIS, maxX: PARIS.minX + MAX_SPAN_METERS + 1, maxY: PARIS.minY + 100 }, pointCount: 10 })).toThrow(/dépasse/);
    // Une emprise illisible, même sans système déclaré.
    expect(() => placeFromHeader({ bounds: { ...PARIS, minX: Number.NaN }, pointCount: 10 })).toThrow(/illisible|incomplète/);
    // Tous ces refus sont des PlacementError, montrées telles quelles au contributeur.
    expect(() => placeFromHeader({ bounds: PARIS, pointCount: 0 })).toThrow(PlacementError);
  // Fin du test.
  });
// Fin du groupe.
});
