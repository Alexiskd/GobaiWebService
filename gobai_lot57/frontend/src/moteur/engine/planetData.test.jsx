// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la table des caractéristiques et les trois fonctions testées.
import { PLANET_DATA, planetData, planetMass, scientific } from './planetData';
// Importe la table des épaisseurs d'atmosphère.
import { ATMOSPHERE_THICKNESS } from './atmosphereData';
// Importe la table des masses et le rayon de la Terre.
import { BODY_MASS_KG, EARTH_RADIUS_KM } from './gravityMath';

// Rayons moyens en km, pour recouper la densité et la gravité avec la masse.
// Rayons moyens des planètes, en kilomètres.
const RADIUS_KM = { mercury: 2439.7, venus: 6051.8, earth: EARTH_RADIUS_KM, mars: 3389.5, jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622, pluto: 1188.3 };

// Test : chaque fiche est complète.
test('caractéristiques : chaque planète de la fiche est renseignée en entier', () => {
  // Les deux tables décrivent les mêmes planètes.
  assert.deepEqual(Object.keys(PLANET_DATA).sort(), Object.keys(ATMOSPHERE_THICKNESS).sort());
  // Pour chaque planète.
  for (const [id, p] of Object.entries(PLANET_DATA)) {
    // Elle a un type.
    assert.ok(p.type, id);
    // Sa densité et sa gravité sont positives.
    assert.ok(p.density > 0 && p.gravity > 0, id);
    // Sa température, son noyau et son champ magnétique ont une valeur et une note.
    for (const key of ['temperature', 'core', 'magnetic']) assert.ok(p[key].value && p[key].note, `${id}.${key}`);
    // Sa masse est connue.
    assert.ok(planetMass(id), id);
  // Fin du parcours.
  }
  // La Lune n'a pas de fiche.
  assert.equal(planetData('moon'), null);
// Fin du test.
});

// Test : la densité.
test('caractéristiques : la densité correspond à la masse et au rayon', () => {
  // Pour chaque planète.
  for (const [id, p] of Object.entries(PLANET_DATA)) {
    // Son rayon, en centimètres.
    const r = RADIUS_KM[id] * 1e5; // cm
    // Sa densité calculée : la masse en grammes divisée par le volume.
    const density = (BODY_MASS_KG[id] * 1000) / ((4 / 3) * Math.PI * r ** 3);
    // Elle concorde avec la fiche à 2 % près.
    assert.ok(Math.abs(density - p.density) / p.density < 0.02, `${id} : ${density}`);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : la gravité.
test('caractéristiques : la gravité des planètes solides correspond à GM / R²', () => {
  // Pour chaque planète solide.
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'pluto']) {
    // Sa gravité calculée : G fois la masse, divisé par le carré du rayon.
    const g = (6.6743e-11 * BODY_MASS_KG[id]) / (RADIUS_KM[id] * 1000) ** 2;
    // Elle concorde avec la fiche à 2 % près.
    assert.ok(Math.abs(g - PLANET_DATA[id].gravity) / g < 0.02, `${id} : ${g}`);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : la masse et l'écriture scientifique.
test('masse en masses terrestres et écriture scientifique', () => {
  // La Terre : une masse terrestre.
  assert.equal(planetMass('earth').earths, 1);
  // Jupiter : 317,8 masses terrestres.
  assert.ok(Math.abs(planetMass('jupiter').earths - 317.8) < 0.1);
  // Cérès : masse inconnue.
  assert.equal(planetMass('ceres'), null);
  // Un nombre à exposant 23.
  assert.equal(scientific(3.3011e23), '3,30 × 10²³');
  // Un nombre arrondi à trois chiffres.
  assert.equal(scientific(1.8982e27), '1,90 × 10²⁷');
  // Un exposant négatif.
  assert.equal(scientific(2.5e-3), '2,50 × 10⁻³');
// Fin du test.
});
