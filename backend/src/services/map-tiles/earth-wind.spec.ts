// Ce qui est testé.
import { WIND_GRID, parseWind, windComponents, windGridPoints, windUrl } from './earth-wind';

// Groupe de tests des vents.
describe('vents de la Terre (Open-Meteo)', () => {
  // Premier test : la grille.
  it('demande 162 points, du sud-ouest au nord-est', () => {
    // Points de la grille.
    const points = windGridPoints();
    // Il y en a 162.
    expect(points.length).toBe(162);
    // Le premier est au sud-ouest.
    expect(points[0]).toEqual({ lat: -80, lon: -180 });
    // Le dernier est au nord-est.
    expect(points[161]).toEqual({ lat: 80, lon: 160 });
    // Avec le vent d'altitude, l'adresse le demande.
    expect(windUrl(true)).toContain('wind_speed_700hPa');
    // Sans lui, elle ne le demande pas.
    expect(windUrl(false)).not.toContain('700hPa');
  // Fin du test.
  });

  // Deuxième test : la direction.
  it('convertit la direction météo : un vent d’ouest va vers l’est', () => {
    // Un vent de 10 m/s venant de l'ouest (270°).
    const [e, n] = windComponents(10, 270);
    // Il va vers l'est à 10 m/s.
    expect(e).toBeCloseTo(10);
    // Et pas vers le nord.
    expect(n).toBeCloseTo(0);
    // Un vent du nord (0°) va vers le sud.
    expect(windComponents(5, 0)[1]).toBeCloseTo(-5); // vent du nord : vers le sud
  // Fin du test.
  });

  // Troisième test : la lecture.
  it('lit la réponse, vent d’altitude d’abord, sinon vent à 10 m', () => {
    // Fausse réponse de 162 points, avec les deux niveaux de vent.
    const upper = Array.from({ length: 162 }, () => ({ current: { time: '2026-11-11T05:00', wind_speed_700hPa: 10, wind_direction_700hPa: 270, wind_speed_10m: 2, wind_direction_10m: 90 } }));
    // La lit.
    const g = parseWind(upper);
    // Taille de la grille, niveau 700 hPa, et vitesses du premier point.
    expect([g.width, g.height, g.level, g.u[0], g.v[0]]).toEqual([WIND_GRID.width, WIND_GRID.height, '700 hPa', 10, -0]);
    // Même réponse sans le vent d'altitude.
    const low = upper.map((p) => ({ current: { time: p.current.time, wind_speed_10m: 2, wind_direction_10m: 90 } }));
    // Le niveau devient 10 m.
    expect(parseWind(low).level).toBe('10 m');
    // Un vent d'est de 2 m/s va vers l'ouest : −2.
    expect(parseWind(low).u[0]).toBe(-2);
    // Une réponse qui n'est pas une liste est refusée.
    expect(() => parseWind({ error: true })).toThrow();
  // Fin du test.
  });
// Fin du groupe.
});
