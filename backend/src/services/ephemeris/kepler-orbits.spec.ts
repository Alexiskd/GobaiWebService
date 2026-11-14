import { ASTRE_BY_ID, ASTRES } from '../data/kepler-elements';
import { meanMotion, orbitalState, periodDays, solveKepler, stateAt } from './kepler-orbits';

describe('kepler-orbits', () => {
  it('résout l’équation de Kepler sur un tour et pour de fortes excentricités', () => {
    for (const e of [0, 0.0167, 0.2056, 0.5, 0.9, 0.99]) {
      for (let index = 0; index <= 360; index++) {
        const M = -Math.PI + (2 * Math.PI * index) / 360;
        const E = solveKepler(M, e);
        expect(Math.abs(E - e * Math.sin(E) - M)).toBeLessThan(1e-12);
      }
    }
  });

  it('rejette les entrées qui ne décrivent pas une ellipse valide', () => {
    expect(() => solveKepler(1, -0.1)).toThrow(RangeError);
    expect(() => solveKepler(1, 1)).toThrow(RangeError);
    expect(() => solveKepler(Number.NaN, 0.1)).toThrow(RangeError);
  });

  it('retourne position, vitesse et distance cohérentes pour chaque planète', () => {
    const epoch = Date.UTC(2000, 0, 1, 12);
    for (const body of ASTRES.filter((item) => item.type === 'planet')) {
      const state = stateAt(body, epoch);
      expect(state.position).toHaveLength(3);
      expect(state.velocity).toHaveLength(3);
      expect([...state.position, ...state.velocity, state.distance].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...state.position)).toBeCloseTo(state.distance, 9);
      expect(state.distance).toBeGreaterThan(0);
    }
  });

  it('retrouve une période terrestre proche de 365,26 jours', () => {
    const earth = ASTRE_BY_ID.get('earth')!;
    expect(periodDays(earth)).toBeGreaterThan(365.2);
    expect(periodDays(earth)).toBeLessThan(365.3);
  });

  it('calcule une vitesse képlérienne compatible avec la relation vis-viva', () => {
    const earth = ASTRE_BY_ID.get('earth')!;
    const n = meanMotion(earth);
    const state = orbitalState(earth.kepler, earth.kepler.M0 * Math.PI / 180, n);
    const speedSquared = state.velocity.reduce((sum, component) => sum + component * component, 0);
    const mu = 0.01720209895 ** 2;
    const expected = mu * (2 / state.distance - 1 / earth.kepler.a);
    expect(speedSquared).toBeCloseTo(expected, 10);
  });

  it('conserve le calcul des satellites naturels en coordonnées relatives à leur planète', () => {
    const moon = ASTRE_BY_ID.get('moon')!;
    const state = stateAt(moon, Date.UTC(2026, 0, 1));
    expect(state.distance).toBeGreaterThan(350_000);
    expect(state.distance).toBeLessThan(410_000);
    expect(state.position.every(Number.isFinite)).toBe(true);
  });
});
