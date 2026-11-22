// Importe le lanceur de tests de Node.
import test from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe la construction du relevé et le relevé vide.
import { buildMetrics, EMPTY_METRICS } from './metricsSnapshot.js';

// Le relevé réunit la fenêtre d'images et la sonde du moteur.
test('relevé : fenêtre d’images et sonde réunies', () => {
  // Résumé de fenêtre.
  const frames = { fps: 58, frameMs: 17.2, worstMs: 31 };
  // Mesure de la sonde, au format de PerfProbe.frameEnd.
  const perf = { cpuMs: 6.1, gpuMs: 9.4, calls: 212, triangles: 480000, textures: 140, geometries: 96, heapMb: 210 };
  // Construit le relevé.
  const m = buildMetrics(1000, frames, perf);
  // FPS et temps de frame viennent de la fenêtre.
  assert.equal(m.fps, 58);
  // Temps moyen.
  assert.equal(m.frameMs, 17.2);
  // Appels de dessin et triangles viennent de la sonde.
  assert.equal(m.drawCalls, 212);
  // Triangles.
  assert.equal(m.triangles, 480000);
  // Mémoire GPU : nombres de textures et de géométries.
  assert.deepEqual({ ...m.gpuMemory }, { textures: 140, geometries: 96 });
  // Le relevé est figé.
  assert.ok(Object.isFrozen(m));
// Fin du test.
});

// Sans sonde (premier relevé, ou sonde pas encore publiée) : des zéros, jamais d'erreur.
test('relevé sans sonde : valeurs par défaut', () => {
  // Construit le relevé sans sonde.
  const m = buildMetrics(500, { fps: 30, frameMs: 33.3, worstMs: 40 }, null);
  // Les FPS sont là.
  assert.equal(m.fps, 30);
  // Les compteurs de la sonde valent leurs défauts.
  assert.equal(m.drawCalls, 0);
  // Pas de temps GPU.
  assert.equal(m.gpuMs, null);
// Fin du test.
});

// Le relevé vide a les mêmes champs qu'un relevé réel.
test('relevé vide : mêmes champs qu’un relevé réel', () => {
  // Compare les listes de champs.
  assert.deepEqual(Object.keys(EMPTY_METRICS).sort(), Object.keys(buildMetrics(0, null, null)).sort());
// Fin du test.
});
