// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le choix du système visé par un clic.
import { pickSystem, rayHitsSphere } from './systemPick.js';

// La caméra à l'origine, qui regarde vers −z.
const O = [0, 0, 0], AHEAD = [0, 0, -1];

test('rayon et sphère : traversée devant la caméra seulement', () => {
  // Sphère droit devant.
  assert.equal(rayHitsSphere(O, AHEAD, [0, 0, -100], 10), true);
  // Sphère derrière la caméra : jamais visée.
  assert.equal(rayHitsSphere(O, AHEAD, [0, 0, 100], 10), false);
  // Le rayon passe à côté.
  assert.equal(rayHitsSphere(O, AHEAD, [20, 0, -100], 10), false);
  // Il frôle le bord : encore dedans.
  assert.equal(rayHitsSphere(O, AHEAD, [9.9, 0, -100], 10), true);
  // La caméra est dans la sphère : le rayon en sort devant.
  assert.equal(rayHitsSphere(O, AHEAD, [0, 0, 5], 10), true);
  // Rayon nul ou négatif : pas de sphère.
  assert.equal(rayHitsSphere(O, AHEAD, [0, 0, -100], 0), false);
});

test('clic sur un système : son astre principal, le plus gros quand les systèmes sont emboîtés', () => {
  const earth = { id: 'earth', center: [0, 0, -1000], radius: 235 };
  const moon = { id: 'moon', center: [60, 0, -1000], radius: 9.6 };
  const mars = { id: 'mars', center: [5000, 0, -1000], radius: 170 };
  // Clic dans le système de la Terre, loin de la Lune : la Terre.
  assert.equal(pickSystem(O, AHEAD, [earth, moon, mars]).id, 'earth');
  // Clic qui traverse aussi la sphère de la Lune : toujours la Terre, l'astre le plus gros du système.
  const towardMoon = [60 / Math.hypot(60, 1000), 0, -1000 / Math.hypot(60, 1000)];
  assert.equal(pickSystem(O, towardMoon, [earth, moon, mars]).id, 'earth');
  // Clic dans le vide : rien.
  assert.equal(pickSystem(O, [0, 1, 0], [earth, moon, mars]), null);
  // La caméra est dans le système de la Terre et vise Jupiter au loin : la sphère de la Terre, traversée de
  // l'intérieur, ne compte pas, même si elle est plus petite.
  const around = { id: 'earth', center: [0, 0, 50], radius: 235 };
  const jupiter = { id: 'jupiter', center: [0, 0, -90000], radius: 8300 };
  assert.equal(pickSystem(O, AHEAD, [around, jupiter]).id, 'jupiter');
  // Et un clic dans le vide, depuis l'intérieur d'un système, ne vise rien.
  assert.equal(pickSystem(O, [0, 1, 0], [around, jupiter]), null);
  // Entrées invalides ignorées.
  assert.equal(pickSystem(O, AHEAD, [null, { id: 'x', radius: 5 }]), null);
});

test('système de Jupiter : un satellite au bord de la sphère, qui dépasse devant, renvoie quand même à Jupiter', () => {
  const jupiter = { id: 'jupiter', center: [0, 0, -100000], radius: 8000 };
  // Ganymède près du bord avant de la sphère de Jupiter, sa petite sphère dépasse vers la caméra.
  const ganymede = { id: 'ganymede', center: [0, 0, -92050], radius: 100 };
  const mars = { id: 'mars', center: [0, 0, -40000], radius: 170 };
  assert.equal(pickSystem(O, AHEAD, [jupiter, ganymede]).id, 'jupiter');
  // Mars devant Jupiter sur la même ligne de visée : le système le plus proche, Mars.
  assert.equal(pickSystem(O, AHEAD, [jupiter, ganymede, mars]).id, 'mars');
});
