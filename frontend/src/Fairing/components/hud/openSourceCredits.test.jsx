import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OPEN_SOURCE_CREDITS, formatRepoDate, visibleCredits, orgsFromRepos } from './openSourceCredits.js';

const items = OPEN_SOURCE_CREDITS.flatMap(({ items }) => items);

test('les dépôts affichés correspondent uniquement aux dépendances du projet', () => {
  const repos = items.map((item) => item.repo);
  assert.ok(repos.length > 0);
  assert.ok(items.every((item) => item.name && item.repo && Array.isArray(item.people)));
  assert.ok(!items.some((item) => item.updated || item.local || item.live));
  assert.equal(new Set(items.map((item) => item.name)).size, items.length);
});

test('les groupes et entreprises sont dérivés des crédits présents', () => {
  assert.equal(visibleCredits().flatMap(({ items }) => items).length, items.length);
  assert.ok(orgsFromRepos().every(({ org, items: repos }) => org && repos.length));
});

test('formatRepoDate reste sûr pour les valeurs absentes ou invalides', () => {
  assert.equal(formatRepoDate(''), '');
  assert.equal(formatRepoDate('pas une date'), '');
});
