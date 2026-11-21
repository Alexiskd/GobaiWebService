// Tests de l'échelle complète de la matière (echelleMatiere.js) : les neuf niveaux et leurs calculs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALOGIES, ECHELONS, GROUPES, NIVEAUX, densiteCritique, dispersionAnalogie, etendue, masseSphere, masseUnivers, placeSurEchelle, repere } from './echelleMatiere.js';

test('neuf niveaux, numérotés de 1 à 9, en trois groupes de trois', () => {
  assert.deepEqual(NIVEAUX.map((n) => n.rang), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(GROUPES.map((g) => g.id), ['atomique', 'matiere', 'cosmique']);
  for (const g of GROUPES) assert.equal(NIVEAUX.filter((n) => n.groupe === g.id).length, 3, g.id);
});

test('l’analogie cosmique porte sur les niveaux 1 à 3 : astres, système solaire, constellation', () => {
  assert.deepEqual(NIVEAUX.filter((n) => n.cosmique).map((n) => n.rang), [1, 2, 3]);
  assert.match(NIVEAUX[0].cosmique, /Planètes et étoiles/);
  assert.match(NIVEAUX[1].cosmique, /Système solaire/);
  assert.match(NIVEAUX[2].cosmique, /Constellation/);
});

test('la matière se sépare en branche inerte et branche vivante aux niveaux 5 et 6', () => {
  assert.deepEqual(NIVEAUX.filter((n) => n.branches).map((n) => n.rang), [5, 6]);
  for (const n of NIVEAUX.filter((x) => x.branches)) assert.deepEqual(n.branches.map((b) => b.branche), ['inerte', 'vivante']);
});

test('chaque niveau est plus grand et plus lourd que le précédent', () => {
  for (let i = 1; i < ECHELONS.length; i += 1) {
    assert.ok(ECHELONS[i].taille > ECHELONS[i - 1].taille, ECHELONS[i].nom);
    assert.ok(ECHELONS[i].masse >= ECHELONS[i - 1].masse, ECHELONS[i].nom);
    assert.ok(Math.abs(ECHELONS[i].saut - Math.log10(ECHELONS[i].facteur)) < 1e-12);
  }
  assert.equal(ECHELONS[0].facteur, null);
});

test('tous les objets ont une taille, une masse et une formule', () => {
  const objets = NIVEAUX.flatMap((n) => [n.reference, n.analogie, ...(n.branches || [])]).filter(Boolean);
  for (const o of objets) assert.ok(o.nom && o.calcul && o.taille > 0 && o.masse > 0 && Number.isFinite(o.taille * o.masse), o.nom);
  assert.equal(repere(NIVEAUX[4]).branche, 'inerte');
});

test('ordres de grandeur : atome ≈ 10⁻¹⁰ m, cellule ≈ 10⁻¹² kg, Terre ≈ 6 × 10²⁴ kg, Univers ≈ 10⁵³ kg', () => {
  assert.ok(Math.abs(ECHELONS[1].taille - 1.058e-10) < 1e-12);
  const cellule = NIVEAUX[4].branches[1];
  assert.ok(cellule.masse > 1e-12 && cellule.masse < 3e-12, cellule.masse);
  assert.ok(Math.abs(masseSphere(1, 1000) - 523.6) < 0.1);
  assert.ok(Math.abs(ECHELONS[6].masse / 5.9724e24 - 1) < 1e-9);
  assert.ok(densiteCritique() > 8.4e-27 && densiteCritique() < 8.7e-27, densiteCritique());
  assert.ok(masseUnivers() > 1e53 && masseUnivers() < 2e53, masseUnivers());
});

test('l’échelle couvre environ 42 ordres de grandeur en taille et 80 en masse ; l’humain est avant le milieu', () => {
  const e = etendue();
  assert.ok(e.taille > 41 && e.taille < 43, e.taille);
  assert.ok(e.masse > 79 && e.masse < 81, e.masse);
  assert.equal(placeSurEchelle(ECHELONS[0].taille), 0);
  assert.ok(Math.abs(placeSurEchelle(ECHELONS[8].taille) - 1) < 1e-12);
  assert.ok(placeSurEchelle(1.7) > 0.3 && placeSurEchelle(1.7) < 0.4);
});

test('analogie : même facteur de masse pour le proton et l’atome, facteurs de taille très différents', () => {
  assert.equal(ANALOGIES.length, 3);
  assert.ok(Math.abs(ANALOGIES[0].facteurMasse / ANALOGIES[1].facteurMasse - 1) < 0.01);
  assert.ok(ANALOGIES[0].facteurMasse > 1.1e57 && ANALOGIES[0].facteurMasse < 1.3e57);
  assert.ok(dispersionAnalogie() > 1000);
});
