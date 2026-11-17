// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { FIRE_KIND, MAX_FIRE_POINTS, buildFireAttributes, confirmedToPoints, fireTileOf, mergeDetailTiles, normalizeFireColumns, tilesAround, viewRadiusDeg } from './fireMath';

// Test : la mise en forme des colonnes du serveur.
test('incendies : les colonnes du serveur deviennent des points, sans valeur illisible', () => {
  // Colonnes d'essai : un point valide, un hors du globe, un illisible.
  const pts = normalizeFireColumns({ lon: [10, 200, 'x'], lat: [45, 0, 1], frp: [12.5, 1, 1], n: [3, 1, 1], ageMin: [30, 0, 0], conf: [0.9, 1, 1] }, FIRE_KIND.cell);
  // Un seul point gardé, mesures recopiées.
  assert.deepEqual(pts, [{ lon: 10, lat: 45, frp: 12.5, ageMin: 30, n: 3, conf: 0.9, kind: FIRE_KIND.cell }]);
  // Réponse vide ou inattendue : aucun point.
  assert.deepEqual(normalizeFireColumns(null, 0), []);
  // Mesures absentes : valeurs neutres (puissance 0, une détection, confiance 1).
  assert.deepEqual(normalizeFireColumns({ lon: [1], lat: [2] }, FIRE_KIND.hotspot)[0], { lon: 1, lat: 2, frp: 0, ageMin: 0, n: 1, conf: 1, kind: FIRE_KIND.hotspot });
// Fin du test.
});

// Test : le maximum de points.
test('incendies : un nuage ne dépasse jamais MAX_FIRE_POINTS', () => {
  // Colonnes démesurées.
  const n = MAX_FIRE_POINTS + 10;
  // Mise en forme.
  const pts = normalizeFireColumns({ lon: new Array(n).fill(1), lat: new Array(n).fill(1) }, 0);
  // Coupé au maximum.
  assert.equal(pts.length, MAX_FIRE_POINTS);
  // Réunion de tuiles : coupée aussi.
  assert.equal(mergeDetailTiles([pts, pts]).length, MAX_FIRE_POINTS);
// Fin du test.
});

// Test : les incendies confirmés.
test('incendies : seuls les événements confirmés deviennent des anneaux, âge compté depuis la réception', () => {
  // Instant de référence.
  const now = Date.UTC(2026, 10, 15, 12);
  // Un incendie confirmé (mis à jour il y a 2 h), un point chaud non confirmé.
  const pts = confirmedToPoints([{ lon: -121.7, lat: 40, confirmed: true, detectedAt: new Date(now - 2 * 3_600_000).toISOString(), intensity: { value: 405 } }, { lon: 0, lat: 0, confirmed: false }], now);
  // Un anneau, âge 120 min, surface en guise de mesure.
  assert.deepEqual(pts, [{ lon: -121.7, lat: 40, frp: 405, ageMin: 120, n: 1, conf: 1, kind: FIRE_KIND.confirmed }]);
// Fin du test.
});

// Test : les tableaux du shader.
test('incendies : tableaux du shader, heure de détection sur l’horloge du calque', () => {
  // Un point d'âge 30 min, reçu à la minute 100 de l'horloge.
  const a = buildFireAttributes([{ lon: 0, lat: 0, frp: 5, ageMin: 30, n: 2, conf: 0.8, kind: 1 }], 100);
  // Un point.
  assert.equal(a.count, 1);
  // Sur l'axe x.
  assert.deepEqual([...a.position].map((v) => Math.round(v * 1e6) / 1e6 + 0), [1, 0, 0]);
  // Puissance, heure de détection (100 − 30), nombre, confiance.
  assert.deepEqual([...a.fire].map((v) => Math.round(v * 1e3) / 1e3), [5, 70, 2, 0.8]);
  // Nature, graine entre 0 et 1.
  assert.ok(a.kind[0] === 1 && a.seed[0] >= 0 && a.seed[0] < 1);
// Fin du test.
});

// Test : les tuiles de détail.
test('incendies : tuiles de 10° comme le serveur, choisies autour du point visé, les plus proches d’abord', () => {
  // Paris : colonne 18, ligne 13.
  assert.deepEqual(fireTileOf(2.35, 48.85), { tx: 18, ty: 13 });
  // Coin du globe : dernière tuile.
  assert.deepEqual(fireTileOf(180, 90), { tx: 35, ty: 17 });
  // Autour de Paris, rayon 10° : la tuile de Paris en premier.
  const list = tilesAround(2.35, 48.85, 10, 16);
  // Première tuile.
  assert.equal(list[0].key, '18,13');
  // Pas plus que le maximum, et quelques voisines.
  assert.ok(list.length > 4 && list.length <= 16);
  // Rayon de vue : borné entre 5 et 35 degrés.
  assert.deepEqual([viewRadiusDeg(0), Math.round(viewRadiusDeg(0.1)), viewRadiusDeg(5)], [5, 25, 35]);
// Fin du test.
});
