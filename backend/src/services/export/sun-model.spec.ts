// Importe ce qui est testé.
import { arcTube, coronalLoops, direction, fbm, mergeMeshes, noise3, prominences, sunColour, sunRegions, sunTexture } from './sun-model';

// Région de la NOAA pour les essais.
const region = (n: number, x: number, carringtonLon: number | null = 120) => ({ number: n, lat: 15, lon: -30, carringtonLon, area: 400, extent: 8, spots: 12, probability: { c: 40, m: 10, x: x } });

// Groupe de tests du modèle du Soleil.
describe('modèle 3D du Soleil', () => {
  // Test : bruit.
  it('donne un bruit continu, reproductible, dans [0, 1]', () => {
    // Même point, même valeur.
    expect(noise3(1.3, 2.7, -0.4, 7)).toBe(noise3(1.3, 2.7, -0.4, 7));
    // Aux coins entiers, deux points proches ont des valeurs proches (continuité).
    expect(Math.abs(noise3(2, 3, 4, 7) - noise3(2.0001, 3, 4, 7))).toBeLessThan(0.01);
    // Somme d'octaves dans [0, 1].
    for (let k = 0; k < 50; k++) { const v = fbm(k * 0.37, k * 0.11, -k * 0.23, 3); expect(v >= 0 && v <= 1).toBe(true); }
  // Fin du test.
  });

  // Test : directions.
  it('place les points comme la sphère texturée (u = 0 à 180° O, nord en +Y)', () => {
    // Pôle nord : +Y.
    expect(direction(90, 0)[1]).toBeCloseTo(1, 6);
    // Équateur, longitude −180° : u = 0, soit (−1, 0, 0).
    expect(direction(0, -180).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([-1, 0, 0]);
  // Fin du test.
  });

  // Test : régions.
  it('tire les régions de la NOAA, ou au hasard sans données', () => {
    // Région la plus active : X = 5 %, Carrington 120° → longitude de texture 120°.
    const [a] = sunRegions([region(4571, 5)], [4571]);
    // Longitude de texture.
    expect(a.lon).toBe(120);
    // Carrington 300° → −60° (ramenée entre −180 et 180).
    expect(sunRegions([region(9, 0, 300)])[0].lon).toBe(-60);
    // Activité : (50 + 30 + 40) / 300 + 0,4 = 0,8.
    expect(a.activity).toBeCloseTo(0.8, 6);
    // Sans longitude de Carrington : celle de Stonyhurst.
    expect(sunRegions([region(1, 0, null)])[0].lon).toBe(-30);
    // Sans région : six régions, mêmes valeurs à chaque fois.
    expect(sunRegions([])).toHaveLength(6); expect(sunRegions([])).toEqual(sunRegions([]));
  // Fin du test.
  });

  // Test : texture.
  it('peint le plasma aux couleurs de SDO, plus vif sur les régions actives', () => {
    // Palette : sombre en bas, presque blanche en haut.
    expect(sunColour(0)[0]).toBeLessThan(20); expect(sunColour(1)[2]).toBeGreaterThan(200);
    // Texture de 64 × 32 avec une région très active au centre de l'image (latitude 0, longitude 0).
    const px = sunTexture(64, 32, [{ lat: 0, lon: 0, radiusDeg: 10, extentDeg: 5, loops: 3, activity: 1 }]);
    // Luminosité moyenne d'un pixel : (r + g + b) / 3.
    const lum = (i: number, j: number) => (px[(j * 64 + i) * 3] + px[(j * 64 + i) * 3 + 1] + px[(j * 64 + i) * 3 + 2]) / 3;
    // Le centre de la région est plus clair qu'un point à l'opposé.
    expect(lum(32, 16)).toBeGreaterThan(lum(0, 16));
  // Fin du test.
  });

  // Test : tubes.
  it('trace un arc de plasma qui s’élève entre ses deux pieds', () => {
    // Arc de 20° de large, 10 000 km de haut, sur une sphère de 100 000 km.
    const tube = arcTube(direction(0, -10), direction(0, 10), { radiusKm: 1e5, heightKm: 1e4, tubeKm: 100, segments: 16, sides: 6 });
    // Sommets et triangles.
    expect(tube.vertexCount).toBe(17 * 7); expect(tube.triangleCount).toBe(16 * 6 * 2);
    // Distance au centre du milieu de l'axe (anneau 8) : environ 110 000 km.
    const mid = 8 * 7; const r = Math.hypot(tube.positions[3 * mid], tube.positions[3 * mid + 1], tube.positions[3 * mid + 2]);
    // À 100 km près (rayon du tube).
    expect(Math.abs(r - 1.1e5)).toBeLessThan(150);
  // Fin du test.
  });

  // Test : réunion et éruptions.
  it('réunit les boucles et les protubérances en un objet chacune', () => {
    // Deux régions tirées.
    const regions = sunRegions([region(1, 5), region(2, 0)]);
    // Boucles : autant de tubes que de boucles (25 × 7 sommets chacun).
    expect(coronalLoops(regions, 695700).vertexCount).toBe(regions.reduce((t, r) => t + r.loops, 0) * 25 * 7);
    // Protubérances : cinq brins sur chacune des deux régions les plus actives (49 × 9 sommets).
    expect(prominences(regions, 695700).vertexCount).toBe(2 * 5 * 49 * 9);
    // Réunion de deux tubes : indices décalés.
    const t = arcTube(direction(0, 0), direction(0, 5), { radiusKm: 1, heightKm: 0.1, tubeKm: 0.01, segments: 2, sides: 3 });
    // Le second tube commence après les sommets du premier.
    expect(mergeMeshes([t, t]).indices[t.indices.length]).toBe(t.indices[0] + t.vertexCount);
  // Fin du test.
  });
// Fin du groupe.
});
