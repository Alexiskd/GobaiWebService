// Fonctions testées.
import { RadarCell, RadarGrid, cellConfidence, cellToEvent, detectCells, matchCells, pixelAreaKm2, pixelToLonLat, trackCells } from './storms';
// Codage des réflectivités.
import { DBZ_CODE_OFFSET } from './radar';

// Côté du monde de la grille d'essai, en pixels.
const W = 256;

// grid : grille mondiale vide.
const grid = (): RadarGrid => ({ rain: new Uint8Array(W * W), snow: new Uint8Array(W * W), width: W, height: W, worldPx: W, x0: 0, y0: 0 });
// paint : pose une réflectivité (pluie) sur un rectangle de pixels (abscisses refermées autour du monde).
const paint = (g: RadarGrid, x0: number, y0: number, w: number, h: number, dbz: number): void => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g.rain[y * W + (((x % W) + W) % W)] = dbz + DBZ_CODE_OFFSET; };
// cell : cellule d'essai à une position.
const cell = (lon: number, lat: number, maxDbz = 50): RadarCell => ({ lon, lat, maxDbz, meanDbz: maxDbz - 3, areaKm2: 500, coreKm2: 100, pixels: 6, snowShare: 0, bbox: [lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1] });

// Groupe de tests : les cellules orageuses estimées.
describe('orages : cellules estimées d’après le radar', () => {
  // Test : géométrie du plan Mercator.
  it('ramène les pixels Mercator en longitude, latitude et surface', () => {
    // Coin haut-gauche : −180°, 85,05°.
    const [lon0, lat0] = pixelToLonLat(0, 0, W);
    // Valeurs.
    expect([lon0, Math.round(lat0 * 100) / 100]).toEqual([-180, 85.05]);
    // Centre du monde : 0°, 0°.
    expect(pixelToLonLat(W / 2, W / 2, W).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0]);
    // Surface d'un pixel à l'équateur (côté ≈ 156 km) : environ 24 450 km².
    expect(Math.round(pixelAreaKm2(W / 2, W) / 100)).toBe(245);
  // Fin du test.
  });

  // Test : détection.
  it('garde une zone ≥ 40 dBZ avec noyau ≥ 45 dBZ, écarte une zone sans noyau et un pixel isolé', () => {
    // Grille vide.
    const g = grid();
    // Cellule : couronne de 42 dBZ (5 × 5) et noyau de 52 dBZ (3 × 3).
    paint(g, 100, 100, 5, 5, 42); paint(g, 101, 101, 3, 3, 52);
    // Zone sans noyau : 41 dBZ.
    paint(g, 40, 60, 4, 4, 41);
    // Pixel isolé très fort.
    paint(g, 200, 30, 1, 1, 60);
    // Pluie faible : ignorée.
    paint(g, 10, 10, 8, 8, 25);
    // Détection.
    const cells = detectCells(g);
    // Une seule cellule.
    expect(cells.length).toBe(1);
    // Réflectivité maximale, pixels et centre (pixel 102,5 au centre du noyau).
    expect([cells[0].maxDbz, cells[0].pixels]).toEqual([52, 25]);
    // Centre attendu.
    const [lon, lat] = pixelToLonLat(102.5, 102.5, W);
    // Centre au millième près.
    expect([cells[0].lon, cells[0].lat]).toEqual([Math.round(lon * 1000) / 1000, Math.round(lat * 1000) / 1000]);
  // Fin du test.
  });

  // Test : antiméridien.
  it('réunit une cellule à cheval sur l’antiméridien', () => {
    // Grille vide.
    const g = grid();
    // Bloc de 4 × 3 pixels à 48 dBZ, de x = 254 à x = 1.
    paint(g, 254, 120, 4, 3, 48);
    // Détection.
    const cells = detectCells(g);
    // Une cellule de 12 pixels, centrée près de ±180°.
    expect([cells.length, cells[0].pixels, Math.abs(Math.abs(cells[0].lon) - 180) < 0.5]).toEqual([1, 12, true]);
  // Fin du test.
  });

  // Test : suivi.
  it('suit une cellule d’image en image, mesure son déplacement sur 20 minutes et refuse un saut impossible', () => {
    // Heure de départ.
    const t0 = Date.UTC(2026, 10, 15, 14, 0);
    // Cellule allant vers l'est d'environ 0,1° (≈ 11 km) toutes les 10 minutes ; une nouvelle cellule sur la dernière image.
    const frames = [{ time: t0, cells: [cell(10, 0)] }, { time: t0 + 600_000, cells: [cell(10.1, 0)] }, { time: t0 + 1_200_000, cells: [cell(10.2, 0), cell(30, 5, 56)] }];
    // Suivi.
    const tracked = trackCells(frames);
    // Première : trois images, cap est, environ 67 km/h sur 20 minutes.
    expect([tracked[0].frames, tracked[0].motion?.bearingDeg, tracked[0].motion?.speedKmh, tracked[0].motion?.overMin]).toEqual([3, 90, 67, 20]);
    // Seconde : nouvelle, sans déplacement.
    expect([tracked[1].frames, tracked[1].motion]).toEqual([1, null]);
    // Confiance : 0,8 (suivie sur trois images, noyau de 50 dBZ) ; 0,55 (nouvelle, noyau de 56 dBZ).
    expect([cellConfidence(tracked[0]), cellConfidence(tracked[1])]).toEqual([0.8, 0.55]);
    // Saut de 100 km en 10 minutes (600 km/h) : refusé.
    expect(matchCells([cell(11, 0)], [cell(10.1, 0)], 10)).toEqual([-1]);
  // Fin du test.
  });

  // Test : format commun.
  it('rend une cellule au format commun, estimée et non confirmée, avec sa méthode et ses drapeaux', () => {
    // Cellule nouvelle.
    const [c] = trackCells([{ time: Date.UTC(2026, 10, 15, 14, 0), cells: [cell(5, 45, 47)] }]);
    // Événement.
    const e = cellToEvent(c, Date.UTC(2026, 10, 15, 14, 0), 'abcd', '2026-11-15T14:03:00.000Z');
    // Famille, statut, confirmation, intensité.
    expect([e.type, e.status, e.confirmed, e.intensity.value, e.intensity.unit, e.intensity.label]).toEqual(['storm', 'estimé', false, 47, 'dBZ', 'cellule convective modérée']);
    // Drapeau de la cellule vue une seule fois, et provenance Rain Viewer.
    expect([e.flags[0].startsWith('cellule vue sur une seule image'), e.sources[0].provider, e.sources[0].sourceId]).toEqual([true, 'rainviewer', 'abcd']);
  // Fin du test.
  });
// Fin du groupe.
});
