// Tests de astre-solide.facts.js : les données du globe lues comme dans la fiche d'information.
import { test } from 'node:test';
// Assertions strictes.
import assert from 'node:assert/strict';
// Fonction testée et constantes.
import { solidBodyFacts, MOON_RADIUS_KM, EARTH_RADIUS_KM } from './astre-solide.facts.js';

// Données réduites, sur le modèle de data.bodies.
const bodies = {
  // La Lune.
  moon: { name: 'Lune', radius: 0.273 },
  // Quelques planètes (rayons en rayons terrestres).
  planets: [{ name: 'Terre', radius: 1, color: '#3d8bff' }, { name: 'Mars', radius: 0.532, color: '#c1440e' }, { name: 'Jupiter', radius: 10.97 }, { name: 'Vénus', radius: 0.95 }],
  // Quelques satellites.
  satellites: [{ id: 'ariel', name: 'Ariel', radiusKm: 578.9, color: '#9a9a9a' }, { id: 'phobos', name: 'Phobos', radiusKm: 11.08 }],
};
// Identifiant d'une planète.
const ids = { Terre: 'earth', Mars: 'mars', Jupiter: 'jupiter', 'Vénus': 'venus' };
// Contexte commun.
const ctx = { bodies, bodyIdOf: (p) => ids[p.name], typeOf: (id) => ({ jupiter: 'Géante gazeuse', mars: 'Planète tellurique', earth: 'Planète tellurique', venus: 'Planète tellurique' })[id] ?? null, atmosphereKmOf: (id) => ({ mars: 200, earth: 600, jupiter: 3000, venus: 250 })[id] ?? null };

// La Lune : rayon de sa fiche, sans air.
test('Lune : rayon de la fiche, sans air', () => {
  // Données.
  const f = solidBodyFacts('moon', ctx);
  // Vérifications.
  assert.equal(f.radiusKm, MOON_RADIUS_KM); assert.equal(f.solid, true); assert.equal(f.airless, true);
});

// Une planète : rayon terrestre × 6 371 km, comme le diamètre de la fiche.
test('Mars : rayon de la fiche, avec atmosphère, couleur de l’interface', () => {
  // Données.
  const f = solidBodyFacts('mars', ctx);
  // Vérifications.
  assert.equal(f.radiusKm, 0.532 * EARTH_RADIUS_KM); assert.equal(f.solid, true); assert.equal(f.airless, false); assert.equal(f.color, '#c1440e');
});

// Une géante : pas de globe.
test('Jupiter : géante, non solide', () => assert.equal(solidBodyFacts('jupiter', ctx).solid, false));

// Vénus : planète tellurique solide, globe CesiumJS comme les autres (fond Venus Trek / USGS, relief GTDR Magellan).
test('Vénus : solide, globe CesiumJS', () => {
  // Données.
  const f = solidBodyFacts('venus', ctx);
  // Vérifications.
  assert.equal(f.solid, true); assert.equal(f.airless, false); assert.equal(f.radiusKm, 0.95 * EARTH_RADIUS_KM);
});

// Un satellite sans carte : solide, rayon de la liste, couleur de l'interface.
test('Ariel : rayon de la liste des satellites', () => {
  // Données.
  const f = solidBodyFacts('ariel', { ...ctx, cfg: { airless: true } });
  // Vérifications.
  assert.equal(f.radiusKm, 578.9); assert.equal(f.solid, true); assert.equal(f.airless, true); assert.equal(f.color, '#9a9a9a');
});

// Phobos : forme irrégulière, modèle 3D gardé.
test('Phobos : irrégulier, non découpé', () => assert.equal(solidBodyFacts('phobos', { ...ctx, cfg: { modelAlways: true } }).solid, false));

// Inconnu sans réglages : rien.
test('astre inconnu : null', () => assert.equal(solidBodyFacts('xyz', ctx), null));
