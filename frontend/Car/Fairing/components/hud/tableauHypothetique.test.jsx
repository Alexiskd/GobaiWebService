// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le module du tableau hypothétique.
import { SYSTEMES, ALPHA_CENTAURI, countSystemes, countComposantes, countMonoEtoiles, countMultiples } from './tableauHypothetique.js';

// Test : le tableau hypothétique contient le Système solaire (rang 0) plus les 48 systèmes voisins, rangs 0 à 48.
test('49 systèmes : rang 0 (Système solaire) à rang 48 (40 Eridani)', () => {
  // 49 systèmes, rangs 0 à 48 sans trou ni doublon.
  assert.equal(countSystemes(), 49);
  assert.deepEqual(SYSTEMES.map((s) => s.rang), Array.from({ length: 49 }, (_, i) => i));
  // Le rang 0 est le Système solaire, le rang 48 est 40 Eridani.
  assert.equal(SYSTEMES[0].nom, 'Système solaire');
  assert.equal(SYSTEMES[48].nom, '40 Eridani');
// Fin du test.
});

// Test : chaque système a un code, au moins une composante, et chaque composante a type, distance et masse.
test('chaque système et chaque composante est complète', () => {
  // Parcourt les systèmes.
  for (const s of SYSTEMES) {
    // Un code court et au moins une composante.
    assert.ok(s.code && s.composantes.length >= 1, s.nom);
    // Chaque composante a un nom, un type, une distance et une masse.
    for (const c of s.composantes) assert.ok(c.nom && c.type && c.distance && c.masse, `${s.nom} / ${c.nom}`);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : 69 composantes au total, et toutes les distances sont à moins de 16,3 a.l. (Soleil compris, à 0,000016).
test('69 composantes, toutes à moins de 16,4 a.l.', () => {
  // Le total de composantes.
  assert.equal(countComposantes(), 69);
  // Chaque distance, lue en remplaçant la virgule par un point, est inférieure à 16,4.
  for (const s of SYSTEMES) for (const c of s.composantes) assert.ok(parseFloat(c.distance.replace(',', '.')) < 16.4, c.nom);
// Fin du test.
});

// Test : Alpha Centauri (rang 1) contient Proxima Centauri — le « Proximium » de la théorie.
test('Alpha Centauri (rang 1) contient Proxima Centauri', () => {
  // C'est bien le système rang 1.
  assert.equal(ALPHA_CENTAURI.rang, 1);
  // Proxima Centauri en est la première composante, de masse 0,122 M☉.
  assert.equal(ALPHA_CENTAURI.composantes[0].nom, 'Proxima Centauri (C)');
  assert.equal(ALPHA_CENTAURI.composantes[0].masse, '0,122 M☉');
  // Le système a trois composantes : Proxima, Alpha Centauri A et B.
  assert.equal(ALPHA_CENTAURI.composantes.length, 3);
// Fin du test.
});

// Test : repères de masse du voisinage — Sirius A est la plus lourde avec 2,063 M☉.
test('Sirius A est la composante la plus lourde (2,063 M☉)', () => {
  // Le système Sirius est au rang 7, sa composante A vaut 2,063 M☉.
  const sirius = SYSTEMES.find((s) => s.rang === 7);
  assert.equal(sirius.nom, 'Sirius');
  assert.equal(sirius.composantes[0].masse, '2,063 M☉');
// Fin du test.
});

// Test : 34 systèmes à une seule étoile (aucun problème à 3 corps) et 15 systèmes multiples, sur 49 au total.
test('34 systèmes simples (une seule étoile, pas de problème à 3 corps) et 15 multiples', () => {
  // Les compteurs.
  assert.equal(countMonoEtoiles(), 34);
  assert.equal(countMultiples(), 15);
  // La somme fait bien les 49 systèmes, et chaque système est compté une seule fois.
  assert.equal(countMonoEtoiles() + countMultiples(), countSystemes());
  // Un système simple n'a qu'une composante ; un multiple en a au moins deux.
  for (const s of SYSTEMES) assert.equal(s.composantes.length === 1, s.composantes.length < 2);
// Fin du test.
});
