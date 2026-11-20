// Tests de la documentation de l'API : chaque route documentée existe dans un contrôleur NestJS de Computing/api,
// et chaque route d'un contrôleur est documentée. La page ne peut donc plus décrire un backend disparu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { API_DOC_GROUPS, API_DOC_EXAMPLES, API_DOC_RULES, countDocRoutes } from './apiDocs.js';

// Dossier de l'API NestJS, depuis ce fichier de test.
const API_DIR = fileURLToPath(new URL('../../../Computing/api/', import.meta.url));

/** Routes déclarées dans un contrôleur : « GET /tiles/layers/{id} », les paramètres « :id » écrits « {id} ». */
// routesDuControleur : lit le fichier et relève ses décorateurs @Get et @Post.
const routesDuControleur = (fichier) => [...readFileSync(`${API_DIR}${fichier}`, 'utf8').matchAll(/@(Get|Post|Put|Patch|Delete)\('([^']+)'\)/g)]
  .map(([, methode, chemin]) => `${methode.toUpperCase()} ${chemin.replace(/:(\w+)/g, '{$1}')}`);

test('chaque groupe documente exactement les routes de son contrôleur', () => {
  for (const { group, controller, routes } of API_DOC_GROUPS) {
    const documentees = routes.map(([methode, chemin]) => `${methode} ${chemin}`).sort();
    assert.deepEqual(documentees, routesDuControleur(controller).sort(), group);
  }
});

test('aucune route en double, chaque route a une description, et le total correspond', () => {
  const toutes = API_DOC_GROUPS.flatMap((g) => g.routes);
  assert.equal(new Set(toutes.map(([m, p]) => `${m} ${p}`)).size, toutes.length);
  for (const [, chemin, texte] of toutes) assert.ok(texte && texte.length > 5, chemin);
  assert.equal(countDocRoutes(), toutes.length);
});

test('la page ne renvoie plus vers l’ancien backend en ligne', () => {
  const texte = JSON.stringify([API_DOC_RULES, API_DOC_EXAMPLES, API_DOC_GROUPS]);
  assert.ok(!texte.includes('gobaispace.com/api'));
  assert.ok(!texte.includes('/api/v1'));
});
