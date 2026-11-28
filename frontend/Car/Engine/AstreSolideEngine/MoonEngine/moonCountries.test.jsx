// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { MOON_COUNTRIES, countryAt, countryLabels, countryOfSite, landingSites, moonBorders } from './moonCountries.jsx';

// Test : le rattachement des sites.
test('sites : chaque alunissage revient au pays de sa fusée', () => {
  assert.equal(countryOfSite('Apollo 11').id, 'apollonie');
  assert.equal(countryOfSite('Luna 9').id, 'lunovie');
  assert.equal(countryOfSite('Lunokhod 1').id, 'lunovie');
  assert.equal(countryOfSite('Chang’e 4').id, 'guanghanie');
  assert.equal(countryOfSite('Chandrayaan-3').id, 'chandrapur');
  assert.equal(countryOfSite('SLIM').id, 'kaguyakuni');
  assert.equal(countryOfSite('IM-1 Odysseus').id, 'apollonie');
  // Tous les sites d'alunissage de l'app ont un pays.
  assert.ok(landingSites().length >= 15);
// Fin du test.
});

// Test : le découpage.
test('découpage : le point d’un site est à son pays, frontières entre pays différents', () => {
  // Sur chaque site : son propre pays.
  for (const s of landingSites()) assert.equal(countryAt(s.lon, s.lat), s.country);
  // Des frontières, au format des frontières de la Terre.
  const b = moonBorders();
  assert.ok(b.length > 0);
  assert.ok(b.every((l) => l.length >= 4 && l.length % 2 === 0));
  // Chaque point d'une frontière est à égale distance de deux pays différents : un petit pas de part et d'autre
  // donne deux pays (vérifié sur un point au milieu de la première frontière).
  const l = b[0], k = Math.floor(l.length / 4) * 2, [lon0, lat0, lon1, lat1] = [l[k - 2] ?? l[0], l[k - 1] ?? l[1], l[k], l[k + 1]];
  const dLon = lat1 - lat0, dLat = -(lon1 - lon0), n = Math.hypot(dLon, dLat) || 1;
  const a = countryAt(lon1 + (dLon / n) * 0.5, lat1 + (dLat / n) * 0.5), c = countryAt(lon1 - (dLon / n) * 0.5, lat1 - (dLat / n) * 0.5);
  assert.notEqual(a, c);
// Fin du test.
});

// Test : les noms et leur descendance.
test('noms : un par pays, posés sur la capitale, descendance du plus ancien au pays', () => {
  const labels = countryLabels();
  assert.equal(labels.length, MOON_COUNTRIES.length);
  // Apollonie sur Apollo 11.
  const ap = labels.find((x) => x.id === 'apollonie');
  assert.deepEqual([ap.lon, ap.lat], [23.473, 0.674]);
  // Chaque descendance finit par le nom du pays.
  for (const c of MOON_COUNTRIES) assert.equal(c.descent.at(-1).term, c.name);
// Fin du test.
});
