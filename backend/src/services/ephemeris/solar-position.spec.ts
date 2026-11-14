/**
 * Contrôles de la position apparente du Soleil.
 *
 * Tous les repères employés ici sont des faits d'astronomie vérifiables sans table extérieure : l'obliquité aux
 * solstices, le passage de la déclinaison par zéro à l'équinoxe, les distances au périhélie et à l'aphélie, la
 * vitesse de défilement du point sous-solaire, et la valeur du temps sidéral de Greenwich à J2000.
 */
import { PLANETS } from '../data/bodies.data';
import { gmstDeg, solarPosition } from './solar-position';

/** Les douze nombres képlériens de la Terre. */
const EARTH = PLANETS.find((p) => p.earth)!.elements;

/** Position du Soleil à une date donnée. */
const at = (iso: string) => solarPosition(EARTH, Date.parse(iso));

describe('gmstDeg', () => {
  it('vaut 280,4606° à J2000.0 (1er janvier 2000 à 12 h UTC)', () => {
    // Le terme constant de la formule est le temps sidéral à cet instant précis.
    expect(gmstDeg(Date.parse('2000-01-01T12:00:00Z'))).toBeCloseTo(280.460_618, 4);
  });

  it('avance de 360,9856° par jour (un tour sidéral en 23 h 56 min 4 s)', () => {
    // Deux instants à un jour d'écart.
    const a = gmstDeg(Date.parse('2026-03-01T00:00:00Z'));
    const b = gmstDeg(Date.parse('2026-03-02T00:00:00Z'));
    // L'écart, ramené dans un tour.
    expect(((b - a) % 360 + 360) % 360).toBeCloseTo(360.985_647 - 360, 4);
  });

  it('reste dans [0, 360[', () => {
    // Quelques instants répartis sur deux siècles.
    for (const iso of ['1950-06-15T03:17:00Z', '2000-01-01T00:00:00Z', '2026-11-14T08:28:00Z', '2099-12-31T23:59:00Z']) {
      // L'angle.
      const g = gmstDeg(Date.parse(iso));
      // Dans le tour.
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(360);
    }
  });
});

describe('solarPosition — déclinaison et saisons', () => {
  it('atteint +23,44° au solstice de juin', () => {
    // Le 21 juin, la déclinaison est à son maximum : l'obliquité de l'écliptique.
    expect(at('2026-06-21T12:00:00Z').declinationDeg).toBeCloseTo(23.44, 1);
  });

  it('atteint −23,44° au solstice de décembre', () => {
    // Le 21 décembre, son minimum.
    expect(at('2026-12-21T12:00:00Z').declinationDeg).toBeCloseTo(-23.44, 1);
  });

  it('passe par zéro dans la journée de l’équinoxe de mars', () => {
    // Avant l'équinoxe : déclinaison négative (hiver boréal).
    expect(at('2026-03-20T00:00:00Z').declinationDeg).toBeLessThan(0);
    // Après : positive (printemps boréal).
    expect(at('2026-03-21T00:00:00Z').declinationDeg).toBeGreaterThan(0);
  });

  it('ne dépasse jamais l’obliquité, sur une année entière', () => {
    // Un relevé par jour sur 2026.
    for (let d = 0; d < 365; d++) {
      // La déclinaison de ce jour.
      const dec = solarPosition(EARTH, Date.UTC(2026, 0, 1) + d * 86_400_000).declinationDeg;
      // Toujours entre les deux tropiques.
      expect(Math.abs(dec)).toBeLessThanOrEqual(23.45);
    }
  });

  it('garde la latitude écliptique à quelques secondes d’arc de zéro', () => {
    // Le Soleil est sur l'écliptique par construction ; ce qui reste vient de deux effets réels : le centre de
    // la Terre est décalé du barycentre Terre–Lune (jusqu'à 4 942 km, soit 7″ vu du Soleil), et l'orbite de la
    // Terre est très légèrement inclinée sur l'écliptique J2000. Le relevé sur une année donne 0,0037° au plus, soit 13″.
    // La plus grande latitude de l'année, relevée toutes les six heures.
    let worst = 0;
    // Parcourt l'année 2026.
    for (let h = 0; h < 365 * 4; h++) worst = Math.max(worst, Math.abs(solarPosition(EARTH, Date.UTC(2026, 0, 1) + h * 6 * 3_600_000).eclipticLatDeg));
    // Quelques secondes d'arc au plus.
    expect(worst).toBeLessThan(0.004);
    // Et jamais nulle non plus : le décalage Terre–barycentre est bien pris en compte.
    expect(worst).toBeGreaterThan(0.001);
  });
});

describe('solarPosition — distance', () => {
  it('passe par 0,9833 UA au périhélie et 1,0167 UA à l’aphélie', () => {
    // Les distances de l'année 2026, un relevé par jour.
    const distances = Array.from({ length: 365 }, (_, d) => solarPosition(EARTH, Date.UTC(2026, 0, 1) + d * 86_400_000).distanceAu);
    // La plus courte : le périhélie, début janvier.
    expect(Math.min(...distances)).toBeCloseTo(0.9833, 3);
    // La plus longue : l'aphélie, début juillet.
    expect(Math.max(...distances)).toBeCloseTo(1.0167, 3);
  });

  it('donne la même distance en kilomètres et en unités astronomiques', () => {
    // Une date.
    const s = at('2026-07-04T00:00:00Z');
    // Le rapport est l'unité astronomique.
    expect(s.distanceKm / s.distanceAu).toBeCloseTo(149_597_870.7, 0);
    // Et la longueur du vecteur en kilomètres est bien cette distance.
    expect(Math.hypot(...s.km)).toBeCloseTo(s.distanceKm, 0);
  });
});

describe('solarPosition — point sous-solaire', () => {
  it('a pour latitude la déclinaison du Soleil', () => {
    // Une date.
    const s = at('2026-08-09T15:00:00Z');
    // La latitude du point sous-solaire est la déclinaison.
    expect(s.subSolar.lat).toBe(s.declinationDeg);
  });

  it('passe près du méridien de Greenwich à midi UTC', () => {
    // À midi UTC, le Soleil est au zénith près du méridien zéro ; l'équation du temps l'en écarte au plus de 4°.
    for (const iso of ['2026-02-11T12:00:00Z', '2026-06-21T12:00:00Z', '2026-11-03T12:00:00Z']) {
      // L'écart au méridien de Greenwich.
      expect(Math.abs(at(iso).subSolar.lon)).toBeLessThan(5);
    }
  });

  it('défile de 15° vers l’ouest par heure', () => {
    // Deux instants à une heure d'écart.
    const a = at('2026-04-10T09:00:00Z').subSolar.lon;
    const b = at('2026-04-10T10:00:00Z').subSolar.lon;
    // Le point sous-solaire recule d'un vingt-quatrième de tour.
    expect(((a - b) % 360 + 360) % 360).toBeCloseTo(15.04, 1);
  });

  it('reste dans [-180, 180[', () => {
    // Un relevé par heure sur une journée.
    for (let h = 0; h < 24; h++) {
      // La longitude.
      const lon = solarPosition(EARTH, Date.UTC(2026, 5, 1, h)).subSolar.lon;
      // Dans l'intervalle.
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThan(180);
    }
  });
});
