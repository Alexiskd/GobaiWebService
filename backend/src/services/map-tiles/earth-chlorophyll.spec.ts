// Importe ce qui est testé.
import { CHL_MAX, CHL_MIN, chlorophyllGray, chlorophyllPixels, chlorophyllUrls, parseEsriAscii } from './earth-chlorophyll';

// Groupe de tests de la chlorophylle.
describe('chlorophylle des océans', () => {
  // Test : adresses ERDDAP.
  it('demande le même mois un an plus tôt, puis le dernier mois', () => {
    // Adresses au 15 novembre 2026, sur une base d'essai.
    const urls = chlorophyllUrls(new Date('2026-11-15T00:00:00Z'), 'https://e.test/griddap/chl');
    // Deux adresses, dans l'ordre.
    expect(urls.map((u) => u.month)).toEqual(['2025-11', 'dernier']);
    // Format ESRI ASCII, novembre 2025, un point sur 12.
    expect(urls[0].url).toBe('https://e.test/griddap/chl.esriAscii?chlor_a%5B(2025-11-16T00:00:00Z)%5D%5B0:12:last%5D%5B0:12:last%5D');
    // Le dernier mois.
    expect(urls[1].url).toContain('chlor_a%5B(last)%5D');
  // Fin du test.
  });

  // Test : lecture d'une grille.
  it('lit une grille ESRI ASCII, valeurs absentes comprises', () => {
    // Grille de 3 × 2.
    const grid = parseEsriAscii('ncols 3\nnrows 2\nxllcorner -180\nyllcorner -90\ncellsize 120\nNODATA_value -9999\n0.1 -9999 1\n10 NaN 0.05\n');
    // Dimensions.
    expect([grid.ncols, grid.nrows]).toEqual([3, 2]);
    // Valeurs : la valeur absente et NaN deviennent NaN.
    expect(Array.from(grid.values).map((v) => (Number.isNaN(v) ? null : Number(v.toFixed(2))))).toEqual([0.1, null, 1, 10, null, 0.05]);
    // Grille tronquée : erreur.
    expect(() => parseEsriAscii('ncols 3\nnrows 2\n1 2')).toThrow();
  // Fin du test.
  });

  // Test : gris et transparence.
  it('code la chlorophylle en gris logarithmique, transparent sans donnée', () => {
    // Bornes : 0 et 255 ; au-delà, borné.
    expect([chlorophyllGray(CHL_MIN), chlorophyllGray(CHL_MAX), chlorophyllGray(0.001), chlorophyllGray(100)]).toEqual([0, 255, 0, 255]);
    // Pixels : opaque pour 1 mg/m³, transparent pour NaN.
    const px = chlorophyllPixels({ ncols: 2, nrows: 1, values: new Float32Array([1, Number.NaN]) });
    // Gris de 1 mg/m³, opaque ; puis transparent.
    expect(Array.from(px)).toEqual([chlorophyllGray(1), 255, 0, 0]);
  // Fin du test.
  });
// Fin du groupe.
});
