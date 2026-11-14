// Fonctions testées : la projection Lambert-93 et le découpage LiDAR HD de l'IGN.
import { gridNorthHeading, ignTileAt, inFranceLambert93, lambert93ToWgs84, wgs84ToLambert93 } from './lambert93';

// Groupe de tests.
describe('lambert93', () => {
  /**
   * Référence : la dalle `backend/data/lidar/paris-0652-6863` versionnée dans le dépôt. Son emprise Lambert-93 est
   * 652 000–653 000 × 6 862 000–6 863 000 et son manifeste porte le calage lat 48,8607816 / lon 2,3525702, cap -0,4684.
   */
  // Centre de cette dalle.
  const CENTRE = { east: 652_500, north: 6_862_500 };

  // Test : la conversion retrouve le calage du manifeste.
  it('retrouve le calage de la dalle LiDAR du dépôt', () => {
    // Centre converti.
    const c = lambert93ToWgs84(CENTRE.east, CENTRE.north);
    // À un millionième de degré près (environ 10 cm).
    expect(c.lat).toBeCloseTo(48.8607816, 6);
    expect(c.lon).toBeCloseTo(2.3525702, 6);
  // Fin du test.
  });

  // Test : aller-retour.
  it('revient au point de départ après un aller-retour', () => {
    // Converti puis reconverti.
    const c = lambert93ToWgs84(CENTRE.east, CENTRE.north);
    const back = wgs84ToLambert93(c.lat, c.lon);
    // Au millimètre.
    expect(back.east).toBeCloseTo(CENTRE.east, 3);
    expect(back.north).toBeCloseTo(CENTRE.north, 3);
  // Fin du test.
  });

  // Test : le cap de la grille.
  it('donne le cap de la grille inscrit dans le manifeste', () => {
    // Convergence des méridiens au centre de la dalle.
    expect(gridNorthHeading(CENTRE.east, CENTRE.north)).toBeCloseTo(-0.4684, 4);
    // Sur le méridien central, la grille est orientée au nord vrai.
    expect(gridNorthHeading(700_000, 6_600_000)).toBeCloseTo(0, 6);
  // Fin du test.
  });

  // Test : la dalle de l'IGN.
  it('nomme la dalle par son bord ouest et son bord nord', () => {
    // La dalle du centre de référence.
    const tile = ignTileAt(CENTRE.east, CENTRE.north);
    // Son nom et son emprise.
    expect(tile.id).toBe('LHD_FXX_0652_6863');
    expect(tile).toMatchObject({ x: 652, y: 6863, bounds: { minX: 652_000, minY: 6_862_000, maxX: 653_000, maxY: 6_863_000 } });
    // Les numéros sont écrits sur quatre chiffres.
    expect(ignTileAt(99_000, 6_049_500).id).toBe('LHD_FXX_0099_6050');
  // Fin du test.
  });

  // Test : l'emprise française.
  it('reconnaît l’emprise Lambert-93 de la métropole', () => {
    // Paris et la Corse sont dedans.
    expect(inFranceLambert93(CENTRE.east, CENTRE.north)).toBe(true);
    expect(inFranceLambert93(1_200_000, 6_070_000)).toBe(true);
    // Des coordonnées UTM ou des degrés n'y sont pas.
    expect(inFranceLambert93(500_000, 4_600_000)).toBe(false);
    expect(inFranceLambert93(2.35, 48.86)).toBe(false);
  // Fin du test.
  });
// Fin du groupe.
});
