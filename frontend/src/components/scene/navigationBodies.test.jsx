import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationBodies } from './navigationBodies.jsx';

const bodies = {
  sun: { name: 'Soleil' },
  planets: [
    { name: 'Mercure' }, { name: 'Vénus' }, { name: 'Terre', earth: true },
    { name: 'Mars' }, { name: 'Jupiter' }, { name: 'Saturne' },
    { name: 'Uranus' }, { name: 'Neptune' },
  ],
  moon: { name: 'Lune' },
};

test('la Lune est un satellite de la Terre sans modifier les indices du moteur', () => {
  const nav = navigationBodies(bodies);
  assert.deepEqual(nav.map(({ name, number, index }) => [name, number, index]), [
    ['Soleil', '01', 0], ['Mercure', '02', 1], ['Vénus', '03', 2],
    ['Terre', '04', 3], ['Lune', '04 bis', 9], ['Mars', '05', 4],
    ['Jupiter', '06', 5], ['Saturne', '07', 6], ['Uranus', '08', 7], ['Neptune', '09', 8],
  ]);
  assert.equal(nav[4].parentIndex, nav[3].index);
});

test('sans Terre, la Lune reste accessible à la fin de la liste', () => {
  const nav = navigationBodies({ ...bodies, planets: bodies.planets.filter((planet) => !planet.earth) });
  assert.deepEqual(nav.at(-1), { index: 8, name: 'Lune', color: '#d8d2c4', number: '09' });
});
