// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le calcul des orbites.
import {
  AU_KM, TT_MINUS_UTC_S, MOON_BARYCENTRE_SHARE, centuriesTT, earthOffsetFromBarycentre, elementsAt,
  heliocentric, heliocentricEcliptic, heliocentricState, moonGeocentric, orbitPositions, solveKepler,
} from './planetOrbits.jsx';
// Importe la table des éléments d'orbite des planètes.
import { PLANETS } from '../../../../backend/src/services/data/bodies.data';

/** Éléments d'une planète par son nom. */
const el = (nom) => PLANETS.find((p) => p.name === nom).elements;

/**
 * Vecteur d'état de référence de Mars, héliocentrique, écliptique J2000, au 1er janvier 2026 à 0 h TDB
 * (jour julien 2461041,5), relevé une fois sur JPL Horizons et figé ici : le calcul du projet est local, cette
 * valeur ne sert qu'à mesurer son écart. Position en km, vitesse en km/s.
 */
const MARS_2026 = {
  jd: 2461041.5,
  x: 5.094999446228143e7, y: -2.074925482420174e8, z: -5.597537454939082e6,
  vx: 2.444715235948102e1, vy: 7.861165862885534, vz: -4.347434612671703e-1,
};

/** Instant UTC qui correspond à un jour julien de Temps terrestre. */
const msOfJdTT = (jd) => (jd - 2440587.5) * 86_400_000 - TT_MINUS_UTC_S * 1000;

// Test : l'équation de Kepler.
test('résout l’équation de Kepler jusqu’à la précision machine, même très excentrique', () => {
  // Pour trois excentricités, dont une bien au-delà des planètes.
  for (const e of [0, 0.0167, 0.2489, 0.9]) {
    // Sur un tour complet.
    for (let k = 0; k < 360; k++) {
      // Anomalie moyenne de ce point.
      const M = (k / 360) * 2 * Math.PI - Math.PI;
      // Anomalie excentrique.
      const E = solveKepler(M, e);
      // Le résidu de l'équation M = E − e·sin E est nul à la précision machine.
      assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-12, `e=${e} M=${M} résidu=${E - e * Math.sin(E) - M}`);
    // Fin du tour.
    }
  // Fin des excentricités.
  }
// Fin du test.
});

// Test : la position de Mars contre la référence.
test('place Mars à moins de 10 000 km du vecteur d’état de référence VSOP87A', () => {
  // Siècles de Temps terrestre de l'époque de référence.
  const T = centuriesTT(msOfJdTT(MARS_2026.jd));
  // Position calculée, en km.
  const [x, y, z] = heliocentricEcliptic(el('Mars'), T).map((v) => v * AU_KM);
  // Écart à la référence.
  const d = Math.hypot(x - MARS_2026.x, y - MARS_2026.y, z - MARS_2026.z);
  // Résidu de VSOP87A face au vecteur de référence JPL, à cet instant.
  assert.ok(d < 10_000, `écart ${Math.round(d)} km`);
  // Et il reste bien au-dessus de zéro : le modèle est une approximation, pas l'éphéméride elle-même.
  assert.ok(d > 1000, `écart ${Math.round(d)} km`);
// Fin du test.
});

// Test : la vitesse de Mars contre la référence.
test('donne la vitesse de Mars à moins de 2 m/s de la référence VSOP87A', () => {
  // Siècles de Temps terrestre de l'époque de référence.
  const T = centuriesTT(msOfJdTT(MARS_2026.jd));
  // Vitesse calculée, des UA par jour aux km/s.
  const [vx, vy, vz] = heliocentricState(el('Mars'), T).velocity.map((v) => (v * AU_KM) / 86_400);
  // Écart à la référence.
  const d = Math.hypot(vx - MARS_2026.vx, vy - MARS_2026.vy, vz - MARS_2026.vz);
  // Résidu mesuré : environ 1,21 m/s sur 25 km/s.
  assert.ok(d < 2, `écart ${(d * 1000).toFixed(1)} m/s`);
// Fin du test.
});

// Test : la vitesse est cohérente avec le déplacement.
test('la dérivée analytique VSOP87A est cohérente avec le déplacement, pour chaque planète', () => {
  // Une date quelconque.
  const T = 0.26;
  // Un demi-pas de dix minutes, en siècles.
  const h = 10 / (60 * 24 * 36_525);
  // Pour chaque planète.
  for (const p of PLANETS) {
    // Vitesse analytique, en UA par jour.
    const v = heliocentricState(p.elements, T).velocity;
    // Vitesse par différences finies centrées.
    const a = heliocentricEcliptic(p.elements, T - h);
    const b = heliocentricEcliptic(p.elements, T + h);
    // Le pas en jours.
    const dt = 2 * h * 36_525;
    // Les deux se correspondent à 10⁻⁴ près de la norme de la vitesse. L'écart résiduel est attendu : la
    // différence finie inclut la lente dérive des éléments entre les deux dates, que la vitesse képlérienne
    // du moment ignore ; il vaut quelques centimètres par seconde sur 25 km/s.
    for (let i = 0; i < 3; i++) {
      // Écart relatif à la norme de la vitesse.
      const err = Math.abs((b[i] - a[i]) / dt - v[i]) / Math.hypot(...v);
      // Vérification.
      assert.ok(err < 1e-4, `${p.name} composante ${i} : écart relatif ${err}`);
    // Fin des composantes.
    }
  // Fin des planètes.
  }
// Fin du test.
});

/** Dérive de la longitude moyenne de chaque planète (degrés par siècle), figée d'après la table publiée. */
const LDOT = {
  Mercure: 149472.67411175, 'Vénus': 58517.81538729, Terre: 35999.37244981, Mars: 19140.30268499,
  Jupiter: 3034.74612775, Saturne: 1222.49362201, Uranus: 428.48202785, Neptune: 218.45945325, Pluton: 145.20780515,
};

// Test : les dérives séculaires sont bien présentes.
test('chaque planète garde ses dérives séculaires ajustées', () => {
  // Constante de Gauss, pour le moyen mouvement à deux corps.
  const K = 0.01720209895;
  // Pour chaque planète.
  for (const p of PLANETS) {
    // Les douze nombres attendus.
    assert.equal(p.elements.length, 12, p.name);
    // La dérive du demi-grand axe, de l'excentricité, de l'inclinaison et du périhélie ne sont pas toutes nulles :
    // des éléments figés à J2000 décalent les planètes de plusieurs minutes d'arc en quelques décennies.
    assert.ok([1, 3, 5, 9, 11].some((i) => p.elements[i] !== 0), `${p.name} : dérives séculaires absentes`);
    // La dérive de la longitude moyenne est celle de la table, ajustée sur les observations.
    assert.equal(p.elements[7], LDOT[p.name], `${p.name} : L' n'est plus la valeur ajustée de la table`);
  // Fin des planètes.
  }
  // Et elle ne se retrouve pas par la troisième loi de Kepler : l'écart, de 0,04 à 1,36 degré par siècle,
  // est ce qui décalait Jupiter de 4,8 millions de kilomètres en 2026 quand le moyen mouvement était recalculé.
  const jupiter = PLANETS.find((p) => p.name === 'Jupiter').elements;
  const twoBody = (K / Math.sqrt(jupiter[0] ** 3)) * (180 / Math.PI) * 36_525;
  assert.ok(Math.abs(jupiter[7] - twoBody) > 1, `Jupiter : écart ${Math.abs(jupiter[7] - twoBody)} °/siècle`);
// Fin du test.
});

// Test : les éléments bougent avec le temps.
test('les éléments évoluent entre J2000 et 2026', () => {
  // Éléments de Mars à J2000 et vingt-six ans plus tard.
  const a = elementsAt(el('Mars'), 0);
  const b = elementsAt(el('Mars'), 0.26);
  // Le demi-grand axe, l'excentricité et l'inclinaison ont changé.
  assert.notEqual(a.a, b.a);
  assert.notEqual(a.e, b.e);
  assert.notEqual(a.I, b.I);
  // Le moyen mouvement est positif et vaut un tour en un peu moins de deux ans.
  assert.ok(b.n > 0);
  assert.ok(Math.abs((2 * Math.PI) / b.n - 687) < 1, `période ${(2 * Math.PI) / b.n} jours`);
// Fin du test.
});

// Test : l'échelle de temps.
test('le Temps terrestre avance de 69,184 s sur UTC', () => {
  // Un instant quelconque.
  const ms = Date.UTC(2026, 0, 1);
  // Siècles comptés en Temps terrestre, et en UTC.
  const tt = centuriesTT(ms);
  const utc = (ms / 86_400_000 + (2440587.5 - 2451545)) / 36_525;
  // L'écart vaut la constante, exprimée en siècles, au microseconde près.
  assert.ok(Math.abs((tt - utc) * 36_525 * 86_400 - TT_MINUS_UTC_S) < 1e-6, `${(tt - utc) * 36_525 * 86_400} s`);
  // Sur la Terre, 69 s de mouvement font environ deux mille kilomètres.
  const d = Math.hypot(...heliocentricEcliptic(el('Terre'), tt).map((v, i) => (v - heliocentricEcliptic(el('Terre'), utc)[i]) * AU_KM));
  assert.ok(d > 1500 && d < 2500, `${Math.round(d)} km`);
// Fin du test.
});

// Test : le centre de la Terre et le barycentre Terre–Lune.
test('sépare le centre de la Terre du barycentre Terre–Lune', () => {
  // Sur deux ans, tous les jours.
  let max = 0;
  // Parcourt les dates.
  for (let k = 0; k < 730; k++) {
    // Siècles de cette date.
    const T = centuriesTT(Date.UTC(2026, 0, 1) + k * 86_400_000);
    // Décalage du centre de la Terre, en km.
    const o = earthOffsetFromBarycentre(T).map((v) => v * AU_KM);
    // Sa norme.
    const r = Math.hypot(...o);
    // Gardée si elle est la plus grande.
    max = Math.max(max, r);
    // Le décalage est à l'opposé de la Lune : le produit scalaire des deux directions vaut −1.
    const { lon, lat, distKm } = moonGeocentric(T);
    const m = [Math.cos(lat * Math.PI / 180) * Math.cos(lon * Math.PI / 180), Math.sin(lat * Math.PI / 180), -Math.cos(lat * Math.PI / 180) * Math.sin(lon * Math.PI / 180)];
    const dot = (o[0] * m[0] + o[1] * m[1] + o[2] * m[2]) / r;
    assert.ok(Math.abs(dot + 1) < 1e-9, `direction ${dot}`);
    // Et sa longueur vaut la part de la Lune dans le barycentre.
    assert.ok(Math.abs(r - MOON_BARYCENTRE_SHARE * distKm) < 1e-6, `longueur ${r}`);
  // Fin des dates.
  }
  // Le décalage culmine vers 4 940 km à l'apogée de la Lune, soit 0,78 rayon terrestre : sous la surface,
  // mais bien assez pour se voir quand la caméra descend près du sol.
  assert.ok(max > 4600 && max < 5000, `maximum ${Math.round(max)} km`);
// Fin du test.
});

// Test : le tracé de l'orbite passe par la planète.
test('la planète est sur l’ellipse tracée, pour chaque planète', () => {
  // Une date quelconque.
  const T = 0.26;
  // Pour chaque planète.
  for (const p of PLANETS) {
    // Le tracé, en unités de scène, et la position de la planète.
    const pts = orbitPositions(p.elements, T, 4096);
    const [x, y, z] = heliocentric(p.elements, T);
    // Demi-grand axe, en unités de scène, pour rapporter l'écart.
    const a = p.elements[0] + p.elements[1] * T;
    // Distance minimale de la planète au tracé, mesurée aux segments et non aux seuls sommets : le tracé est
    // une ligne brisée, et la planète tombe en général entre deux sommets.
    let best = Infinity;
    // Parcourt les segments.
    for (let i = 0; i < 4096; i++) {
      // Les deux extrémités du segment, en unités astronomiques.
      const j = (i + 1) % 4096;
      const A = [pts[3 * i] / 23455, pts[3 * i + 1] / 23455, pts[3 * i + 2] / 23455];
      const B = [pts[3 * j] / 23455, pts[3 * j + 1] / 23455, pts[3 * j + 2] / 23455];
      // Vecteur du segment et vecteur vers la planète.
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const w = [x - A[0], y - A[1], z - A[2]];
      // Projection, ramenée dans le segment.
      const t = Math.max(0, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (u[0] ** 2 + u[1] ** 2 + u[2] ** 2)));
      // Distance au point projeté, en unités de demi-grand axe.
      const d = Math.hypot(w[0] - t * u[0], w[1] - t * u[1], w[2] - t * u[2]) / a;
      // Gardée si elle est la plus petite.
      if (d < best) best = d;
    // Fin des segments.
    }
    // La planète est sur l'ellipse tracée, à la flèche de la corde près.
    assert.ok(best < 1e-6, `${p.name} : ${best} demi-grand axe`);
  // Fin des planètes.
  }
// Fin du test.
});
