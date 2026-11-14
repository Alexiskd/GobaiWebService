/**
 * Point sous-solaire calculé sur place. Les contrôles portent sur des grandeurs physiques connues et
 * indépendantes du calcul : obliquité de Mars, inclinaison de l'équateur lunaire, durée du jour solaire
 * martien et du mois synodique. Aucun service d'éphémérides n'est appelé, ici ni ailleurs.
 */
import {
  eclipticToEquatorial, marsRotation, marsSubSolar, moonSubSolar, rotateAround, subSolarFromIau, wrap180,
} from './subsolar';

// Groupe de tests.
describe('subsolar', () => {
  /** Un jour, en millisecondes. */
  const DAY = 86_400_000;

  // Test : l'obliquité de Mars.
  it('retrouve l’obliquité de Mars dans la latitude du point sous-solaire', () => {
    // Les extrêmes sur presque deux années martiennes.
    let min = 90; let max = -90;
    // Un point par jour.
    for (let k = 0; k < 700; k++) {
      // La latitude de ce jour.
      const { lat } = marsSubSolar(Date.UTC(2026, 0, 1) + k * DAY);
      // Gardée si elle est extrême.
      min = Math.min(min, lat);
      max = Math.max(max, lat);
    // Fin des jours.
    }
    // Le Soleil ne dépasse jamais l'obliquité de Mars, 25,19°, et l'atteint au solstice.
    expect(max).toBeCloseTo(25.19, 1);
    expect(min).toBeCloseTo(-25.19, 1);
  // Fin du test.
  });

  // Test : le jour solaire martien.
  it('fait tourner Mars en un jour solaire de 24 h 39 min', () => {
    // Instant de départ et longitude du point sous-solaire.
    const t0 = Date.UTC(2026, 5, 1);
    const lon0 = marsSubSolar(t0).lon;
    // Cherche le moment où la longitude revient à sa valeur, à la minute près.
    let best = { s: 0, d: 360 };
    // Balaye autour de la durée attendue.
    for (let s = 88_000; s < 90_000; s += 10) {
      // Écart angulaire à la longitude de départ.
      const d = Math.abs(wrap180(marsSubSolar(t0 + s * 1000).lon - lon0));
      // Gardé s'il est le plus petit.
      if (d < best.d) best = { s, d };
    // Fin du balayage.
    }
    // Le jour solaire martien vaut 24 h 39 min 35 s, soit 88 775 s, à une minute près.
    expect(Math.abs(best.s - 88_775)).toBeLessThan(60);
  // Fin du test.
  });

  // Test : l'équateur lunaire.
  it('garde le Soleil à moins de 1,6° de l’équateur lunaire', () => {
    // Les extrêmes sur plus de deux ans.
    let max = 0;
    // Un point par jour.
    for (let k = 0; k < 800; k++) max = Math.max(max, Math.abs(moonSubSolar(Date.UTC(2026, 0, 1) + k * DAY).lat));
    // L'équateur de la Lune est incliné de 1,54° sur l'écliptique : le Soleil n'en sort pas.
    expect(max).toBeGreaterThan(1.4);
    expect(max).toBeLessThan(1.7);
  // Fin du test.
  });

  // Test : le mois synodique.
  it('fait le tour de la Lune en un mois synodique', () => {
    // Longitude de départ, et nombre de tours comptés.
    let prev = moonSubSolar(Date.UTC(2026, 0, 1)).lon;
    let turns = 0;
    // Un point par jour, sur deux mille jours.
    for (let k = 1; k <= 2000; k++) {
      // La longitude du jour.
      const lon = moonSubSolar(Date.UTC(2026, 0, 1) + k * DAY).lon;
      // Un tour de plus quand la longitude saute en arrière.
      if (lon > prev + 180) turns += 1;
      // Pour la comparaison suivante.
      prev = lon;
    // Fin des jours.
    }
    // Le Soleil fait le tour de la Lune en un mois synodique, 29,53 jours.
    expect(2000 / turns).toBeCloseTo(29.53, 0);
  // Fin du test.
  });

  // Test : la nouvelle lune.
  it('met le Soleil au-dessus de la face cachée à la nouvelle lune', () => {
    // Nouvelle lune du 18 janvier 2026 : la Terre est entre le Soleil et la Lune.
    const { lon } = moonSubSolar(Date.UTC(2026, 0, 18, 19, 52));
    // Le point sous-solaire est donc à l'opposé de la Terre, près du méridien 180.
    expect(Math.abs(lon)).toBeGreaterThan(170);
  // Fin du test.
  });

  // Test : le modèle de rotation de Mars.
  it('fait avancer le méridien origine de Mars d’un tour par jour sidéral', () => {
    // Le méridien origine à J2000 et un jour plus tard.
    const a = marsRotation(0, 0).w;
    const b = marsRotation(1 / 36_525, 1).w;
    // Un jour sidéral martien dure 360 / (b − a) jours, soit 24 h 37 min 22 s.
    const sidereal = (360 / (b - a)) * 24;
    expect(sidereal).toBeCloseTo(24.6229, 3);
    // Le pôle est bien celui de l'UAI, et il dérive lentement.
    expect(marsRotation(0, 0).ra).toBeCloseTo(317.68143, 5);
    expect(marsRotation(0, 0).dec).toBeCloseTo(52.8865, 5);
    expect(marsRotation(1, 0).ra).toBeLessThan(marsRotation(0, 0).ra);
  // Fin du test.
  });

  // Test : les outils géométriques.
  it('tourne les vecteurs et change de repère sans rien perdre', () => {
    // Une rotation d'un quart de tour autour de l'axe vertical.
    const r = rotateAround([1, 0, 0], [0, 1, 0], Math.PI / 2);
    // Le vecteur a tourné, sa longueur est conservée.
    expect(Math.hypot(...r)).toBeCloseTo(1, 12);
    expect(r[1]).toBeCloseTo(0, 12);
    // Une rotation nulle ne change rien.
    expect(rotateAround([0.3, -0.5, 0.8], [1, 0, 0], 0)).toEqual([0.3, -0.5, 0.8]);
    // Le passage à l'équateur céleste laisse l'axe de l'équinoxe en place et incline le reste de l'obliquité.
    expect(eclipticToEquatorial([1, 0, 0])).toEqual([1, 0, 0]);
    const pole = eclipticToEquatorial([0, 0, 1]);
    expect((Math.atan2(Math.hypot(pole[0], pole[1]), pole[2]) * 180) / Math.PI).toBeCloseTo(23.4392911, 6);
    // Les longitudes sont ramenées dans [-180, 180[.
    expect(wrap180(190)).toBeCloseTo(-170, 12);
    expect(wrap180(-190)).toBeCloseTo(170, 12);
    expect(wrap180(180)).toBeCloseTo(-180, 12);
  // Fin du test.
  });

  // Test : un pôle qui regarde le Soleil.
  it('met le point sous-solaire au pôle quand le Soleil est dans l’axe', () => {
    // La direction est donnée dans l'écliptique : le pôle nord de l'écliptique se lit, dans le repère des
    // pôles de l'UAI, à l'ascension droite 270° et à la déclinaison 90° − obliquité.
    const { lat } = subSolarFromIau([0, 0, 1], { ra: 270, dec: 90 - 23.4392911, w: 0 });
    // Un astre dont le pôle pointe là a le Soleil au zénith de son pôle nord, quelle que soit sa rotation propre.
    expect(lat).toBeCloseTo(90, 6);
    // Et un pôle à l'opposé met le Soleil au zénith du pôle sud.
    expect(subSolarFromIau([0, 0, 1], { ra: 90, dec: 23.4392911 - 90, w: 123 }).lat).toBeCloseTo(-90, 6);
  // Fin du test.
  });
// Fin du groupe.
});
