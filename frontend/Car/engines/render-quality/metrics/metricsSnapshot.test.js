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

// Importe les compteurs de tuiles.
import { EMPTY_TILES, tileMetrics } from './metricsSnapshot.js';

// Test : compteurs des tuiles de la Terre dans le relevé.
test('relevé : compteurs des tuiles de la Terre, à zéro sans couche mesurée', () => {
  // Sans mesure : compteurs vides.
  assert.deepEqual({ ...buildMetrics(0, null, null).tiles }, { ...EMPTY_TILES });
  // Avec une mesure : recopiée, figée.
  const m = buildMetrics(1000, { fps: 60 }, null, { uploadMs: 1.2, tilesPerSec: 14, queued: 30, loading: 6, wanted: 120 });
  // Valeurs recopiées.
  assert.deepEqual({ ...m.tiles }, { uploadMs: 1.2, tilesPerSec: 14, queued: 30, loading: 6, wanted: 120 });
  // Figées.
  assert.ok(Object.isFrozen(m.tiles));
  // Champ manquant : 0.
  assert.equal(tileMetrics({ queued: 3 }).uploadMs, 0);
// Fin du test.
});
