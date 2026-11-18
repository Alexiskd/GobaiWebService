// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les mises en forme de la composante « Contribuer ».
import { formatAge, formatBytes, formatCrs, formatCount, formatDegrees, formatMeters, formatTile, placementState } from './format.jsx';

// Test : les états d'un placement.
test('chaque état de placement a un libellé, une couleur et une teinte', () => {
  // Les trois états connus.
  assert.equal(placementState('valide').color, 'success');
  assert.equal(placementState('conteste').color, 'error');
  assert.equal(placementState('attente').color, 'warning');
  // Un état inconnu retombe sur l'attente.
  assert.equal(placementState('n’importe quoi').label, placementState('attente').label);
  // Chaque état porte une teinte pour le calque 3D.
  for (const status of ['valide', 'conteste', 'attente']) assert.equal(typeof placementState(status).tint, 'number');
// Fin du test.
});

// Test : les nombres.
test('met en forme les nombres, les longueurs et les tailles', () => {
  // Séparateur de milliers français (espace insécable).
  assert.equal(formatCount(16618577).replace(/ | /g, ' '), '16 618 577');
  assert.equal(formatCount(NaN), '—');
  // Mètres et kilomètres.
  assert.equal(formatMeters(72.53), '73 m');
  assert.equal(formatMeters(1000), '1 km');
  assert.equal(formatMeters(undefined), '—');
  // Tailles de fichier.
  assert.equal(formatBytes(0), '0 o');
  assert.equal(formatBytes(1536), '1,5 Kio');
  assert.equal(formatBytes(-1), '—');
// Fin du test.
});

// Test : les coordonnées.
test('met en forme les coordonnées avec leur hémisphère', () => {
  // Nord et est.
  assert.equal(formatDegrees(48.8607816, 'lat'), '48.86078° N');
  assert.equal(formatDegrees(2.3525702, 'lon'), '2.35257° E');
  // Sud et ouest.
  assert.equal(formatDegrees(-33.86, 'lat'), '33.86000° S');
  assert.equal(formatDegrees(-0.5, 'lon'), '0.50000° O');
// Fin du test.
});

// Test : la dalle IGN.
test('nomme la dalle IGN par ses deux numéros', () => {
  // Nom attendu.
  assert.equal(formatTile('LHD_FXX_0652_6863'), 'dalle 0652-6863');
  // Nom inattendu rendu tel quel, absence rendue par null.
  assert.equal(formatTile('autre'), 'autre');
  assert.equal(formatTile(null), null);
// Fin du test.
});

// Test : l'âge d'une publication.
test('dit l’âge d’une publication', () => {
  // Instant de référence.
  const now = Date.UTC(2026, 10, 14, 12, 0, 0);
  // Les paliers.
  assert.equal(formatAge(now - 10_000, now), 'à l’instant');
  assert.equal(formatAge(now - 300_000, now), 'il y a 5 min');
  assert.equal(formatAge(now - 7_200_000, now), 'il y a 2 h');
  assert.equal(formatAge(now - 3 * 86_400_000, now), 'il y a 3 j');
  // Au-delà d'un mois : une date.
  assert.match(formatAge(now - 120 * 86_400_000, now), /\d{2}\/\d{2}\/\d{4}/);
  // Date illisible.
  assert.equal(formatAge('pas une date', now), '');
// Fin du test.
});

// Test : l'origine du système de coordonnées.
test('dit si le système de coordonnées venait du fichier', () => {
  // Déclaré, puis reconnu.
  assert.match(formatCrs('EPSG:2154', 'declare'), /déclaré par le fichier/);
  assert.match(formatCrs('EPSG:2154', 'deduit'), /reconnu à l’emprise/);
// Fin du test.
});
