import test from 'node:test';
import assert from 'node:assert/strict';
import { AU_UNITS, elementsAt } from '../../../../AstreSolideEngine/planetOrbits.jsx';
import {
  GEODESIC_EXAGGERATION, SCHWARZSCHILD_FADE_MS, easeInOutCubic, gridRadii, gridWellY, mirrorY, mixPoints,
  precessionPerCenturyArcsec, precessionPerOrbitRad,
  schwarzschildGeodesic, schwarzschildGridSegments, schwarzschildRadiusM,
} from './orbitSchwarzschildMath.jsx';
// Le catalogue complet des astres : pour vérifier que la grille englobe le plus lointain (l'aphélie d'Éris).
import { PLANETS } from '../data/bodies.data.ts';

// Éléments képlériens de Mercure, en tableau des douze nombres (J2000 + dérive séculaire).
const MERCURY_ELEMENTS = [
  0.38709927, 3.7e-7, 0.20563593, 0.00001906, 7.00497902, -0.00594749,
  252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081,
];

test('rayon de Schwarzschild du Soleil (CODATA)', () => {
  // 2GM/c² pour GM = 1,32712440018e20 m³/s² et c = 299792458 m/s, ≈ 2 953,25 m.
  const rs = schwarzschildRadiusM();
  assert.ok(Math.abs(rs - 2953.25) / 2953.25 < 1e-4, `rs = ${rs} m, attendu ≈ 2953 m`);
});

test('avance du périhélie de Mercure (43″ par siècle, valeur célèbre)', () => {
  // a = 0,387098 UA, e = 0,205630 ; la métrique de Schwarzschild donne ≈ 43,0″/siècle.
  const arcsec = precessionPerCenturyArcsec({ aAu: 0.387098, e: 0.20563 });
  assert.ok(Math.abs(arcsec - 43.0) < 0.2, `Δϖ = ${arcsec}″/siècle, attendu ≈ 43″`);
});

test('l’avance du périhélie décroît avec le demi-grand axe', () => {
  // Plus l'orbite est lointaine, moins l'avance est grande (Terre : 3,84″ ; Jupiter : 0,06″).
  const mercury = precessionPerCenturyArcsec({ aAu: 0.387098, e: 0.20563 });
  const earth = precessionPerCenturyArcsec({ aAu: 1, e: 0.0167 });
  const jupiter = precessionPerCenturyArcsec({ aAu: 5.2038, e: 0.0489 });
  assert.ok(mercury > earth, `Mercure (${mercury.toFixed(2)}″) devant la Terre (${earth.toFixed(2)}″)`);
  assert.ok(earth > jupiter, `Terre (${earth.toFixed(2)}″) devant Jupiter (${jupiter.toFixed(4)}″)`);
  // Par orbite : le même ordre (la formule au premier ordre ne dépend que de a et e).
  const perOrbit = (aAu, e) => precessionPerOrbitRad({ aAu, e });
  assert.ok(perOrbit(0.387098, 0.20563) > perOrbit(1, 0.0167));
  assert.ok(perOrbit(1, 0.0167) > perOrbit(5.2038, 0.0489));
});

test('l’avancement amorti relie 0 à 1 sans à-coup et reste dans [0, 1]', () => {
  // Aux bornes.
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  // Croissant partout, symétrique au point milieu.
  let prev = 0;
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    const v = easeInOutCubic(u);
    assert.ok(v >= prev - 1e-12, `croissant en u = ${u} (v = ${v}, précédent = ${prev})`);
    assert.ok(v >= 0 && v <= 1, `dans [0, 1] en u = ${u} (v = ${v})`);
    prev = v;
  }
  assert.equal(easeInOutCubic(0.5), 0.5);
});

test('mixPoints interpole chaque composante et borne les extrêmes', () => {
  // Deux tracés de même longueur (un point de fermeture en plus sur le ruban) :
  const from = new Float32Array([1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0]);
  const to = new Float32Array([2, 0, 0, 0, 2, 0, -2, 0, 0, 2, 0, 0]);
  const out = new Float32Array(from.length);
  // À u = 0, le tracé de départ ; à u = 1, le tracé d'arrivée.
  mixPoints(from, to, 0, out);
  assert.deepEqual([...out], [...from]);
  mixPoints(from, to, 1, out);
  assert.deepEqual([...out], [...to]);
  // À mi-chemin, chaque composante est la moyenne des deux.
  mixPoints(from, to, 0.5, out);
  for (let i = 0; i < out.length; i++) {
    assert.ok(Math.abs(out[i] - (from[i] + to[i]) / 2) < 1e-12, `composante ${i} : ${out[i]} ≠ ${(from[i] + to[i]) / 2}`);
  }
});

test('les rayons de la grille s’écartent du Soleil par pas croissants', () => {
  // Vingt-huit anneaux sur un disque bordé par l'aphélie de la naine la plus lointaine (Éris : a(1+e) ≈ 97,7 UA,
  // arrondi à 98 par le moteur), la surface du Soleil comme garde-fou intérieur (0,00465 UA, non atteinte ici).
  const radii = gridRadii(98, 28, 0.00465);
  assert.equal(radii.length, 28);
  // Premier anneau : espacement quadratique (98 × (1/28)²), qui n'est pas la surface du Soleil
  // (le garde-fou s'applique seulement si l'anneau voulait passer dessous).
  assert.ok(Math.abs(radii[0] - 98 / 784) < 1e-9, `premier anneau = ${radii[0]} UA (attendu ≈ ${(98 / 784).toFixed(4)} UA)`);
  assert.equal(radii[radii.length - 1], 98);
  for (let i = 1; i < radii.length; i++) assert.ok(radii[i] > radii[i - 1], `anneau ${i} croissant`);
});

test('le puits de gravité plonge au centre et remonte au bord (profil √r préservé)', () => {
  // Sur le disque : le creux au centre, la surface au bord.
  const center = gridWellY(0.00465, 50);
  const edge = gridWellY(50, 50);
  const mid = gridWellY(0.7071067812 * 50, 50);
  assert.ok(center < mid, `centre (${center}) sous la mi-hauteur (${mid})`);
  assert.ok(mid < 0 && edge === 0, `mi-hauteur (${mid}) sous le plan, bord (${edge}) sur le plan`);
  // La signature en √r : la pente est forte au centre, faible au bord.
  const nearEdge = gridWellY(0.99 * 50, 50) - gridWellY(0.98 * 50, 50);
  const nearCenter = gridWellY(0.02 * 50, 50) - gridWellY(0.01 * 50, 50);
  assert.ok(nearCenter > nearEdge, `pente au centre (${nearCenter}) plus forte qu'au bord (${nearEdge})`);
});

test('la g\u00e9od\u00e9sique sans exag\u00e9ration retombe sur la conique de Kepler', () => {
  // Le siècle courant, pour les éléments à la date du jour.
  const T = 0.26;
  // Trois orbites de Mercure, 2 048 points, exagération nulle : la vraie équation se réduit à la conique.
  const n = 2048, revolutions = 3;
  const pts = schwarzschildGeodesic(MERCURY_ELEMENTS, T, n, revolutions, 0);
  // Le nombre de points exact : n × 3 (le point de fermeture est répété par le moteur, pas par le calcul).
  assert.equal(pts.length, n * 3);
  // Les éléments à cette date, pour la conique attendue : p = a(1 − e²), et r(φ) = p / (1 + e·cos φ).
  const k = elementsAt(MERCURY_ELEMENTS, T);
  const p = k.a * (1 - k.e * k.e);
  // Le pas d'anomalie vraie entre deux points.
  const dPhi = (2 * Math.PI * revolutions) / n;
  // Chaque point (échantillonné) vérifie l'équation de la conique, à la précision de Runge-Kutta près.
  for (let i = 0; i < n; i += 32) {
    // Le rayon du point, reconduit en UA depuis les unités de la scène.
    const x = pts[3 * i], y = pts[3 * i + 1], z = pts[3 * i + 2];
    const r = Math.sqrt(x * x + y * y + z * z) / AU_UNITS;
    // Le rayon képlérien au même angle.
    const rKepler = p / (1 + k.e * Math.cos(i * dPhi));
    assert.ok(Math.abs(r - rKepler) / rKepler < 1e-6, `point ${i} : r = ${r} UA au lieu de ${rKepler} UA`);
  }
});

test('l\u2019avance du p\u00e9rih\u00e9lie int\u00e9gr\u00e9e rejoint la formule analytique', () => {
  // Trois orbites de Mercure avec l'exagération pédagogique par défaut (l'équation reste la vraie).
  const n = 2048, revolutions = 3;
  const pts = schwarzschildGeodesic(MERCURY_ELEMENTS, 0.26, n, revolutions);
  // Le pas d'anomalie vraie, et u = 1/r en UA⁻¹ (les maxima de u sont les périhélies).
  const dPhi = (2 * Math.PI * revolutions) / n;
  const u = [];
  for (let i = 0; i < n; i++) {
    const x = pts[3 * i], y = pts[3 * i + 1], z = pts[3 * i + 2];
    u.push(AU_UNITS / Math.sqrt(x * x + y * y + z * z));
  }
  // Les périhélies, précisés par interpolation parabolique autour du maximum échantillonné.
  const peaks = [];
  for (let i = 1; i < n - 1; i++) {
    // Un maximum local de u : un périhélie (hors du bord du tracé).
    if (u[i] > u[i - 1] && u[i] > u[i + 1]) {
      // Le sommet de la parabole passant par les trois échantillons.
      const d = u[i - 1] - 2 * u[i] + u[i + 1];
      peaks.push((i + 0.5 * (u[i - 1] - u[i + 1]) / d) * dPhi);
    }
  }
  // Le périhélie initial (φ = 0) est au bord : deux périhélies mesurables sur trois orbites.
  assert.ok(peaks.length === 2, `deux périhélies détectés (reçu : ${peaks.length})`);
  // L'angle entre deux périhélies vaut 2π + Δφω (l'avance) : la mesure.
  const advance = peaks[1] - peaks[0] - 2 * Math.PI;
  // La formule analytique, à la même échelle d'exagération.
  const k = elementsAt(MERCURY_ELEMENTS, 0.26);
  const expected = precessionPerOrbitRad({ aAu: k.a, e: k.e }) * GEODESIC_EXAGGERATION;
  assert.ok(Math.abs(advance - expected) / expected < 0.1, `Δφ = ${advance.toFixed(5)} rad au lieu de ${expected.toFixed(5)} rad`);
});

test('mirrorY inverse la hauteur et garde le plan de l\u2019\u00e9cliptique', () => {
  // Deux points : le miroir garde x et z, inverse y.
  const pts = new Float32Array([1, 2, 3, -4, 5, -6]);
  const mir = mirrorY(pts);
  assert.deepEqual([...mir], [1, -2, 3, -4, -5, -6]);
  // L'originale est intacte.
  assert.deepEqual([...pts], [1, 2, 3, -4, 5, -6]);
  // Dans un tampon fourni : le même résultat, sans nouvelle allocation.
  const out = new Float32Array(pts.length);
  const back = mirrorY(pts, out);
  assert.equal(back, out);
  assert.deepEqual([...out], [...mir]);
});

test('la grille est un double puits : la seconde moitié est le miroir exact de la première', () => {
  // Les segments du double puits, sur un petit disque pour le test.
  const segs = schwarzschildGridSegments({ outerAu: 50, rings: 6, spokes: 8 });
  // La moitié du tampon, en points entiers.
  const half = segs.length / 2;
  assert.equal(segs.length % 2, 0);
  assert.equal(half % 3, 0);
  // Chaque segment du dessus est le miroir exact de son homologue du dessous.
  for (let i = 0; i < half; i += 3) {
    assert.equal(segs[half + i], segs[i], `x du point ${i / 3}`);
    assert.equal(segs[half + i + 1], -segs[i + 1], `y du point ${i / 3}`);
    assert.equal(segs[half + i + 2], segs[i + 2], `z du point ${i / 3}`);
  }
});

test('la grille englobe tous les astres du système : aphélie de la naine la plus lointaine (Éris)', () => {
  // L'aphélie de chaque astre du catalogue : a(1+e) ; Éris est de loin la plus lointaine (≈ 97,7 UA).
  const aphelias = PLANETS.map((b) => b.elements[0] * (1 + b.elements[2]));
  const farthest = Math.max(...aphelias);
  // Le disque de la grille de Schwarzschild du moteur l'englobe, avec une marge.
  const outer = Math.ceil(farthest);
  assert.equal(outer, 98, `bord de grille = ${outer} UA (aphélie d'Éris arrondi au-dessus)`);
  assert.ok(outer >= farthest, `la grille (${outer} UA) englobe l'aphélie le plus lointain (${farthest.toFixed(2)} UA)`);
  // Le module des rayons renvoie bien ce bord pour ce disque.
  const radii = gridRadii(outer, 28, 0.00465);
  assert.equal(radii[radii.length - 1], outer);
});

// Test : la rosette d'un satellite — cercle sans excentricité ni terme relativiste, périastre qui avance sinon.
test('rosette d’un satellite : cercle unité au repos, périastre qui avance avec le terme relativiste', async () => {
  const { SATELLITE_ECCENTRICITY, schwarzschildSatelliteRosette, periapsisAdvance } = await import('./orbitSchwarzschildMath.jsx');
  // La table des excentricités : toutes entre 0 et 1, Néréide la plus excentrique.
  for (const [id, e] of Object.entries(SATELLITE_ECCENTRICITY)) assert.ok(e >= 0 && e < 1, id);
  assert.ok(SATELLITE_ECCENTRICITY.nereid > 0.7);
  // Sans excentricité ni relativité : le cercle unité, dans le plan x-z, n + 1 points.
  const circle = schwarzschildSatelliteRosette({ e: 0, rsOverA: 0, n: 64, revolutions: 1 });
  assert.equal(circle.length, 65 * 3);
  for (let i = 0; i < circle.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(circle[i], circle[i + 2]) - 1) < 1e-6);
    assert.equal(circle[i + 1], 0);
  }
  // Ellipse de Kepler (sans relativité) : départ au périastre, apoastre un demi-tour plus loin,
  // et retour au périastre après un tour — l'orbite se referme.
  const n = 720, e = 0.2;
  const kepler = schwarzschildSatelliteRosette({ e, rsOverA: 0, n, revolutions: 1 });
  const radius = (pts, i) => Math.hypot(pts[3 * i], pts[3 * i + 2]);
  // Rayons ramenés au périastre : 1 au départ, (1 + e) / (1 − e) = 1,5 à l'apoastre.
  assert.ok(Math.abs(radius(kepler, 0) - 1) < 1e-6);
  assert.ok(Math.abs(radius(kepler, n / 2) - 1.5) < 1e-4);
  assert.ok(Math.abs(radius(kepler, n) - 1) < 1e-4);
  // Avec le terme relativiste : après un tour, le satellite n'est pas revenu au périastre (il y arrive plus tard),
  // l'orbite ne se referme plus.
  const rosette = schwarzschildSatelliteRosette({ e, rsOverA: 0.01, n, revolutions: 1 });
  assert.ok(radius(rosette, n) > radius(kepler, n) + 1e-4);
  // L'avance prédite au premier ordre : 3π × rs / p.
  assert.ok(Math.abs(periapsisAdvance(0.01, e) - (3 * Math.PI * 0.01) / (1 - e * e)) < 1e-12);
});
