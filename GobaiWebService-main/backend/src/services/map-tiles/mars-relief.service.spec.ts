import { cleanMarsHeights, marsReliefExportUrl, marsTileBounds } from './mars-relief.service';

describe('relief numérique de Mars (MOLA)', () => {
  it('projette les tuiles géographiques dans MarsEC0 en mètres', () => {
    const b = marsTileBounds(0, 0, 0);
    expect(Math.abs(b[0] + Math.PI * 3396190)).toBeLessThan(1e-6);
    expect(Math.abs(b[2])).toBeLessThan(1e-6);
    expect(Math.abs(b[1] + Math.PI / 2 * 3396190)).toBeLessThan(1e-6);
    expect(Math.abs(b[3] - Math.PI / 2 * 3396190)).toBeLessThan(1e-6);
  });

  it('demande un raster TIFF numérique F32, jamais une image hillshade RGB', () => {
    const u = new URL(marsReliefExportUrl('https://example.test/ImageServer/', 2, 1, 1));
    expect(u.pathname).toBe('/ImageServer/exportImage');
    expect(u.searchParams.get('pixelType')).toBe('F32');
    expect(u.searchParams.get('format')).toBe('tiff');
    expect(u.searchParams.get('bboxSR')).toBe('104905');
  });

  it('conserve les altitudes signées en mètres et écarte les nodata / valeurs aberrantes', () => {
    const g = cleanMarsHeights({ width: 4, height: 1, data: new Float32Array([-8200, 21229, NaN, 50000]) });
    expect(g.data[0]).toBe(-8200);
    expect(g.data[1]).toBe(21229);
    expect(Number.isNaN(g.data[2])).toBe(true);
    expect(Number.isNaN(g.data[3])).toBe(true);
  });

  it('ne change pas l’unité d’une tuile de plaine proche de zéro', () => {
    const g = cleanMarsHeights({ width: 3, height: 1, data: new Float32Array([-8.2, 21.2, 2.5]) });
    expect(g.data[0]).toBeCloseTo(-8.2);
    expect(g.data[1]).toBeCloseTo(21.2);
    expect(g.data[2]).toBeCloseTo(2.5);
  });
});
