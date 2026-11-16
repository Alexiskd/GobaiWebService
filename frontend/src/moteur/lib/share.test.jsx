// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { shareData, shareView } from './share.jsx';

// Données de partage pour Mars.
const data = shareData({ bodyName: 'Mars', url: 'https://www.gobaispace.com/mars' });

// Premier test : le texte partagé.
test('texte partagé : nom de l’astre et nom de l’app', () => {
  // Le titre porte l'astre et l'application.
  assert.equal(data.title, 'Mars · Go白ناन्टех');
  // L'adresse est gardée.
  assert.equal(data.url, 'https://www.gobaispace.com/mars');
  // Sans astre, le titre commence par le nom de l'application.
  assert.match(shareData({ url: 'https://www.gobaispace.com/' }).title, /^Go白ناन्टех/);
// Fin du test.
});

// Deuxième test : la feuille de partage.
test('feuille de partage du téléphone quand elle existe', async () => {
  // Données reçues par le faux navigateur.
  let got = null;
  // Avec une feuille de partage : « shared ».
  assert.equal(await shareView(data, { share: async (d) => { got = d; } }), 'shared');
  // Elle a reçu les données.
  assert.equal(got, data);
  // Erreur « feuille fermée ».
  const abort = Object.assign(new Error('fermé'), { name: 'AbortError' });
  // Feuille fermée : « cancelled ».
  assert.equal(await shareView(data, { share: async () => { throw abort; } }), 'cancelled');
// Fin du test.
});

// Troisième test : la copie du lien.
test('sinon copie du lien ; échec signalé si rien n’est possible', async () => {
  // Lien copié.
  let copied = null;
  // Sans feuille de partage : « copied ».
  assert.equal(await shareView(data, { clipboard: { writeText: async (t) => { copied = t; } } }), 'copied');
  // Le lien copié est le bon.
  assert.equal(copied, data.url);
  // Navigateur dont le partage échoue mais pas la copie.
  const refused = { share: async () => { throw new Error('refusé'); }, clipboard: { writeText: async (t) => { copied = `2:${t}`; } } };
  // Partage refusé : « copied ».
  assert.equal(await shareView(data, refused), 'copied');
  // Ni partage ni copie : « failed ».
  assert.equal(await shareView(data, {}), 'failed');
// Fin du test.
});
