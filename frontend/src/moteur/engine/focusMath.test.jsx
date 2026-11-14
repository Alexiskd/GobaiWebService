// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les trois fonctions testées.
import { ORBIT_FRAME, OUTER_ORBIT_RADII, PLANET_ONLY_ZOOM, defaultDistance, defaultZoom, planetZoom } from './focusMath';

// Test : le zoom par défaut des planètes à satellites.
test('zoom par défaut : chaque planète est cadrée sur l’orbite de son satellite le plus éloigné', () => {
  // La Terre : 100.
  assert.equal(defaultZoom('earth'), 100);  // Lune
  // Mars : 11.
  assert.equal(defaultZoom('mars'), 11);    // Deimos
  // Jupiter : 44.
  assert.equal(defaultZoom('jupiter'), 44); // Callisto
  // Saturne : 98.
  assert.equal(defaultZoom('saturn'), 98);  // Japet
  // Uranus : 38.
  assert.equal(defaultZoom('uranus'), 38);  // Obéron
  // Neptune : 24.
  assert.equal(defaultZoom('neptune'), 24); // Triton
  // Pluton : 27.
  assert.equal(defaultZoom('pluto'), 27);   // Charon
// Fin du test.
});

// Test : l'orbite la plus éloignée tient dans la vue.
test('zoom par défaut : l’orbite la plus éloignée tient toujours dans la vue, avec une marge', () => {
  // Pour chaque planète de la table.
  for (const [id, outer] of Object.entries(OUTER_ORBIT_RADII)) {
    // Le zoom dépasse 1,5 fois le rayon de l'orbite.
    assert.ok(defaultZoom(id) > outer * 1.5, id);
    // Il vaut ce rayon multiplié par le facteur de recul, à l'arrondi près.
    assert.ok(Math.abs(defaultZoom(id) - outer * ORBIT_FRAME) <= 0.5, id);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : les autres astres.
test('zoom par défaut : planètes sans satellite à 6×, 10× pour les autres astres (Soleil, Lune, satellites…)', () => {
  // Mercure : 6.
  assert.equal(defaultZoom('mercury'), 6);
  // Vénus : 6.
  assert.equal(defaultZoom('venus'), 6);
  // Le Soleil, la Lune, des satellites et un identifiant absent : 10.
  for (const id of ['sun', 'moon', 'titan', 'phobos', undefined]) assert.equal(defaultZoom(id), 10);
// Fin du test.
});

// Test : la distance par défaut.
test('zoom par défaut : la distance est le zoom multiplié par le rayon, plafonnée', () => {
  // La Terre, rayon 1 : 100.
  assert.equal(defaultDistance('earth', 1), 100);
  // Jupiter, rayon 10 : 440.
  assert.equal(defaultDistance('jupiter', 10), 440);
  // Mars, plafonnée à 4.
  assert.equal(defaultDistance('mars', 0.53, 4), 4);
// Fin du test.
});

// Test : le zoom selon le menu des satellites.
test('zoom d’une planète : système complet menu déplié, planète seule menu replié', () => {
  // Jupiter, menu déplié : 44.
  assert.equal(planetZoom('jupiter'), 44);
  // Jupiter, menu replié : le zoom « planète seule ».
  assert.equal(planetZoom('jupiter', true), PLANET_ONLY_ZOOM);
  // La Terre, menu replié : 6.
  assert.equal(planetZoom('earth', true), 6);
  // Saturne, menu déplié : 98.
  assert.equal(planetZoom('saturn', false), 98);
  // Jamais plus loin que le zoom par défaut de l'astre.
  // Pour chaque planète.
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
    // Le zoom replié ne dépasse jamais le zoom déplié.
    assert.ok(planetZoom(id, true) <= planetZoom(id, false), id);
  // Fin du parcours.
  }
  // Distance de Jupiter seule, rayon 10 : 60.
  assert.equal(defaultDistance('jupiter', 10, Infinity, true), 60);
// Fin du test.
});
