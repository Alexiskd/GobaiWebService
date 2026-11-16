import { cleanMarsHeights, marsReliefExportUrl, marsTileBounds } from './mars-relief.service';

describe('mars relief MOLA', () => {
  it('calcule le découpage géographique 2^(z+1) × 2^z', () => {
    expect(marsTileBounds(0, 0, 0)).toEqual([-180, -90, 0, 90]);
    expect(marsTileBounds(1, 3, 1)).toEqual([90, -90, 180, 0]);
  });

  it('construit une exportImage ArcGIS en flottants TIFF', () => {
    const url = new URL(marsReliefExportUrl('https://example.test/ImageServer', 2, 4, 1));
    expect(url.pathname).toBe('/ImageServer/exportImage');
    expect(url.searchParams.get('format')).toBe('tiff');
    expect(url.searchParams.get('pixelType')).toBe('F32');
    expect(url.searchParams.get('bbox')).toBe('0,0,45,45');
  });

  it('conserve les altitudes MOLA plausibles et élimine les valeurs hors plage', () => {
    const grid = cleanMarsHeights({ width: 4, height: 1, data: new Float32Array([-8200, 21229, 25001, Number.NaN]) });
    expect(grid.data[0]).toBe(-8200);
    expect(grid.data[1]).toBe(21229);
    expect(Number.isNaN(grid.data[2])).toBe(true);
    expect(Number.isNaN(grid.data[3])).toBe(true);
  });
});
