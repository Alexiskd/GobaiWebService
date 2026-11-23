// Tests des favoris de vues (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FAVORITES_KEY, FAVORITES_MAX, addFavorite, readFavorites, removeFavorite, writeFavorites } from './astre-solide.favorites.js';

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
const fav = (i) => ({ name: `Vue ${i}`, path: '/terre', hash: `#vue=${i},2,2500,0,-90` });

test('favoris : ajout en tête, sans doublon, borné', () => {
  let list = addFavorite([], fav(1));
  list = addFavorite(list, fav(2));
  list = addFavorite(list, fav(1));
  assert.deepEqual(list.map((f) => f.name), ['Vue 1', 'Vue 2']);
  for (let i = 0; i < 40; i++) list = addFavorite(list, fav(i + 10));
  assert.equal(list.length, FAVORITES_MAX);
  assert.deepEqual(addFavorite([], { name: 'x', path: '/terre', hash: '#autre' }), []);
  assert.deepEqual(removeFavorite([fav(1), fav(2)], 0), [fav(2)]);
});

test('favoris : écrits puis relus, contenu illisible ignoré, stockage absent', () => {
  const s = memory();
  assert.equal(writeFavorites(s, [fav(1)]), true);
  assert.deepEqual(readFavorites(s), [fav(1)]);
  s.setItem(FAVORITES_KEY, '{pas du json');
  assert.deepEqual(readFavorites(s), []);
  assert.deepEqual(readFavorites(null), []);
  assert.equal(writeFavorites({ setItem() { throw new Error('plein'); } }, []), false);
});
