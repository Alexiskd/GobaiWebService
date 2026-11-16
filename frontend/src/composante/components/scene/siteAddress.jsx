// Adresse, titre et adresse canonique de ce qui est affiché (fonctions pures, voir useSiteAddress.jsx).
// Importe fold, qui normalise un texte (minuscules, sans accents).
import { fold } from '../../../moteur/lib/format';
// Importe SITE_TREE, l'arborescence du site.
import { SITE_TREE } from '../hud/siteTree';

/** Adresses connues du site (celles de l'arborescence, donc du sitemap). */
// Ensemble des adresses connues, vide au départ.
const KNOWN_PATHS = new Set();
// Fonction récursive appelée tout de suite : parcourt l'arborescence.
(function walk(node) {
  // Ajoute l'adresse du nœud, s'il en a une.
  if (node.path) KNOWN_PATHS.add(node.path);
  // Parcourt ses enfants.
  node.children.forEach(walk);
// Fin du parcours, lancé sur la racine de l'arborescence.
})(SITE_TREE);

/** Fenêtres ayant leur adresse : identifiant du panneau → adresse. */
// Le panneau des sources a l'adresse /node.
const PANEL_PATHS = { sources: '/node', donate: '/faire-un-don' };

/** Adresse de ce qui est affiché : la fenêtre ouverte d'abord, sinon l'astre ciblé, sinon l'accueil. */
// Déclare et exporte sitePathFor : galerie ouverte, panneau ouvert et nom de l'astre.
export function sitePathFor({ galleryOpen, panel, bodyName }) {
  // Galerie ouverte : /galerie.
  if (galleryOpen) return '/galerie';
  // Panneau qui a une adresse : cette adresse.
  if (PANEL_PATHS[panel]) return PANEL_PATHS[panel];
  // Adresse de l'astre : son nom normalisé, précédé d'une barre oblique.
  const path = `/${fold(bodyName || '')}`;
  // Cette adresse si elle est connue, l'accueil sinon.
  return KNOWN_PATHS.has(path) ? path : '/';
// Fin de sitePathFor.
}

// Adresse de base du site.
const SITE_URL = 'https://www.gobaispace.com';
// Titre de la page d'accueil.
const HOME_TITLE = 'Système solaire 3D en direct · ∞ Go白ناन्टех α΄一하나א (Gobai Space)';
// Titres des fenêtres qui ont une adresse (début de l'objet).
const WINDOW_TITLES = {
  // Titre de la galerie.
  '/galerie': 'Galerie d’images du système solaire',
  // Titre de la fenêtre des sources.
  '/node': 'Anthropic Node Open Source : sources des données',
  // Titre de la fenêtre de don.
  '/faire-un-don': 'Dons au développeur de l’application Gobai',
// Fin de l'objet.
};
/** Noms qui prennent un article dans le titre de leur page (comme côté serveur, body-pages.ts). */
// Les trois astres dont le nom prend un article.
const WITH_ARTICLE = { Soleil: 'Le Soleil', Terre: 'La Terre', Lune: 'La Lune' };

/**
 * Titre de l'onglet et adresse canonique de ce qui est affiché, identiques à ceux que le serveur donne à la même
 * adresse : un moteur ou un assistant qui lit la page après navigation voit le bon astre.
 */
// Déclare et exporte siteHeadFor : reçoit l'adresse et le nom de l'astre.
export function siteHeadFor(path, bodyName) {
  // Adresse canonique : la base du site suivie de l'adresse.
  const canonical = `${SITE_URL}${path}`;
  // Accueil : le titre d'accueil.
  if (path === '/') return { title: HOME_TITLE, canonical };
  // Fenêtre : son titre, suivi du nom du site.
  if (WINDOW_TITLES[path]) return { title: `${WINDOW_TITLES[path]} · Go白ناन्टех (Gobai Space)`, canonical };
  // Astre : son nom (avec article s'il en prend un), suivi de la formule commune.
  return { title: `${WITH_ARTICLE[bodyName] || bodyName} en 3D et en direct · Système solaire 3D Go白ناन्टех (Gobai Space)`, canonical };
// Fin de siteHeadFor.
}
