// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la liste des crédits et la mise en forme des dates.
import { OPEN_SOURCE_CREDITS, formatRepoDate } from './openSourceCredits.js';

// Tous les crédits qui ont un dépôt.
const repos = OPEN_SOURCE_CREDITS.flatMap(({ items }) => items).filter((item) => item.repo);

// Test : chaque dépôt a une date.
test('chaque dépôt a une date de dernière mise à jour lisible', () => {
  // La date de chaque dépôt est au format AAAA-MM-JJ.
  for (const item of repos) assert.match(item.updated ?? '', /^\d{4}-\d{2}-\d{2}$/, item.repo);
// Fin du test.
});

// Test : aucun dépôt chargé en direct.
test('plus aucun dépôt n’est chargé en direct : three.js, Natural Earth et World Atlas sont importés dans le projet', () => {
  // Aucun dépôt n'est marqué « live ».
  assert.deepEqual(repos.filter((item) => item.live), []);
  // Les dépôts marqués « local » (début de l'appel).
  assert.deepEqual(
    // Leurs noms, triés.
    repos.filter((item) => item.local).map((item) => item.repo).sort(),
    // Ce sont exactement ces trois dépôts.
    ['mrdoob/three.js', 'nvkelso/natural-earth-vector', 'topojson/world-atlas'],
  // Fin de l'appel.
  );
// Fin du test.
});

// Test : la date est écrite en français.
test('formatRepoDate écrit la date en français', () => {
  // Une date simple.
  assert.equal(formatRepoDate('2026-11-10'), '10 nov. 2026');
  // Une date avec heure : seul le jour est gardé.
  assert.equal(formatRepoDate('2026-11-10T23:30:00Z'), '10 nov. 2026');
  // Texte vide : résultat vide.
  assert.equal(formatRepoDate(''), '');
  // Texte qui n'est pas une date : résultat vide.
  assert.equal(formatRepoDate('pas une date'), '');
// Fin du test.
});
