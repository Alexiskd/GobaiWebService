// Tests de l'accord des couleurs entre les niveaux de zoom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL_MAX_SAMPLES, LevelColors, corrected, levelFit } from './levelColors.jsx';
import { ColorStats } from '../earth/earthDirect.jsx';

// Image de 16 pixels (4 × 4) : tons variés autour d'une teinte, décalés par `seed`.
const image = (seed, f = (v) => v) => {
  const d = new Uint8ClampedArray(64);
  for (let i = 0; i < 16; i++) {
    const v = 40 + ((i * 37 + seed * 53) % 170);
    d[4 * i] = f(v, 0); d[4 * i + 1] = f(v * 0.8 + 20, 1); d[4 * i + 2] = f(v * 0.6 + 30, 2); d[4 * i + 3] = 255;
  }
  return d;
};
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('un niveau plus sombre et plus terne que la référence est ramené sur elle', () => {
  const lc = new LevelColors();
  for (let k = 0; k < 6; k++) assert.equal(lc.add(5, image(k, (v) => v * 0.8 + 10), image(k)), true);
  const st = lc.of(5);
  // image fine = référence × 0,8 + 10 → correction attendue : gain 1,25, décalage −12,5 / 255
  for (let c = 0; c < 3; c++) { near(st.gain[c], 1.25, 0.02); near(st.offset[c], -12.5 / 255, 0.01); }
  // une tuile du niveau, corrigée, retrouve les couleurs de la référence
  const fixed = corrected(image(9, (v) => v * 0.8 + 10), st.gain, st.offset), want = image(9);
  for (let i = 0; i < 64; i++) near(fixed[i], want[i], 3);
});

test('des niveaux déjà identiques ne sont pas touchés', () => {
  const lc = new LevelColors();
  for (let k = 0; k < 6; k++) lc.add(7, image(k), image(k));
  for (let c = 0; c < 3; c++) { near(lc.of(7).gain[c], 1, 1e-6); near(lc.of(7).offset[c], 0, 1e-6); }
});

test('pas de correction avant trois mesures, puis correction figée après le maximum', () => {
  const lc = new LevelColors();
  lc.add(4, image(1, (v) => v * 0.8), image(1)); lc.add(4, image(2, (v) => v * 0.8), image(2));
  assert.deepEqual([...lc.of(4).gain], [1, 1, 1]);
  assert.equal(lc.settled(4), false);
  lc.add(4, image(3, (v) => v * 0.8), image(3));
  assert.equal(lc.settled(4), true);
  assert.ok(lc.of(4).gain[0] > 1.2);
  for (let k = 0; k < 40; k++) lc.add(4, image(k, (v) => v * 0.8), image(k));
  assert.equal(lc.of(4).stats.samples, LEVEL_MAX_SAMPLES);
  assert.equal(lc.wants(4), false);
  assert.equal(lc.add(4, image(1), image(1)), false);
});

test('le niveau de référence n\'est jamais corrigé', () => {
  const lc = new LevelColors({ baseZoom: 2 });
  assert.equal(lc.add(2, image(1, (v) => v * 0.5), image(1)), false);
  assert.equal(lc.wants(2), false);
  assert.equal(lc.settled(1), true);
  assert.equal(lc.wants(3), true);
});

test('sur des images presque unies, seul le ton moyen est accordé (pas le contraste)', () => {
  const flat = (base, k) => { const d = new Uint8ClampedArray(64); for (let i = 0; i < 16; i++) { d[4 * i] = d[4 * i + 1] = d[4 * i + 2] = base + ((i + k) % 3); d[4 * i + 3] = 255; } return d; };
  const stats = new ColorStats();
  for (let k = 0; k < 5; k++) stats.add(flat(100, k), flat(120, k * 2));
  const fit = levelFit(stats);
  for (let c = 0; c < 3; c++) { near(fit.gain[c], 1, 1e-6); near(fit.offset[c], 20 / 255, 0.01); }
});

test('la correction reste bornée', () => {
  const lc = new LevelColors();
  for (let k = 0; k < 6; k++) lc.add(6, image(k, (v) => v * 0.2), image(k));
  for (let c = 0; c < 3; c++) { assert.ok(lc.of(6).gain[c] <= 1.35 + 1e-6); assert.ok(Math.abs(lc.of(6).offset[c]) <= 0.2 + 1e-6); }
});

test('la référence est l\'ancêtre le plus grossier aux couleurs connues, à 6 niveaux au plus', () => {
  const lc = new LevelColors();
  const all = () => true;
  assert.deepEqual(lc.reference({ z: 4, x: 9, y: 5 }, all), { z: 0, x: 0, y: 0, key: '0/0/0', depth: 4 });
  // niveau 9 : le niveau 3 (écart 6) n'a pas encore ses couleurs, ni les suivants → aucune référence
  assert.equal(lc.reference({ z: 9, x: 300, y: 200 }, all), null);
  for (let k = 0; k < 3; k++) lc.add(5, image(k), image(k));
  assert.deepEqual(lc.reference({ z: 9, x: 300, y: 200 }, all), { z: 5, x: 18, y: 12, key: '5/18/12', depth: 4 });
  assert.equal(lc.reference({ z: 9, x: 300, y: 200 }, () => false), null);
  assert.equal(lc.reference({ z: 0, x: 0, y: 0 }, all), null);
  assert.deepEqual(lc.crop(256, 4, { x: 300, y: 200 }), { sx: 192, sy: 128, sw: 16, sh: 16 });
});
