// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe la mise en forme du catalogue.
import { badgesOf, bodyOfProduct, jsSnippet, pathOfScope, sectionOfProduct, sectionsOf } from './sections.jsx';

// Test : l'astre d'un article.
test('lit l’astre d’un article', () => {
  // Un article d'astre.
  assert.equal(bodyOfProduct('body-mars'), 'mars');
  // Un article d'orbite, Soleil compris.
  assert.equal(bodyOfProduct('orbit-soleil'), 'soleil');
  // Les articles groupés n'ont pas d'astre.
  assert.equal(bodyOfProduct('tiles'), null);
  assert.equal(bodyOfProduct('all'), null);
  // Une valeur qui n'est pas un texte.
  assert.equal(bodyOfProduct(undefined), null);
// Fin du test.
});

// Test : le rayon d'un article.
test('range chaque article dans son rayon', () => {
  // Les astres.
  assert.equal(sectionOfProduct('body-terre'), 'astres');
  assert.equal(sectionOfProduct('body-soleil'), 'astres');
  // Les orbites, et la position du Soleil avec elles.
  assert.equal(sectionOfProduct('orbit-mars'), 'orbites');
  assert.equal(sectionOfProduct('orbit-soleil'), 'orbites');
  // Les fonds de carte et l'ensemble.
  assert.equal(sectionOfProduct('tiles'), 'cartes');
  assert.equal(sectionOfProduct('all'), 'tout');
// Fin du test.
});

// Test : le catalogue rangé.
test('range le catalogue en rayons, dans l’ordre, sans rayon vide', () => {
  // Un catalogue réduit, dans un ordre quelconque.
  const produits = [
    { id: 'all', label: 'Tout' },
    { id: 'orbit-soleil', label: 'Position du Soleil', hourly: true },
    { id: 'body-mars', label: 'Mars', tiled: true },
    { id: 'body-soleil', label: 'Soleil', tiled: false },
  ];
  // Les astres tels que l'API les décrit.
  const astres = [
    { key: 'mars', name: 'Mars', hasTiles: true, hasOrbit: true },
    { key: 'soleil', name: 'Soleil', hasTiles: false, hasOrbit: false },
  ];
  // Les rayons.
  const rayons = sectionsOf(produits, astres);
  // Trois rayons seulement : « cartes » est vide et disparaît.
  assert.deepEqual(rayons.map((s) => s.id), ['astres', 'orbites', 'tout']);
  // Les deux astres sont dans le premier rayon, dans l'ordre reçu.
  assert.deepEqual(rayons[0].products.map((p) => p.id), ['body-mars', 'body-soleil']);
  // Chaque article d'astre porte l'astre que l'API décrit.
  assert.equal(rayons[0].products[1].body.hasOrbit, false);
  // Chaque rayon a son titre.
  assert.ok(rayons[0].title.length > 0);
// Fin du test.
});

// Test : les badges d'un article.
test('dit ce que chaque article contient', () => {
  // Un astre tuilé : le modèle et son fond de carte.
  assert.deepEqual(badgesOf({ id: 'body-mars', section: 'astres', tiled: true }), ['modèle 3D (GLB)', 'fond de carte']);
  // Le Soleil : le modèle seul, et c'est dit.
  assert.deepEqual(badgesOf({ id: 'body-soleil', section: 'astres', tiled: false }), ['modèle 3D (GLB)', 'sans fond de carte']);
  // Une location : le badge de la location vient en premier.
  assert.deepEqual(badgesOf({ id: 'orbit-mars', section: 'orbites', hourly: true }), ['loué à l’heure']);
  // L'ensemble : les deux.
  assert.deepEqual(badgesOf({ id: 'all', section: 'tout' }), ['modèle 3D (GLB)', 'fonds de carte']);
// Fin du test.
});

// Test : la route ouverte par un droit.
test('donne la route que chaque droit ouvre', () => {
  // Le modèle 3D d'un astre.
  assert.equal(pathOfScope('body:mars'), '/export/bodies/mars/model.glb');
  // Le fond de carte d'un astre.
  assert.equal(pathOfScope('tiles:terre'), '/export/bodies/terre/tiles.jpg');
  // Le calcul d'orbite.
  assert.equal(pathOfScope('orbit:soleil'), '/export/orbits?body=soleil&steps=365');
  // Les droits groupés donnent un exemple.
  assert.equal(pathOfScope('tiles'), '/export/bodies/terre/tiles.jpg');
  assert.equal(pathOfScope('all'), '/export/bodies/mars/model.glb');
  // Un droit inconnu n'ouvre rien.
  assert.equal(pathOfScope('autre'), null);
// Fin du test.
});

// Test : l'exemple de code.
test('écrit un exemple JavaScript qui porte le jeton et la bonne route', () => {
  // Un achat de modèle 3D.
  const modele = jsSnippet('https://www.gobaispace.com/api/v1', ['body:mars']);
  // Il appelle la route du modèle…
  assert.ok(modele.includes('/export/bodies/mars/model.glb'));
  // … avec le jeton en en-tête…
  assert.ok(modele.includes('Authorization: `Bearer ${jeton}`'));
  // … et récupère un fichier.
  assert.ok(modele.includes('reponse.blob()'));
  // Un achat d'orbite rend du JSON.
  const orbite = jsSnippet('https://www.gobaispace.com/api/v1', ['orbit:soleil']);
  assert.ok(orbite.includes('reponse.json()'));
  assert.ok(orbite.includes('body=soleil'));
  // Un jeton sans droit exploitable ne donne aucun exemple.
  assert.equal(jsSnippet('https://exemple.fr/api/v1', ['autre']), '');
// Fin du test.
});

// Test : l'explication des réglages manquants.
test('explique chaque réglage manquant, et nomme ceux qu’il ne connaît pas', async () => {
  // La table et la fonction.
  const { MISSING_SETTINGS, missingLabel } = await import('./sections.jsx');
  // Les deux réglages qui ferment le paiement sont expliqués.
  assert.ok(MISSING_SETTINGS.STRIPE_SECRET_KEY.includes('Stripe'));
  assert.ok(MISSING_SETTINGS.SESSION_SECRET.includes('signe les clés'));
  // La fonction rend la phrase de la table…
  assert.equal(missingLabel('SESSION_SECRET'), MISSING_SETTINGS.SESSION_SECRET);
  // … et, pour un réglage inconnu, une phrase qui le nomme quand même plutôt que de rester muette.
  assert.match(missingLabel('AUTRE_CHOSE'), /AUTRE_CHOSE/);
// Fin du test.
});
