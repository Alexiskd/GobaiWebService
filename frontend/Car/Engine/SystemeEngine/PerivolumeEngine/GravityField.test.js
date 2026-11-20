// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le champ gravitationnel des astres.
import {
  BODY_MASS_KG, bodyMassKg, gravitySphereRadius, hillRadius, schwarzschildRadiusOfMass, systemWellProfile, systemWellSegments, wellDepthM,
} from './GravityField.js';

// Rayon de la Terre en km : l'unité de scène du moteur.
const UNIT_KM = 6378.137;

test('sphère de Hill : la Terre à 1,5 million de km, la Lune à 61 500 km, Mercure à 220 000 km', () => {
  const earth = hillRadius(149_597_870.7, BODY_MASS_KG.earth, BODY_MASS_KG.sun);
  assert.ok(Math.abs(earth - 1_496_000) < 10_000, String(earth));
  const moon = hillRadius(384_400, BODY_MASS_KG.moon, BODY_MASS_KG.earth);
  assert.ok(Math.abs(moon - 61_500) < 1_000, String(moon));
  const mercury = hillRadius(0.38709927 * 149_597_870.7, BODY_MASS_KG.mercury, BODY_MASS_KG.sun);
  assert.ok(Math.abs(mercury - 220_000) < 5_000, String(mercury));
  // Un astre plus lourd à la même distance a une sphère plus grande ; une donnée manquante rend 0.
  assert.ok(hillRadius(1, 8, 1) > hillRadius(1, 1, 1));
  assert.equal(hillRadius(1, 0, 1), 0);
});

test('sphère translucide : la sphère de Hill, jamais plus petite que le minimum donné', () => {
  // Phobos, tout près de Mars : sa sphère de Hill (≈ 17 km) est plus petite que le minimum demandé.
  const phobosHill = hillRadius(9376, bodyMassKg('phobos', 11.08), BODY_MASS_KG.mars);
  assert.ok(phobosHill > 5 && phobosHill < 40, String(phobosHill));
  assert.equal(gravitySphereRadius({ distance: 9376, massKg: bodyMassKg('phobos', 11.08), parentMassKg: BODY_MASS_KG.mars, minimum: 60 }), 60);
  // La Terre : la sphère de Hill l'emporte largement.
  assert.ok(gravitySphereRadius({ distance: 149_597_870.7, massKg: BODY_MASS_KG.earth, parentMassKg: BODY_MASS_KG.sun, minimum: 9567 }) > 1_400_000);
});

test('rayon de Schwarzschild : 2,95 km pour le Soleil, 8,9 mm pour la Terre', () => {
  assert.ok(Math.abs(schwarzschildRadiusOfMass(BODY_MASS_KG.sun) - 2954) < 2);
  assert.ok(Math.abs(schwarzschildRadiusOfMass(BODY_MASS_KG.earth) - 0.00887) < 1e-5);
});

test('toupie d’un système : nulle au bord, la plus creuse au centre, plus creuse pour un astre plus lourd', () => {
  const rsEarth = schwarzschildRadiusOfMass(BODY_MASS_KG.earth), rsJupiter = schwarzschildRadiusOfMass(BODY_MASS_KG.jupiter);
  assert.equal(wellDepthM(4e8, 4e8, rsEarth, 2000), 0);
  // Vers le centre le puits se creuse : la profondeur est plus négative près de l'astre qu'à mi-distance.
  assert.ok(wellDepthM(1e7, 4e8, rsEarth, 2000) < wellDepthM(2e8, 4e8, rsEarth, 2000));
  assert.ok(wellDepthM(1e7, 4e8, rsJupiter, 2000) < wellDepthM(1e7, 4e8, rsEarth, 2000));
  // La géométrie : (anneaux × rayons + rayons × (anneaux − 1)) segments, doublés par le miroir.
  const rings = 14, spokes = 32;
  const segs = systemWellSegments({ outer: 60, inner: 1, unitM: UNIT_KM * 1000, massKg: BODY_MASS_KG.earth, exaggeration: 2000, rings, spokes });
  assert.equal(segs.length, 2 * 6 * (rings * spokes + spokes * (rings - 1)));
  // La seconde moitié est le miroir exact de la première (y inversé).
  const half = segs.length / 2;
  assert.equal(segs[half + 1], -segs[1]);
  assert.equal(segs[half], segs[0]);
  // Tous les points restent dans le rayon du système.
  for (let i = 0; i < segs.length; i += 3) assert.ok(Math.hypot(segs[i], segs[i + 2]) <= 60 + 1e-3);
  // Sans masse ou sans étendue : pas de toupie.
  assert.equal(systemWellSegments({ outer: 0, unitM: 1, massKg: 1, exaggeration: 1 }).length, 0);
});

test('toupie d’un petit astre : étirée jusqu’à l’englober, sans changer de profil', () => {
  const base = { outer: 60, inner: 1, unitM: UNIT_KM * 1000, massKg: BODY_MASS_KG.earth, exaggeration: 2000 };
  const lowest = (segs) => { let min = 0; for (let i = 1; i < segs.length / 2; i += 3) min = Math.min(min, segs[i]); return -min; };
  const natural = lowest(systemWellSegments(base));
  // Le puits réel de la Terre est presque plat à cette échelle : il ne dépasse pas son rayon.
  assert.ok(natural > 0 && natural < 2);
  // Avec un creux minimal de 20 unités, les pointes se referment bien au-delà de l'astre (rayon 1).
  const stretched = systemWellSegments({ ...base, minDepth: 20 });
  assert.ok(Math.abs(lowest(stretched) - 20) < 1e-3);
  // Le bord reste à la hauteur zéro et le rayon ne change pas : seule la hauteur est étirée.
  assert.equal(stretched.length, systemWellSegments(base).length);
  // Un puits déjà plus creux que le minimum n'est pas touché.
  assert.ok(Math.abs(lowest(systemWellSegments({ ...base, minDepth: natural / 2 })) - natural) < 1e-6);
});

test('profil de la toupie : les astres du système descendent sur le cône du bas, d’autant plus qu’ils sont proches du centre', () => {
  // La toupie de la Terre, étirée pour l'englober : rayon 235, creux d'au moins 82 au centre.
  const y = systemWellProfile({ outer: 235, inner: 1, unitM: UNIT_KM * 1000, massKg: BODY_MASS_KG.earth, exaggeration: 2000, minDepth: 82 });
  // Au bord et au-delà (hors du système) : aucune descente.
  assert.equal(y(235), 0);
  assert.equal(y(1000), 0);
  // À la distance de la Lune : une descente franche, mais moindre qu'au ras de la Terre.
  const moon = y(60.3);
  assert.ok(moon < -20 && moon > -82, String(moon));
  assert.ok(Math.abs(y(1) + 82) < 1e-6);
  assert.ok(y(10) < moon);
  // Sous la surface de l'astre, le profil reste celui de sa surface : pas de pointe infinie.
  assert.equal(y(0), y(1));
  // Le profil est celui que dessine la grille : son anneau le plus bas (le premier des 14, de rayon 235 / 14²) est
  // à la hauteur que le profil donne à cette distance.
  const segs = systemWellSegments({ outer: 235, inner: 1, unitM: UNIT_KM * 1000, massKg: BODY_MASS_KG.earth, exaggeration: 2000, minDepth: 82 });
  let lowest = 0;
  for (let i = 1; i < segs.length / 2; i += 3) lowest = Math.min(lowest, segs[i]);
  assert.ok(Math.abs(lowest - y(235 / 196)) < 1e-3);
  // Sans masse : profil plat.
  assert.equal(systemWellProfile({ outer: 10, unitM: 1, massKg: 0, exaggeration: 1 })(5), 0);
});
