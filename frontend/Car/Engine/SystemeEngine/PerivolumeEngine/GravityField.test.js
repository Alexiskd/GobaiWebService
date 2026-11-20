// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le champ gravitationnel des astres.
import {
  BODY_MASS_KG, bodyMassKg, gravitySphereRadius, hillRadius, schwarzschildRadiusOfMass, systemExtents, systemWellSegments, wellDepthM,
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

test('systèmes : seules les planètes qui ont des satellites portent une toupie', () => {
  const extents = systemExtents([
    { parent: 'earth', distance: 60.3 }, { parent: 'jupiter', distance: 66 }, { parent: 'jupiter', distance: 295 },
    { parent: 'mars', distance: 3.7 }, { parent: 'saturn', distance: 0 }, null,
  ]);
  assert.deepEqual([...extents.keys()].sort(), ['earth', 'jupiter', 'mars']);
  assert.equal(extents.get('jupiter'), 295);
  // Mercure et la Lune n'ont aucun satellite : absents.
  assert.equal(extents.has('mercury'), false);
  assert.equal(extents.has('moon'), false);
});
