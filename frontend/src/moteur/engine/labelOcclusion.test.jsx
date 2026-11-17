// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les deux fonctions testées.
import { hiddenBehind, hiddenByAny } from './labelOcclusion';

// at : fabrique une position.
const at = (x, y = 0, z = 0) => ({ x, y, z });
// body : fabrique un astre d'essai, avec sa position et son rayon.
const body = (x, y, z, radius, extra = {}) => ({ pos: at(x, y, z), radius, ...extra });
// La caméra, à l'origine.
const cam = at(0, 0, 0);

// Test : une cible derrière un astre.
test('repère masqué : la cible est derrière l’astre, dans l’axe de la caméra', () => {
  // La Terre devant, la Lune derrière, dans l'axe.
  const earth = body(10, 0, 0, 1), moon = body(70, 0, 0, 0.27);
  // La Lune est cachée par la Terre.
  assert.equal(hiddenBehind(cam, moon, earth), true);
  // La Terre, elle, n'est pas cachée par la Lune qui est derrière elle.
  // La Terre n'est pas cachée par la Lune.
  assert.equal(hiddenBehind(cam, earth, moon), false);
// Fin du test.
});

// Test : les cas visibles.
test('repère visible : la cible dépasse du bord, ou l’astre est derrière la caméra', () => {
  // La Terre.
  const earth = body(10, 0, 0, 1);
  // Cible à côté du disque : visible.
  assert.equal(hiddenBehind(cam, body(70, 8, 0, 0.27), earth), false, 'à côté du disque (7 unités à hauteur de la Terre ≈ 1,1)');
  // Cible juste derrière le bord : cachée.
  assert.equal(hiddenBehind(cam, body(70, 6.9, 0, 0.27), earth), true, 'juste derrière le bord');
  // Astre derrière la caméra : visible.
  assert.equal(hiddenBehind(cam, body(70, 0, 0, 0.27), body(-10, 0, 0, 1)), false, 'astre dans le dos de la caméra');
  // Cible devant l'astre : visible.
  assert.equal(hiddenBehind(cam, body(5, 0, 0, 0.1), earth), false, 'cible devant l’astre');
// Fin du test.
});

// Test : une lune devant sa planète.
test('une lune qui passe devant sa planète ne masque pas le repère de la planète', () => {
  // Jupiter, et Io devant elle.
  const jupiter = body(1000, 0, 0, 11), io = body(993, 0, 0, 0.29);
  // Io ne cache pas Jupiter.
  assert.equal(hiddenBehind(cam, jupiter, io), false);
  // Derrière Jupiter, Io est bien masquée.
  // Derrière Jupiter, Io est cachée.
  assert.equal(hiddenBehind(cam, body(1007, 3, 0, 0.29), jupiter), true);
// Fin du test.
});

// Test : la caméra dans un astre.
test('caméra à l’intérieur d’un astre (géante gazeuse traversée) : il ne masque rien', () => {
  // Il ne cache rien.
  assert.equal(hiddenBehind(cam, body(50, 0, 0, 1), body(0.5, 0, 0, 11)), false);
// Fin du test.
});

// Test : près du sol.
test('près du sol : un astre sous l’horizon est masqué par l’astre survolé', () => {
  // Caméra à 0,001 rayon au-dessus de la Terre (centre à l'origine), Lune de l'autre côté du globe.
  // Caméra juste au-dessus de la Terre.
  const eye = at(0, 1.001, 0), earth = body(0, 0, 0, 1);
  // Astre sous l'horizon : caché.
  assert.equal(hiddenBehind(eye, body(20, -55, 0, 0.27), earth), true);
  // Astre au-dessus de l'horizon : visible.
  assert.equal(hiddenBehind(eye, body(20, 55, 0, 0.27), earth), false, 'au-dessus de l’horizon');
// Fin du test.
});

// Test : une liste d'astres.
test('liste d’astres : la cible elle-même et les astres non dessinés sont ignorés', () => {
  // La Terre et la Lune.
  const earth = body(10, 0, 0, 1), moon = body(70, 0, 0, 0.27);
  // La Lune est cachée par un astre de la liste.
  assert.equal(hiddenByAny(cam, moon, [moon, earth]), true);
  // Si la Terre n'est pas dessinée, elle ne cache rien.
  assert.equal(hiddenByAny(cam, moon, [moon, { ...earth, isHidden: () => true }]), false);
  // La Terre n'est cachée par aucun astre.
  assert.equal(hiddenByAny(cam, earth, [moon, earth]), false);
// Fin du test.
});
