// Importe les sources et les fonctions pures du relief de Mars, de Mercure et de Vénus.
import { bodyReliefExportUrl, bodyReliefSource, bodyTileBounds, bodyVerticalStep, cleanBodyHeights, missingShare } from './body-relief';
// Importe l'encodeur et le décodeur Terrarium.
import { decodeTerrariumPng, encodeTerrariumPng } from '../terrarium';

describe('relief de Mars, de Mercure et de Vénus', () => {
  const mars = bodyReliefSource('mars')!;
  const mercury = bodyReliefSource('mercury')!;
  const venus = bodyReliefSource('venus')!;

  it('ne sert que les astres déclarés', () => {
    expect(mars.label).toBe('Mars');
    expect(mercury.label).toBe('Mercure');
    expect(venus.label).toBe('Vénus');
    expect(venus.maxZoom).toBe(5);
    // Un nom de propriété hérité d'Object n'est pas un astre.
    expect(bodyReliefSource('toString')).toBeUndefined();
  });

  it('demande la référence spatiale de Vénus (IAU 29900) pour son relief', () => {
    const v = new URL(bodyReliefExportUrl(venus, venus.url, 0, 0, 0));
    expect(v.searchParams.get('bboxSR')).toBe('29900');
    expect(v.searchParams.get('imageSR')).toBe('29900');
  });

  it('découpe l’astre en 2^(z+1) × 2^z tuiles, d’ouest en est et du nord au sud', () => {
    expect(bodyTileBounds(0, 0, 0)).toEqual([-180, -90, 0, 90]);
    expect(bodyTileBounds(1, 3, 1)).toEqual([90, -90, 180, 0]);
  });

  it('demande des flottants 32 bits en TIFF sans compression, avec la référence spatiale si la source l’exige', () => {
    const url = new URL(bodyReliefExportUrl(mars, `${mars.url}/`, 2, 1, 0));
    expect(url.pathname.endsWith('/ImageServer/exportImage')).toBe(true);
    expect(url.searchParams.get('bbox')).toBe('-135,45,-90,90');
    expect(url.searchParams.get('size')).toBe('256,256');
    expect(url.searchParams.get('format')).toBe('tiff');
    expect(url.searchParams.get('pixelType')).toBe('F32');
    expect(url.searchParams.get('bboxSR')).toBeNull();
    const m = new URL(bodyReliefExportUrl(mercury, mercury.url, 0, 0, 0));
    expect(m.searchParams.get('bboxSR')).toBe('19900');
    expect(m.searchParams.get('imageSR')).toBe('19900');
  });

  it('garde les extrêmes de Mars et met hors données les valeurs aberrantes', () => {
    const grid = cleanBodyHeights({ width: 2, height: 2, data: new Float32Array([21229, -8200, -32768, 3.4e38]) }, mars.limitM);
    expect(grid.data[0]).toBe(21229);
    expect(grid.data[1]).toBe(-8200);
    expect(Number.isNaN(grid.data[2])).toBe(true);
    expect(Number.isNaN(grid.data[3])).toBe(true);
    expect(missingShare(grid)).toBe(0.5);
    // Olympus Mons et Hellas tiennent dans l'encodage Terrarium et se relisent à l'identique.
    const back = decodeTerrariumPng(encodeTerrariumPng(grid, bodyVerticalStep(8)));
    expect(back.data[0]).toBe(21229);
    expect(back.data[1]).toBe(-8200);
  });

  it('arrondit la précision verticale selon le niveau (1 m à 25 cm)', () => {
    expect(bodyVerticalStep(0)).toBe(1);
    expect(bodyVerticalStep(8)).toBe(0.25);
  });
});
