// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le client HTTP, sans API joignable : le repli local fait foi.
import { ApiError, get, post, resolveApiUrl } from './client.jsx';

// Test : le repli local sur une route de tuiles.
test('renvoie le contrat local des couches de tuiles', async () => {
  // Sans API NestJS joignable, la réponse locale sert le contrat de l'API.
  assert.deepEqual(await get('/tiles/layers'), { provider: 'static', fallback: true, tileSize: 256, layers: [] });
// Fin du test.
});

// Test : le repli local sur une route de scène.
test('renvoie le contrat local des éphémérides', async () => {
  // La Lune reste calculée côté navigateur.
  assert.deepEqual(await get('/ephemeris/moon'), { source: 'local', points: [] });
// Fin du test.
});

// Test : une route inconnue a quand même un contrat de repli.
test('renvoie un repli pour une route sans contrat', async () => {
  // Le repli générique.
  assert.deepEqual(await get('/route/inconnue'), { available: false, items: [] });
// Fin du test.
});

// Test : les écritures restent désactivées côté client.
test('rejette les écritures avec une erreur 503', async () => {
  // L'appel échoue avec l'erreur dédiée.
  await assert.rejects(post('/contributions'), (error) => error instanceof ApiError && error.status === 503);
// Fin du test.
});

// Test : la résolution d'adresse laisse les chemins locaux tels quels.
test('les chemins restent locaux', () => {
  // Un chemin relatif ne bouge pas ; une entrée vide non plus.
  assert.equal(resolveApiUrl('/tiles/layers'), '/tiles/layers');
  assert.equal(resolveApiUrl(''), '');
// Fin du test.
});
