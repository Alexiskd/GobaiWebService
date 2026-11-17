// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les deux fonctions testées.
import { siteHeadFor, sitePathFor } from './siteAddress';

// Test : l'adresse dépend de la fenêtre ouverte, puis de l'astre ciblé.
test('adresse du site : fenêtre ouverte, astre ciblé, sinon accueil', () => {
  // Galerie ouverte : /galerie, même si un astre est ciblé.
  assert.equal(sitePathFor({ galleryOpen: true, panel: null, bodyName: 'Mars' }), '/galerie');
  // Panneau des sources ouvert : /node.
  assert.equal(sitePathFor({ galleryOpen: false, panel: 'sources', bodyName: 'Mars' }), '/node');
  // Fenêtre de don ouverte : /faire-un-don.
  assert.equal(sitePathFor({ galleryOpen: false, panel: 'donate', bodyName: 'Mars' }), '/faire-un-don');
  // Aucune fenêtre : l'adresse de l'astre, sans accent ni majuscule.
  assert.equal(sitePathFor({ galleryOpen: false, panel: null, bodyName: 'Vénus' }), '/venus');
  // Astre inconnu : l'accueil.
  assert.equal(sitePathFor({ galleryOpen: false, panel: null, bodyName: 'Inconnu' }), '/');
// Fin du test.
});

// Test : le titre et l'adresse canonique.
test('titre et adresse canonique : les mêmes que ceux du serveur pour la même adresse', () => {
  // Page de Mars : compare l'objet entier (début de l'appel).
  assert.deepEqual(siteHeadFor('/mars', 'Mars'), {
    // Le titre et l'adresse canonique attendus.
    title: 'Mars en 3D et en direct · Système solaire 3D Go白ناन्टех (Gobai Space)', canonical: 'https://www.gobaispace.com/mars',
  // Fin de l'appel.
  });
  // La Terre prend un article dans son titre.
  assert.match(siteHeadFor('/terre', 'Terre').title, /^La Terre en 3D et en direct · /);
  // Titre de la galerie, quel que soit l'astre ciblé.
  assert.equal(siteHeadFor('/galerie', 'Mars').title, 'Galerie d’images du système solaire · Go白ناन्टех (Gobai Space)');
  // Adresse canonique de l'accueil.
  assert.equal(siteHeadFor('/', 'Soleil').canonical, 'https://www.gobaispace.com/');
  // Début du titre de l'accueil.
  assert.match(siteHeadFor('/', 'Soleil').title, /^Système solaire 3D en direct/);
// Fin du test.
});
