// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { RAIN_SCALE, animationState, arrowSegments, bearing, blockTiles, dbzOfCode, detailBlock, framesToShow, mercator, normalizeFrames, normalizeStorms, radarLegend, ringSegments } from './radarMath.jsx';

// Test : les images.
test('radar : images triées et contrôlées, animation des dernières ou dernière seule', () => {
  // Réponse d'essai : deux images dans le désordre, une mal formée.
  const frames = normalizeFrames({ frames: [{ id: 'bbbb', time: '2026-11-15T14:10:00Z' }, { id: 'aaaa', time: '2026-11-15T14:00:00Z' }, { id: '../x', time: '2026-11-15T14:20:00Z' }] });
  // Deux images, triées.
  assert.deepEqual(frames.map((f) => f.id), ['aaaa', 'bbbb']);
  // Animation : les deux ; sans animation : la dernière.
  assert.deepEqual([framesToShow(frames).length, framesToShow(frames, false)[0].id], [2, 'bbbb']);
  // Codes : 51 → 40 dBZ ; 0 → aucun écho.
  assert.deepEqual([dbzOfCode(51), dbzOfCode(0)], [40, null]);
// Fin du test.
});

// Test : l'animation.
test('radar : l’animation avance image par image, fond la fin de chaque pas, tient la dernière', () => {
  // Début : première image seule.
  assert.deepEqual(animationState(0, 3, 1, 2), { a: 0, b: 1, mix: 0 });
  // Fin du premier pas : fondu presque complet vers la deuxième.
  assert.ok(animationState(0.99, 3, 1, 2).mix > 0.95);
  // Pause : dernière image.
  assert.deepEqual(animationState(2.5, 3, 1, 2), { a: 2, b: 2, mix: 0 });
  // Boucle : retour au début après 4 s (2 pas + 2 s de pause).
  assert.equal(animationState(4.1, 3, 1, 2).a, 0);
  // Une seule image : pas d'animation.
  assert.deepEqual(animationState(5, 1), { a: 0, b: 0, mix: 0 });
// Fin du test.
});

// Test : le bloc de détail.
test('radar : bloc de détail centré sur le point, passage de l’antiméridien, bornes en latitude', () => {
  // Paris au niveau 5 : x ≈ 16,2, y ≈ 11,3 → bloc (15..16, 10..11).
  const b = detailBlock(2.35, 48.85, 5, 2);
  // Coin, clé et emprise.
  assert.deepEqual([b.x0, b.y0, b.key, b.box[2]], [15, 10, '5/15/10', 2 / 32]);
  // Antiméridien : la colonne −1 est ramenée à 31.
  const a = detailBlock(-179.9, 0, 5, 2);
  // Tuiles ramenées dans la grille.
  assert.deepEqual(blockTiles(a).map((t) => t.x), [31, 0, 31, 0]);
  // Pôle : bloc borné à la grille.
  assert.equal(detailBlock(0, 85, 5, 2).y0, 0);
  // Mercator : (0°, 0°) au centre.
  assert.deepEqual(mercator(0, 0), [0.5, 0.5]);
// Fin du test.
});

// Test : la légende.
test('radar : légende de la pluie avec intensité estimée', () => {
  // Autant de paliers que l'échelle.
  const legend = radarLegend();
  // Paliers et libellés (40 dBZ ≈ 12 mm/h).
  assert.deepEqual([legend.length, legend[5].label], [RAIN_SCALE.length, '45 dBZ ≈ 24 mm/h']);
// Fin du test.
});

// Test : les orages.
test('orages : cellules et avertissements mis en forme, flèche de déplacement et contours', () => {
  // Réponse d'essai.
  const data = { cells: [
    // Cellule forte, suivie, en mouvement vers l'est à 40 km/h.
    { lon: 10, lat: 45, confidence: 0.8, intensity: { value: 52 }, details: { areaKm2: 314, frames: 3, motion: { bearingDeg: 90, speedKmh: 40 } } },
    // Cellule sans position : écartée.
    { lon: null, lat: 1, intensity: { value: 47 } },
  // Avertissement de tornade observé.
  ], warnings: [{ lon: -97.25, lat: 32.7, status: 'observé', geometry: { coordinates: [[[-97.5, 32.5], [-97, 32.5], [-97, 32.9], [-97.5, 32.9], [-97.5, 32.5]]] }, details: { kind: 'tornade', motion: { bearingDeg: 82, speedKmh: 70 } } }] };
  // Mise en forme.
  const s = normalizeStorms(data);
  // Une cellule rouge (≥ 50 dBZ), rayon équivalent 10 km, flèche vers l'est (20 km en 30 min).
  assert.deepEqual([s.cells.length, s.cells[0].color, Math.round(s.cells[0].radiusKm), Math.round(bearing(...s.cells[0].arrow[0], ...s.cells[0].arrow[1]))], [1, '#ff4b3a', 10, 90]);
  // Un avertissement de tornade observé.
  assert.deepEqual([s.warnings.length, s.warnings[0].tornado, s.warnings[0].observed], [1, true, true]);
  // Contour : segments (paires de points de 3 coordonnées), refermé.
  const ring = ringSegments(s.warnings[0].ring, 1, 0.25);
  // Multiple de 6 coordonnées, et dernier point = premier.
  assert.deepEqual([ring.length % 6, ring.slice(-3).every((v, i) => Math.abs(v - ring[i]) < 1e-9)], [0, true]);
  // Flèche : 8 pas + 2 branches = 10 segments de 6 coordonnées.
  assert.equal(arrowSegments(...s.cells[0].arrow).length, 60);
// Fin du test.
});
