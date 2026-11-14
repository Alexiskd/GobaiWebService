// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les quatre fonctions testées.
import { diskWritten, openDisk, trimCount, trimDisk } from './diskCache';

/** Faux Cache Storage : clés rendues dans l'ordre d'enregistrement, comme le vrai. */
// Déclare fakeCache : un faux cache de n fichiers.
function fakeCache(n) {
  // Ses clés, dans l'ordre d'enregistrement.
  const keys = Array.from({ length: n }, (_, i) => `t${i}`);
  // Renvoie la liste des clés, la suppression d'une clé et l'accès direct à la liste.
  return { keys: async () => [...keys], delete: async (k) => { const i = keys.indexOf(k); if (i >= 0) keys.splice(i, 1); return i >= 0; }, list: keys };
// Fin de fakeCache.
}
// tick : attend le tour suivant de la boucle d'événements.
const tick = () => new Promise((r) => setTimeout(r, 0));

// Test : le nombre de fichiers à retirer.
test('ménage : rien sous le plafond, retour à 90 % du plafond au-delà', () => {
  // Sous le plafond : 0.
  assert.equal(trimCount(900, 1000), 0);
  // Au plafond : 0.
  assert.equal(trimCount(1000, 1000), 0);
  // Un de trop : retour à 90 % du plafond.
  assert.equal(trimCount(1001, 1000), 101);
  // Très au-dessus : de même.
  assert.equal(trimCount(5000, 1000), 4100);
  // Sans plafond : 0.
  assert.equal(trimCount(50, 0), 0, 'sans plafond, rien ne sort');
// Fin du test.
});

// Test : l'ordre de sortie.
test('ménage : les fichiers les plus anciens sortent les premiers', async () => {
  // Un cache de 25 fichiers.
  const cache = fakeCache(25);
  // Plafond de 20 : 7 fichiers retirés.
  assert.equal(await trimDisk(Promise.resolve(cache), 20), 7);
  // Il en reste 18.
  assert.equal(cache.list.length, 18);
  // Le plus ancien restant est le huitième.
  assert.equal(cache.list[0], 't7');
  // Le plus récent est toujours là.
  assert.equal(cache.list.at(-1), 't24');
  // Sans cache : 0.
  assert.equal(await trimDisk(Promise.resolve(null), 20), 0, 'pas de cache : rien à faire');
// Fin du test.
});

// Test : le déclenchement du ménage.
test('ménage déclenché au premier fichier de la session, puis à intervalle régulier', async () => {
  // Un cache de 40 fichiers.
  const cache = fakeCache(40);
  // Sa promesse.
  const p = Promise.resolve(cache);
  // Premier fichier de la session : ménage.
  assert.equal(diskWritten('essai', p, 20, 4), true);
  // Attend la fin du ménage.
  await tick();
  // Il reste 18 fichiers.
  assert.equal(cache.list.length, 18);
  // Deuxième fichier : pas de ménage.
  assert.equal(diskWritten('essai', p, 20, 4), false);
  // Troisième fichier : pas de ménage.
  assert.equal(diskWritten('essai', p, 20, 4), false);
  // Quatrième fichier : ménage.
  assert.equal(diskWritten('essai', p, 20, 4), true, 'quatrième fichier');
  // Sans plafond : jamais de ménage.
  assert.equal(diskWritten('sans-plafond', p, 0), false);
// Fin du test.
});

// Test : l'ouverture d'un cache.
test('ouverture : null sans Cache Storage ou si l’ouverture échoue', async () => {
  // Sans stockage : null.
  assert.equal(openDisk('x', undefined), null);
  // Ouverture en échec : null.
  assert.equal(await openDisk('x', { open: async () => { throw new Error('refusé'); } }), null);
  // Un cache d'essai.
  const cache = {};
  // Ouverture réussie : ce cache.
  assert.equal(await openDisk('x', { open: async () => cache }), cache);
// Fin du test.
});
