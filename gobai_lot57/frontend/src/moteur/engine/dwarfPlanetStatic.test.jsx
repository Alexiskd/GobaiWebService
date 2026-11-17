import test from 'node:test';
import assert from 'node:assert/strict';
import { DWARF_PLANETS_DATA } from '../data/astronomy/data/dwarf-planets.data';
import { heliocentricEcliptic } from './planetOrbits';

const JD_2026_11_17 = 2461361.5;
const T_2026 = (JD_2026_11_17 - 2451545) / 36525;

test('Hauméa, Makémaké et Éris sont préchargées dans le catalogue statique', () => {
  const names = DWARF_PLANETS_DATA.map((body) => body.name);
  for (const name of ['Hauméa', 'Makémaké', 'Éris']) assert.ok(names.includes(name), name);
});

test('les trois planètes naines ont des éléments valides et une position calculable sans réseau', () => {
  for (const name of ['Hauméa', 'Makémaké', 'Éris']) {
    const body = DWARF_PLANETS_DATA.find((entry) => entry.name === name);
    assert.ok(body);
    assert.equal(body.dwarf, true);
    assert.equal(body.elements.length, 12);
    assert.ok(body.elements.every(Number.isFinite));
    const position = heliocentricEcliptic(body.elements, T_2026);
    assert.equal(position.length, 3);
    assert.ok(position.every(Number.isFinite), `${name}: ${position}`);
    assert.ok(Math.hypot(...position) > 30, `${name} doit rester dans la ceinture transneptunienne`);
  }
});
