import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer2D } from './render2d.js';
import { locate, modelItinerary } from './modes.js';

// Faux canvas : enregistre les appels de dessin, sans navigateur.
function fakeCanvas() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, name) => (name === 'calls' ? calls : (...args) => { calls.push([name, ...args]); }),
    set: (_, name, value) => { calls.push(['set:' + name, value]); return true; },
  });
  return { calls, canvas: { getContext: () => ctx, getBoundingClientRect: () => ({ width: 400, height: 300 }), width: 0, height: 0 } };
}

const A = { lat: 48.9992, lon: 2.0967 }, G = { lat: 48.9961, lon: 2.0924 }, CDG = { lat: 49.0097, lon: 2.5479 }, JFK = { lat: 40.6413, lon: -73.7781 };
const model = modelItinerary({ segments: [
  { index: 0, mode: 'marche', from: A, to: G, waypoints: [], minutes: 8 },
  { index: 1, mode: 'train', from: G, to: CDG, waypoints: [{ lat: 49, lon: 2.3 }], minutes: 40 },
  { index: 2, mode: 'avion', category: 'vol', from: CDG, to: JFK, waypoints: [], minutes: 480, altitudeKm: 11 },
] });

test('le rendu 2D dessine tracés, repères A et B et véhicule sans erreur, y compris sur une étape seule', () => {
  const { calls, canvas } = fakeCanvas();
  const r = createRenderer2D(canvas);
  r.resize();
  assert.equal(canvas.width, 400 * Math.min(2, 1));
  r.draw(model.tracks, 0.3);
  const texts = calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  assert.ok(texts.includes('A') && texts.includes('B'));
  assert.ok(texts.includes(locate(model.tracks, 0.3).track.glyph), 'pictogramme du véhicule');
  calls.length = 0;
  r.draw([model.tracks[1]], 0.5, { highlight: 0 });
  assert.ok(calls.some((c) => c[0] === 'stroke'));
  calls.length = 0;
  r.draw([], 0);
  assert.ok(!calls.some((c) => c[0] === 'stroke'));
});

test('le rendu 2D supporte un tracé de longueur nulle', () => {
  const { canvas } = fakeCanvas();
  const r = createRenderer2D(canvas);
  const t = modelItinerary({ segments: [{ index: 0, mode: 'marche', from: A, to: { ...A, lat: A.lat + 1e-7 }, minutes: 1 }] });
  r.draw(t.tracks, 1);
});
