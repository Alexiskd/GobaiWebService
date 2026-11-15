// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la fonction testée.
import { layerSource } from './layerSource.jsx';

// Test : la source de chaque famille de fonds.
test('source de chaque famille de fonds de carte', () => {
  // Fond connu par son identifiant.
  assert.equal(layerSource({ id: 'satellite', provider: 'gibs' }), 'NASA GIBS (Blue Marble)');
  // L'identifiant passe avant le fournisseur.
  assert.equal(layerSource({ id: 'ign-ortho', provider: 'earth-hd' }), 'IGN (Géoplateforme)');
  // Fond connu par son fournisseur.
  assert.equal(layerSource({ id: 'moon-kaguya', provider: 'nasa-trek' }), 'NASA / JPL-Caltech (Moon Trek)');
  // Fournisseur lu dans un identifiant « space-moon-… ».
  assert.equal(layerSource({ id: 'space-moon-usgs-astro-lola-color', provider: 'usgs-astro' }), 'USGS Astrogeology');
  // Le fournisseur le plus long l'emporte (Mercury Trek en WMTS).
  assert.equal(layerSource({ id: 'space-mercury-mercury-trek-wmts-x', provider: 'mercury-trek-wmts' }), 'NASA / JPL-Caltech (Mercury Trek)');
  // Fournisseur lu dans un identifiant « space-mars-… ».
  assert.equal(layerSource({ id: 'space-mars-usgs-astro-mars-mola', provider: 'usgs-astro-mars' }), 'USGS Astrogeology');
  // La Lune réelle.
  assert.equal(layerSource({ id: 'real' }), 'NASA SVS + JAXA (Kaguya)');
// Fin du test.
});

// Test : les satellites.
test('satellites : Treks et USGS', () => {
  // Le fournisseur commun des satellites.
  const p = 'satellite-trek';
  // Description qui cite les Treks : la NASA.
  assert.equal(layerSource({ id: 'io-surface', provider: p, label: 'Io · Mosaïque', description: 'Io : NASA Solar System Treks — Io_x' }), 'NASA / JPL-Caltech (Solar System Treks)');
  // Description qui cite l'USGS : l'USGS.
  assert.equal(layerSource({ id: 'io--usgs', provider: p, label: 'Io · USGS', description: 'Io : USGS Astrogeology — IO' }), 'USGS Astrogeology');
// Fin du test.
});

// Test : source inconnue.
test('source inconnue : null', () => {
  // Un fournisseur nommé « constructor » ne trouve rien (pas de fuite par le prototype).
  assert.equal(layerSource({ id: 'x', provider: 'constructor' }), null);
  // Calque nul : null.
  assert.equal(layerSource(null), null);
// Fin du test.
});
