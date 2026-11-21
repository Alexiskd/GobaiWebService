// Importe ce qui est testé.
import { DEFAULT_LOG_CHL, WATER_ALPHA, composeSeabed, decodeChlorophyll, decodeTerrarium, fillGaps, mercatorLat, mercatorV, reliefMesh, sampleGrid, seaWeight, waterColour, waterTexture } from './earth-oceans';

// terrarium : les trois octets Terrarium d'une altitude (m).
const terrarium = (m: number): number[] => { const v = m + 32768; return [Math.floor(v / 256), Math.floor(v) % 256, Math.floor((v - Math.floor(v)) * 256)]; };

// Groupe de tests des océans du modèle 3D.
describe('océans du modèle 3D de la Terre', () => {
  // Test : part de l'eau du large.
  it('garde les côtes et montre l’eau au large', () => {
    // Terre, côte, mi-chemin, large.
    expect([seaWeight(200), seaWeight(-5), seaWeight(-30), seaWeight(-3000)]).toEqual([0, 0, 0.5, 1]);
  // Fin du test.
  });

  // Test : décodage Terrarium.
  it('décode les altitudes Terrarium', () => {
    // Deux pixels RGB : 1 500 m et −4 000 m.
    expect(Array.from(decodeTerrarium(Uint8Array.from([...terrarium(1500), ...terrarium(-4000)]), 3))).toEqual([1500, -4000]);
  // Fin du test.
  });

  // Test : projection et lecture de la grille.
  it('lit la grille Web Mercator, le tour du monde compris', () => {
    // Équateur au milieu, aller-retour latitude ↔ v.
    expect(mercatorV(0)).toBeCloseTo(0.5, 6); expect(mercatorLat(mercatorV(0.7))).toBeCloseTo((0.7 * 180) / Math.PI, 4);
    // Grille 2 × 2 : ouest 0, est −1 000.
    const grid = { size: 2, values: Int16Array.from([0, -1000, 0, -1000]) };
    // Au centre d'une case : sa valeur ; à 180° : moitié-moitié.
    expect(sampleGrid(grid, 0.25, 0.5)).toBe(0); expect(sampleGrid(grid, 0, 0.5)).toBe(-500);
  // Fin du test.
  });

  // Test : texture du relief.
  it('met l’image des fonds au large et garde le satellite sur les terres', () => {
    // Grille 2 × 2 : ouest terre, est mer profonde.
    const elevation = { size: 2, values: Int16Array.from([100, -4000, 100, -4000]) };
    // Satellite gris, fonds bleus, 2 × 2 px.
    const out = composeSeabed(new Uint8Array(12).fill(100), Uint8Array.from([0, 0, 200, 0, 0, 200, 0, 0, 200, 0, 0, 200]), 2, elevation);
    // Pixel ouest : gris ; pixel est : bleu.
    expect(Array.from(out.slice(0, 6))).toEqual([100, 100, 100, 0, 0, 200]);
  // Fin du test.
  });

  // Test : chlorophylle.
  it('décode et comble la chlorophylle', () => {
    // Gris 0 opaque, puis transparent (2 octets par pixel).
    const g = decodeChlorophyll(Uint8Array.from([0, 255, 90, 0]), 2, 0.01, 30);
    // 0,01 mg/m³, puis NaN.
    expect(g[0]).toBeCloseTo(-2, 6); expect(Number.isNaN(g[1])).toBe(true);
    // Comblé par sa voisine.
    expect(Array.from(fillGaps(g, 2, 1))).toEqual([g[0], g[0]]);
    // Grille vide : valeur par défaut.
    expect(fillGaps(Float32Array.from([Number.NaN]), 1, 1)[0]).toBeCloseTo(DEFAULT_LOG_CHL, 6);
  // Fin du test.
  });

  // Test : texture de l'eau.
  it('colore l’eau selon la chlorophylle, transparente sur les terres', () => {
    // Grille 2 × 2 : ouest terre, est mer.
    const elevation = { size: 2, values: Int16Array.from([100, -4000, 100, -4000]) };
    // Chlorophylle uniforme : 1 mg/m³.
    const px = waterTexture(2, elevation, { grid: Float32Array.from([0]), w: 1, h: 1 });
    // Terre : transparente.
    expect(px[3]).toBe(0);
    // Mer : la couleur de 1 mg/m³, opacité du large.
    expect(Array.from(px.slice(4, 8))).toEqual([...waterColour(0).map(Math.round), Math.round(255 * WATER_ALPHA)]);
  // Fin du test.
  });

  // Test : relief.
  it('soulève les terres et creuse les fonds, exagérés', () => {
    // Grille 1 × 1 à −4 000 m : tout le globe creusé.
    const mesh = reliefMesh(6371, 4, 8, 0, { size: 1, values: Int16Array.from([-4000]) }, 10);
    // Distance au centre d'un sommet de l'équateur : 6 371 − 40 km.
    const i = 2 * 9 + 3;
    // Rayon obtenu.
    expect(Math.hypot(mesh.positions[3 * i], mesh.positions[3 * i + 1], mesh.positions[3 * i + 2])).toBeCloseTo(6331, 3);
    // Normales de longueur 1.
    expect(Math.hypot(mesh.normals[3 * i], mesh.normals[3 * i + 1], mesh.normals[3 * i + 2])).toBeCloseTo(1, 5);
  // Fin du test.
  });
// Fin du groupe.
});
