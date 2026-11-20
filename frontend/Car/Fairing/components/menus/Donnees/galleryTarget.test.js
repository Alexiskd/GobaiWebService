// Tests de la cible de galerie d'une fiche : chaque astre de la Documentation retrouve ses archives NASA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galleryTargetFor, isBodyPhoto } from './galerieData.jsx';

test('Soleil, planètes, planètes naines et satellites ont une cible de galerie', () => {
  const cases = [['Soleil', null, 'sun', 'planet'], ['Jupiter', null, 'jupiter', 'planet'], ['Cérès', null, 'ceres', 'planet'],
    ['Lune', 'Terre', 'moon', 'moon'], ['Amalthée', 'Jupiter', 'amalthea', 'moon'], ['Phœbé', 'Saturne', 'phoebe', 'moon'], ['Nix', 'Pluton', 'nix', 'moon']];
  for (const [name, parent, q, kind] of cases) {
    const t = galleryTargetFor(name, parent);
    assert.ok(t, name);
    assert.equal(t.body.q, q, name);
    assert.equal(t.body.kind, kind, name);
  }
  assert.equal(galleryTargetFor('Inconnue'), null);
});

test('le Soleil passe le filtre des photos sans erreur', () => {
  const t = galleryTargetFor('Soleil');
  assert.equal(isBodyPhoto(t.planet, t.body, { title: 'The Sun in extreme ultraviolet', keywords: ['SDO'] }), true);
  assert.equal(isBodyPhoto(t.planet, t.body, { title: 'Mars rover selfie', keywords: [] }), false);
});
