// Tests du rangement de Ma collection par astre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photosOf } from './collectionPhotos.js';

const data = {
  folders: [
    { id: 'jupiter', name: 'Jupiter', items: [{ id: 'j1', title: 'Jupiter · photo 01' }, { id: 'j2', title: 'Carte aplatie des nuages' }] },
    { id: 'satellites', name: 'Satellites naturels sphériques', items: [
      { id: 's1', title: 'Io' }, { id: 's2', title: 'Dione' }, { id: 's3', title: 'Survol de la Lune par Artemis II (animation)' },
      { id: 's4', title: 'Lune · Artemis II' }, { id: 's5', title: 'Ganymède' },
    ] },
  ],
};

test('dossier au nom de l’astre : tous ses médias', () => {
  assert.deepEqual(photosOf('Jupiter', data).map((p) => p.id), ['j1', 'j2']);
});

test('titre contenant le nom de l’astre, sans accents ni majuscules', () => {
  assert.deepEqual(photosOf('Lune', data).map((p) => p.id), ['s3', 's4']);
  assert.deepEqual(photosOf('Dioné', data).map((p) => p.id), ['s2']);
  assert.deepEqual(photosOf('Io', data).map((p) => p.id), ['s1']);
  assert.equal(photosOf('Io', data)[0].folderName, 'Satellites naturels sphériques');
});

test('mot entier seulement, et rien sans données', () => {
  assert.deepEqual(photosOf('Mars', data), []);
  assert.deepEqual(photosOf('Jupiter', null), []);
});
