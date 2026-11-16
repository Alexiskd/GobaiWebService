// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les deux fonctions testées.
import { eclipticOf, interpolateState } from './moonEphemeris';

// Orbite circulaire inclinée de test : 384 400 km, période 27,32 j, table au pas de 30 min comme Horizons.
// Rayon, période (en millisecondes) et inclinaison (en radians) de l'orbite d'essai.
const R = 384400, P = 27.321661 * 86400e3, I = (5.14 * Math.PI) / 180;
// at : position exacte sur cette orbite à l'instant t.
const at = (t) => {
  // Angle parcouru.
  const a = (2 * Math.PI * t) / P;
  // L'instant et les trois coordonnées.
  return { t, x: R * Math.cos(a), y: R * Math.sin(a) * Math.cos(I), z: R * Math.sin(a) * Math.sin(I) };
// Fin de at.
};
// Table de 100 points, un toutes les 30 minutes.
const table = Array.from({ length: 100 }, (_, i) => at(i * 30 * 60e3));

// Test : la précision de l'interpolation.
test('Horizons : interpolation de Catmull-Rom précise au mètre entre deux points de la table', () => {
  // Plus grand écart rencontré.
  let worst = 0;
  // Parcourt la table par pas de 7 minutes et 13 secondes.
  for (let t = table[1].t; t <= table[98].t; t += 7 * 60e3 + 13e3) {
    // Position interpolée et position exacte.
    const p = interpolateState(table, t), e = at(t);
    // Garde le plus grand écart.
    worst = Math.max(worst, Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z));
  // Fin du parcours.
  }
  // L'écart reste sous 5 km.
  assert.ok(worst < 5, `écart maximal ${worst.toFixed(2)} km`); // < 5 km garanti, ≈ quelques mètres en pratique
  // Et même sous 50 mètres.
  assert.ok(worst < 0.05, `écart maximal ${(worst * 1000).toFixed(1)} m`);
// Fin du test.
});

// Test : hors de la table.
test('Horizons : hors de la table → null (repli sur la théorie ELP)', () => {
  // Avant le début : null.
  assert.equal(interpolateState(table, -1), null);
  // Après la fin : null.
  assert.equal(interpolateState(table, table[99].t + 1), null);
  // Table de trois points : null.
  assert.equal(interpolateState(table.slice(0, 3), table[1].t), null);
// Fin du test.
});

// Test : la conversion en coordonnées écliptiques.
test('Horizons : vecteur → longitude, latitude, distance', () => {
  // Un vecteur sur l'axe y.
  const e = eclipticOf({ x: 0, y: 384400, z: 0 });
  // Sa distance est conservée.
  assert.equal(e.distKm, 384400);
  // Longitude de 90°, latitude nulle.
  assert.ok(Math.abs(e.lon - 90) < 1e-9 && Math.abs(e.lat) < 1e-9);
// Fin du test.
});
