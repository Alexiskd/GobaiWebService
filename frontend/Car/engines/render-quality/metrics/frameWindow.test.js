// Importe le lanceur de tests de Node.
import test from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe la fenêtre de mesure.
import { FrameWindow, GAP_MS } from './frameWindow.js';

// Envoie `n` images espacées de `dt` ms à partir de `t0` ; renvoie le dernier résumé et l'instant atteint.
function feed(win, t0, n, dt) {
  // Instant courant.
  let t = t0;
  // Dernier résumé rendu.
  let last = null;
  // Chaque image.
  for (let i = 0; i < n; i += 1) {
    // Avance le temps.
    t += dt;
    // Enregistre l'image ; garde un résumé s'il y en a un.
    last = win.record(t, dt) || last;
  // Fin des images.
  }
  // Rend le résumé et l'instant.
  return { last, t };
// Fin de feed.
}

// 60 images régulières sur une seconde : 60 FPS, 16,7 ms.
test('60 images par seconde régulières : 60 FPS et 16,7 ms', () => {
  // Une fenêtre neuve.
  const win = new FrameWindow();
  // Ouvre la fenêtre à t = 0.
  win.record(0, 0);
  // Une seconde à 1000/60 ms.
  const { last } = feed(win, 0, 61, 1000 / 60);
  // Un résumé a été rendu.
  assert.ok(last);
  // 60 FPS.
  assert.equal(last.fps, 60);
  // 16,7 ms.
  assert.equal(last.frameMs, 16.7);
// Fin du test.
});

// Avant la fin de la seconde, rien n'est rendu.
test('rien avant la fin de la seconde', () => {
  // Une fenêtre neuve.
  const win = new FrameWindow();
  // Ouvre la fenêtre.
  win.record(0, 0);
  // Une demi-seconde d'images.
  const { last } = feed(win, 0, 30, 16);
  // Aucun résumé.
  assert.equal(last, null);
// Fin du test.
});

// Un intervalle d'onglet caché ne fausse pas la moyenne.
test('un intervalle trop long (onglet caché) est ignoré', () => {
  // Une fenêtre neuve.
  const win = new FrameWindow();
  // Ouvre la fenêtre.
  win.record(0, 0);
  // Un trou plus long que GAP_MS.
  win.record(GAP_MS + 100, GAP_MS + 100);
  // Puis des images à 20 ms jusqu'à fermer la fenêtre.
  const { last } = feed(win, GAP_MS + 100, 40, 20);
  // 50 FPS : le trou n'a pas compté.
  assert.equal(last.fps, 50);
  // Le plus lent est 20 ms, pas le trou.
  assert.equal(last.worstMs, 20);
// Fin du test.
});

// L'image la plus lente est gardée.
test('image la plus lente de la seconde', () => {
  // Une fenêtre neuve.
  const win = new FrameWindow();
  // Ouvre la fenêtre.
  win.record(0, 0);
  // Une image lente de 80 ms.
  win.record(80, 80);
  // Puis des images à 16 ms.
  const { last } = feed(win, 80, 60, 16);
  // 80 ms retenu.
  assert.equal(last.worstMs, 80);
// Fin du test.
});
