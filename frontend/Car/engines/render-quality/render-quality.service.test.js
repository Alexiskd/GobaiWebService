// Importe le lanceur de tests de Node.
import test from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe le module.
import { createRenderQualityModule } from './render-quality.module.js';

// Une seconde d'images à 20 ms, avec une sonde : un relevé publié, abonnés prévenus une fois.
test('service : un relevé par seconde, abonnés prévenus une fois', () => {
  // Crée le module.
  const { service, dispose } = createRenderQualityModule();
  // Relevés reçus.
  const seen = [];
  // S'abonne.
  service.subscribe((m) => seen.push(m));
  // Sonde du moteur.
  service.recordPerf({ calls: 150, triangles: 90000, textures: 40, geometries: 30 });
  // Première image : ouvre la fenêtre.
  service.recordFrame(0, 0);
  // Une seconde à 20 ms.
  for (let t = 20; t <= 1000; t += 20) service.recordFrame(t, 20);
  // Un seul relevé.
  assert.equal(seen.length, 1);
  // 50 FPS.
  assert.equal(service.getMetrics().fps, 50);
  // Appels de dessin de la sonde.
  assert.equal(service.getMetrics().drawCalls, 150);
  // Libère.
  dispose();
// Fin du test.
});

// Un abonné qui lève une erreur n'empêche pas les autres.
test('service : un abonné en échec n’arrête pas les autres', () => {
  // Crée le module.
  const { service } = createRenderQualityModule();
  // Second abonné prévenu ?
  let ok = false;
  // Abonné en échec.
  service.subscribe(() => { throw new Error('boom'); });
  // Abonné sain.
  service.subscribe(() => { ok = true; });
  // Ouvre la fenêtre.
  service.recordFrame(0, 0);
  // Une seconde à 25 ms.
  for (let t = 25; t <= 1000; t += 25) service.recordFrame(t, 25);
  // Le second a été prévenu.
  assert.equal(ok, true);
// Fin du test.
});

// Après dispose, plus rien n'est mesuré ni publié.
test('service : arrêté, il ne publie plus rien', () => {
  // Crée le module.
  const { service, dispose } = createRenderQualityModule();
  // Relevés reçus.
  let count = 0;
  // S'abonne.
  service.subscribe(() => { count += 1; });
  // Arrête.
  dispose();
  // Une seconde d'images.
  for (let t = 0; t <= 1100; t += 20) service.recordFrame(t, 20);
  // Aucun relevé.
  assert.equal(count, 0);
// Fin du test.
});

// Test : la mesure des tuiles passe dans le relevé de la seconde.
test('service : la dernière mesure des tuiles est publiée avec le relevé', () => {
  // Crée le module.
  const { service, dispose } = createRenderQualityModule();
  // Mesure des tuiles.
  service.recordTiles({ uploadMs: 2, tilesPerSec: 8, queued: 4, loading: 2, wanted: 50 });
  // Première image : ouvre la fenêtre.
  service.recordFrame(0, 0);
  // Une seconde à 20 ms : relevé publié.
  for (let t = 20; t <= 1000; t += 20) service.recordFrame(t, 20);
  // Les tuiles y sont.
  assert.equal(service.getMetrics().tiles.wanted, 50);
  // Libère.
  dispose();
// Fin du test.
});
