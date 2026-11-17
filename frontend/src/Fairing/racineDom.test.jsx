// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe la lecture de fichier et la résolution de chemin.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Invariants de la page qui accueille l'application : le DOM de React n'appartient qu'à React.
 *
 * Ces trois règles tiennent ensemble, et une seule édition malheureuse de index.html suffit à les rompre sans
 * que rien d'autre ne le signale — ni les tests de composants, ni le build.
 */
// Le contenu de index.html, à la racine du dossier frontend.
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'), 'utf8');

// Test : la racine est déclarée non traduisible.
test('la racine de React porte translate="no"', () => {
  // La balise ouvrante de la racine.
  const tag = /<div[^>]*id="root"[^>]*>/.exec(html);
  // Elle existe.
  assert.ok(tag, 'aucun élément #root dans index.html');
  // Et elle interdit la traduction : les traducteurs du navigateur ne doivent pas réécrire l'arbre de React,
  // sous peine de lui faire perdre ses nœuds (« Failed to execute removeChild on Node »).
  assert.match(tag[0], /translate="no"/);
// Fin du test.
});

// Test : la racine est vide dans le HTML servi.
test('la racine de React est vide : personne d’autre n’écrit dedans', () => {
  // Rien entre la balise ouvrante et sa fermeture.
  assert.match(html, /<div[^>]*id="root"[^>]*>\s*<\/div>/);
// Fin du test.
});

// Test : le contenu de départ des moteurs de recherche vit à côté, pas dedans.
test('le contenu de départ est hors de la racine de React', () => {
  // Position de la racine et du contenu de départ.
  const root = html.indexOf('id="root"');
  const seo = html.indexOf('id="seo"');
  // Les deux existent.
  assert.ok(root > -1, 'aucun élément #root');
  assert.ok(seo > -1, 'aucun élément #seo');
  // Le contenu de départ vient après la racine…
  assert.ok(seo > root, 'le contenu de départ devrait suivre la racine');
  // … et la racine est bien refermée avant lui : ce sont deux frères, pas un parent et son enfant.
  const close = html.indexOf('</div>', root);
  assert.ok(close > -1 && close < seo, 'la racine de React devrait être refermée avant le contenu de départ');
// Fin du test.
});
