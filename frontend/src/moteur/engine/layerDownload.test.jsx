// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les deux fonctions testées.
import { DOWNLOAD_ZOOM, layerFileName } from './layerDownload.jsx';

// Test : le nom du fichier téléchargé.
test('nom du fichier téléchargé : astre et couche, sans accent', () => {
  // Astre et couche en minuscules, reliés par des tirets, avec l'extension .png.
  assert.equal(layerFileName('Terre', 'Satellite HD'), 'terre-satellite-hd.png');
  // Les accents et les signes sont retirés.
  assert.equal(layerFileName('Encelade', 'Mosaïque globale · USGS'), 'encelade-mosaique-globale-usgs.png');
  // Sans astre ni couche : « carte.png ».
  assert.equal(layerFileName('', ''), 'carte.png');
// Fin du test.
});

// Test : le niveau de zoom de la carte téléchargée.
test('zoom de la carte téléchargée : 4096 × 2048 px sur tous les appareils', () => {
  // Niveau 4.
  assert.equal(DOWNLOAD_ZOOM, 4);
// Fin du test.
});
