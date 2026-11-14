/**
 * Calcul local des orbites : vérifié sur un vecteur d'état de référence relevé une fois sur une éphéméride
 * publiée, puis figé ici. Le code testé n'appelle aucun service : la référence ne sert qu'à mesurer l'écart.
 */
import { PLANETS } from '../data/bodies.data';
import {
  AU_KM, TT_MINUS_UTC_S, UNIX_EPOCH_JD, centuriesTT, earthPosition, elementsAt,
  heliocentric, heliocentricState, moonGeocentric, solveKepler,
} from './planet-orbits';

/** Éléments d'une planète par son nom. */
const el = (nom: string) => PLANETS.find((p) => p.name === nom)!.elements;

/**
 * Mars, héliocentrique, écliptique J2000, au 1er janvier 2026 à 0 h TDB (jour julien 2461041,5).
 * Position en km, vitesse en km/s.
 */
const MARS_2026 = {
  jd: 2461041.5,
  x: 5.094999446228143e7, y: -2.074925482420174e8, z: -5.597537454939082e6,
  vx: 2.444715235948102e1, vy: 7.861165862885534, vz: -4.347434612671703e-1,
};

/** Instant UTC qui correspond à un jour julien de Temps terrestre. */
const msOfJdTT = (jd: number) => (jd - UNIX_EPOCH_JD) * 86_400_000 - TT_MINUS_UTC_S * 1000;

// Groupe de tests.
describe('planet-orbits', () => {
  // Test : l'équation de Kepler.
  it('résout l’équation de Kepler à la précision machine jusqu’aux fortes excentricités', () => {
    // Le pire résidu rencontré.
    let worst = 0;
    // Pour plusieurs excentricités, sur un tour complet.
    for (const e of [0, 0.0167, 0.2489, 0.5, 0.9, 0.99]) {
      // Chaque anomalie moyenne.
      for (let k = 0; k <= 720; k++) {
        // L'anomalie moyenne.
        const M = -Math.PI + (2 * Math.PI * k) / 720;
        // L'anomalie excentrique.
        const E = solveKepler(M, e);
        // Le résidu de M = E − e·sin E.
        worst = Math.max(worst, Math.abs(E - e * Math.sin(E) - M));
      // Fin des anomalies.
      }
    // Fin des excentricités.
    }
    // Le résidu reste au niveau du dernier bit.
    expect(worst).toBeLessThan(1e-12);
  // Fin du test.
  });

  // Test : Mars contre la référence.
  it('place Mars à moins de 10 000 km de la référence VSOP87A, vitesse comprise', () => {
    // Siècles de Temps terrestre de l'époque de référence.
    const T = centuriesTT(msOfJdTT(MARS_2026.jd));
    // Position, en km.
    const [x, y, z] = heliocentric(el('Mars'), T).map((v) => v * AU_KM);
    // Écart de position.
    const d = Math.hypot(x - MARS_2026.x, y - MARS_2026.y, z - MARS_2026.z);
    // Résidu de VSOP87A face au vecteur de référence JPL, à cet instant.
    expect(d).toBeLessThan(10_000);
    // Vitesse, des UA par jour aux km/s.
    const [vx, vy, vz] = heliocentricState(el('Mars'), T).velocity.map((v) => (v * AU_KM) / 86_400);
    // Écart de vitesse mesuré : environ 1,21 m/s sur 25 km/s.
    expect(Math.hypot(vx - MARS_2026.vx, vy - MARS_2026.vy, vz - MARS_2026.vz)).toBeLessThan(2);
  // Fin du test.
  });

  // Test : les dérives séculaires.
  it('garde les dérives séculaires ajustées de la table', () => {
    // Pour chaque planète.
    for (const p of PLANETS) {
      // Les douze nombres.
      expect(p.elements).toHaveLength(12);
      // Au moins une dérive non nulle : des éléments figés à J2000 décalent les planètes en quelques décennies.
      expect([1, 3, 5, 9, 11].some((i) => p.elements[i] !== 0)).toBe(true);
    // Fin des planètes.
    }
    // La dérive de la longitude moyenne de Jupiter est celle de la table, pas le moyen mouvement à deux corps :
    // l'écart de 1,36 degré par siècle valait 4,8 millions de kilomètres en 2026.
    const jupiter = el('Jupiter');
    expect(jupiter[7]).toBe(3034.74612775);
    const twoBody = (0.01720209895 / Math.sqrt(jupiter[0] ** 3)) * (180 / Math.PI) * 36_525;
    expect(Math.abs(jupiter[7] - twoBody)).toBeGreaterThan(1);
  // Fin du test.
  });

  // Test : la vitesse est celle du mouvement.
  it('donne une vitesse cohérente avec le déplacement, pour chaque planète', () => {
    // Une date quelconque et un demi-pas de dix minutes, en siècles.
    const T = 0.26;
    const h = 10 / (60 * 24 * 36_525);
    // Pour chaque planète.
    for (const p of PLANETS) {
      // Vitesse analytique.
      const v = heliocentricState(p.elements, T).velocity;
      // Vitesse par différences finies centrées.
      const a = heliocentric(p.elements, T - h);
      const b = heliocentric(p.elements, T + h);
      // Le pas en jours.
      const dt = 2 * h * 36_525;
      // Les deux se correspondent ; l'écart résiduel vient de la dérive des éléments entre les deux dates.
      for (let i = 0; i < 3; i++) {
        expect(Math.abs((b[i] - a[i]) / dt - v[i]) / Math.hypot(...v)).toBeLessThan(1e-4);
      // Fin des composantes.
      }
    // Fin des planètes.
    }
  // Fin du test.
  });

  // Test : l'échelle de temps.
  it('compte les orbites en Temps terrestre, pas en UTC', () => {
    // Un instant quelconque.
    const ms = Date.UTC(2026, 0, 1);
    // Siècles en Temps terrestre et en UTC.
    const tt = centuriesTT(ms);
    const utc = (ms / 86_400_000 + (2440587.5 - 2451545)) / 36_525;
    // L'écart vaut la constante TT − UTC.
    expect((tt - utc) * 36_525 * 86_400).toBeCloseTo(TT_MINUS_UTC_S, 6);
    // Sur la Terre, ces 69 s valent environ deux mille kilomètres de trajet.
    const p = heliocentric(el('Terre'), tt);
    const q = heliocentric(el('Terre'), utc);
    const d = Math.hypot(...p.map((v, i) => (v - q[i]) * AU_KM));
    expect(d).toBeGreaterThan(1500);
    expect(d).toBeLessThan(2500);
  // Fin du test.
  });

  // Test : VSOP87A EARTH décrit le centre de la Terre, et non le barycentre Terre–Lune.
  it('utilise directement la série VSOP87A du centre de la Terre', () => {
    for (let k = 0; k < 73; k++) {
      const T = centuriesTT(Date.UTC(2026, 0, 1) + k * 10 * 86_400_000);
      const state = heliocentric(el('Terre'), T);
      const earth = earthPosition(el('Terre'), T);
      expect(earth[0]).toBeCloseTo(state[0], 14);
      expect(earth[1]).toBeCloseTo(state[1], 14);
      expect(earth[2]).toBeCloseTo(state[2], 14);
    }
  });

  // Test : la Lune.
  it('garde la Lune dans son intervalle de distance et d’inclinaison', () => {
    // Les extrêmes rencontrés sur deux ans.
    let near = Infinity; let far = 0; let tilt = 0;
    // Tous les jours.
    for (let k = 0; k < 730; k++) {
      // Position de la Lune.
      const g = moonGeocentric(centuriesTT(Date.UTC(2026, 0, 1) + k * 86_400_000));
      // Distances extrêmes et latitude maximale.
      near = Math.min(near, g.distKm);
      far = Math.max(far, g.distKm);
      tilt = Math.max(tilt, Math.abs(g.lat));
    // Fin des dates.
    }
    // Périgée et apogée réels, à quelques milliers de kilomètres près.
    expect(near).toBeGreaterThan(356_000);
    expect(near).toBeLessThan(363_000);
    expect(far).toBeGreaterThan(404_000);
    expect(far).toBeLessThan(407_000);
    // L'orbite de la Lune est inclinée d'environ 5,15° sur l'écliptique.
    expect(tilt).toBeGreaterThan(4.9);
    expect(tilt).toBeLessThan(5.4);
  // Fin du test.
  });

  // Test : les éléments à la date.
  it('fait évoluer les éléments et rend une période juste', () => {
    // Éléments de Mars à J2000 et en 2026.
    const a = elementsAt(el('Mars'), 0);
    const b = elementsAt(el('Mars'), 0.26);
    // Les éléments ont bougé.
    expect(a.a).not.toBe(b.a);
    expect(a.e).not.toBe(b.e);
    // La période sidérale de Mars vaut 687 jours.
    expect((2 * Math.PI) / b.n).toBeCloseTo(687, 0);
  // Fin du test.
  });
// Fin du groupe.
});
