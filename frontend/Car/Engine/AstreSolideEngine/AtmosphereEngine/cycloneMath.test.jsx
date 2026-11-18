// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { MAX_CYCLONES, RADII_STYLE, cycloneSummary, dashAlphas, destination, localFrame, normalizeCyclones, normalizeRadii, radiiOutline, spinOf, styleOf, trackAlphas, trackPositions, vortexRadiusKm } from './cycloneMath.jsx';

// near : deux nombres égaux à une tolérance près.
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Test : le nettoyage de la liste.
test('cyclones : la liste garde les cyclones valides, leur trajectoire lisible et leur sens de rotation', () => {
  // Liste d'essai : un cyclone du sud, un hors du globe, un doublon.
  const list = normalizeCyclones([
    // Cyclone de l'hémisphère sud, catégorie 2, trajectoire avec une position illisible.
    { id: 'c1', name: 'Freddy', lon: 50, lat: -20, flags: ['contradiction : vent'], details: { category: 'C2', windKt: 90, pressureMb: 960, track: [[52, -19, 1, 80], [51, -19.5, 2, 85], ['x', 0]] } },
    // Hors du globe.
    { id: 'c2', lon: 10, lat: 100 },
    // Doublon.
    { id: 'c1', lon: 50, lat: -20 },
  // Fin de la liste.
  ]);
  // Un seul cyclone.
  assert.equal(list.length, 1);
  // Catégorie, vent, pression, rotation horaire (sud), deux positions lisibles, alerte gardée.
  assert.deepEqual([list[0].category, list[0].windKt, list[0].pressureMb, list[0].spin, list[0].track.length, list[0].flags.length], ['C2', 90, 960, -1, 2, 1]);
  // Catégorie inconnue : NC.
  assert.equal(normalizeCyclones([{ id: 'x', lon: 0, lat: 10, details: { category: 'Z' } }])[0].category, 'NC');
  // Maximum respecté.
  assert.equal(normalizeCyclones(Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, lon: i, lat: 10 }))).length, MAX_CYCLONES);
// Fin du test.
});

// Test : sens de rotation et styles.
test('cyclones : antihoraire au nord, horaire au sud ; style par catégorie, gris si inconnue', () => {
  // Sens.
  assert.deepEqual([spinOf(15), spinOf(-15)], [1, -1]);
  // Catégorie 5 plus grande et avec un œil plein ; inconnue : grise.
  assert.ok(styleOf('C5').radiusKm > styleOf('TS').radiusKm && styleOf('C5').eye === 1 && styleOf('?').color === '#c8c8c8');
// Fin du test.
});

// Test : le repère local.
test('cyclones : le repère local est orthonormé et direct (est × nord = haut)', () => {
  // Repère au-dessus de 20° N, 140° E.
  const { up, east, north } = localFrame(140, 20);
  // Produit vectoriel est × nord.
  const cross = [east[1] * north[2] - east[2] * north[1], east[2] * north[0] - east[0] * north[2], east[0] * north[1] - east[1] * north[0]];
  // Égal au haut.
  assert.ok(cross.every((v, i) => near(v, up[i])));
  // Nord : composante y positive (vers le pôle).
  assert.ok(north[1] > 0);
  // Est unitaire et perpendiculaire au haut.
  assert.ok(near(Math.hypot(...east), 1) && near(east[0] * up[0] + east[1] * up[1] + east[2] * up[2], 0));
// Fin du test.
});

// Test : la trajectoire.
test('cyclones : la trajectoire suit le grand cercle au-dessus du sol, opacités de l’ancien au présent', () => {
  // Deux positions à 10° d'écart sur l'équateur.
  const p = trackPositions([[0, 0], [10, 0]], 1.002, 1);
  // 1 + 10 points.
  assert.equal(p.length / 3, 11);
  // Chaque point au rayon voulu (jamais sous le sol).
  for (let i = 0; i < p.length; i += 3) assert.ok(near(Math.hypot(p[i], p[i + 1], p[i + 2]), 1.002, 1e-5));
  // Opacités : de 0,25 à 1.
  const a = trackAlphas(4);
  // Bornes.
  assert.ok(near(a[0], 0.25) && near(a[3], 1));
  // Un seul point : pleine opacité.
  assert.equal(trackAlphas(1)[0], 1);
// Fin du test.
});

// Test : le texte court.
test('cyclones : texte court avec catégorie, vent en kt et km/h, pression', () => {
  // Cyclone de catégorie 2.
  assert.equal(cycloneSummary({ name: 'Freddy', category: 'C2', windKt: 90, pressureMb: 960 }), 'Freddy · C2 90 kt (167 km/h) · 960 hPa');
  // Intensité inconnue.
  assert.equal(cycloneSummary({ name: '', category: 'NC', windKt: null, pressureMb: null }), 'Sans nom · intensité inconnue');
// Fin du test.
});

// Test : la prévision et les rayons lus.
test('cyclones : prévision officielle et rayons de vent lus, valeurs illisibles écartées', () => {
  // Cyclone du NHC avec prévision et rayons.
  const [c] = normalizeCyclones([{ id: 'e', name: 'Ernesto', lon: -65.2, lat: 29, details: { category: 'C1', windKt: 75, windRadiiKm: { 34: [389, 370, 259, 296], 50: [204, 185, 111, 148], 64: [74, 74, 37, 'x'] }, forecast: { issuedAt: '2026-08-16T12:00:00.000Z', points: [{ lon: -65.2, lat: 29, t: 0, windKt: 75, category: 'C1' }, { lon: -64.2, lat: 33.5, t: 86_400_000, windKt: 90, category: 'C2' }, { lon: 999, lat: 0 }] } } }]);
  // Deux échéances lisibles, catégorie de la seconde.
  assert.deepEqual([c.forecast.length, c.forecast[1][4]], [2, 'C2']);
  // Seuils lisibles : 34 et 50 (64 a un rayon illisible).
  assert.deepEqual(Object.keys(c.radii), ['34', '50']);
  // Taille réelle : rayon moyen des vents de 34 nœuds.
  assert.equal(Math.round(vortexRadiusKm(c)), Math.round((389 + 370 + 259 + 296) / 4));
  // Sans rayons : le symbole de la catégorie.
  assert.equal(vortexRadiusKm({ category: 'C3', radii: null }), 360);
  // Texte court : prévision sur 1 jour et rayons.
  assert.match(cycloneSummary(c), /prévision sur 1 j · rayons de vent$/);
  // Rayons entièrement nuls : aucun seuil.
  assert.equal(normalizeRadii({ 34: [0, 0, 0, 0] }), null);
  // Couleurs des trois seuils.
  assert.deepEqual(Object.keys(RADII_STYLE), ['34', '50', '64']);
// Fin du test.
});

// Test : la géométrie des rayons.
test('cyclones : contour des vents par quadrant, à la bonne distance du centre, fermé', () => {
  // 111,2 km plein nord depuis l'équateur : 1° de latitude.
  const [lon, lat] = destination(0, 0, 0, (Math.PI / 180) * 6371);
  // Contrôle.
  assert.ok(near(lon, 0, 1e-9) && near(lat, 1, 1e-9));
  // Contour : rayons de 100, 200, 300 et 0 km.
  const p = radiiOutline(0, 0, [100, 200, 300, 0], 1, 6);
  // Quatre quarts de 16 points, plus la fermeture.
  assert.equal(p.length / 3, 4 * 16 + 1);
  // Distance au centre du point à 45° (quadrant NE) : 100 km.
  const k = 8 * 3, ang = Math.acos(Math.min(1, p[k])) * 6371;
  // Contrôle (le centre est sur l'axe x).
  assert.ok(near(ang, 100, 0.5), String(ang));
  // Fermé : dernier point = premier.
  assert.deepEqual([...p.slice(-3)], [...p.slice(0, 3)]);
  // Pointillés : deux points allumés, deux éteints.
  assert.deepEqual([...dashAlphas(6, 2, 2, 1)], [1, 1, 0, 0, 1, 1]);
// Fin du test.
});
